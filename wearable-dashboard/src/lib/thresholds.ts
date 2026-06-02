import { TelemetryRow, AlertRow } from './db';

// ─── Safety Thresholds ────────────────────────────────────────────────────────
// Based on OSHA/NIOSH industrial safety standards

export const THRESHOLDS = {
  // Heart Rate (MAX30102) — BPM
  BPM_LOW_WARNING:      60,
  BPM_LOW_CRITICAL:     40,
  BPM_HIGH_WARNING:    120,
  BPM_HIGH_CRITICAL:   150,

  // Blood Oxygen (MAX30102) — SpO2 %
  SPO2_WARNING:         95,
  SPO2_CRITICAL:        90,

  // Temperature (DHT11/22) — °C
  TEMP_WARNING:         38,
  TEMP_CRITICAL:        46,

  // Humidity (DHT11/22) — %
  HUMIDITY_WARNING:     85,
  HUMIDITY_CRITICAL:    95,

  // Gas (MQ-135/MQ-2) — PPM (CO equivalent)
  GAS_PPM_WARNING:      50,   // OSHA PEL for CO
  GAS_PPM_CRITICAL:    200,   // IDLH threshold

  // Sound (KY-038/MAX4466) — dB
  SOUND_DB_WARNING:     85,   // OSHA 8-hr TWA
  SOUND_DB_CRITICAL:   115,   // Immediate danger

  // Accelerometer spike (MPU6050) — g-force
  ACCEL_SPIKE_WARNING:   2.0,
  ACCEL_SPIKE_CRITICAL:  3.0,

  // Pressure change rate (BMP180) — hPa per second
  PRESSURE_DROP_WARNING:  3.0,
  PRESSURE_DROP_CRITICAL: 5.0,

  // Battery (TP4056) — %
  BATTERY_WARNING:  20,
  BATTERY_CRITICAL: 10,
};

interface CheckResult {
  triggered: boolean;
  alerts: Omit<AlertRow, 'timestamp' | 'email_sent'>[];
}

let previousPressure: Record<string, { value: number; time: number }> = {};
let previousAccel: Record<string, { x: number; y: number; z: number; time: number }> = {};

