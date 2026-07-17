import React, { useEffect, useState } from 'react';
import api from '../api.js';

export default function TransactionsPage() {
  const userStr = localStorage.getItem('user');
  let userRole = 'student';
  if (userStr) {
    try {
      userRole = JSON.parse(userStr).role || 'student';
    } catch (_) {}
  }
  const isStaff = userRole === 'admin' || userRole === 'officer';
  const isMember = userRole === 'student' || userRole === 'teacher';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState({});

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const [txRes, studentsRes] = await Promise.all([
        api.get('/transactions').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] }))
      ]);

      const txData = txRes.data || [];
      const studentsData = studentsRes.data || [];

      const studentsMap = {};
      studentsData.forEach((s) => {
        studentsMap[s.id] = s;
      });

      setStudents(studentsMap);
      setTransactions(txData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

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

  const openReceipt = async (id) => {
    try {
      // Determine receipt type based on transaction status
      const tx = transactions.find((t) => t.id === id);
      const isReturned = tx && (tx.status === 'completed' || tx.status === 'has_problem_resolved' || tx.status === 'has_problem_pending' || tx.status === 'partially_returned');

      // Always use return-receipt for returned transactions, receipt for ongoing
      const endpoint = isReturned ? `/transactions/${id}/return-receipt` : `/transactions/${id}/receipt`;
      const res = await api.get(endpoint, {
        responseType: 'text'
      });
      const w = window.open('', '_blank');
      if (w) {
        w.document.open();
        w.document.write(res.data);
        w.document.close();
      }
    } catch (err) {
      console.error('Error opening receipt:', err);
      let errorMsg = 'Gagal membuka struk';
      if (err.response) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else {
          errorMsg = err.response.data?.message || JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      alert('Gagal membuka struk:\n\n' + errorMsg + '\n\nSilakan cek console untuk detail error.');
      // Log full error untuk debugging
      console.error('Full receipt error:', err);
    }
  };

  const handleResolvePending = async (id) => {
    if (!confirm('Apakah siswa sudah membayar denda atau mengganti buku?')) {
      return;
    }
    try {
      await api.put(`/transactions/${id}/resolve-pending`, { action: 'paid' });
      alert('✅ Kasus berhasil diselesaikan');
      loadTransactions();
    } catch (err) {
      alert('❌ Gagal menyelesaikan kasus');
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'ongoing': { text: 'Dipinjam', class: 'status-ongoing' },
      'completed': { text: 'Selesai', class: 'status-completed' },
      'partially_returned': { text: 'Sebagian Dikembalikan', class: 'status-partial' },
      'has_problem_pending': { text: 'Bermasalah (Belum Bayar)', class: 'status-problem' },
      'has_problem_resolved': { text: 'Bermasalah (Selesai)', class: 'status-resolved' }
    };
    const statusInfo = statusMap[status] || { text: status, class: 'status-default' };
    return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Memuat data...</p>
      </div>
    );
  }

  const pageTitle = userRole === 'teacher' ? 'Peminjaman Siswa' : isMember ? 'Pinjaman Saya' : 'Transaksi Peminjaman';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">{pageTitle}</h2>
        <button type="button" className="btn-secondary" onClick={loadTransactions}>
          Refresh
        </button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal Pinjam</th>
              <th>Jatuh Tempo</th>
              {userRole !== 'student' && <th>Siswa</th>}
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const student = students[t.studentId] || t.student;
              const isReturned = t.status === 'completed' || t.status === 'has_problem_resolved' || t.status === 'has_problem_pending' || t.status === 'partially_returned';
              return (
                <tr key={t.id}>
                  <td>{formatDate(t.borrowDate)}</td>
                  <td>{formatDate(t.dueDate)}</td>
                  {userRole !== 'student' && (
                    <td>
                      {student ? (
                        <>
                          <strong>{student.name}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>{student.nis}</small>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>ID: {t.studentId}</span>
                      )}
                    </td>
                  )}
                  <td>{getStatusBadge(t.status)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => openReceipt(t.id)}
                        title="Lihat Struk"
                      >
                        🖨️ Struk
                      </button>
                      {t.status === 'has_problem_pending' && isStaff && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleResolvePending(t.id)}
                          title="Selesaikan (Sudah Bayar/Ganti)"
                        >
                          ✅ Selesaikan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={userRole === 'student' ? 4 : 5} style={{ textAlign: 'center', padding: '40px' }}>
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
  );
}


