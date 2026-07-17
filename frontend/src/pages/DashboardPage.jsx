import React, { useEffect, useState } from 'react';
import api from '../api.js';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalStudents: 0,
    activeLoans: 0,
    overdueBooks: 0
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

      setStats({
        totalBooks,
        totalStudents,
        activeLoans,
        overdueBooks
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
      if (minutes < 60) return `${minutes} menit yang lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam yang lalu`;
      const days = Math.floor(hours / 24);
      return `${days} hari yang lalu`;
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
      return `Siswa dengan NIS ${nis} bernama ${name} telah mengembalikan ${bookCount} buku pada tanggal ${formatDate(t.returnDate || t.updatedAt)}.`;
    }
    if (t.status === 'ongoing') {
      const today = new Date();
      const dueDate = new Date(t.dueDate);
      if (dueDate < today) {
        return `⚠️ Siswa dengan NIS ${nis} bernama ${name} terlambat mengembalikan ${bookCount} buku. (Jatuh tempo: ${formatDate(t.dueDate)}).`;
      }
      return `📢 Siswa dengan NIS ${nis} bernama ${name} meminjam ${bookCount} buku pada tanggal ${dateStr}.`;
    }
    if (t.status === 'has_problem_pending') {
      return `❌ Siswa dengan NIS ${nis} bernama ${name} memiliki denda/kasus tertunda pada peminjaman tanggal ${dateStr}.`;
    }
    if (t.status === 'has_problem_resolved') {
      return `✅ Kasus/denda untuk Siswa dengan NIS ${nis} bernama ${name} telah diselesaikan pada tanggal ${formatDate(t.updatedAt)}.`;
    }
    return `Siswa dengan NIS ${nis} bernama ${name} melakukan transaksi peminjaman ${bookCount} buku.`;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2 className="page-title">Dashboard Operations</h2>
        <button type="button" className="btn-secondary btn-refresh" onClick={loadDashboardData}>
          <span>🔄</span> Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalBooks}</div>
            <div className="stat-label">Total Buku</div>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalStudents}</div>
            <div className="stat-label">Total Siswa</div>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">📖</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeLoans}</div>
            <div className="stat-label">Peminjaman Aktif</div>
          </div>
        </div>

        <div className="stat-card stat-danger">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.overdueBooks}</div>
            <div className="stat-label">Terlambat</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <h3 className="section-title">📊 Transaksi Terbaru</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal Pinjam</th>
                  <th>Jatuh Tempo</th>
                  <th>Siswa</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.borrowDate)}</td>
                    <td>{formatDate(t.dueDate)}</td>
                    <td>
                      {t.student ? (
                        <>
                          <strong>{t.student.name}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>{t.student.nis}</small>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>ID: {t.studentId}</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${t.status}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
                {recentTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                      <div className="empty-state">
                        <div className="empty-icon">📋</div>
                        <p>Belum ada transaksi</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-section">
          <h3 className="section-title">🔔 Notifikasi &amp; Aktivitas Live</h3>
          <div className="activity-feed">
            {recentTransactions.map((t) => {
              const text = getActivityText(t);
              return (
                <div key={t.id} className={`activity-item status-${t.status}`}>
                  <div className="activity-icon">{getActivityIcon(t.status)}</div>
                  <div className="activity-content">
                    <p className="activity-text">{text}</p>
                    <small className="activity-time">{formatTimeAgo(t.borrowDate || t.createdAt)}</small>
                  </div>
                </div>
              );
            })}
            {recentTransactions.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔔</div>
                <p>Belum ada aktivitas terbaru</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


