'use client';
import { useEffect, useState } from 'react';
import { UserCircle, Plus, Edit2, Trash2, X, HardHat, Users, Search } from 'lucide-react';

interface Worker { rfid: string; name: string; contact?: string; medical_notes?: string; role?: string; }

const blankWorker: Worker = { rfid: '', name: '', contact: '', medical_notes: '', role: 'worker' };

export default function ProfilesPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<Worker>(blankWorker);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<Record<string, string>>({});

  async function fetchWorkers() {
    const [wRes, dRes] = await Promise.all([
      fetch('/api/workers'),
      fetch('/api/devices')
    ]);
    if (wRes.ok) { const d = await wRes.json(); setWorkers(d.workers || []); }
    if (dRes.ok) {
      const d = await dRes.json();
      const statusMap: Record<string, string> = {};
      d.devices?.forEach((dev: any) => {
        if (dev.rfid) statusMap[dev.rfid] = dev.status;
      });
      setDeviceStatus(statusMap);
    }
  }

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/workers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    await fetchWorkers();
    setModal(null);
    setSaving(false);
  }

  async function del(rfid: string) {
    if (!confirm(`Delete worker with RFID ${rfid}?`)) return;
    await fetch('/api/workers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rfid }) });
    fetchWorkers();
  }

  const filtered = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.rfid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Worker Profiles</div>
          <div className="topbar-subtitle">RFID-to-worker mapping, emergency contacts, and medical notes</div>
        </div>
        <button id="add-worker-btn" className="btn btn-primary btn-sm" onClick={() => { setForm(blankWorker); setModal('add'); }}>
          <Plus size={14} /> Add Worker
        </button>
      </div>

      <div className="page-body">
        {/* Search */}
        <div className="mb-16">
          <div style={{ position: 'relative', maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              id="worker-search"
              className="input"
              type="search"
              placeholder="Search by name or RFID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 80 }}>
            <Users size={40} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div className="empty-state-title">No Workers Registered</div>
            <div className="empty-state-sub">Add workers and link their RFID tags to enable identification</div>
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>RFID Tag</th>
                    <th>Role</th>
                    <th>Emergency Contact</th>
                    <th>Medical Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(w => (
                    <tr key={w.rfid} id={`profile-${w.rfid}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <HardHat size={16} style={{ color: 'var(--primary)' }} />
                            </div>
                            <span 
                              style={{ 
                                position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--surface)',
                                background: deviceStatus[w.rfid] === 'online' ? 'var(--success)' : 'var(--muted)'
                              }} 
                              title={deviceStatus[w.rfid] === 'online' ? 'Online' : 'Offline'}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{w.name}</div>
                            <div style={{ fontSize: 11, color: deviceStatus[w.rfid] === 'online' ? 'var(--success)' : 'var(--muted)', fontWeight: 500 }}>
                              {deviceStatus[w.rfid] === 'online' ? 'Online' : 'Offline'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><code style={{ background: 'var(--surface)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{w.rfid}</code></td>
                      <td><span className={`badge ${w.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{w.role || 'worker'}</span></td>
                      <td style={{ color: w.contact ? 'var(--text-2)' : 'var(--muted)' }}>{w.contact || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: w.medical_notes ? 'var(--text-2)' : 'var(--muted)' }}>{w.medical_notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            id={`edit-${w.rfid}`}
                            className="btn btn-xs btn-outline"
                            onClick={() => { setForm({ ...w }); setModal('edit'); }}
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                          <button
                            id={`del-${w.rfid}`}
                            className="btn btn-xs btn-danger"
                            onClick={() => del(w.rfid)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} id="worker-modal">
            <div className="modal-header">
              <div className="modal-title"><UserCircle size={18} style={{ display: 'inline', marginRight: 6 }} />{modal === 'add' ? 'Add Worker' : 'Edit Worker'}</div>
              <button className="btn btn-xs btn-outline" onClick={() => setModal(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">RFID Tag *</label>
                <input id="modal-rfid" className="input" value={form.rfid} onChange={e => setForm(f => ({ ...f, rfid: e.target.value }))} placeholder="e.g. A1B2C3D4" disabled={modal === 'edit'} />
              </div>
              <div className="input-group">
                <label className="input-label">Full Name *</label>
                <input id="modal-name" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select id="modal-role" className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="worker">Worker</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Emergency Contact</label>
                <input id="modal-contact" className="input" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="e.g. +91 9876543210" />
              </div>
              <div className="input-group">
                <label className="input-label">Medical Notes</label>
                <textarea id="modal-medical" className="input" rows={3} value={form.medical_notes} onChange={e => setForm(f => ({ ...f, medical_notes: e.target.value }))} placeholder="e.g. Asthma — avoid dust areas" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button id="modal-save" className="btn btn-primary" onClick={save} disabled={saving || !form.rfid || !form.name}>
                {saving ? 'Saving...' : 'Save Worker'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
