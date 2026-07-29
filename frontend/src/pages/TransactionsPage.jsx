import React, { useEffect, useState } from 'react';
import api from '../api.js';
import ReceiptModal from '../components/ReceiptModal.jsx';
import WarningLetterModal from '../components/WarningLetterModal.jsx';

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
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Warning Letter State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedWarningTx, setSelectedWarningTx] = useState(null);

  const loadTransactions = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const txRes = await api.get('/transactions');
      const txData = txRes.data || [];
      setTransactions(txData);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTransactions(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      const tx = transactions.find((t) => t.id === id);
      const isReturned = tx && (tx.status === 'completed' || tx.status === 'has_problem_resolved' || tx.status === 'has_problem_pending' || tx.status === 'partially_returned');

      const endpoint = isReturned ? `/transactions/${id}/return-receipt` : `/transactions/${id}/receipt`;
      const res = await api.get(endpoint, {
        responseType: 'text'
      });
      setReceiptHtml(res.data);
      setShowReceiptModal(true);
    } catch (err) {
      console.error('Error opening receipt:', err);
      let errorMsg = 'Gagal membuka struk';
      if (err.response) {
        errorMsg = typeof err.response.data === 'string' ? err.response.data : (err.response.data?.message || JSON.stringify(err.response.data));
      } else if (err.message) {
        errorMsg = err.message;
      }
      alert('Gagal membuka struk:\n\n' + errorMsg);
    }
  };

  const openWarningLetter = (tx) => {
    setSelectedWarningTx(tx);
    setShowWarningModal(true);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdueTx = (t) => {
    if (t.status !== 'ongoing' || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Stats calculation
  const totalCount = transactions.length;
  const activeCount = transactions.filter((t) => t.status === 'ongoing').length;
  const completedCount = transactions.filter((t) => t.status === 'completed' || t.status === 'has_problem_resolved').length;
  const overdueCount = transactions.filter((t) => isOverdueTx(t) || t.status === 'has_problem_pending').length;

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const qLower = search.toLowerCase();
    const studentName = t.student?.name || '';
    const studentNis = t.student?.nis || '';
    const receiptNum = t.receiptNumber || t.id || '';

    const matchesSearch = !search || studentName.toLowerCase().includes(qLower) || studentNis.toLowerCase().includes(qLower) || receiptNum.toLowerCase().includes(qLower);

    let matchesStatus = true;
    if (selectedStatus === 'ongoing') matchesStatus = t.status === 'ongoing';
    else if (selectedStatus === 'completed') matchesStatus = t.status === 'completed' || t.status === 'has_problem_resolved';
    else if (selectedStatus === 'overdue') matchesStatus = isOverdueTx(t);
    else if (selectedStatus === 'problem') matchesStatus = t.status === 'has_problem_pending';

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (t) => {
    const isOverdue = isOverdueTx(t);
    if (isOverdue) {
      const due = new Date(t.dueDate);
      const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return (
        <span style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
          ⚠️ Terlambat ({diffDays} Hari)
        </span>
      );
    }

    const statusMap = {
      'ongoing': { text: '📢 Sedang Dipinjam', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      'completed': { text: '✅ Selesai', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
      'partially_returned': { text: '🔄 Sebagian', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' },
      'has_problem_pending': { text: '❌ Ada Denda/Kasus', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
      'has_problem_resolved': { text: '💚 Kasus Selesai', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
    };
    const s = statusMap[t.status] || { text: t.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

    return (
      <span style={{ padding: '4px 10px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
        {s.text}
      </span>
    );
  };

  const pageTitle = userRole === 'teacher' ? '📋 Peminjaman Siswa' : isMember ? '📋 Pinjaman Saya' : '📋 Riwayat & Data Transaksi';

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="page-title">{pageTitle}</h2>
          <p className="page-subtitle">Kelola seluruh sirkulasi peminjaman, pengembalian, dan surat keterlambatan</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8 }}
          onClick={() => loadTransactions(true)}
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Total Transaksi</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{totalCount}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Sedang Dipinjam</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>{activeCount}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Transaksi Selesai</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{completedCount}</div>
        </div>
        <div style={{ background: overdueCount > 0 ? '#fef2f2' : 'white', border: overdueCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: overdueCount > 0 ? '#991b1b' : '#64748b', fontWeight: 600 }}>Terlambat / Denda</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: overdueCount > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>{overdueCount}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari berdasarkan nama siswa, NIS, atau kode struk (TX)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          <div style={{ width: 200 }}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="">📋 Semua Status</option>
              <option value="ongoing">📢 Sedang Dipinjam</option>
              <option value="overdue">⚠️ Terlambat</option>
              <option value="completed">✅ Selesai</option>
              <option value="problem">❌ Ada Denda/Kasus</option>
            </select>
          </div>

          {(search || selectedStatus) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedStatus(''); }}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Data Transaksi */}
      {loading ? (
        <div style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
          <p>Memuat data transaksi...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
            {search || selectedStatus ? 'Tidak ada transaksi yang cocok dengan filter pencarian.' : 'Belum ada transaksi peminjaman.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <table className="table" style={{ margin: 0, minWidth: 750 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 50, textAlign: 'center' }}>No</th>
                <th>Kode Struk</th>
                <th>Tgl Pinjam</th>
                <th>Jatuh Tempo</th>
                {userRole !== 'student' && <th>Peminjam / Siswa</th>}
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: 220 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t, idx) => {
                const isOverdue = isOverdueTx(t);
                const student = t.student || {};

                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isOverdue ? '#fff5f5' : 'transparent'
                    }}
                  >
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13 }}>
                      {t.receiptNumber || t.id.substring(0, 10)}
                    </td>
                    <td style={{ color: '#475569', fontSize: 13 }}>{formatDate(t.borrowDate)}</td>
                    <td style={{ fontWeight: isOverdue ? 800 : 500, color: isOverdue ? '#dc2626' : '#475569', fontSize: 13 }}>
                      {formatDate(t.dueDate)}
                    </td>
                    {userRole !== 'student' && (
                      <td>
                        {student.name ? (
                          <div>
                            <strong style={{ color: '#0f172a' }}>{student.name}</strong>
                            <br />
                            <small style={{ color: '#64748b' }}>NIS: {student.nis || '-'} • {student.class || ''}</small>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>ID: {t.studentId}</span>
                        )}
                      </td>
                    )}
                    <td style={{ textAlign: 'center' }}>{getStatusBadge(t)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          style={{ padding: '4px 10px' }}
                          onClick={() => openReceipt(t.id)}
                          title="Lihat & Cetak Struk"
                        >
                          🖨️ Struk
                        </button>

                        {isOverdue && isStaff && (
                          <button
                            type="button"
                            className="btn-sm btn-danger"
                            style={{ padding: '4px 10px', background: '#dc2626', borderColor: '#b91c1c' }}
                            onClick={() => openWarningLetter(t)}
                            title="Cetak Surat Peringatan Keterlambatan"
                          >
                            ⚠️ Surat Peringatan
                          </button>
                        )}

                        {t.status === 'has_problem_pending' && isStaff && (
                          <button
                            type="button"
                            className="btn-sm btn-primary"
                            style={{ padding: '4px 10px', background: '#059669', borderColor: '#059669' }}
                            onClick={() => handleResolvePending(t.id)}
                            title="Selesaikan (Sudah Bayar Denda/Ganti Buku)"
                          >
                            ✅ Selesaikan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Struk Transaksi */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        htmlContent={receiptHtml}
      />

      {/* Modal Surat Peringatan Keterlambatan */}
      <WarningLetterModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        transaction={selectedWarningTx}
      />
    </div>
  );
}


