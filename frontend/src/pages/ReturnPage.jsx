import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api.js';
import QrScanner from '../components/QrScanner.jsx';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { normalizeScannedText } from '../utils/scanNormalize.js';

export default function ReturnPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchMode, setSearchMode] = useState('student'); // 'student', 'receipt', 'found'
  const [studentQuery, setStudentQuery] = useState('');
  const [receiptQuery, setReceiptQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionItems, setTransactionItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({}); // { itemId: { condition, fine, notes } }
  const [paymentStatus, setPaymentStatus] = useState('paid'); // 'paid' or 'pending'
  const [officerName, setOfficerName] = useState('');
  const [officerTitle, setOfficerTitle] = useState('Petugas Perpustakaan');
  const [message, setMessage] = useState('');
  const [receiptHtml, setReceiptHtml] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState(''); // 'receipt' or 'book'
  const [showFoundBookModal, setShowFoundBookModal] = useState(false);
  const [foundBookData, setFoundBookData] = useState({ code: '', description: '' });
  const [returnSuccess, setReturnSuccess] = useState(null); // { transactionId, totalFine, status }

  // Active Loan Dropdown State
  const [activeTransactions, setActiveTransactions] = useState([]);
  const [receiptResults, setReceiptResults] = useState([]);
  const [showReceiptDropdown, setShowReceiptDropdown] = useState(false);

  const loadActiveTransactions = async () => {
    try {
      const res = await api.get('/transactions');
      const ongoing = (res.data || []).filter(
        (t) => t.status === 'ongoing' || t.status === 'partially_returned' || t.status === 'has_problem_pending'
      );
      setActiveTransactions(ongoing);
    } catch (err) {
      console.error('Failed to load active transactions:', err);
    }
  };

  useEffect(() => {
    loadActiveTransactions();
  }, []);

  const searchStudents = async (q) => {
    if (!q) {
      setStudentResults([]);
      return;
    }
    try {
      const res = await api.get('/transactions/search-by-student', { params: { q } });
      setStudentResults(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const searchByReceipt = async (receiptNumber) => {
    const clean = normalizeScannedText(String(receiptNumber || ''));
    if (!clean) return;
    try {
      const res = await api.get(
        `/transactions/by-receipt/${encodeURIComponent(clean)}`
      );
      const tx = res.data;
      setSelectedTransaction(tx);
      const returnedItems = Array.isArray(tx.items) ? tx.items : [];

      // Check transaction status
      if (tx.status === 'complete' || tx.status === 'completed' || tx.status === 'has_problem_resolved') {
        setMessage('✅ Transaksi ini sudah selesai dikembalikan & seluruh denda telah lunas.');
        if (returnedItems.length > 0) {
          setTransactionItems(returnedItems);
        } else {
          loadTransactionItems(tx.id);
        }
        setSelectedItems({});
      } else if (tx.status === 'has_problem_pending') {
        setMessage(`⚠️ Transaksi berstatus "Denda Belum Lunas"${tx.totalFine ? ` (Rp ${Number(tx.totalFine).toLocaleString('id-ID')})` : ''}. Buku sudah dikembalikan, silakan konfirmasi pembayaran denda.`);
        if (returnedItems.length > 0) {
          setTransactionItems(returnedItems);
        } else {
          loadTransactionItems(tx.id);
        }
        setSelectedItems({});
      } else if (tx.status === 'partially_returned') {
        setMessage('🔄 Transaksi ini baru dikembalikan sebagian. Silakan proses buku yang tersisa.');
        loadTransactionItems(tx.id);
      } else {
        setMessage('');
        loadTransactionItems(tx.id);
      }
    } catch (err) {
      setMessage('❌ Transaksi tidak ditemukan');
      console.error(err);
    }
  };
  const handleReceiptInputChange = (val) => {
    setReceiptQuery(val);
    setShowReceiptDropdown(true);
    if (!val.trim()) {
      setReceiptResults(activeTransactions.slice(0, 10));
      return;
    }
    const qLower = val.toLowerCase();
    const filtered = activeTransactions.filter((t) => {
      const receipt = (t.receiptNumber || t.id || '').toLowerCase();
      const sName = (t.student?.name || '').toLowerCase();
      const sNis = (t.student?.nis || '').toLowerCase();
      return receipt.includes(qLower) || sName.includes(qLower) || sNis.includes(qLower);
    });
    setReceiptResults(filtered.slice(0, 10));
  };

  const handleSelectTransaction = (tx) => {
    setSelectedTransaction(tx);
    setStudentQuery('');
    setStudentResults([]);
    setShowReceiptDropdown(false);
    if (tx.status === 'complete' || tx.status === 'completed' || tx.status === 'has_problem_resolved') {
      setMessage('✅ Transaksi ini sudah selesai dikembalikan & seluruh denda telah lunas.');
      loadTransactionItems(tx.id);
    } else if (tx.status === 'has_problem_pending') {
      setMessage(`⚠️ Transaksi berstatus "Denda Belum Lunas"${tx.totalFine ? ` (Rp ${Number(tx.totalFine).toLocaleString('id-ID')})` : ''}. Buku sudah dikembalikan, silakan konfirmasi pelunasan denda.`);
      loadTransactionItems(tx.id);
      setSelectedItems({});
    } else {
      setMessage('');
      loadTransactionItems(tx.id);
    }
  };

  useEffect(() => {
    const r = location.state?.openReceipt;
    if (!r) return;
    const clean = normalizeScannedText(String(r));
    if (!clean) return;
    setSearchMode('receipt');
    setReceiptQuery(clean);
    searchByReceipt(clean);
    navigate('/app/return', { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya reaksi ke navigasi dari Scan QR
  }, [location.state, navigate]);

  const loadTransactionItems = async (transactionId) => {
    try {
      const res = await api.get(`/transactions/${transactionId}/items`);
      setTransactionItems(res.data || []);

      // Initialize selected items
      const initial = {};
      res.data.forEach((item) => {
        initial[item.itemId] = {
          selected: false,
          condition: 'good',
          fine: 0,
          notes: ''
        };
      });
      setSelectedItems(initial);
    } catch (err) {
      console.error(err);
      setMessage('❌ Gagal memuat detail transaksi');
    }
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId]?.selected
      }
    }));
  };

  const updateItemCondition = (itemId, field, value) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleReturn = async () => {
    const selected = Object.entries(selectedItems)
      .filter(([_, data]) => data.selected)
      .map(([itemId, data]) => ({
        itemId,
        condition: data.condition,
        fine: data.fine || 0,
        notes: data.notes || ''
      }));

    if (selected.length === 0) {
      setMessage('⚠️ Pilih minimal satu buku untuk dikembalikan');
      return;
    }

    if (!selectedTransaction) {
      setMessage('⚠️ Pilih transaksi terlebih dahulu');
      return;
    }

    if (!officerName.trim()) {
      setMessage('⚠️ Nama petugas wajib diisi');
      return;
    }
    if (!officerTitle.trim()) {
      setMessage('⚠️ Jabatan petugas wajib diisi');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/transactions/return', {
        transactionId: selectedTransaction.id,
        items: selected,
        paymentStatus: paymentStatus,
        officerName: officerName.trim(),
        officerTitle: officerTitle.trim()
      });
      setReturnSuccess({
        transactionId: selectedTransaction.id,
        receiptNumber: selectedTransaction.receiptNumber || selectedTransaction.id,
        totalFine: res.data.totalFine || 0,
        status: res.data.status,
        paymentStatus: paymentStatus
      });
      setMessage('✅ Pengembalian berhasil diproses');
      setSelectedItems({});
      setSelectedTransaction(null);
      setOfficerName('');
      setOfficerTitle('Petugas Perpustakaan');
      setTransactionItems([]);
      setPaymentStatus('paid');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Gagal memproses pengembalian';
      setMessage(`❌ ${errorMsg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFoundBook = async () => {
    if (!foundBookData.code) {
      setMessage('⚠️ Masukkan kode buku');
      return;
    }
    setLoading(true);
    try {
      await api.post('/transactions/found-book', foundBookData);
      setMessage('✅ Buku ditemukan berhasil dicatat');
      setShowFoundBookModal(false);
      setFoundBookData({ code: '', description: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Gagal mencatat buku ditemukan';
      setMessage(`❌ ${errorMsg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalFine = () => {
    return Object.values(selectedItems)
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + (Number(item.fine) || 0), 0);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📥 Pengembalian Buku</h2>
          <p className="page-subtitle">Proses pengembalian buku dengan berbagai metode pencarian</p>
        </div>
      </div>

      {/* Search Mode Tabs */}
      <div className="search-mode-tabs">
        <button
          type="button"
          className={`tab-button ${searchMode === 'student' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('student');
            setSelectedTransaction(null);
            setTransactionItems([]);
          }}
        >
          👤 Cari Peminjam
        </button>
        <button
          type="button"
          className={`tab-button ${searchMode === 'receipt' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('receipt');
            setSelectedTransaction(null);
            setTransactionItems([]);
          }}
        >
          🎫 Scan Kode Peminjaman
        </button>
        <button
          type="button"
          className={`tab-button ${searchMode === 'found' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('found');
            setShowFoundBookModal(true);
          }}
        >
          🔍 Buku Ditemukan
        </button>
      </div>

      {message && (
        <div className={`form-message ${message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {/* Search by Student */}
      {searchMode === 'student' && (
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">👤</span>
            <h3 className="form-card-title">Cari Peminjam</h3>
          </div>
          <div className="form-card-body">
            <label className="form-label">
              Nama Peminjam
              <input
                className="form-input"
                placeholder="🔍 Ketik nama peminjam..."
                value={studentQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setStudentQuery(v);
                  searchStudents(v);
                }}
              />
            </label>
            {studentResults.length > 0 && (
              <div className="dropdown">
                {studentResults.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleSelectTransaction(tx)}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong>{tx.student?.name || '-'}</strong>
                        {tx.student?.role === 'teacher' ? (
                          <span style={{ fontSize: 10, padding: '1px 6px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 4, fontWeight: 700 }}>
                            👨‍🏫 GURU
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, padding: '1px 6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, fontWeight: 700 }}>
                            🎓 SISWA
                          </span>
                        )}
                      </div>
                      <div className="dropdown-meta">
                        {tx.student?.role === 'teacher' ? `NIP/NUPTK: ${tx.student?.nis || '-'} • Guru` : `NIS: ${tx.student?.nis || '-'} • ${tx.student?.class || ''}`} | Kode: {tx.receiptNumber} • {tx.borrowDate ? new Date(tx.borrowDate).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search by Receipt */}
      {searchMode === 'receipt' && (
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">🎫</span>
            <h3 className="form-card-title">Pilih / Scan Kode Peminjaman</h3>
          </div>
          <div className="form-card-body" style={{ position: 'relative' }}>
            <div className="code-input-group">
              <input
                className="form-input code-input"
                placeholder="🔍 Ketik/pilih kode TX, nama siswa, atau scan QR..."
                value={receiptQuery}
                onFocus={() => {
                  setShowReceiptDropdown(true);
                  handleReceiptInputChange(receiptQuery);
                }}
                onChange={(e) => handleReceiptInputChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchByReceipt(receiptQuery);
                    setShowReceiptDropdown(false);
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary btn-scan"
                onClick={() => {
                  setScanType('receipt');
                  setShowScanner(true);
                }}
              >
                📷 Scan QR
              </button>
            </div>

            {/* Dropdown Active Loan Transactions */}
            {showReceiptDropdown && (receiptResults.length > 0 || activeTransactions.length > 0) && (
              <div className="dropdown" style={{ marginTop: 4, width: '100%', maxHeight: 260, overflowY: 'auto' }}>
                {(receiptResults.length > 0 ? receiptResults : activeTransactions.slice(0, 10)).map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    className="dropdown-item"
                    style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                    onClick={() => {
                      setReceiptQuery(tx.receiptNumber || tx.id);
                      setShowReceiptDropdown(false);
                      handleSelectTransaction(tx);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: '#1d4ed8', fontSize: 13 }}>🎫 {tx.receiptNumber || tx.id}</strong>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{tx.student?.role === 'teacher' ? '👨‍🏫' : '👤'} {tx.student?.name || 'Peminjam'} {tx.student?.nis ? `(${tx.student.nis})` : ''}</span>
                          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: tx.student?.role === 'teacher' ? '#ecfdf5' : '#eff6ff', color: tx.student?.role === 'teacher' ? '#047857' : '#1d4ed8', border: tx.student?.role === 'teacher' ? '1px solid #a7f3d0' : '1px solid #bfdbfe', fontWeight: 700 }}>
                            {tx.student?.role === 'teacher' ? 'GURU' : 'SISWA'}
                          </span>
                        </div>
                      </div>
                      {tx.status === 'has_problem_pending' ? (
                        <span style={{ fontSize: 11, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                          ⚠️ Denda Belum Lunas
                        </span>
                      ) : tx.status === 'partially_returned' ? (
                        <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                          🔄 Sebagian
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                          {tx.borrowDate ? new Date(tx.borrowDate).toLocaleDateString('id-ID') : '-'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <p className="form-hint" style={{ marginTop: 10 }}>
              💡 Pilih transaksi peminjaman dari dropdown, scan QR struk, atau ketik kode peminjaman.
            </p>
          </div>
        </div>
      )}

      {/* Selected Transaction Info */}
      {selectedTransaction && (
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">📋</span>
            <h3 className="form-card-title">Detail Transaksi</h3>
          </div>
          <div className="form-card-body">
            <div className="transaction-info">
              <div className="info-row">
                <span className="info-label">Peminjam:</span>
                <span className="info-value" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <strong>{selectedTransaction.student?.name || '-'}</strong>
                  {selectedTransaction.student?.role === 'teacher' ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 12, fontWeight: 700 }}>
                      👨‍🏫 Guru (NIP/NUPTK: {selectedTransaction.student?.nis || '-'})
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 12, fontWeight: 700 }}>
                      🎓 Siswa (NIS: {selectedTransaction.student?.nis || '-'})
                    </span>
                  )}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Kode Peminjaman:</span>
                <span className="info-value">{selectedTransaction.receiptNumber || '-'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {selectedTransaction.status === 'ongoing' && '🟢 Sedang Dipinjam'}
                  {(selectedTransaction.status === 'complete' || selectedTransaction.status === 'completed') && '✅ Selesai'}
                  {selectedTransaction.status === 'has_problem_pending' && (
                    <span style={{ color: '#dc2626', fontWeight: 800 }}>
                      ⚠️ Denda Belum Lunas {selectedTransaction.totalFine ? `(Rp ${Number(selectedTransaction.totalFine).toLocaleString('id-ID')})` : ''}
                    </span>
                  )}
                  {selectedTransaction.status === 'has_problem_resolved' && '💚 Denda Lunas (Selesai)'}
                  {selectedTransaction.status === 'partially_returned' && '🔄 Sebagian Dikembalikan'}
                  {!['ongoing', 'complete', 'completed', 'has_problem_pending', 'has_problem_resolved', 'partially_returned', 'pending_payment'].includes(selectedTransaction.status) && selectedTransaction.status}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Tanggal Pinjam:</span>
                <span className="info-value">
                  {selectedTransaction.borrowDate
                    ? new Date(selectedTransaction.borrowDate).toLocaleDateString('id-ID')
                    : '-'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Jatuh Tempo:</span>
                <span className="info-value">
                  {selectedTransaction.dueDate
                    ? new Date(selectedTransaction.dueDate).toLocaleDateString('id-ID')
                    : '-'}
                </span>
              </div>
              {selectedTransaction.returnDate && (
                <div className="info-row">
                  <span className="info-label">Tanggal Kembali:</span>
                  <span className="info-value">
                    {new Date(selectedTransaction.returnDate).toLocaleDateString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            {/* Status Messages */}
            {(selectedTransaction.status === 'complete' || selectedTransaction.status === 'completed' || selectedTransaction.status === 'has_problem_resolved') && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                borderRadius: '12px',
                border: '2px solid #86efac',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>✅</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontWeight: '700' }}>
                  {selectedTransaction.status === 'has_problem_resolved' ? 'Buku Dikembalikan & Denda Telah Lunas' : 'Buku Sudah Dikembalikan'}
                </h4>
                <p style={{ margin: '0 0 16px 0', color: '#15803d', fontSize: '14px' }}>
                  Transaksi ini sudah selesai. Silakan cetak struk jika diperlukan.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/transactions/${selectedTransaction.id}/return-receipt`, {
                        responseType: 'text'
                      });
                      setReceiptHtml(res.data);
                      setShowReceiptModal(true);
                    } catch (err) {
                      console.error('Receipt error:', err);
                      alert('Gagal membuka struk. Silakan cek console untuk detail.');
                    }
                  }}
                >
                  🖨️ Tampilkan Struk
                </button>
              </div>
            )}

            {selectedTransaction.status === 'has_problem_pending' && (
              <div style={{
                marginTop: '16px',
                padding: '20px',
                background: '#fef2f2',
                borderRadius: '12px',
                border: '2px solid #fca5a5',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '44px', marginBottom: '8px' }}>⚠️</div>
                <h4 style={{ margin: '0 0 6px 0', color: '#991b1b', fontWeight: '800', fontSize: '17px' }}>
                  Buku Sudah Dikembalikan — Denda / Ganti Rugi Belum Lunas
                </h4>
                <p style={{ margin: '0 0 14px 0', color: '#7f1d1d', fontSize: '13px', lineHeight: 1.5 }}>
                  Buku pada transaksi ini telah diterima di perpustakaan, namun tercatat denda / tanggungan sebesar{' '}
                  <strong style={{ fontSize: '15px', color: '#b91c1c' }}>
                    Rp {Number(selectedTransaction.totalFine || 0).toLocaleString('id-ID')}
                  </strong>
                  {selectedTransaction.problemSummary ? ` (${selectedTransaction.problemSummary})` : ''} yang belum dibayarkan.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#059669', borderColor: '#059669', fontWeight: 700 }}
                    onClick={async () => {
                      const fineAmt = Number(selectedTransaction.totalFine || 0);
                      const name = selectedTransaction.student?.name || 'Peminjam';
                      if (!confirm(`💳 KONFIRMASI PELUNASAN DENDA\n\nNama: ${name}\nTotal: Rp ${fineAmt.toLocaleString('id-ID')}\n\nApakah peminjam sudah melunasi pembayaran denda atau menyelesaikan ganti rugi buku?\n\nKlik OK untuk mengubah status menjadi Lunas.`)) return;
                      try {
                        await api.put(`/transactions/${selectedTransaction.id}/resolve-pending`, { action: 'paid' });
                        alert('✅ Denda berhasil diselesaikan & ditandai Lunas!');
                        setSelectedTransaction({ ...selectedTransaction, status: 'has_problem_resolved', paymentStatus: 'paid' });
                        loadActiveTransactions();
                      } catch (err) {
                        alert('❌ Gagal menyelesaikan denda: ' + (err.response?.data?.message || err.message));
                      }
                    }}
                  >
                    💳 Tandai Denda Sudah Lunas
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={async () => {
                      try {
                        const res = await api.get(`/transactions/${selectedTransaction.id}/return-receipt`, {
                          responseType: 'text'
                        });
                        setReceiptHtml(res.data);
                        setShowReceiptModal(true);
                      } catch (err) {
                        console.error('Receipt error:', err);
                        alert('Gagal membuka struk.');
                      }
                    }}
                  >
                    🖨️ Tampilkan Struk
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate('/app/transactions')}
                  >
                    📋 Riwayat Transaksi
                  </button>
                </div>
              </div>
            )}

            {selectedTransaction.status === 'partially_returned' && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '12px',
                border: '2px solid #fcd34d',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔄</div>
                <h4 style={{ margin: '0 0 8px 0', color: '#92400e', fontWeight: '700' }}>
                  Sebagian Buku Sudah Dikembalikan
                </h4>
                <p style={{ margin: '0 0 16px 0', color: '#78350f', fontSize: '14px' }}>
                  Beberapa buku telah dikembalikan sebelumnya. Silakan pilih dan proses pengembalian buku yang masih dipinjam di bawah ini.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Items - Read-only display for returned transactions / has_problem_pending */}
      {selectedTransaction &&
        transactionItems.length > 0 &&
        (selectedTransaction.status === 'has_problem_pending' ||
          selectedTransaction.status === 'has_problem_resolved' ||
          selectedTransaction.status === 'complete' ||
          selectedTransaction.status === 'completed') && (
          <div className="form-card">
            <div className="form-card-header">
              <span className="form-card-icon">📚</span>
              <h3 className="form-card-title">
                {selectedTransaction.status === 'has_problem_pending'
                  ? 'Daftar Buku (Status: Menunggu Pembayaran Denda)'
                  : 'Daftar Buku pada Transaksi Ini'}
              </h3>
            </div>
            <div className="form-card-body">
              <div className="items-list">
                {transactionItems.map((item, idx) => {
                  const conditionClass =
                    item.condition === 'good'
                      ? 'condition-good'
                      : item.condition === 'damaged'
                        ? 'condition-damaged'
                        : 'condition-lost';
                  const conditionText =
                    item.condition === 'good'
                      ? '✅ Kondisi Baik'
                      : item.condition === 'damaged'
                        ? '⚠️ Rusak'
                        : item.condition === 'lost'
                          ? '❌ Hilang'
                          : '✅ Baik';
                  const bookTitle = item.book?.title || item.title || 'Buku Perpustakaan';
                  const bookAuthor = item.book?.author || item.author || '-';
                  const itemCode = item.item?.uniqueCode || item.code || '-';
                  const fine = Number(item.fine || 0);

                  return (
                    <div key={item.id || item.itemId || idx} className="item-card" style={{ cursor: 'default' }}>
                      <div className="item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="item-title" style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                          {bookTitle}
                        </span>
                        <span className={`condition-badge ${conditionClass}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                          {conditionText}
                        </span>
                      </div>
                      <div className="item-meta" style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569' }}>
                        <span><strong>Penulis:</strong> {bookAuthor}</span>
                        <span><strong>Kode Item:</strong> {itemCode}</span>
                        {fine > 0 && (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>
                            <strong>Denda:</strong> Rp {fine.toLocaleString('id-ID')}
                          </span>
                        )}
                        {item.notes && (
                          <span style={{ fontStyle: 'italic', color: '#64748b' }}>
                            <strong>Catatan:</strong> {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* Transaction Items - Only show if transaction is ongoing or partially returned */}
      {selectedTransaction &&
        transactionItems.length > 0 &&
        (selectedTransaction.status === 'ongoing' ||
          selectedTransaction.status === 'partially_returned') && (
          <div className="form-card">
            <div className="form-card-header">
              <span className="form-card-icon">📚</span>
              <h3 className="form-card-title">Daftar Buku yang Dipinjam</h3>
            </div>
            <div className="form-card-body">
              <div className="items-list">
                {transactionItems.map((item) => {
                  const isSelected = selectedItems[item.itemId]?.selected || false;
                  const itemData = selectedItems[item.itemId] || {
                    selected: false,
                    condition: 'good',
                    fine: 0,
                    notes: ''
                  };

                  return (
                    <div key={item.itemId} className={`item-card ${isSelected ? 'selected' : ''}`}>
                      <div className="item-header">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemSelection(item.itemId)}
                          />
                          <span className="item-title">{item.book?.title || 'Buku tidak ditemukan'}</span>
                        </label>
                        <button
                          type="button"
                          className="btn-icon btn-scan-small"
                          onClick={() => {
                            setScanType('book');
                            setShowScanner(true);
                          }}
                          title="Scan QR Buku"
                        >
                          📷
                        </button>
                      </div>
                      {item.book && (
                        <div className="item-meta">
                          <span>Penulis: {item.book.author || '-'}</span>
                          <span>Kode: {item.item?.uniqueCode || '-'}</span>
                        </div>
                      )}
                      {isSelected && (
                        <div className="item-conditions">
                          <label className="form-label">
                            Kondisi
                            <select
                              className="form-input"
                              value={itemData.condition}
                              onChange={(e) => updateItemCondition(item.itemId, 'condition', e.target.value)}
                            >
                              <option value="good">✅ Baik</option>
                              <option value="damaged">⚠️ Rusak</option>
                              <option value="lost">❌ Hilang</option>
                            </select>
                          </label>
                          {(itemData.condition === 'lost' || itemData.condition === 'damaged') && (
                            <>
                              <label className="form-label">
                                Denda (Rp)
                                <input
                                  type="number"
                                  className="form-input"
                                  min="0"
                                  value={itemData.fine}
                                  onChange={(e) => updateItemCondition(item.itemId, 'fine', e.target.value)}
                                  placeholder="0"
                                />
                              </label>
                              <label className="form-label">
                                Catatan
                                <textarea
                                  className="form-input"
                                  value={itemData.notes}
                                  onChange={(e) => updateItemCondition(item.itemId, 'notes', e.target.value)}
                                  placeholder="Catatan tambahan..."
                                  rows="2"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Object.values(selectedItems).filter((item) => item.selected).length > 0 && (
                <div className="return-summary">
                  <div className="summary-row">
                    <span>Total Denda:</span>
                    <strong>Rp {calculateTotalFine().toLocaleString('id-ID')}</strong>
                  </div>
                  {calculateTotalFine() > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <label className="form-label">
                        Status Pembayaran
                        <select
                          className="form-input"
                          value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value)}
                        >
                          <option value="paid">💳 Bayar Langsung</option>
                          <option value="pending">⏳ Bayar Nanti</option>
                        </select>
                      </label>
                      <p className="form-hint">
                        {paymentStatus === 'paid'
                          ? '✅ Transaksi akan langsung selesai setelah pengembalian'
                          : '⚠️ Transaksi akan menunggu pembayaran denda, perlu konfirmasi lagi nanti'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {selectedTransaction && Object.values(selectedItems).filter((item) => item.selected).length > 0 && (
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">✍️</span>
            <h3 className="form-card-title">Petugas yang Menandatangani</h3>
          </div>
          <div className="form-card-body">
            <label className="form-label">
              Jabatan / Posisi
              <select
                className="form-input"
                value={officerTitle}
                onChange={(e) => setOfficerTitle(e.target.value)}
                required
              >
                <option value="Petugas Perpustakaan">Petugas Perpustakaan</option>
                <option value="Kepala Sekolah">Kepala Sekolah</option>
                <option value="Guru">Guru</option>
                <option value="Karyawan">Karyawan</option>
                <option value="Wakil Kepala Sekolah">Wakil Kepala Sekolah</option>
                <option value="Wali Kelas">Wali Kelas</option>
                <option value="Staf Administrasi">Staf Administrasi</option>
              </select>
            </label>
            <label className="form-label">
              Nama Petugas
              <input
                type="text"
                className="form-input"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Contoh: Karin, Ata Fadli, dll"
                required
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Nama lengkap petugas yang akan menandatangani struk
              </small>
            </label>
          </div>
        </div>
      )}

      {message && (
        <div className={`form-message ${message.includes('berhasil') || message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {selectedTransaction &&
        (selectedTransaction.status === 'ongoing' || selectedTransaction.status === 'partially_returned') && (
        <button
          type="button"
          className="btn-submit"
          onClick={handleReturn}
          disabled={loading || Object.values(selectedItems).filter((item) => item.selected).length === 0 || !officerName.trim() || !officerTitle.trim()}
        >
          {loading ? '⏳ Memproses...' : '✅ Proses Pengembalian'}
        </button>
      )}

      {/* Return Success Modal */}
      {returnSuccess && (
        <div className="modal-overlay" onClick={() => setReturnSuccess(null)}>
          <div className="modal-content modal-success" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Pengembalian Berhasil!</h3>
              <button className="modal-close" onClick={() => setReturnSuccess(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  QR Code Pengembalian
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(returnSuccess.receiptNumber)}`}
                    alt={`QR Code ${returnSuccess.receiptNumber}`}
                    style={{ width: '200px', height: '200px', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: 'white' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', letterSpacing: '1px', fontFamily: 'monospace' }}>
                      {returnSuccess.receiptNumber}
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                      Kode transaksi pengembalian
                    </p>
                  </div>
                </div>
              </div>
              {returnSuccess.totalFine > 0 && (
                <div className="payment-info" style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <p><strong>Total Denda:</strong> Rp {returnSuccess.totalFine.toLocaleString('id-ID')}</p>
                  <p style={{ color: returnSuccess.paymentStatus === 'paid' ? '#166534' : '#92400e', marginTop: '4px' }}>
                    Status: {returnSuccess.paymentStatus === 'paid' ? '✅ LUNAS' : '⏳ BELUM LUNAS'}
                  </p>
                </div>
              )}
              <div className="success-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/transactions/${returnSuccess.transactionId}/return-receipt`, {
                        responseType: 'text'
                      });
                      setReceiptHtml(res.data);
                      setShowReceiptModal(true);
                    } catch (err) {
                      console.error('Receipt error:', err);
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
                    }
                  }}
                >
                  🖨️ Cetak Struk
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReturnSuccess(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner */}
      {showScanner && (
        <QrScanner
          onResult={async (code) => {
            const trimmed = (code || '').trim();
            if (!trimmed) {
              setShowScanner(false);
              return;
            }

            try {
              if (scanType === 'receipt') {
                setReceiptQuery(trimmed);
                await searchByReceipt(trimmed);
              } else if (scanType === 'book') {
                const item = transactionItems.find(
                  (i) =>
                    i.item?.uniqueCode === trimmed ||
                    i.itemId === trimmed ||
                    i.book?.id === trimmed ||
                    i.bookId === trimmed ||
                    i.item?.bookId === trimmed
                );
                if (item) {
                  if (!selectedItems[item.itemId]?.selected) {
                    toggleItemSelection(item.itemId);
                  }
                  setMessage(`✅ Buku "${item.book?.title || trimmed}" berhasil dipilih`);
                } else {
                  setMessage(`⚠️ Buku dengan kode ${trimmed} tidak ditemukan dalam transaksi ini`);
                }
              } else if (scanType === 'found') {
                setFoundBookData((prev) => ({ ...prev, code: trimmed }));
                setMessage(`✅ Kode ${trimmed} berhasil ditambahkan`);
              }
            } catch (e) {
              console.error(e);
              setMessage('❌ Gagal memproses hasil scan.');
            } finally {
              setShowScanner(false);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Found Book Modal */}
      {showFoundBookModal && (
        <div className="modal-overlay" onClick={() => setShowFoundBookModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Buku Ditemukan</h3>
              <button className="modal-close" onClick={() => setShowFoundBookModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">
                Kode Buku
                <div className="code-input-group">
                  <input
                    className="form-input"
                    placeholder="Masukkan kode atau scan QR..."
                    value={foundBookData.code}
                    onChange={(e) => setFoundBookData({ ...foundBookData, code: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn-primary btn-scan"
                    onClick={() => {
                      setScanType('found');
                      setShowScanner(true);
                    }}
                  >
                    📷 Scan
                  </button>
                </div>
              </label>
              <label className="form-label">
                Deskripsi Temuan
                <textarea
                  className="form-input"
                  placeholder="Deskripsi lokasi atau kondisi buku yang ditemukan..."
                  value={foundBookData.description}
                  onChange={(e) => setFoundBookData({ ...foundBookData, description: e.target.value })}
                  rows="4"
                />
              </label>
              <p className="form-hint">
                💡 Buku yang ditemukan akan dicatat dan bisa dikembalikan ke peminjam jika ada yang mengklaim
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowFoundBookModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleFoundBook}
                disabled={loading || !foundBookData.code}
              >
                {loading ? '⏳ Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        htmlContent={receiptHtml}
      />
    </div>
  );
}
