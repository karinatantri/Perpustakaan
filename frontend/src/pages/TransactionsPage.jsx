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
  const [dateFrom, setDateFrom] = useState(() => `${new Date().toISOString().slice(0, 8)}01`);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Warning Letter State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedWarningTx, setSelectedWarningTx] = useState(null);
  const [teacherScope, setTeacherScope] = useState('all'); // 'all', 'self', 'class'

  const loadTransactions = async (showLoadingIndicator = true, scope = teacherScope) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const params = {};
      if (userRole === 'teacher' && scope !== 'all') {
        params.filterType = scope;
      }
      const isReportUser = isStaff || userRole === 'principal';
      if (isReportUser) {
        params.from = dateFrom;
        params.to = dateTo;
      }
      const txRes = await api.get(isReportUser ? '/transactions/report' : '/transactions', { params });
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

  const handleResolvePending = async (tx) => {
    const studentName = tx.student?.name || 'Peminjam';
    const fineText = Number(tx.totalFine) > 0 ? ` sebesar Rp ${Number(tx.totalFine).toLocaleString('id-ID')}` : '';
    const probText = tx.problemSummary ? ` (${tx.problemSummary})` : '';

    const confirmMsg =
      `💳 KONFIRMASI PELUNASAN DENDA / KASUS\n\n` +
      `Peminjam: ${studentName}\n` +
      `No Struk: ${tx.receiptNumber || tx.id}\n` +
      `Keterangan: ${probText || 'Denda Keterlambatan / Ganti Rugi'}\n` +
      `Total Tanggungan: ${fineText || 'Rp 0'}\n\n` +
      `Apakah siswa/guru telah melunasi denda atau menyelesaikan ganti rugi buku?\n\n` +
      `Klik OK untuk menandai status transaksi menjadi "Denda Lunas".`;

    if (!confirm(confirmMsg)) {
      return;
    }
    try {
      await api.put(`/transactions/${tx.id}/resolve-pending`, { action: 'paid' });
      alert(`✅ Berhasil! Denda/kasus "${studentName}" telah ditandai Lunas.`);
      loadTransactions();
    } catch (err) {
      alert('❌ Gagal menyelesaikan kasus: ' + (err.response?.data?.message || err.message));
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

    if (t.status === 'has_problem_pending') {
      const fineVal = Number(t.totalFine) || 0;
      return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ padding: '4px 10px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 20, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
            ⚠️ Denda Belum Lunas
          </span>
          {fineVal > 0 && (
            <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>
              Rp {fineVal.toLocaleString('id-ID')}
            </span>
          )}
          {t.problemSummary && (
            <span style={{ fontSize: 10, color: '#991b1b', background: '#fee2e2', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              {t.problemSummary}
            </span>
          )}
        </div>
      );
    }

    if (t.status === 'has_problem_resolved') {
      return (
        <span style={{ padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
          💚 Denda Lunas
        </span>
      );
    }

    const statusMap = {
      'ongoing': { text: '📢 Sedang Dipinjam', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      'completed': { text: '✅ Selesai', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
      'partially_returned': { text: '🔄 Sebagian', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' }
    };
    const s = statusMap[t.status] || { text: t.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };

    return (
      <span style={{ padding: '4px 10px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
        {s.text}
      </span>
    );
  };

  const printReport = () => {
    const escapeHtml = (value) => String(value ?? '-').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
    const statusText = (t) => isOverdueTx(t) ? 'Terlambat' : ({ ongoing: 'Sedang dipinjam', completed: 'Selesai', partially_returned: 'Dikembalikan sebagian', has_problem_pending: 'Denda belum lunas', has_problem_resolved: 'Denda lunas' }[t.status] || t.status || '-');
    const rows = filteredTransactions.map((t, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(t.receiptNumber || t.id)}</td><td>${escapeHtml(t.student?.name || '-')}</td><td>${escapeHtml(formatDate(t.borrowDate))}</td><td>${escapeHtml(formatDate(t.returnDate))}</td><td>${escapeHtml(statusText(t))}</td><td>Rp ${Number(t.totalFine || 0).toLocaleString('id-ID')}</td></tr>`).join('');
    const popup = window.open('', '_blank');
    if (!popup) return alert('Izinkan pop-up untuk mencetak laporan.');
    popup.document.write(`<!doctype html><html><head><base href="${window.location.origin}/"><title>Laporan Transaksi Perpustakaan</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:10px;margin:0;padding:0}.report{border:2px solid #1d4ed8;border-radius:8px;padding:12px}.header{background:#1d4ed8;color:#fff;border-radius:6px;padding:10px;text-align:center}.brand{display:flex;align-items:center;justify-content:center;gap:8px;font-size:20px;font-weight:800}.brand img{height:40px;width:40px;object-fit:contain;background:#fff;border-radius:50%;padding:2px}.school{font-size:12px;font-weight:700;margin-top:2px}.title{font-size:11px;margin-top:3px;opacity:.95}.meta{display:flex;justify-content:space-between;gap:12px;padding:9px 10px;margin:10px 0;background:#f8fafc;border:1px solid #dbeafe;border-radius:6px;color:#475569}.summary{margin:0 0 10px;padding:9px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#1e3a8a;font-weight:700}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#1d4ed8;color:#fff;text-align:center;font-weight:700}tr:nth-child(even){background:#f8fafc}.sign{display:flex;justify-content:space-between;gap:50px;margin-top:28px;text-align:center}.sign>div{width:190px}.line{border-top:1px solid #0f172a;margin-top:42px;padding-top:4px;color:#475569}.footer{border-top:1px solid #dbeafe;margin-top:16px;padding-top:8px;text-align:center;color:#64748b;font-size:9px}</style></head><body><main class="report"><header class="header"><div class="brand"><img src="Logo/logo.png" alt="Logo"><span>YP. TUNAS KARYA</span></div><div class="school">SEKOLAH YP. TUNAS KARYA</div><div class="title">LAPORAN TRANSAKSI PERPUSTAKAAN</div></header><section class="meta"><span><strong>Periode:</strong> ${escapeHtml(dateFrom)} s.d. ${escapeHtml(dateTo)}</span><span><strong>Dicetak:</strong> ${escapeHtml(new Date().toLocaleString('id-ID'))}</span></section><div class="summary">Total transaksi: ${filteredTransactions.length} &nbsp;|&nbsp; Total denda: Rp ${filteredTransactions.reduce((sum, t) => sum + Number(t.totalFine || 0), 0).toLocaleString('id-ID')}</div><table><thead><tr><th>No</th><th>Kode Struk</th><th>Peminjam</th><th>Tanggal Pinjam</th><th>Tanggal Kembali</th><th>Status</th><th>Denda</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Tidak ada data pada periode ini.</td></tr>'}</tbody></table><section class="sign"><div>Mengetahui,<div class="line">Kepala Perpustakaan</div></div><div>Petugas Perpustakaan,<div class="line">_____________________</div></div></section><footer class="footer">Laporan ini dibuat oleh Sistem Perpustakaan YP. Tunas Karya</footer></main></body></html>`);
    popup.document.head.insertAdjacentHTML('beforeend', '<style>@page{size:A4 portrait;margin:0}html,body{width:210mm;min-height:297mm}.report{min-height:297mm;border-radius:0;padding:10mm}table{table-layout:fixed;font-size:8px}th,td{padding:4px;overflow-wrap:anywhere}.brand{font-size:17px}</style>');
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const pageTitle = userRole === 'teacher' ? '📋 Data Transaksi (Guru & Kelas)' : isMember ? '📋 Pinjaman Saya' : '📊 Laporan Transaksi';

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="page-title">{pageTitle}</h2>
          <p className="page-subtitle">Rekap peminjaman, pengembalian, dan denda berdasarkan periode.</p>
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
          <div style={{ fontSize: 12, color: overdueCount > 0 ? '#991b1b' : '#64748b', fontWeight: 600 }}>Terlambat / Denda Belum Lunas</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: overdueCount > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>{overdueCount}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {(isStaff || userRole === 'principal') && (
            <>
              <label style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>Dari
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input" style={{ marginTop: 4, width: 150 }} />
              </label>
              <label style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>Sampai
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input" style={{ marginTop: 4, width: 150 }} />
              </label>
              <button type="button" className="btn-secondary" onClick={() => loadTransactions(true)} style={{ padding: '8px 12px', marginTop: 15 }}>Terapkan periode</button>
              <button type="button" className="btn-primary" onClick={printReport} style={{ padding: '8px 12px', marginTop: 15 }}>🖨 Cetak / Simpan PDF</button>
            </>
          )}
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder={userRole === 'student' ? 'Cari berdasarkan kode struk (TX)...' : 'Cari nama guru/siswa, NIS/NIP/NUPTK, atau kode struk (TX)...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          {userRole === 'teacher' && (
            <div style={{ width: 190 }}>
              <select
                value={teacherScope}
                onChange={(e) => {
                  const newScope = e.target.value;
                  setTeacherScope(newScope);
                  loadTransactions(true, newScope);
                }}
                className="form-input"
                style={{ width: '100%', fontWeight: 600 }}
              >
                <option value="all">👥 Semua Transaksi</option>
                <option value="self">👨‍🏫 Pinjaman Saya</option>
                <option value="class">🎓 Pinjaman Kelas</option>
              </select>
            </div>
          )}

          <div style={{ width: 210 }}>
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
              <option value="problem">⚠️ Denda Belum Lunas</option>
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
                {userRole !== 'student' && <th>Peminjam (Guru / Siswa)</th>}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ color: '#0f172a' }}>{student.name}</strong>
                              {student.role === 'teacher' ? (
                                <span style={{ fontSize: 10, padding: '2px 6px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 4, fontWeight: 700 }}>
                                  👨‍🏫 GURU
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, fontWeight: 700 }}>
                                  🎓 SISWA
                                </span>
                              )}
                            </div>
                            <small style={{ color: '#64748b' }}>
                              {student.role === 'teacher'
                                ? `NIP/NUPTK: ${student.nis || '-'} • Guru`
                                : `NIS: ${student.nis || '-'} • ${student.class || ''}`}
                            </small>
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
                            style={{ padding: '4px 10px', background: '#059669', borderColor: '#059669', fontWeight: 700 }}
                            onClick={() => handleResolvePending(t)}
                            title="Tandai Denda / Ganti Rugi Telah Lunas"
                          >
                            💳 Lunasi Denda
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


