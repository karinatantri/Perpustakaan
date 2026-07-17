/**
 * Membersihkan hasil scan kamera/QR dan mengekstrak nomor struk (TX-...) jika tertanam di URL/teks panjang.
 */
export function normalizeScannedText(raw) {
  if (raw == null) return '';
  let s = String(raw);

  s = s.replace(/\uFEFF/g, '').replace(/\u200B/g, '');
  s = s.trim();

  if (!s) return '';

  const txMatch = s.match(/TX-\d{10,20}/i);
  if (txMatch) {
    return txMatch[0].toUpperCase();
  }

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      const pathLast = u.pathname.split('/').filter(Boolean).pop() || '';
      const fromPath = pathLast.match(/TX-\d{10,20}/i);
      if (fromPath) return fromPath[0].toUpperCase();
      const q = u.searchParams.get('id') || u.searchParams.get('receipt') || u.searchParams.get('code');
      if (q) {
        const fromQ = String(q).match(/TX-\d{10,20}/i);
        if (fromQ) return fromQ[0].toUpperCase();
      }
    }
  } catch {
    /* bukan URL valid */
  }

  return s;
}

/** True jika teks normalisasi berupa nomor struk peminjaman (QR struk TX-...). */
export function isReceiptNumber(code) {
  const s = String(code || '').trim();
  return /^TX-\d{10,20}$/i.test(s);
}
