import { NextRequest, NextResponse } from 'next/server';
import {
  insertTelemetry,
  insertAlert,
  upsertDevice,
  getWorkerByRfid,
  markEmailSent,
  TelemetryRow,
} from '@/lib/db';
import { checkThresholds } from '@/lib/thresholds';
import { sendAlertEmail } from '@/lib/email';
import { emitTelemetry, emitAlert } from '@/lib/socket-server';

export async function POST(req: NextRequest) {
  let body: TelemetryRow;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.device_id) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  // Set timestamp if not provided
  if (!body.timestamp) {
    body.timestamp = Math.floor(Date.now() / 1000);
  }

  // 1. Store telemetry
  try {
    insertTelemetry(body);
  } catch (err) {
    console.error('[ingest] DB insert error:', err);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // 2. Upsert device status
  upsertDevice({
    device_id: body.device_id,
    rfid: body.rfid,
    battery_pct: body.battery_pct,
    last_seen: body.timestamp,
    status: body.is_logging_out ? 'offline' : 'online',
    ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
    wifi_rssi: body.wifi_rssi,
  });

  if (body.is_logging_out) {
    // If the device explicitly logged out, skip anomaly checking and telemetry broadcast
    emitTelemetry({ device_id: body.device_id });
    return NextResponse.json({ success: true, message: 'Logged out' });
  }

  // 3. Check thresholds
  const { triggered, alerts } = checkThresholds(body);

  // 4. Lookup worker name
  let workerName: string | undefined;
  if (body.rfid) {
    const worker = getWorkerByRfid(body.rfid) as { name: string } | undefined;
    workerName = worker?.name;
  }

  // 5. Persist and email alerts
  for (const alertData of alerts) {
    const fullAlert = {
      ...alertData,
      timestamp: body.timestamp,
      email_sent: 0,
    };

    let insertedId: number | undefined;
    try {
      const result = insertAlert(fullAlert);
      insertedId = result.lastInsertRowid as number;
    } catch (err) {
      console.error('[ingest] Alert insert error:', err);
    }

    // Send email for CRITICAL alerts only
    if (alertData.severity === 'CRITICAL') {
      try {
        await sendAlertEmail({
          ...alertData,
          worker_name: workerName,
          timestamp: body.timestamp,
        });
        if (insertedId) markEmailSent(insertedId);
      } catch (err) {
        console.error('[ingest] Email send error:', err);
      }
    }

    // Broadcast via Socket.io
    emitAlert({ ...fullAlert, worker_name: workerName, id: insertedId });
  }

  // 6. Broadcast telemetry update
  emitTelemetry({ ...body, worker_name: workerName });

  return NextResponse.json({
    success: true,
    alerts_triggered: alerts.length,
    critical: alerts.filter((a) => a.severity === 'CRITICAL').length,
  });
}
