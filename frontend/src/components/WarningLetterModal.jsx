import React from 'react';

export default function WarningLetterModal({ isOpen, onClose, transaction }) {
  if (!isOpen || !transaction) return null;

  const student = transaction.student || {};
  const items = transaction.items || [];
  
  const today = new Date();
  const dueDate = transaction.dueDate ? new Date(transaction.dueDate) : today;
  const diffTime = Math.max(0, today.getTime() - dueDate.getTime());
  const lateDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const finePerDay = 1000;
  const estimatedFine = lateDays * finePerDay * (transaction.itemCount || items.length || 1);

  const formatDateLong = (dateObj) => {
    try {
      return new Date(dateObj).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 780,
          background: '#ffffff',
          borderRadius: 16,
          padding: 0,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header Controls (Not Printed) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            background: '#0f172a',
            color: 'white'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>
              Surat Peringatan Keterlambatan Pengembalian Buku
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                background: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              🖨️ Cetak Surat Peringatan
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Official Warning Letter Area */}
        <div
          id="printable-warning-letter"
          style={{
            padding: '36px 48px',
            color: '#1e293b',
            fontFamily: "'Times New Roman', Times, serif",
            overflowY: 'auto',
            flex: 1,
            background: 'white'
          }}
        >
          {/* Official Kop Surat */}
          <div
            style={{
              textAlign: 'center',
              borderBottom: '3px double #0f172a',
              paddingBottom: 12,
              marginBottom: 24
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', letterSpacing: 1, color: '#0f172a' }}>
              YAYASAN PERGURUAN TUNAS KARYA
            </h2>
            <h3 style={{ margin: '4px 0', fontSize: 18, fontWeight: 'bold', color: '#166534' }}>
              PERPUSTAKAAN INTEGRASI SEKOLAH
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
              Jl. Pembangunan No. 45, Kompleks Pendidikan Tunas Karya • Telp: (021) 555-0199 • Email: perpus@tunaskarya.sch.id
            </p>
          </div>

          {/* Letter Title */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 'bold',
                textDecoration: 'underline',
                textTransform: 'uppercase',
                color: '#dc2626'
              }}
            >
              SURAT PERINGATAN KETERLAMBATAN PENGEMBALIAN BUKU
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              Nomor: SP/PERPUS/{new Date().getFullYear()}/{(transaction.receiptNumber || transaction.id).substring(0, 10)}
            </p>
          </div>

          {/* Recipient Info */}
          <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px' }}>Kepada Yth.</p>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Siswa/i: {student.name || 'Siswa Perpustakaan'}</p>
            <p style={{ margin: 0 }}>NIS: {student.nis || '-'}</p>
            <p style={{ margin: 0 }}>Kelas / Jurusan: {student.class || '-'} {student.major ? `(${student.major})` : ''}</p>
            <p style={{ margin: 0 }}>Di Tempat</p>
          </div>

          {/* Body Paragraph */}
          <div style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 20, textAlign: 'justify' }}>
            <p style={{ margin: '0 0 12px' }}>Dengan hormat,</p>
            <p style={{ margin: 0 }}>
              Berdasarkan catatan sistem informasi perpustakaan YP Tunas Karya, hingga surat peringatan ini diterbitkan pada tanggal{' '}
              <strong>{formatDateLong(today)}</strong>, Saudara/i belum mengembalikan pinjaman buku dengan rincian transaksi sebagai berikut:
            </p>
          </div>

          {/* Transaction & Book Details Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
              fontSize: 13
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <strong>No. Struk Transaksi:</strong> {transaction.receiptNumber || transaction.id}
              </div>
              <div>
                <strong>Tanggal Pinjam:</strong> {formatDateLong(transaction.borrowDate)}
              </div>
              <div>
                <strong>Tanggal Jatuh Tempo:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{formatDateLong(transaction.dueDate)}</span>
              </div>
              <div>
                <strong>Keterlambatan:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{lateDays} Hari</span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>No</th>
                  <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>Judul Buku</th>
                  <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                        {item.title || item.name || 'Buku Perpustakaan'}
                      </td>
                      <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>
                        Belum Dikembalikan
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>1</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>
                      Buku Peminjaman Kode {transaction.receiptNumber}
                    </td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#dc2626', fontWeight: 'bold' }}>
                      Belum Dikembalikan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1', textAlign: 'right' }}>
              <strong>Estimasi Denda Keterlambatan: </strong>
              <span style={{ color: '#dc2626', fontSize: 15, fontWeight: 'bold' }}>
                Rp {estimatedFine.toLocaleString('id-ID')}
              </span>
              <br />
              <small style={{ color: '#64748b' }}>(Perhitungan denda Rp {finePerDay.toLocaleString('id-ID')} / hari per buku)</small>
            </div>
          </div>

          {/* Directive & Call to Action */}
          <div style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 30, textAlign: 'justify' }}>
            <p style={{ margin: '0 0 10px' }}>
              Mengingat pentingnya ketersediaan buku untuk siswa lainnya, kami menghimbau Saudara/i untuk{' '}
              <strong>segera mengembalikan buku tersebut ke ruang perpustakaan</strong> pada jam operasional sekolah.
            </p>
            <p style={{ margin: 0 }}>
              Demikian surat peringatan ini disampaikan. Atas perhatian dan kerjasamanya, kami ucapkan terima kasih.
            </p>
          </div>

          {/* Signature Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40, pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: 220 }}>
              <p style={{ margin: '0 0 60px', fontSize: 13 }}>Mengetahui,<br />Peminjam / Siswa</p>
              <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>{student.name || '(...............................)'}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>NIS: {student.nis || '-'}</p>
            </div>

            <div style={{ textAlign: 'center', width: 240 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13 }}>Tunas Karya, {formatDateLong(today)}</p>
              <p style={{ margin: '0 0 60px', fontSize: 13 }}>Petugas Perpustakaan,</p>
              <p style={{ margin: 0, fontWeight: 'bold', textDecoration: 'underline' }}>
                {transaction.officerName || 'Staf Perpustakaan'}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                {transaction.officerTitle || 'Petugas Layanan Sirkulasi'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-warning-letter, #printable-warning-letter * {
            visibility: visible;
          }
          #printable-warning-letter {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
