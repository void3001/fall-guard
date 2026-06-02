'use client';
import { Shield, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WorkerLayoutClient({ children, username }: { children: React.ReactNode; username: string }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <div className="worker-topbar">
        <div className="worker-topbar-logo">
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="white" />
          </div>
          <span>SafetyWatch</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>— Worker View</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>👷 {username}</span>
          <button
            id="worker-logout-btn"
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--danger)', fontWeight: 600, padding: '6px 12px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
