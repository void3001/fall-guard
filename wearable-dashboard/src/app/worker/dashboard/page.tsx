'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Heart, Wind, Thermometer, Droplets, Volume2, Gauge,
  MoveVertical, Radio, CheckCircle, BellRing, AlertOctagon,
  Flame, ShieldCheck, ShieldAlert, Battery,
} from 'lucide-react';

interface TRow {
  device_id: string; rfid?: string; worker_name?: string;
  bpm?: number; spo2?: number; temperature?: number; humidity?: number;
  gas_ppm?: number; smoke_detected?: number; sound_db?: number;
  battery_pct?: number; altitude_m?: number; sos_pressed?: number;
  pressure_hpa?: number; timestamp?: number;
}

interface AlertItem { id: number; type: string; severity: string; message: string; timestamp: number; acknowledged: number; }

function vStatus(v: number | undefined, warn: number, crit: number, dir: 'hi' | 'lo' = 'hi'): 'ok' | 'warn' | 'crit' | 'na' {
  if (v === undefined || v === null) return 'na';
  if (dir === 'hi') { if (v >= crit) return 'crit'; if (v >= warn) return 'warn'; return 'ok'; }
  else { if (v <= crit) return 'crit'; if (v <= warn) return 'warn'; return 'ok'; }
}

function VitalCard({
  icon, label, value, unit, status
}: {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  unit?: string;
  status: 'ok' | 'warn' | 'crit' | 'na';
}) {
  const color = status === 'crit' ? 'var(--danger)' : status === 'warn' ? 'var(--warning)' : status === 'ok' ? 'var(--primary)' : 'var(--muted)';
  return (
    <div className="vital-card">
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div className="vital-label">{label}</div>
        <div className="vital-value" style={{ color }}>
          {value !== undefined && value !== null ? `${value}${unit || ''}` : '—'}
        </div>
        <span className={`vital-status ${status}`}>
          {status === 'ok' ? 'Normal' : status === 'warn' ? 'Warning' : status === 'crit' ? 'Critical' : 'No Data'}
        </span>
      </div>
    </div>
  );
}

export default function WorkerDashboardPage() {
  const [data, setData] = useState<TRow | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetch_ = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      fetch('/api/telemetry'),
      fetch('/api/alerts?active=true&limit=10'),
    ]);
    if (tRes.ok) {
      const d = await tRes.json();
      if (d.telemetry?.length > 0) setData(d.telemetry[0]);
    }
    if (aRes.ok) { const d = await aRes.json(); setAlerts(d.alerts || []); }
    setLastUpdate(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    fetch_();
    const socket: Socket = io({ path: '/api/socket' });
    socket.on('telemetry-update', fetch_);
    socket.on('alert-triggered', fetch_);
    return () => { socket.disconnect(); };
  }, [fetch_]);

  const critAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return (
    <div className="worker-page">
      {/* Critical Banner */}
      {critAlerts.length > 0 && (
        <div className="alert-banner" id="worker-critical-banner">
          <AlertOctagon size={18} />
          ALERT: {critAlerts[0].message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            My Safety Dashboard
          </h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {data ? `Device: ${data.device_id} · ${data.worker_name || 'Unknown'}` : 'Waiting for device data...'}
            {' '} · Last updated: {lastUpdate}
          </div>
        </div>
        {data?.battery_pct !== undefined && (
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Battery size={18} style={{ color: data.battery_pct < 10 ? 'var(--danger)' : data.battery_pct < 20 ? 'var(--warning)' : 'var(--primary)' }} />
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 2 }}>Battery</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: data.battery_pct < 10 ? 'var(--danger)' : data.battery_pct < 20 ? 'var(--warning)' : 'var(--primary)' }}>
                {data.battery_pct}%
              </div>
            </div>
          </div>
        )}
      </div>

      {!data ? (
        <div className="empty-state" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 80 }}>
          <Radio size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
          <div className="empty-state-title">No Device Connected</div>
          <div className="empty-state-sub">Your ESP32 wearable is not sending data yet. Ensure it is powered on and connected to Wi-Fi.</div>
        </div>
      ) : (
        <>
          {/* Vitals */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Vitals</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <VitalCard
                icon={<Heart size={24} />} label="Heart Rate" value={data.bpm} unit=" BPM"
                status={vStatus(data.bpm, 60, 40, 'lo') !== 'ok' && vStatus(data.bpm, 60, 40, 'lo') !== 'na'
                  ? vStatus(data.bpm, 60, 40, 'lo')
                  : vStatus(data.bpm, 120, 150)}
              />
              <VitalCard icon={<Wind size={24} />} label="Blood Oxygen (SpO2)" value={data.spo2} unit="%" status={vStatus(data.spo2, 95, 90, 'lo')} />
            </div>
          </div>

          {/* Environment */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Environment</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <VitalCard icon={<Thermometer size={24} />} label="Temperature" value={data.temperature?.toFixed(1)} unit="°C" status={vStatus(data.temperature, 38, 46)} />
              <VitalCard icon={<Droplets size={24} />} label="Humidity" value={data.humidity?.toFixed(0)} unit="%" status={vStatus(data.humidity, 85, 95)} />
              <VitalCard icon={<ShieldAlert size={24} />} label="Gas Level" value={data.gas_ppm?.toFixed(0)} unit=" ppm" status={vStatus(data.gas_ppm, 50, 200)} />
              <VitalCard icon={<Volume2 size={24} />} label="Noise Level" value={data.sound_db?.toFixed(0)} unit=" dB" status={vStatus(data.sound_db, 85, 115)} />
              <VitalCard icon={<Gauge size={24} />} label="Pressure" value={data.pressure_hpa?.toFixed(1)} unit=" hPa" status="ok" />
              <VitalCard icon={<MoveVertical size={24} />} label="Altitude" value={data.altitude_m?.toFixed(1)} unit=" m" status={vStatus(data.altitude_m, 4, 20)} />
            </div>
          </div>

          {/* Status indicators */}
          <div className="grid-2 mb-24">
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              {data.smoke_detected
                ? <Flame size={28} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                : <ShieldCheck size={28} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Smoke / Fire Detector</div>
                <div style={{ fontWeight: 700, color: data.smoke_detected ? 'var(--danger)' : 'var(--primary)' }}>
                  {data.smoke_detected ? 'SMOKE DETECTED!' : 'Clear'}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              {data.sos_pressed
                ? <AlertOctagon size={28} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                : <ShieldCheck size={28} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>SOS Emergency Button</div>
                <div style={{ fontWeight: 700, color: data.sos_pressed ? 'var(--danger)' : 'var(--primary)' }}>
                  {data.sos_pressed ? 'SOS PRESSED!' : 'Not Pressed'}
                </div>
              </div>
            </div>
          </div>

          {/* My Recent Alerts */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><BellRing size={16} style={{ color: 'var(--danger)' }} /> My Recent Alerts</div>
              <span className="badge badge-red">{alerts.length}</span>
            </div>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <CheckCircle size={32} style={{ color: 'var(--primary)', marginBottom: 10 }} />
                <div className="empty-state-title">No Active Alerts</div>
                <div className="empty-state-sub">All systems normal.</div>
              </div>
            ) : (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map(a => (
                  <div key={a.id} id={`worker-alert-${a.id}`} className={`alert-item ${a.severity.toLowerCase()}`}>
                    <div className="alert-item-body">
                      <div className="alert-item-msg">{a.message}</div>
                      <div className="alert-item-meta">
                        <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-red' : 'badge-yellow'}`}>{a.severity}</span>
                        <span>{new Date(a.timestamp * 1000).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
