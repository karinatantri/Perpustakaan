import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : {};
  const userRole = user.role || 'student';
  const isStaff = userRole === 'admin' || userRole === 'officer';

  const [stats, setStats] = useState({
    totalBooks: 0,
    totalStudents: 0,
    activeLoans: 0,
    overdueBooks: 0,
    totalInventories: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions/stats');
      const { totalBooks = 0, totalStudents = 0, activeLoans = 0, overdueBooks = 0, recentTransactions = [] } = res.data || {};

      let totalInventories = 0;
      try {
        const invRes = await api.get('/inventories');
        totalInventories = (invRes.data || []).length;
      } catch (_) {}

      setStats({
        totalBooks,
        totalStudents,
        activeLoans,
        overdueBooks,
        totalInventories
      });

      setRecentTransactions(recentTransactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getActivityIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'ongoing': return '📢';
      case 'has_problem_pending': return '⚠️';
      case 'has_problem_resolved': return '💚';
      default: return '📋';
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Baru saja';
      if (minutes < 60) return `${minutes}m yang lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}j yang lalu`;
      const days = Math.floor(hours / 24);
      return `${days}h yang lalu`;
    } catch {
      return '';
    }
  };

  const getActivityText = (t) => {
    const name = t.student?.name || 'Anggota';
    const nis = t.student?.nis || 'N/A';
    const bookCount = t.itemCount || 1;
    const dateStr = formatDate(t.borrowDate);
    
    if (t.status === 'completed') {
      return `Siswa (${nis} - ${name}) telah mengembalikan ${bookCount} buku pada ${formatDate(t.returnDate || t.updatedAt)}.`;
    }
    if (t.status === 'ongoing') {
      const today = new Date();
      const dueDate = new Date(t.dueDate);
      if (dueDate < today) {
        return `⚠️ Siswa (${nis} - ${name}) terlambat mengembalikan ${bookCount} buku (Jatuh tempo: ${formatDate(t.dueDate)}).`;
      }
      return `📢 Siswa (${nis} - ${name}) meminjam ${bookCount} buku pada ${dateStr}.`;
    }
    if (t.status === 'has_problem_pending') {
      return `❌ Siswa (${nis} - ${name}) memiliki denda/masalah tertunda.`;
    }
    if (t.status === 'has_problem_resolved') {
      return `✅ Kasus denda (${nis} - ${name}) telah diselesaikan.`;
    }
    return `Transaksi peminjaman ${bookCount} buku oleh ${name}.`;
  };

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
        <p style={{ fontWeight: 600 }}>Memuat Dashboard Perpustakaan...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Welcome Banner Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #065f46 50%, #059669 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          color: 'white',
          marginBottom: 24,
          boxShadow: '0 10px 25px rgba(5, 150, 105, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.18)', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                {userRole === 'admin' ? '👑 SYSTEM ADMINISTRATOR' : isStaff ? '💼 PETUGAS PERPUSTAKAAN' : '🎓 KATALOG SISWA'}
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: '10px 0 4px', color: '#ffffff' }}>
                Selamat Datang, {user.name || user.username || 'Pengguna'}! 👋
              </h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
                Sistem Informasi & Manajemen Operasional Perpustakaan YP Tunas Karya
              </p>
            </div>

            <button
              type="button"
              onClick={loadDashboardData}
              style={{
                padding: '10px 18px',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s'
              }}
            >
              🔄 Refresh Data
            </button>
          </div>

          {/* Quick Action Shortcuts */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/app/books')}
              style={{ padding: '8px 14px', background: 'white', color: '#065f46', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              📖 Data Buku & Barang
            </button>
            {isStaff && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/app/borrow')}
                  style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  📤 Peminjaman
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/return')}
                  style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  📥 Pengembalian
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/scan')}
                  style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  📷 Scan QR
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 5 Executive Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total Judul Buku</span>
            <span style={{ fontSize: 24 }}>📚</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>{stats.totalBooks}</div>
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Katalog Aktif</span>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Siswa Terdaftar</span>
            <span style={{ fontSize: 24 }}>👥</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1d4ed8', marginTop: 8 }}>{stats.totalStudents}</div>
          <span style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>Anggota Perpustakaan</span>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Peminjaman Aktif</span>
            <span style={{ fontSize: 24 }}>📢</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0284c7', marginTop: 8 }}>{stats.activeLoans}</div>
          <span style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}>Sedang Dipinjam</span>
        </div>

        <div style={{ background: stats.overdueBooks > 0 ? '#fef2f2' : 'white', border: stats.overdueBooks > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: stats.overdueBooks > 0 ? '#991b1b' : '#64748b', fontWeight: 600 }}>Terlambat</span>
            <span style={{ fontSize: 24 }}>⚠️</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: stats.overdueBooks > 0 ? '#dc2626' : '#0f172a', marginTop: 8 }}>{stats.overdueBooks}</div>
          <span style={{ fontSize: 12, color: stats.overdueBooks > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
            {stats.overdueBooks > 0 ? 'Perlu Pengembalian' : 'Tidak Ada Denda'}
          </span>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Inventaris Barang</span>
            <span style={{ fontSize: 24 }}>📦</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', marginTop: 8 }}>{stats.totalInventories}</div>
          <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Perlengkapan Sekolah</span>
        </div>
      </div>

      {/* Main Grid: Recent Transactions & Live Activity Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Recent Transactions Section */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>📋 Transaksi Terbaru</h3>
            {isStaff && (
              <button
                type="button"
                onClick={() => navigate('/app/transactions')}
                style={{ fontSize: 13, color: '#1d4ed8', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Lihat Semua →
              </button>
            )}
          </div>

          <div className="table-responsive" style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, fontSize: 13, minWidth: 500 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Tgl Pinjam</th>
                  <th>Peminjam</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.slice(0, 6).map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ color: '#475569', fontSize: 12 }}>
                      <div>{formatDate(t.borrowDate)}</div>
                      <small style={{ color: '#94a3b8' }}>Jth tempo: {formatDate(t.dueDate)}</small>
                    </td>
                    <td>
                      {t.student ? (
                        <div>
                          <strong style={{ color: '#0f172a' }}>{t.student.name}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>NIS: {t.student.nis}</small>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>ID: {t.studentId}</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge status-${t.status}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Belum ada transaksi peminjaman.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>🔔 Notifikasi & Activity Feed</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
            {recentTransactions.slice(0, 8).map((t) => {
              const text = getActivityText(t);
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{ fontSize: 18, marginTop: 2 }}>{getActivityIcon(t.status)}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 13, color: '#334155', lineHeight: 1.4 }}>{text}</p>
                    <small style={{ color: '#94a3b8', fontSize: 11 }}>{formatTimeAgo(t.borrowDate || t.createdAt)}</small>
                  </div>
                </div>
              );
            })}
            {recentTransactions.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                Belum ada notifikasi atau aktivitas terbaru.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


