'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Activity, BellRing, History, Cpu,
  Users, UserCircle, Shield, LogOut, Radio, WifiOff,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  id: string;
}

const NAV: NavItem[] = [
  { href: '/admin/dashboard',  label: 'Dashboard',       icon: <LayoutDashboard className="nav-icon" />, id: 'nav-dashboard' },
  { href: '/admin/telemetry',  label: 'Live Telemetry',  icon: <Activity className="nav-icon" />,        id: 'nav-telemetry' },
  { href: '/admin/alerts',     label: 'Alerts',          icon: <BellRing className="nav-icon" />,        id: 'nav-alerts' },
  { href: '/admin/history',    label: 'Exposure History',icon: <History className="nav-icon" />,         id: 'nav-history' },
  { href: '/admin/devices',    label: 'Devices',         icon: <Cpu className="nav-icon" />,             id: 'nav-devices' },
  { href: '/admin/workers',    label: 'Workers Map',     icon: <Users className="nav-icon" />,           id: 'nav-workers' },
  { href: '/admin/profiles',   label: 'Worker Profiles', icon: <UserCircle className="nav-icon" />,      id: 'nav-profiles' },
];

// ESP32 is considered "live" if it sent data in the last 30 seconds
const LIVE_THRESHOLD_SECONDS = 30;

export function AdminSidebar({ alertCount = 0 }: { alertCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [esp32Status, setEsp32Status] = useState<'live' | 'offline' | 'checking'>('checking');
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  async function checkEsp32() {
    try {
      const res = await fetch('/api/telemetry');
      if (!res.ok) { setEsp32Status('offline'); return; }
      const data = await res.json();
      const rows: { timestamp: number }[] = data.telemetry || [];

      if (rows.length === 0) {
        setEsp32Status('offline');
        setLastSeen(null);
        return;
      }

      // Find the most recent timestamp across all devices
      const latestTs = Math.max(...rows.map(r => r.timestamp));
      const secondsAgo = Math.floor(Date.now() / 1000) - latestTs;

      if (secondsAgo <= LIVE_THRESHOLD_SECONDS) {
        setEsp32Status('live');
        setLastSeen(null);
      } else {
        setEsp32Status('offline');
        const mins = Math.floor(secondsAgo / 60);
        setLastSeen(mins > 60 ? `${Math.floor(mins / 60)}h ago` : mins > 0 ? `${mins}m ago` : `${secondsAgo}s ago`);
      }
    } catch {
      setEsp32Status('offline');
    }
  }

  useEffect(() => {
    checkEsp32();
    const interval = setInterval(checkEsp32, 10000); // re-check every 10s
    return () => clearInterval(interval);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Shield size={18} />
        </div>
        <div>
          <div className="sidebar-logo-text">SafetyWatch</div>
          <div className="sidebar-logo-sub">Admin Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Monitoring</div>
        {NAV.slice(0, 3).map(item => (
          <Link
            key={item.href}
            href={item.href}
            id={item.id}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
            {item.label === 'Alerts' && alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
          </Link>
        ))}

        <div className="sidebar-section-label">Data</div>
        {NAV.slice(3, 5).map(item => (
          <Link
            key={item.href}
            href={item.href}
            id={item.id}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        <div className="sidebar-section-label">Management</div>
        {NAV.slice(5).map(item => (
          <Link
            key={item.href}
            href={item.href}
            id={item.id}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {/* ESP32 Live Status — only shows "Live" when device is actually transmitting */}
        <div
          id="esp32-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            padding: '8px 10px',
            background: esp32Status === 'live' ? 'var(--primary-light)' : 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.3s',
          }}
        >
          {esp32Status === 'live' ? (
            <>
              <Radio size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: 12, color: 'var(--primary-dark)', fontWeight: 600 }}>
                ESP32 Live
              </span>
              {/* Pulsing dot */}
              <span style={{
                marginLeft: 'auto',
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--primary)',
                animation: 'pulse-dot 1.5s ease-in-out infinite',
              }} />
            </>
          ) : esp32Status === 'offline' ? (
            <>
              <WifiOff size={14} style={{ color: 'var(--muted)' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                {lastSeen ? `ESP32 · ${lastSeen}` : 'ESP32 Offline'}
              </span>
            </>
          ) : (
            <>
              <Radio size={14} style={{ color: 'var(--muted)', opacity: 0.5 }} />
              <span style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.5 }}>Checking...</span>
            </>
          )}
        </div>

        <button
          id="logout-btn"
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
          onClick={logout}
        >
          <LogOut className="nav-icon" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
