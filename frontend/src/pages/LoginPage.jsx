import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  // Particle animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.45 + 0.08,
      hue: Math.random() > 0.5 ? 142 : 160, // emerald green or teal
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.opacity})`;
        ctx.fill();
      });

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.05 * (1 - dist / 80)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Check if user is already logged in
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setChecking(false);
      return;
    }
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const response = await api.get('/books', {
          validateStatus: (status) => status < 500,
        });
        if (response.status === 200) {
          navigate('/app', { replace: true });
          return;
        }
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/app');
    } catch (err) {
      const isNetwork =
        err.code === 'ERR_NETWORK' ||
        err.message === 'Network Error' ||
        !err.response;
      if (isNetwork) {
        setError(
          'Tidak bisa terhubung ke server. Pastikan backend (port 4000) aktif.'
        );
      } else {
        setError('Username atau password salah. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="lp-shell">
        <div className="lp-checking">
          <div className="lp-check-spinner" />
          <p>Memeriksa sesi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-shell">
      {/* Animated canvas background */}
      <canvas ref={canvasRef} className="lp-canvas" />

      {/* Ambient glow orbs */}
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />

      {/* Content layout */}
      <div className="lp-layout">

        {/* ── LEFT PANEL ── */}
        <aside className="lp-left">
          <div className="lp-left-inner">
            {/* Logo */}
            <div className="lp-brand">
              <div className="lp-brand-logo">
                <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" className="lp-brand-img" />
              </div>
              <div className="lp-brand-text">
                <span className="lp-brand-name">Perpustakaan</span>
                <span className="lp-brand-school">YP. Tunas Karya</span>
              </div>
            </div>

            {/* Hero headline */}
            <div className="lp-hero-copy">
              <div className="lp-pill">
                <span className="lp-pill-dot" />
                Portal Admin &amp; Petugas
              </div>
              <h1 className="lp-headline">
                Kelola Perpustakaan<br />
                <span className="lp-headline-accent">Lebih Cerdas</span>
              </h1>
              <p className="lp-desc">
                Pantau buku, kelola peminjaman dengan scan QR, dan cetak laporan —
                semua dalam satu dasbor yang cepat &amp; modern.
              </p>
            </div>

            {/* Feature badges */}
            <div className="lp-features">
              {[
                { icon: '📱', label: 'Scan QR Buku & Struk' },
                { icon: '📊', label: 'Laporan Excel Otomatis' },
                { icon: '🔐', label: 'Role Admin & Petugas' },
                { icon: '⚡', label: 'Real‑Time Dashboard' },
              ].map((f) => (
                <div key={f.label} className="lp-feat-chip">
                  <span className="lp-feat-icon">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="lp-stats">
              {[
                { value: '1.200+', label: 'Buku Terdaftar' },
                { value: '800+', label: 'Siswa Aktif' },
                { value: '99.9%', label: 'Uptime' },
              ].map((s) => (
                <div key={s.label} className="lp-stat">
                  <span className="lp-stat-value">{s.value}</span>
                  <span className="lp-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── RIGHT PANEL (Form) ── */}
        <main className="lp-right">
          <form className="lp-card" onSubmit={handleSubmit} noValidate>
            {/* Card top glow line */}
            <div className="lp-card-glow-bar" />

            <div className="lp-form-header">
              <h2 className="lp-form-title">Selamat Datang 👋</h2>
              <p className="lp-form-sub">Masuk ke akun admin atau petugas Anda</p>
            </div>

            {/* Username field */}
            <div className={`lp-field ${focusedField === 'user' ? 'lp-field--focused' : ''} ${username ? 'lp-field--filled' : ''}`}>
              <label htmlFor="lp-username" className="lp-label">Username</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="lp-username"
                  className="lp-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('user')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className={`lp-field ${focusedField === 'pass' ? 'lp-field--focused' : ''} ${password ? 'lp-field--filled' : ''}`}>
              <label htmlFor="lp-password" className="lp-label">Password</label>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="lp-password"
                  className="lp-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="lp-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit button */}
            <button
              id="lp-submit-btn"
              type="submit"
              className="lp-submit"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <span className="lp-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Masuk ke Sistem
                </>
              )}
            </button>

            {/* Footer */}
            <div className="lp-form-footer">
              <span className="lp-footer-dot" />
              <p>Sistem Perpustakaan Digital — SMK Swasta Tunas Karya</p>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
