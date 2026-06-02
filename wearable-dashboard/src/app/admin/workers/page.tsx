'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, MapPin, RefreshCw, Heart, Wind, Thermometer, HardHat, MoveVertical, AlertTriangle, Map } from 'lucide-react';

interface TRow {
  device_id: string; rfid?: string; worker_name?: string;
  bpm?: number; spo2?: number; temperature?: number; gas_ppm?: number;
  battery_pct?: number; wifi_rssi?: number; timestamp: number; altitude_m?: number;
}

function zone(rssi?: number) {
  if (!rssi) return 'Unknown Zone';
  if (rssi > -50) return 'Zone A (close to AP)';
  if (rssi > -70) return 'Zone B';
  if (rssi > -85) return 'Zone C (far from AP)';
  return 'Zone D (low signal)';
}

function safetyStatus(row: TRow): { label: string; color: string } {
  if (!row.bpm) return { label: 'No Data', color: 'var(--muted)' };
  if (row.bpm < 40 || row.bpm > 150 || (row.spo2 && row.spo2 < 90) || (row.gas_ppm && row.gas_ppm > 200)) {
    return { label: 'CRITICAL', color: 'var(--danger)' };
  }
  if (row.bpm < 60 || row.bpm > 120 || (row.spo2 && row.spo2 < 95) || (row.gas_ppm && row.gas_ppm > 50)) {
    return { label: 'WARNING', color: 'var(--warning)' };
  }
  return { label: 'Safe', color: 'var(--primary)' };
}

export default function WorkersMapPage() {
  const [workers, setWorkers] = useState<TRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/telemetry');
    if (res.ok) { const d = await res.json(); setWorkers(d.telemetry || []); }
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
          <div className="topbar-title">Live Operations Map</div>
          <div className="topbar-subtitle">All active workers, zones, and safety status · {lastUpdate}</div>
        </div>
        <button id="refresh-workers" className="btn btn-outline btn-sm" onClick={fetch_}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="page-body">
        {workers.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 80 }}>
            <Map size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No Active Workers</div>
            <div className="empty-state-sub">Workers appear here when their ESP32 device sends telemetry data</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={13} />
              Zone is inferred from Wi-Fi signal strength (RSSI). RFID checkpoints override this when available.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {workers.map(w => {
                const sts = safetyStatus(w);
                return (
                  <div key={w.device_id} id={`worker-${w.device_id}`} className="card">
                    <div className="card-header">
                      <div className="card-title" style={{ gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--primary-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <HardHat size={18} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{w.worker_name || 'Unknown Worker'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>{w.device_id} · {w.rfid || 'No RFID'}</div>
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12, color: sts.color }}>{sts.label}</span>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                          <MapPin size={13} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{zone(w.wifi_rssi)}</span>
                          {w.wifi_rssi && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{w.wifi_rssi} dBm</span>}
                        </div>
                        {w.altitude_m !== undefined && (
                          <div style={{ fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MoveVertical size={13} />
                            Altitude: <strong style={{ color: 'var(--text)' }}>{w.altitude_m.toFixed(1)} m</strong>
                            {w.altitude_m > 4 && (
                              <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <AlertTriangle size={11} /> Height risk
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                          {[
                            { Icon: Heart, label: 'BPM', value: w.bpm, color: 'var(--danger)' },
                            { Icon: Wind, label: 'SpO2', value: w.spo2 ? `${w.spo2}%` : undefined, color: 'var(--info)' },
                            { Icon: Thermometer, label: 'Temp', value: w.temperature ? `${w.temperature.toFixed(0)}°C` : undefined, color: 'var(--warning)' },
                          ].map(({ Icon, label, value, color }) => (
                            <div key={label} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}>
                              <Icon size={13} style={{ color, marginBottom: 3 }} />
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value ?? '—'}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right', marginTop: 2 }}>
                          Last seen: {new Date(w.timestamp * 1000).toLocaleTimeString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