export function checkThresholds(row: TelemetryRow): CheckResult {
  const alerts: Omit<AlertRow, 'timestamp' | 'email_sent'>[] = [];
  const { device_id, rfid } = row;

  // ── SOS ──────────────────────────────────────────────────────────────────
  if (row.sos_pressed) {
    alerts.push({
      device_id, rfid,
      type: 'SOS',
      severity: 'CRITICAL',
      message: `SOS button pressed by worker on device ${device_id}`,
      value: 1,
      threshold: 0,
    });
  }

  // ── Heart Rate ────────────────────────────────────────────────────────────
  if (row.bpm !== undefined && row.bpm !== null) {
    if (row.bpm < THRESHOLDS.BPM_LOW_CRITICAL || row.bpm > THRESHOLDS.BPM_HIGH_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'HEART_RATE',
        severity: 'CRITICAL',
        message: `Critical heart rate: ${row.bpm} BPM (normal: 60–120 BPM)`,
        value: row.bpm,
        threshold: row.bpm < THRESHOLDS.BPM_LOW_CRITICAL ? THRESHOLDS.BPM_LOW_CRITICAL : THRESHOLDS.BPM_HIGH_CRITICAL,
      });
    } else if (row.bpm < THRESHOLDS.BPM_LOW_WARNING || row.bpm > THRESHOLDS.BPM_HIGH_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'HEART_RATE',
        severity: 'WARNING',
        message: `Abnormal heart rate: ${row.bpm} BPM`,
        value: row.bpm,
        threshold: row.bpm < THRESHOLDS.BPM_LOW_WARNING ? THRESHOLDS.BPM_LOW_WARNING : THRESHOLDS.BPM_HIGH_WARNING,
      });
    }
  }

  // ── SpO2 ──────────────────────────────────────────────────────────────────
  if (row.spo2 !== undefined && row.spo2 !== null) {
    if (row.spo2 < THRESHOLDS.SPO2_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'SPO2',
        severity: 'CRITICAL',
        message: `Critical oxygen level: ${row.spo2}% SpO2 (normal: ≥95%)`,
        value: row.spo2,
        threshold: THRESHOLDS.SPO2_CRITICAL,
      });
    } else if (row.spo2 < THRESHOLDS.SPO2_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'SPO2',
        severity: 'WARNING',
        message: `Low oxygen level: ${row.spo2}% SpO2`,
        value: row.spo2,
        threshold: THRESHOLDS.SPO2_WARNING,
      });
    }
  }

  // ── Temperature ───────────────────────────────────────────────────────────
  if (row.temperature !== undefined && row.temperature !== null) {
    if (row.temperature > THRESHOLDS.TEMP_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'TEMPERATURE',
        severity: 'CRITICAL',
        message: `Extreme heat risk: ${row.temperature.toFixed(1)}°C — Heat stroke danger!`,
        value: row.temperature,
        threshold: THRESHOLDS.TEMP_CRITICAL,
      });
    } else if (row.temperature > THRESHOLDS.TEMP_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'TEMPERATURE',
        severity: 'WARNING',
        message: `High temperature: ${row.temperature.toFixed(1)}°C — Heat stroke risk`,
        value: row.temperature,
        threshold: THRESHOLDS.TEMP_WARNING,
      });
    }
  }

  // ── Gas / Air Quality ─────────────────────────────────────────────────────
  if (row.gas_ppm !== undefined && row.gas_ppm !== null) {
    if (row.gas_ppm > THRESHOLDS.GAS_PPM_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'GAS',
        severity: 'CRITICAL',
        message: `DANGEROUS gas level: ${row.gas_ppm.toFixed(0)} PPM — EVACUATE IMMEDIATELY!`,
        value: row.gas_ppm,
        threshold: THRESHOLDS.GAS_PPM_CRITICAL,
      });
    } else if (row.gas_ppm > THRESHOLDS.GAS_PPM_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'GAS',
        severity: 'WARNING',
        message: `Elevated gas level: ${row.gas_ppm.toFixed(0)} PPM (OSHA limit: 50 PPM)`,
        value: row.gas_ppm,
        threshold: THRESHOLDS.GAS_PPM_WARNING,
      });
    }
  }

  if (row.smoke_detected) {
    alerts.push({
      device_id, rfid,
      type: 'SMOKE',
      severity: 'CRITICAL',
      message: `Smoke detected on device ${device_id}!`,
      value: 1,
      threshold: 0,
    });
  }

  // ── Noise / Sound ─────────────────────────────────────────────────────────
  if (row.sound_db !== undefined && row.sound_db !== null) {
    if (row.sound_db > THRESHOLDS.SOUND_DB_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'SOUND',
        severity: 'CRITICAL',
        message: `Explosive noise: ${row.sound_db.toFixed(0)} dB — Acoustic trauma risk!`,
        value: row.sound_db,
        threshold: THRESHOLDS.SOUND_DB_CRITICAL,
      });
    } else if (row.sound_db > THRESHOLDS.SOUND_DB_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'SOUND',
        severity: 'WARNING',
        message: `High noise: ${row.sound_db.toFixed(0)} dB — hearing protection required (OSHA: 85 dB)`,
        value: row.sound_db,
        threshold: THRESHOLDS.SOUND_DB_WARNING,
      });
    }
  }

  // ── Fall Detection (Acceleration spike) ───────────────────────────────────
  if (row.accel_x !== undefined && row.accel_y !== undefined && row.accel_z !== undefined) {
    const magnitude = Math.sqrt(
      (row.accel_x ?? 0) ** 2 +
      (row.accel_y ?? 0) ** 2 +
      (row.accel_z ?? 0) ** 2
    );
    // Subtract 1g (gravity) — net acceleration
    const netG = Math.abs(magnitude - 9.81) / 9.81;

    if (netG > THRESHOLDS.ACCEL_SPIKE_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'FALL',
        severity: 'CRITICAL',
        message: `FALL DETECTED on device ${device_id}! Acceleration: ${netG.toFixed(2)}g`,
        value: netG,
        threshold: THRESHOLDS.ACCEL_SPIKE_CRITICAL,
      });
    } else if (netG > THRESHOLDS.ACCEL_SPIKE_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'FALL',
        severity: 'WARNING',
        message: `Impact detected: ${netG.toFixed(2)}g on device ${device_id}`,
        value: netG,
        threshold: THRESHOLDS.ACCEL_SPIKE_WARNING,
      });
    }
    previousAccel[device_id] = { x: row.accel_x ?? 0, y: row.accel_y ?? 0, z: row.accel_z ?? 0, time: row.timestamp };
  }

  // ── Pressure / Altitude drop (BMP180) ────────────────────────────────────
  if (row.pressure_hpa !== undefined && row.pressure_hpa !== null) {
    const prev = previousPressure[device_id];
    if (prev) {
      const dt = row.timestamp - prev.time;
      if (dt > 0 && dt < 10) { // Only check if within 10 seconds
        const dropRate = (prev.value - row.pressure_hpa) / dt;
        if (dropRate > THRESHOLDS.PRESSURE_DROP_CRITICAL) {
          alerts.push({
            device_id, rfid,
            type: 'PRESSURE_DROP',
            severity: 'CRITICAL',
            message: `Rapid pressure drop: ${dropRate.toFixed(2)} hPa/s — possible fall from height`,
            value: dropRate,
            threshold: THRESHOLDS.PRESSURE_DROP_CRITICAL,
          });
        } else if (dropRate > THRESHOLDS.PRESSURE_DROP_WARNING) {
          alerts.push({
            device_id, rfid,
            type: 'PRESSURE_DROP',
            severity: 'WARNING',
            message: `Pressure drop detected: ${dropRate.toFixed(2)} hPa/s`,
            value: dropRate,
            threshold: THRESHOLDS.PRESSURE_DROP_WARNING,
          });
        }
      }
    }
    previousPressure[device_id] = { value: row.pressure_hpa, time: row.timestamp };
  }

  // ── Battery ───────────────────────────────────────────────────────────────
  if (row.battery_pct !== undefined && row.battery_pct !== null) {
    if (row.battery_pct < THRESHOLDS.BATTERY_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'BATTERY',
        severity: 'CRITICAL',
        message: `Critical battery on ${device_id}: ${row.battery_pct}% — device may shut off!`,
        value: row.battery_pct,
        threshold: THRESHOLDS.BATTERY_CRITICAL,
      });
    } else if (row.battery_pct < THRESHOLDS.BATTERY_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'BATTERY',
        severity: 'WARNING',
        message: `Low battery on ${device_id}: ${row.battery_pct}%`,
        value: row.battery_pct,
        threshold: THRESHOLDS.BATTERY_WARNING,
      });
    }
  }

  // ── Humidity ──────────────────────────────────────────────────────────────
  if (row.humidity !== undefined && row.humidity !== null) {
    if (row.humidity > THRESHOLDS.HUMIDITY_CRITICAL) {
      alerts.push({
        device_id, rfid,
        type: 'HUMIDITY',
        severity: 'CRITICAL',
        message: `Extreme humidity: ${row.humidity.toFixed(0)}% — severe heat stress risk`,
        value: row.humidity,
        threshold: THRESHOLDS.HUMIDITY_CRITICAL,
      });
    } else if (row.humidity > THRESHOLDS.HUMIDITY_WARNING) {
      alerts.push({
        device_id, rfid,
        type: 'HUMIDITY',
        severity: 'WARNING',
        message: `High humidity: ${row.humidity.toFixed(0)}%`,
        value: row.humidity,
        threshold: THRESHOLDS.HUMIDITY_WARNING,
      });
    }
  }

  return { triggered: alerts.length > 0, alerts };
}
