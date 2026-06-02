'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, Wind, Thermometer, Volume2, User, Lock, ChevronRight, HardHat, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'admin' | 'worker'>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push(role === 'admin' ? '/admin/dashboard' : '/worker/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: <Activity size={14} />, text: 'Real-time biometric monitoring (BPM, SpO2)' },
    { icon: <Wind size={14} />, text: 'Gas, smoke & air quality detection' },
    { icon: <Thermometer size={14} />, text: 'Heat stroke & environment alerts' },
    { icon: <Volume2 size={14} />, text: 'Acoustic trauma monitoring' },
    { icon: <Shield size={14} />, text: 'Fall detection & emergency SOS' },
  ];

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Brand Panel */}
        <div className="login-brand">
          <div className="login-brand-logo">
            <Shield size={28} />
          </div>
          <div className="login-brand-title">
            Industrial Safety<br />Wearable Dashboard
          </div>
          <div className="login-brand-sub">
            A comprehensive real-time monitoring system powered by ESP32. Protecting workers with intelligent sensor fusion and instant alerts.
          </div>
          {features.map((f, i) => (
            <div key={i} className="login-feature">
              <div style={{ color: 'var(--primary)' }}>{f.icon}</div>
              <span>{f.text}</span>
            </div>
          ))}
          <div style={{
            marginTop: 28,
            padding: '14px 18px',
            background: 'rgba(22,163,74,0.08)',
            borderRadius: 'var(--radius)',
            borderLeft: '3px solid var(--primary)',
            fontSize: 12.5,
            color: 'var(--text-2)',
            lineHeight: 1.6,
          }}>
            <strong>No data is simulated.</strong> The dashboard connects directly to your ESP32 hardware. Data will appear once your device starts transmitting.
          </div>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-tabs">
            <button
              id="tab-admin"
              className={`login-tab ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >
              <Shield size={14} style={{ display: 'inline', marginRight: 5 }} /> Admin
            </button>
            <button
              id="tab-worker"
              className={`login-tab ${role === 'worker' ? 'active' : ''}`}
              onClick={() => { setRole('worker'); setError(''); }}
            >
              <HardHat size={14} style={{ display: 'inline', marginRight: 5 }} /> Worker
            </button>
          </div>

          <form className="login-form" onSubmit={handleLogin} id="login-form">
            <div>
              <div className="login-form-title">
                {role === 'admin' ? 'Admin Sign In' : 'Worker Sign In'}
              </div>
              <div className="login-form-sub" style={{ marginTop: 4 }}>
                {role === 'admin'
                  ? 'Access the full safety management dashboard'
                  : 'View your personal safety metrics and alerts'}
              </div>
            </div>

            {error && (
              <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <div className="input-group">
              <label className="input-label" htmlFor="username-input">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  id="username-input"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  type="text"
                  placeholder={role === 'admin' ? 'admin' : 'worker01'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="password-input">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  id="password-input"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button id="login-btn" type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Sign In <ChevronRight size={16} />
                </span>
              )}
            </button>

            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', paddingTop: 4 }}>
              Credentials are configured in <code style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: 4 }}>.env.local</code>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
