import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [stats, setStats] = useState({
    booksToday: 0,
    activeStudents: 0,
    overdueBooks: 0,
  });
  const [loading, setLoading] = useState(true);

  // Particle canvas animation
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

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.35 + 0.05,
      hue: [142, 155, 168][Math.floor(Math.random() * 3)],
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
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.opacity})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.04 * (1 - dist / 100)})`;
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

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/public/stats');
      setStats({
        booksToday: res.data.booksToday || 0,
        activeStudents: res.data.activeStudents || 0,
        overdueBooks: res.data.overdueBooks || 0
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
      setStats({ booksToday: 0, activeStudents: 0, overdueBooks: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lnd-root">
      {/* Full-page particle canvas */}
      <canvas ref={canvasRef} className="lnd-canvas" />

      {/* Ambient orbs */}
      <div className="lnd-orb lnd-orb-1" />
      <div className="lnd-orb lnd-orb-2" />
      <div className="lnd-orb lnd-orb-3" />

      {/* ─── HEADER ─────────────────────────────── */}
      <header className="lnd-header">
        <div className="lnd-logo">
          <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" className="lnd-logo-img" />
          <div className="lnd-logo-text">
            <span className="lnd-logo-name">Perpustakaan</span>
            <span className="lnd-logo-sub">YP. Tunas Karya</span>
          </div>
        </div>
        <button
          type="button"
          className="lnd-login-btn"
          onClick={() => navigate('/login')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Login Admin
        </button>
      </header>

      {/* ─── HERO ────────────────────────────────── */}
      <main className="lnd-main">
        <section className="lnd-hero">
          <div className="lnd-hero-left">
            {/* Badge */}
            <div className="lnd-badge">
              <span className="lnd-badge-dot" />
              <span>🏆 Akreditasi A — SMK Swasta Tunas Karya</span>
            </div>

            {/* Title */}
            <h1 className="lnd-title">
              Sistem Perpustakaan
              <span className="lnd-title-accent"> Digital Modern</span>
            </h1>

            {/* Description */}
            <p className="lnd-desc">
              Platform berbasis QR Code untuk mengelola peminjaman buku perpustakaan secara real-time.
              Scan QR, pilih siswa, cetak struk, dan pantau riwayat langsung dari web.
            </p>

            {/* School info */}
            <div className="lnd-info-box">
              {[
                { icon: '📍', text: 'Jl. Batang Kuis, Tanjung Sari, Batang Kuis, Deli Serdang, Sumatera Utara' },
                { icon: '📞', text: '061-7949099' },
                { icon: '📧', text: 'smktunaskarya1@gmail.com' },
              ].map((item) => (
                <div key={item.text} className="lnd-info-row">
                  <span className="lnd-info-icon">{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="lnd-cta-row">
              <button
                type="button"
                className="lnd-btn-primary"
                onClick={() => navigate('/login')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Mulai Masuk
              </button>
              <button
                type="button"
                className="lnd-btn-secondary"
                onClick={() => navigate('/login')}
              >
                Lihat Dashboard
              </button>
            </div>

            {/* Social links */}
            <div className="lnd-socials">
              <a href="https://www.instagram.com/smk_tunaskaryabkuis?igsh=NjByNzRpZGhqZGI0" target="_blank" rel="noopener noreferrer" className="lnd-social">
                📷 Instagram
              </a>
              <a href="https://www.tiktok.com/@smks_tuskar_hebat?_r=1&_t=ZS-91y2IdHU0Lo" target="_blank" rel="noopener noreferrer" className="lnd-social">
                🎵 TikTok
              </a>
              <a href="https://www.facebook.com/share/1AAZYsNs1y/" target="_blank" rel="noopener noreferrer" className="lnd-social">
                👥 Facebook
              </a>
              <a href="http://www.yptunaskarya.id" target="_blank" rel="noopener noreferrer" className="lnd-social">
                🌐 Website
              </a>
            </div>
          </div>

          {/* ── Hero right card ── */}
          <div className="lnd-hero-right">
            <div className="lnd-card">
              <div className="lnd-card-header">
                <span className="lnd-card-icon">📚</span>
                <span>Tampilan Cepat Sistem</span>
                <span className="lnd-card-live">● LIVE</span>
              </div>

              <div className="lnd-card-body">
                {loading ? (
                  <div className="lnd-loading">
                    <div className="lnd-spinner" />
                    <span>Memuat data...</span>
                  </div>
                ) : (
                  <div className="lnd-metrics">
                    <div className="lnd-metric">
                      <span className="lnd-metric-label">Buku dipinjam hari ini</span>
                      <span className="lnd-metric-value">{stats.booksToday}</span>
                    </div>
                    <div className="lnd-metric">
                      <span className="lnd-metric-label">Siswa aktif</span>
                      <span className="lnd-metric-value">{stats.activeStudents}</span>
                    </div>
                    <div className="lnd-metric">
                      <span className="lnd-metric-label">Buku terlambat</span>
                      <span className="lnd-metric-value lnd-metric-danger">{stats.overdueBooks}</span>
                    </div>
                  </div>
                )}

                {/* Mini bar chart */}
                <div className="lnd-bars">
                  <div className="lnd-bar" style={{ height: '40%', animationDelay: '0s' }} />
                  <div className="lnd-bar" style={{ height: '75%', animationDelay: '0.15s' }} />
                  <div className="lnd-bar" style={{ height: '55%', animationDelay: '0.3s' }} />
                  <div className="lnd-bar" style={{ height: '85%', animationDelay: '0.45s' }} />
                  <div className="lnd-bar" style={{ height: '60%', animationDelay: '0.6s' }} />
                  <div className="lnd-bar" style={{ height: '90%', animationDelay: '0.75s' }} />
                  <div className="lnd-bar" style={{ height: '70%', animationDelay: '0.9s' }} />
                </div>

                {/* Program keahlian */}
                <div className="lnd-jurusan">
                  <h4 className="lnd-jurusan-title">Program Keahlian</h4>
                  <div className="lnd-jurusan-grid">
                    {[
                      'Otomatisasi & Tata Kelola Perkantoran',
                      'Akuntansi & Keuangan Lembaga',
                      'Perhotelan',
                      'Tata Boga',
                    ].map((j) => (
                      <span key={j} className="lnd-jurusan-chip">{j}</span>
                    ))}
                  </div>
                </div>

                <p className="lnd-card-foot">
                  Perpustakaan digital untuk layanan yang lebih cepat, rapi, dan modern.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURE SECTION ──────────────────── */}
        <section className="lnd-features">
          {[
            {
              icon: '📱',
              title: 'Scan QR dari Android',
              desc: 'Petugas cukup mengarahkan kamera ponsel ke QR code buku. Sistem otomatis mengenali kode dan menambahkannya ke transaksi peminjaman.',
              color: '#22c55e',
            },
            {
              icon: '🖨️',
              title: 'Struk Digital & Cetak',
              desc: 'Setiap peminjaman menghasilkan surat peminjaman yang bisa langsung ditandatangani siswa dan petugas, baik secara fisik maupun digital.',
              color: '#14b8a6',
            },
            {
              icon: '🚀',
              title: 'Siap Dikembangkan',
              desc: 'Arsitektur backend & frontend terpisah, siap diintegrasikan dengan sistem sekolah lain, notifikasi, dan analitik lanjutan.',
              color: '#34d399',
            },
          ].map((feat) => (
            <div key={feat.title} className="lnd-feat" style={{ '--feat-color': feat.color }}>
              <div className="lnd-feat-icon">{feat.icon}</div>
              <h3 className="lnd-feat-title">{feat.title}</h3>
              <p className="lnd-feat-desc">{feat.desc}</p>
            </div>
          ))}
        </section>

        {/* ─── FOOTER ───────────────────────────── */}
        <footer className="lnd-footer">
          <span className="lnd-footer-dot" />
          <span>© 2025 Perpustakaan YP. Tunas Karya — Sistem Perpustakaan Digital</span>
        </footer>
      </main>
    </div>
  );
}
