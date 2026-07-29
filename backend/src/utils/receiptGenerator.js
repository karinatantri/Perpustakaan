/**
 * Utility module for generating HTML receipts for Borrow and Return transactions.
 * Extracted from transactions.js to enforce Separation of Concerns and Single Responsibility.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COMMON_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; background: white; margin: 0 auto; padding: 10px; }
  @media screen { body { width: 100%; max-width: 210mm; } }
  @media print { body { width: 210mm; min-height: 297mm; padding: 10mm; } }
  .receipt-container { width: 100%; background: white; border: 2px solid #1d4ed8; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
  .header { text-align: center; margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); border-radius: 6px; color: white; }
  .logo { font-size: 24px; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .logo-img { height: 50px; width: auto; object-fit: contain; }
  .school-name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  .receipt-title { font-size: 12px; opacity: 0.95; margin-top: 2px; }
  .top-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 8px; align-items: start; }
  .qr-side { text-align: center; padding: 10px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; justify-self: end; max-width: 170px; }
  .code-label { font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
  .qr-image { width: 110px; height: 110px; object-fit: contain; margin: 4px auto; display: block; }
  .qr-text { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: 1px; margin-top: 2px; }
  .qr-hint { font-size: 9px; color: #64748b; margin-top: 3px; font-style: italic; }
  .meta { margin: 8px 0; font-size: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; padding: 10px; background: #f8fafc; border-radius: 6px; }
  .meta-row { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { color: #64748b; font-weight: 600; font-size: 9px; }
  .meta-value { color: #0f172a; font-weight: 700; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 6px 0; font-size: 9px; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 4px; text-align: left; }
  th { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: white; font-weight: 700; font-size: 10px; text-align: center; }
  td { font-size: 9px; }
  tr:nth-child(even) { background: #f8fafc; }
  .condition-badge { display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .condition-good { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .condition-damaged { background: #fef3c7; color: #92400e; border: 1px solid #fde047; }
  .condition-lost { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .summary { margin-top: 14px; padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #cbd5e1; border-radius: 6px; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; }
  .summary-label { color: #475569; font-weight: 600; font-size: 11px; }
  .summary-value { font-weight: 800; color: #0f172a; font-size: 16px; }
  .payment-status { margin-top: 10px; padding: 10px; border-radius: 6px; text-align: center; font-weight: 800; font-size: 12px; text-transform: uppercase; border: 2px solid; }
  .payment-paid { background: #dcfce7; color: #166534; border-color: #86efac; }
  .payment-pending { background: #fef3c7; color: #92400e; border-color: #fde047; }
  .sign-row { margin-top: 18px; display: flex; justify-content: space-between; gap: 16px; }
  .sign-box { flex: 1; text-align: center; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; }
  .sign-label { font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 40px; display: block; }
  .sign-line { border-top: 2px solid #0f172a; padding-top: 4px; font-size: 10px; color: #64748b; }
  .footer { margin-top: 18px; padding-top: 12px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; font-style: italic; }
`;

function generateBorrowReceiptHtml({ receiptNumber, student, borrowDate, dueDate, items, officerName, officerTitle, qrBase64 }) {
  const safeReceiptNumber = escapeHtml(receiptNumber);
  const safeStudentName = student ? escapeHtml(student.name) : '-';
  const safeStudentNis = student ? escapeHtml(student.nis || '-') + ' / ' + escapeHtml(student.class || '-') : '-';
  const safeOfficerName = escapeHtml(officerName || 'Petugas Perpustakaan');
  const safeOfficerTitle = escapeHtml(officerTitle || 'Petugas Perpustakaan');

  const formattedBorrowDate = borrowDate ? new Date(borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Struk Peminjaman Buku</title>
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" class="logo-img" />
        <span>YP. TUNAS KARYA</span>
      </div>
      <div class="school-name">SEKOLAH YP. TUNAS KARYA</div>
      <div class="receipt-title">Struk Peminjaman Buku Perpustakaan</div>
    </div>
    <div class="top-grid">
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Nomor Struk</span><span class="meta-value">${safeReceiptNumber}</span></div>
        <div class="meta-row"><span class="meta-label">Nama Siswa</span><span class="meta-value">${safeStudentName}</span></div>
        <div class="meta-row"><span class="meta-label">NIS / Kelas</span><span class="meta-value">${safeStudentNis}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Pinjam</span><span class="meta-value">${formattedBorrowDate}</span></div>
        <div class="meta-row"><span class="meta-label">Jatuh Tempo</span><span class="meta-value">${formattedDueDate}</span></div>
      </div>
      <div class="qr-side">
        <div class="code-label">QR CODE (SCAN UNTUK PENGEMBALIAN)</div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR" class="qr-image" />` : `<div style="padding: 10px; background: #fee2e2; color: #991b1b; font-size: 10px;">⚠️ No QR</div>`}
        <div class="qr-text">${safeReceiptNumber}</div>
        <div class="qr-hint">Simpan kode ini untuk pengembalian</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>No</th><th>Judul Buku</th><th>Kode</th></tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(it.title || '-')}</td>
            <td>${escapeHtml(it.code || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Jumlah Buku</span>
        <span class="summary-value">${items.length} Buku</span>
      </div>
    </div>
    <div class="sign-row">
      <div class="sign-box">
        <span class="sign-label">Siswa</span>
        <div class="sign-line">${safeStudentName}</div>
      </div>
      <div class="sign-box">
        <span class="sign-label">${safeOfficerTitle}</span>
        <div class="sign-line">${safeOfficerName}</div>
      </div>
    </div>
    <div class="footer">Harap kembalikan buku tepat waktu dan dalam kondisi baik</div>
  </div>
</body>
</html>`;
}

function generateReturnReceiptHtml({ receiptNumber, student, borrowDate, returnDate, items, totalFine, paymentStatus, status, officerName, officerTitle, qrBase64 }) {
  const safeReceiptNumber = escapeHtml(receiptNumber);
  const safeStudentName = student ? escapeHtml(student.name) : '-';
  const safeStudentNis = student ? escapeHtml(student.nis || '-') + ' / ' + escapeHtml(student.class || '-') : '-';
  const safeOfficerName = escapeHtml(officerName || 'Petugas Perpustakaan');
  const safeOfficerTitle = escapeHtml(officerTitle || 'Petugas Perpustakaan');

  const formattedBorrowDate = borrowDate ? new Date(borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const formattedReturnDate = returnDate ? new Date(returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Struk Pengembalian Buku</title>
  <style>${COMMON_CSS}</style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" class="logo-img" />
        <span>YP. TUNAS KARYA</span>
      </div>
      <div class="school-name">SEKOLAH YP. TUNAS KARYA</div>
      <div class="receipt-title">Struk Pengembalian Buku Perpustakaan</div>
    </div>
    <div class="top-grid">
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Nomor Struk</span><span class="meta-value">${safeReceiptNumber}</span></div>
        <div class="meta-row"><span class="meta-label">Nama Siswa</span><span class="meta-value">${safeStudentName}</span></div>
        <div class="meta-row"><span class="meta-label">NIS / Kelas</span><span class="meta-value">${safeStudentNis}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Pinjam</span><span class="meta-value">${formattedBorrowDate}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Kembali</span><span class="meta-value">${formattedReturnDate}</span></div>
      </div>
      <div class="qr-side">
        <div class="code-label">QR CODE</div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR" class="qr-image" />` : `<div style="padding: 10px; background: #fee2e2; color: #991b1b; font-size: 10px;">⚠️ No QR</div>`}
        <div class="qr-text">${safeReceiptNumber}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>No</th><th>Judul Buku</th><th>Kode</th><th>Kondisi</th><th>Denda</th></tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const conditionClass = it.condition === 'good' ? 'condition-good' : 
                                 it.condition === 'damaged' ? 'condition-damaged' : 'condition-lost';
          const conditionText = it.condition === 'good' ? '✅ Baik' : 
                               it.condition === 'damaged' ? '⚠️ Rusak' : '❌ Hilang';
          return `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(it.title || '-')}</td>
            <td>${escapeHtml(it.code || '-')}</td>
            <td><span class="condition-badge ${conditionClass}">${conditionText}</span></td>
            <td>${it.fine > 0 ? 'Rp ' + Number(it.fine).toLocaleString('id-ID') : '-'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row"><span class="summary-label">Jumlah Buku</span><span class="summary-value">${items.length} Buku</span></div>
      <div class="summary-row"><span class="summary-label">Total Denda</span><span class="summary-value">Rp ${Number(totalFine || 0).toLocaleString('id-ID')}</span></div>
      <div class="payment-status ${paymentStatus === 'paid' ? 'payment-paid' : 'payment-pending'}">
        Status Pembayaran: ${paymentStatus === 'paid' ? '✅ LUNAS' : '⏳ BELUM LUNAS'}
      </div>
      ${status === 'has_problem_pending' ? '<div style="margin-top: 8px; padding: 6px; background: #fee2e2; border-radius: 4px; text-align: center; font-size: 10px; color: #991b1b; font-weight: 600;">⚠️ Transaksi Bermasalah - Menunggu Pembayaran Denda</div>' : ''}
    </div>
    <div class="sign-row">
      <div class="sign-box"><span class="sign-label">Siswa</span><div class="sign-line">${safeStudentName}</div></div>
      <div class="sign-box"><span class="sign-label">${safeOfficerTitle}</span><div class="sign-line">${safeOfficerName}</div></div>
    </div>
    <div class="footer">Terima kasih telah mengembalikan buku tepat waktu</div>
  </div>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  generateBorrowReceiptHtml,
  generateReturnReceiptHtml
};
