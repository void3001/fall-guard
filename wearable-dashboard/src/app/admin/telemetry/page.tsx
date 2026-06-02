'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, RefreshCw, Radio, Flame, AlertOctagon, ShieldCheck } from 'lucide-react';

interface TRow {
  device_id: string; rfid?: string; worker_name?: string; timestamp: number;
  bpm?: number; spo2?: number; temperature?: number; humidity?: number;
  gas_ppm?: number; smoke_detected?: number; sound_db?: number;
  battery_pct?: number; altitude_m?: number; sos_pressed?: number; wifi_rssi?: number;
}

function status(value: number | undefined, warn: number, crit: number, dir: 'high' | 'low' = 'high') {
  if (value === undefined || value === null) return 'default';
  if (dir === 'high') {
    if (value >= crit) return 'crit';
    if (value >= warn) return 'warn';
  } else {
    if (value <= crit) return 'crit';
    if (value <= warn) return 'warn';
  }
  return 'ok';
}

function Cell({ value, unit, st }: { value?: number | string; unit?: string; st: string }) {
  const color = st === 'crit' ? 'var(--danger)' : st === 'warn' ? 'var(--warning)' : st === 'ok' ? 'var(--primary)' : 'var(--muted)';
  return (
    <td style={{ color, fontWeight: st !== 'default' ? 600 : 400 }}>
      {value !== undefined && value !== null ? `${value}${unit || ''}` : '—'}
    </td>
  );
}

export default function TelemetryPage() {
  const [rows, setRows] = useState<TRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/telemetry');
    if (res.ok) { const d = await res.json(); setRows(d.telemetry || []); }
    setLastUpdate(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    fetch_();
    const socket: Socket = io({ path: '/api/socket' });
    socket.on('telemetry-update', fetch_);
    return () => { socket.disconnect(); };
  }, [fetch_]);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Live Telemetry Feed</div>
          <div className="topbar-subtitle">Real-time sensor data from all active ESP32 devices · {lastUpdate}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetch_} id="refresh-telemetry"><RefreshCw size={13} /> Refresh</button>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Activity size={16} style={{ color: 'var(--primary)' }} /> All Device Readings</div>
            <span className="badge badge-green">{rows.length} device{rows.length !== 1 ? 's' : ''}</span>
          </div>
          {rows.length === 0 ? (
            <div className="empty-state">
              <Radio size={36} style={{ color: 'var(--muted)', marginBottom: 12 }} />
              <div className="empty-state-title">No Data Yet</div>
              <div className="empty-state-sub">Waiting for ESP32 to POST data to /api/data/ingest</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Worker / Device</th>
                    <th>BPM</th>
                    <th>SpO2 %</th>
                    <th>Temp °C</th>
                    <th>Humidity %</th>
                    <th>Gas PPM</th>
                    <th>Smoke</th>
                    <th>Sound dB</th>
                    <th>Altitude m</th>
                    <th>Battery %</th>
                    <th>RSSI</th>
                    <th>SOS</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.device_id} id={`row-${r.device_id}`}>
                      <td><span className="status-dot online" /></td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.worker_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.device_id}</div>
                      </td>
                      <Cell value={r.bpm} st={status(r.bpm, 60, 40, 'low') === 'default' ? status(r.bpm, 120, 150) : status(r.bpm, 60, 40, 'low')} />
                      <Cell value={r.spo2} unit="%" st={status(r.spo2, 95, 90, 'low')} />
                      <Cell value={r.temperature != null ? +r.temperature.toFixed(1) : undefined} unit="°C" st={status(r.temperature, 38, 46)} />
                      <Cell value={r.humidity != null ? +r.humidity.toFixed(0) : undefined} unit="%" st={status(r.humidity, 85, 95)} />
                      <Cell value={r.gas_ppm != null ? +r.gas_ppm.toFixed(1) : undefined} st={status(r.gas_ppm, 50, 200)} />
                      <td>{r.smoke_detected
                        ? <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Flame size={11} /> Smoke</span>
                        : <span className="badge badge-green">Clear</span>}
                      </td>
                      <Cell value={r.sound_db != null ? +r.sound_db.toFixed(0) : undefined} unit=" dB" st={status(r.sound_db, 85, 115)} />
                      <Cell value={r.altitude_m != null ? +r.altitude_m.toFixed(1) : undefined} unit=" m" st="default" />
                      <td>
                        {r.battery_pct !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="progress" style={{ width: 60 }}>
                              <div className={`progress-bar ${r.battery_pct < 10 ? 'red' : r.battery_pct < 20 ? 'yellow' : 'green'}`} style={{ width: `${r.battery_pct}%` }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{r.battery_pct}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.wifi_rssi ? `${r.wifi_rssi} dBm` : '—'}</td>
                      <td>
                        {r.sos_pressed
                          ? <span className="badge badge-red" style={{ display: 'flex', alignItems: 'center', gap: 4, animation: 'flash-bg 1s infinite' }}><AlertOctagon size={11} /> SOS!</span>
                          : <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={11} /> OK</span>}
                      </td>
                      <td style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {new Date(r.timestamp * 1000).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
