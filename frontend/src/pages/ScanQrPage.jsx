import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import QrScanner from '../components/QrScanner.jsx';
import { normalizeScannedText, isReceiptNumber } from '../utils/scanNormalize.js';

/**
 * Scan QR → tutup kamera dulu → proses API → langsung ke halaman terkait (pinjam / kembali).
 * Menghindari race React (layar putih) saat modal scanner masih terbuka.
 */
export default function ScanQrPage() {
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [panel, setPanel] = useState(null);

  const processScannedCode = useCallback(
    async (raw) => {
      const code = normalizeScannedText(String(raw || '').trim());
      if (!code) {
        setMessage('❌ Kode kosong.');
        return;
      }

      setLoading(true);
      setMessage('');
      setPanel(null);

      try {
        if (isReceiptNumber(code)) {
          const res = await api.get(
            `/transactions/by-receipt/${encodeURIComponent(code)}`
          );
          const tx = res.data;
          const done =
            tx.status === 'complete' || tx.status === 'completed';

          if (!done) {
            navigate('/app/return', { state: { openReceipt: code } });
            return;
          }

          setPanel({
            type: 'receipt',
            receipt: code,
            tx,
            done: true
          });
          setMessage('ℹ️ Transaksi ini sudah selesai dikembalikan.');
        } else {
          const res = await api.get(
            `/books/by-code/${encodeURIComponent(code)}`
          );
          const book = res.data;
          if (!book || typeof book !== 'object') {
            throw new Error('Data buku tidak valid');
          }
          const borrowCode = book.item?.uniqueCode || book.id;
          if (!borrowCode) {
            throw new Error('Tidak ada kode eksemplar untuk dipinjam');
          }
          navigate('/app/borrow', {
            state: {
              presetBorrowItems: [
                {
                  code: borrowCode,
                  title: book.title || 'Buku',
                  author: book.author
                }
              ]
            }
          });
        }
      } catch (err) {
        console.error(err);
        const msg =
          err.response?.data?.message ||
          (isReceiptNumber(code)
            ? 'Struk / transaksi tidak ditemukan.'
            : 'Buku atau kode tidak ditemukan.');
        setPanel({ type: 'error', detail: msg });
        setMessage(`❌ ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const handleDecodeResult = useCallback(
    (rawCode) => {
      // Tutup scanner jika masih terbuka (dari kamera live).
      // Dari scan gambar, scanner sudah ditutup oleh QrScanner sendiri.
      setShowScanner(false);
      window.setTimeout(() => {
        processScannedCode(rawCode).catch((err) => {
          console.error(err);
          setMessage('❌ Gagal memproses hasil scan.');
        });
      }, 300);
    },
    [processScannedCode]
  );

  const goReturnWithReceipt = (receipt) => {
    navigate('/app/return', { state: { openReceipt: receipt } });
  };

  const msgClass =
    message.startsWith('✅') || message.startsWith('ℹ️')
      ? 'form-message-success'
      : message.startsWith('⚠️')
        ? 'form-message-error'
        : 'form-message-error';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📷 Scan QR</h2>
          <p className="page-subtitle">
            <strong>QR buku</strong> → langsung ke <strong>Peminjaman</strong>.{' '}
            <strong>QR struk (TX-…)</strong> yang masih aktif → ke{' '}
            <strong>Pengembalian</strong>. Struk yang sudah selesai ditampilkan di sini.
          </p>
        </div>
      </div>

      {message && (
        <div className={`form-message ${msgClass}`}>{message}</div>
      )}

      <div className="form-card" style={{ marginBottom: 20 }}>
        <div className="form-card-header">
          <span className="form-card-icon">📷</span>
          <h3 className="form-card-title">Mulai scan</h3>
        </div>
        <div className="form-card-body">
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Kamera atau unggah foto QR. Pastikan pencahayaan cukup; jika kamera sulit,
            gunakan <strong>Scan dari gambar</strong>.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', padding: '14px 20px', fontSize: 16 }}
            disabled={loading}
            onClick={() => {
              setPanel(null);
              setMessage('');
              setShowScanner(true);
            }}
          >
            {loading ? '⏳ Memproses…' : '📷 Buka scanner (kamera / gambar)'}
          </button>
        </div>
      </div>

      {panel && panel.type === 'receipt' && panel.tx && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <div className="form-card-header">
            <span className="form-card-icon">🎫</span>
            <h3 className="form-card-title">Struk (sudah selesai)</h3>
          </div>
          <div className="form-card-body">
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>{panel.receipt}</p>
            <p style={{ margin: '0 0 8px', color: '#64748b' }}>
              Peminjam:{' '}
              <strong>{panel.tx.student?.name || panel.tx.studentId || '-'}</strong>
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569' }}>
              Status: <strong>{panel.tx.status}</strong>
            </p>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'rgba(34, 197, 94, 0.1)',
                marginBottom: 16,
                border: '1px solid rgba(34, 197, 94, 0.25)'
              }}
            >
              <strong>Pengembalian sudah diselesaikan</strong>
              <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                Transaksi ini tidak lagi aktif.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => goReturnWithReceipt(panel.receipt)}
              >
                Lihat di halaman Pengembalian
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPanel(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {panel && panel.type === 'error' && (
        <div className="form-card form-message form-message-error" style={{ marginBottom: 20 }}>
          <strong>Scan tidak dikenali</strong>
          <p style={{ margin: '8px 0 0' }}>{panel.detail}</p>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => setPanel(null)}
          >
            OK
          </button>
        </div>
      )}

      {showScanner && (
        <QrScanner onResult={handleDecodeResult} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
