'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { History, Download, BarChart2 } from 'lucide-react';

interface HistRow {
  id: number; timestamp: number; bpm?: number; spo2?: number;
  temperature?: number; gas_ppm?: number; sound_db?: number; humidity?: number;
}

export default function HistoryPage() {
  const [deviceId, setDeviceId] = useState('ESP32-001');
  const [devices, setDevices] = useState<string[]>([]);
  const [data, setData] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  });
  const [to, setTo] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    fetch('/api/telemetry').then(r => r.json()).then(d => {
      const ids = (d.telemetry || []).map((t: { device_id: string }) => t.device_id);
      setDevices(ids);
      if (ids.length > 0) setDeviceId(ids[0]);
    });
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/history?device_id=${deviceId}&from=${from}&to=${to}`);
    if (res.ok) { const d = await res.json(); setData(d.history || []); }
    setLoading(false);
  }

  function downloadCsv() {
    const head = 'timestamp,bpm,spo2,temperature,humidity,gas_ppm,sound_db';
    const rows = data.map(r =>
      `${new Date(r.timestamp * 1000).toISOString()},${r.bpm ?? ''},${r.spo2 ?? ''},${r.temperature ?? ''},${r.humidity ?? ''},${r.gas_ppm ?? ''},${r.sound_db ?? ''}`
    );
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `exposure_${deviceId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = data.map(r => ({
    time: new Date(r.timestamp * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    BPM: r.bpm, SpO2: r.spo2, Temp: r.temperature,
    Gas: r.gas_ppm, Sound: r.sound_db, Humidity: r.humidity,
  }));

  const charts = [
    { keys: ['BPM', 'SpO2'], colors: ['#ef4444', '#0ea5e9'], title: 'Vitals — Heart Rate & Blood Oxygen', refLines: [{ key: 'BPM', val: 120, label: 'BPM Warn' }, { key: 'SpO2', val: 95, label: 'SpO2 Warn' }] },
    { keys: ['Temp', 'Humidity'], colors: ['#f59e0b', '#16a34a'], title: 'Environment — Temperature & Humidity', refLines: [] },
    { keys: ['Gas'], colors: ['#8b5cf6'], title: 'Gas Exposure (PPM)', refLines: [] },
    { keys: ['Sound'], colors: ['#ec4899'], title: 'Noise Exposure (dB)', refLines: [] },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Exposure History</div>
          <div className="topbar-subtitle">Historical sensor data for OSHA compliance and health audits</div>
        </div>
        {data.length > 0 && (
          <button id="download-csv" className="btn btn-outline btn-sm" onClick={downloadCsv}>
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Controls */}
        <div className="card mb-24">
          <div className="card-body">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="input-label">Device</label>
                <select id="device-select" className="select" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                  {devices.length > 0 ? devices.map(id => <option key={id} value={id}>{id}</option>) : <option value="ESP32-001">ESP32-001</option>}
                </select>
              </div>
              <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="input-label">From</label>
                <input id="from-date" type="datetime-local" className="input"
                  defaultValue={new Date(from * 1000).toISOString().slice(0, 16)}
                  onChange={e => setFrom(Math.floor(new Date(e.target.value).getTime() / 1000))} />
              </div>
              <div className="input-group" style={{ flex: 1, minWidth: 160 }}>
                <label className="input-label">To</label>
                <input id="to-date" type="datetime-local" className="input"
                  defaultValue={new Date(to * 1000).toISOString().slice(0, 16)}
                  onChange={e => setTo(Math.floor(new Date(e.target.value).getTime() / 1000))} />
              </div>
              <button id="load-history" className="btn btn-primary" onClick={load} disabled={loading}>
                {loading ? <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <History size={14} />}
                {loading ? 'Loading...' : 'Load History'}
              </button>
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 80 }}>
            <BarChart2 size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No Data Loaded</div>
            <div className="empty-state-sub">Select a device and date range, then click Load History</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>{data.length} records loaded</div>
            {charts.map(c => (
              <div key={c.title} className="card">
                <div className="card-header">
                  <div className="card-title"><History size={15} style={{ color: 'var(--primary)' }} /> {c.title}</div>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {c.keys.map((k, i) => (
                        <Line key={k} type="monotone" dataKey={k} dot={false} strokeWidth={2} stroke={c.colors[i]} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
