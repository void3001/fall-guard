'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Users, BellRing, Activity, Cpu, RefreshCw, CheckCircle, Radio, Battery, Mail } from 'lucide-react';

interface AlertItem {
  id: number;
  device_id: string;
  rfid?: string;
  worker_name?: string;
  type: string;
  severity: string;
  message: string;
  value?: number;
  threshold?: number;
  timestamp: number;
  acknowledged: number;
  email_sent: number;
}

interface TelemetryRow { device_id: string; bpm?: number; spo2?: number; battery_pct?: number; worker_name?: string; timestamp: number; }

function fmt(ts: number) { return new Date(ts * 1000).toLocaleTimeString('en-IN'); }
function fmtDate(ts: number) { return new Date(ts * 1000).toLocaleString('en-IN'); }

export default function AdminDashboardPage() {
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('—');

  const fetchData = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      fetch('/api/telemetry'),
      fetch('/api/alerts?active=true&limit=20'),
    ]);
    if (tRes.ok) { const d = await tRes.json(); setTelemetry(d.telemetry || []); }
    if (aRes.ok) { const d = await aRes.json(); setAlerts(d.alerts || []); }
    setLastUpdate(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    fetchData();
    const socket: Socket = io({ path: '/api/socket' });
    socket.on('telemetry-update', () => fetchData());
    socket.on('alert-triggered', () => fetchData());
    return () => { socket.disconnect(); };
  }, [fetchData]);

  async function ackAlert(id: number) {
    await fetch(`/api/alerts/${id}/ack`, { method: 'PATCH' });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  const avgBpm = telemetry.length ? Math.round(telemetry.reduce((s, t) => s + (t.bpm || 0), 0) / telemetry.filter(t => t.bpm).length) : null;
  const avgSpo2 = telemetry.length ? Math.round(telemetry.reduce((s, t) => s + (t.spo2 || 0), 0) / telemetry.filter(t => t.spo2).length) : null;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Safety Overview</div>
          <div className="topbar-subtitle">Last updated: {lastUpdate}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchData} id="refresh-btn">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Critical alert banner */}
        {criticalAlerts.length > 0 && (
          <div className="alert-banner" id="critical-banner">
            <BellRing size={20} />
            <span>{criticalAlerts.length} CRITICAL alert{criticalAlerts.length > 1 ? 's' : ''} require immediate attention!</span>
          </div>
        )}

        {/* Stat cards */}
        <div className="stat-grid mb-24">
          <div className="stat-card">
            <div className="stat-icon green"><Users size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Active Workers</div>
              <div className="stat-value">{telemetry.length}</div>
              <div className="stat-sub">devices online</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><BellRing size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Active Alerts</div>
              <div className="stat-value" style={{ color: alerts.length > 0 ? 'var(--danger)' : undefined }}>{alerts.length}</div>
              <div className="stat-sub">{criticalAlerts.length} critical</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><Activity size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Avg Heart Rate</div>
              <div className="stat-value">{avgBpm ?? '—'}</div>
              <div className="stat-sub">BPM across fleet</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Cpu size={22} /></div>
            <div className="stat-body">
              <div className="stat-label">Avg SpO2</div>
              <div className="stat-value">{avgSpo2 ? `${avgSpo2}%` : '—'}</div>
              <div className="stat-sub">blood oxygen level</div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Active Alerts panel */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><BellRing size={16} style={{ color: 'var(--danger)' }} /> Active Alerts</div>
              <span className="badge badge-red">{alerts.length}</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={36} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                  <div className="empty-state-title">All Clear</div>
                  <div className="empty-state-sub">No active alerts. Workers are safe.</div>
                </div>
              ) : (
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.map(a => (
                    <div key={a.id} className={`alert-item ${a.severity.toLowerCase()}`} id={`alert-${a.id}`}>
                      <div className="alert-item-body">
                        <div className="alert-item-msg">{a.message}</div>
                        <div className="alert-item-meta">
                          <span>{a.worker_name || a.device_id}</span>
                          <span>{fmtDate(a.timestamp)}</span>
                          {a.email_sent ? (
                            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Mail size={11} /> emailed
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        id={`ack-${a.id}`}
                        className="btn btn-sm btn-outline"
                        onClick={() => ackAlert(a.id)}
                        title="Acknowledge"
                      >
                        <CheckCircle size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live worker status */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><Users size={16} style={{ color: 'var(--primary)' }} /> Live Worker Status</div>
            </div>
            {telemetry.length === 0 ? (
              <div className="empty-state">
                <Radio size={36} style={{ color: 'var(--muted)', marginBottom: 12 }} />
                <div className="empty-state-title">Waiting for ESP32</div>
                <div className="empty-state-sub">No data received yet. Connect your hardware.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>BPM</th>
                      <th>SpO2</th>
                      <th>Battery</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {telemetry.map(t => (
                      <tr key={t.device_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="status-dot online" />
                            <span style={{ fontWeight: 600 }}>{t.worker_name || t.device_id}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ color: !t.bpm || t.bpm < 40 || t.bpm > 150 ? 'var(--danger)' : t.bpm < 60 || t.bpm > 120 ? 'var(--warning)' : 'var(--primary)' }}>
                            {t.bpm ?? '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: !t.spo2 ? undefined : t.spo2 < 90 ? 'var(--danger)' : t.spo2 < 95 ? 'var(--warning)' : 'var(--primary)' }}>
                            {t.spo2 ? `${t.spo2}%` : '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div className="progress" style={{ flex: 1 }}>
                              <div
                                className={`progress-bar ${!t.battery_pct ? 'gray' : t.battery_pct < 10 ? 'red' : t.battery_pct < 20 ? 'yellow' : 'green'}`}
                                style={{ width: `${t.battery_pct ?? 0}%` }}
                              />
                            </div>
                            <Battery size={13} style={{ color: !t.battery_pct ? 'var(--muted)' : t.battery_pct < 10 ? 'var(--danger)' : t.battery_pct < 20 ? 'var(--warning)' : 'var(--primary)' }} />
                            <span style={{ fontSize: 12, minWidth: 32 }}>{t.battery_pct ? `${t.battery_pct}%` : '—'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt(t.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
