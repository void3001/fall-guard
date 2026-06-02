'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Cpu, RefreshCw, Wifi, WifiOff, Battery, BatteryLow, Radio, AlertTriangle, Zap } from 'lucide-react';

interface Device {
  device_id: string; rfid?: string; worker_name?: string;
  battery_pct?: number; last_seen?: number; status: string;
  ip_address?: string; wifi_rssi?: number;
}

function batteryColor(pct?: number) {
  if (!pct) return 'gray';
  if (pct < 10) return 'red';
  if (pct < 20) return 'yellow';
  return 'green';
}

function batteryIconColor(pct?: number) {
  if (!pct) return 'var(--muted)';
  if (pct < 10) return 'var(--danger)';
  if (pct < 20) return 'var(--warning)';
  return 'var(--primary)';
}

function timeSince(ts?: number) {
  if (!ts) return 'Never';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/devices');
    if (res.ok) { const d = await res.json(); setDevices(d.devices || []); }
    setLastUpdate(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 15000);
    const socket: Socket = io({ path: '/api/socket' });
    socket.on('telemetry-update', fetch_);
    return () => { clearInterval(interval); socket.disconnect(); };
  }, [fetch_]);

  const online = devices.filter(d => d.status === 'online').length;
  const critical = devices.filter(d => (d.battery_pct ?? 100) < 10).length;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Device Management</div>
          <div className="topbar-subtitle">{online}/{devices.length} devices online · {lastUpdate}</div>
        </div>
        <button id="refresh-devices" className="btn btn-outline btn-sm" onClick={fetch_}><RefreshCw size={13} /> Refresh</button>
      </div>

      <div className="page-body">
        <div className="stat-grid mb-24">
          <div className="stat-card">
            <div className="stat-icon green"><Cpu size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Total Devices</div>
              <div className="stat-value">{devices.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Wifi size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Online</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{online}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><WifiOff size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Offline</div>
              <div className="stat-value">{devices.length - online}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><BatteryLow size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Critical Battery</div>
              <div className="stat-value" style={{ color: critical > 0 ? 'var(--danger)' : undefined }}>{critical}</div>
            </div>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 80 }}>
            <Radio size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No Devices Registered</div>
            <div className="empty-state-sub">Devices appear here automatically when they send data to /api/data/ingest</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {devices.map(d => (
              <div key={d.device_id} id={`device-${d.device_id}`} className="card">
                <div className="card-header">
                  <div className="card-title">
                    <span className={`status-dot ${d.status}`} />
                    <Cpu size={15} style={{ color: 'var(--primary)' }} />
                    {d.device_id}
                  </div>
                  <span className={`badge ${d.status === 'online' ? 'badge-green' : 'badge-gray'}`}>
                    {d.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      ['Worker', d.worker_name || d.rfid || '— unassigned'],
                      ['IP Address', d.ip_address || '—'],
                      ['Wi-Fi RSSI', d.wifi_rssi ? `${d.wifi_rssi} dBm` : '—'],
                      ['Last Seen', timeSince(d.last_seen)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--muted)' }}>{label}</span>
                        <span style={{ fontWeight: 600, fontFamily: label === 'IP Address' ? 'monospace' : undefined, fontSize: label === 'IP Address' ? 12 : undefined }}>{value}</span>
                      </div>
                    ))}

                    {/* Battery */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                          <Battery size={13} /> Battery
                        </span>
                        <span style={{ fontWeight: 700, color: batteryIconColor(d.battery_pct) }}>
                          {d.battery_pct !== undefined ? `${d.battery_pct}%` : '—'}
                        </span>
                      </div>
                      <div className="progress">
                        <div className={`progress-bar ${batteryColor(d.battery_pct)}`} style={{ width: `${d.battery_pct ?? 0}%` }} />
                      </div>
                      {d.battery_pct !== undefined && d.battery_pct < 10 && (
                        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={11} /> Critical — replace immediately
                        </div>
                      )}
                      {d.battery_pct !== undefined && d.battery_pct >= 10 && d.battery_pct < 20 && (
                        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Zap size={11} /> Low battery warning
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
