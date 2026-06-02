'use client';
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  BellRing, CheckCircle, Filter, RefreshCw,
  AlertOctagon, Heart, Wind, Thermometer, Droplets,
  Volume2, TrendingDown, Battery, Flame, PersonStanding,
  AlertTriangle, ShieldAlert,
} from 'lucide-react';

interface AlertItem {
  id: number; device_id: string; rfid?: string; worker_name?: string;
  type: string; severity: string; message: string;
  value?: number; threshold?: number; timestamp: number;
  acknowledged: number; email_sent: number;
}

function TypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const props = { size, strokeWidth: 2 };
  switch (type) {
    case 'SOS':          return <AlertOctagon {...props} style={{ color: 'var(--danger)' }} />;
    case 'FALL':         return <PersonStanding {...props} style={{ color: 'var(--danger)' }} />;
    case 'HEART_RATE':   return <Heart {...props} style={{ color: 'var(--danger)' }} />;
    case 'SPO2':         return <Wind {...props} style={{ color: 'var(--info)' }} />;
    case 'GAS':          return <ShieldAlert {...props} style={{ color: 'var(--danger)' }} />;
    case 'SMOKE':        return <Flame {...props} style={{ color: 'var(--danger)' }} />;
    case 'TEMPERATURE':  return <Thermometer {...props} style={{ color: 'var(--warning)' }} />;
    case 'HUMIDITY':     return <Droplets {...props} style={{ color: 'var(--info)' }} />;
    case 'SOUND':        return <Volume2 {...props} style={{ color: 'var(--warning)' }} />;
    case 'PRESSURE_DROP':return <TrendingDown {...props} style={{ color: 'var(--warning)' }} />;
    case 'BATTERY':      return <Battery {...props} style={{ color: 'var(--warning)' }} />;
    default:             return <AlertTriangle {...props} style={{ color: 'var(--warning)' }} />;
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'CRITICAL' | 'WARNING' | 'active'>('all');
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetch_ = useCallback(async () => {
    const res = await fetch('/api/alerts?limit=200');
    if (res.ok) { const d = await res.json(); setAlerts(d.alerts || []); }
    setLastUpdate(new Date().toLocaleTimeString('en-IN'));
  }, []);

  useEffect(() => {
    fetch_();
    const socket: Socket = io({ path: '/api/socket' });
    socket.on('alert-triggered', fetch_);
    return () => { socket.disconnect(); };
  }, [fetch_]);

  async function ack(id: number) {
    await fetch(`/api/alerts/${id}/ack`, { method: 'PATCH' });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: 1 } : a));
    if (selected?.id === id) setSelected({ ...selected, acknowledged: 1 });
  }

  const filtered = alerts.filter(a => {
    if (filter === 'CRITICAL') return a.severity === 'CRITICAL';
    if (filter === 'WARNING') return a.severity === 'WARNING';
    if (filter === 'active') return a.acknowledged === 0;
    return true;
  });

  const critCount = alerts.filter(a => a.severity === 'CRITICAL' && !a.acknowledged).length;

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Alert Center</div>
          <div className="topbar-subtitle">All incidents and safety events · {lastUpdate}</div>
        </div>
        <div className="flex-gap">
          {critCount > 0 && <span className="badge badge-red">{critCount} critical unacknowledged</span>}
          <button className="btn btn-outline btn-sm" onClick={fetch_} id="refresh-alerts"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="flex-gap mb-16">
          <Filter size={14} style={{ color: 'var(--muted)' }} />
          {(['all', 'active', 'CRITICAL', 'WARNING'] as const).map(f => (
            <button
              key={f}
              id={`filter-${f.toLowerCase()}`}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Unacknowledged' : f}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{filtered.length} records</span>
        </div>

        <div className="grid-2">
          {/* Alert List */}
          <div className="card" style={{ gridColumn: selected ? undefined : '1 / -1' }}>
            <div className="card-header">
              <div className="card-title">
                <BellRing size={16} style={{ color: 'var(--danger)' }} /> Incident Log
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={40} style={{ color: 'var(--primary)', marginBottom: 12 }} />
                <div className="empty-state-title">No alerts found</div>
                <div className="empty-state-sub">All clear under this filter.</div>
              </div>
            ) : (
              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {filtered.map(a => (
                  <div
                    key={a.id}
                    id={`alert-row-${a.id}`}
                    onClick={() => setSelected(s => s?.id === a.id ? null : a)}
                    style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      background: selected?.id === a.id ? 'var(--surface-2)' : a.acknowledged ? 'transparent' : a.severity === 'CRITICAL' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: a.acknowledged ? 0.6 : 1,
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <TypeIcon type={a.type} size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: 2 }}>
                        {a.message}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 12 }}>
                        <span>{a.worker_name || a.device_id}</span>
                        <span>{new Date(a.timestamp * 1000).toLocaleString('en-IN')}</span>
                        {a.email_sent ? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Email sent</span> : null}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-red' : 'badge-yellow'}`}>{a.severity}</span>
                      {!a.acknowledged && (
                        <button
                          id={`ack-btn-${a.id}`}
                          className="btn btn-xs btn-outline"
                          onClick={e => { e.stopPropagation(); ack(a.id); }}
                        >
                          <CheckCircle size={11} /> Ack
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incident Detail Panel */}
          {selected && (
            <div className="card" id="incident-detail">
              <div className="card-header">
                <div className="card-title">
                  <TypeIcon type={selected.type} size={16} />
                  Incident Summary
                </div>
                <button className="btn btn-xs btn-outline" onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="card-body">
                <div style={{
                  background: selected.severity === 'CRITICAL' ? 'var(--danger-light)' : 'var(--warning-light)',
                  padding: 16, borderRadius: 'var(--radius)', marginBottom: 16,
                  borderLeft: `4px solid ${selected.severity === 'CRITICAL' ? 'var(--danger)' : 'var(--warning)'}`
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{selected.message}</div>
                  <span className={`badge ${selected.severity === 'CRITICAL' ? 'badge-red' : 'badge-yellow'}`}>{selected.severity}</span>
                </div>

                {[
                  ['Alert Type', selected.type.replace(/_/g, ' ')],
                  ['Device ID', selected.device_id],
                  ['Worker', selected.worker_name || selected.rfid || 'Unknown'],
                  ['Measured Value', selected.value !== undefined ? selected.value.toFixed(2) : '—'],
                  ['Threshold', selected.threshold !== undefined ? selected.threshold.toString() : '—'],
                  ['Timestamp', new Date(selected.timestamp * 1000).toLocaleString('en-IN')],
                  ['Email Alert', selected.email_sent ? 'Sent' : selected.severity === 'CRITICAL' ? 'Failed' : 'Not sent (WARNING only)'],
                  ['Status', selected.acknowledged ? 'Acknowledged' : 'Pending'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13.5 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{k}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}

                {!selected.acknowledged && (
                  <button id="detail-ack-btn" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => ack(selected.id)}>
                    <CheckCircle size={15} /> Mark as Acknowledged
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
