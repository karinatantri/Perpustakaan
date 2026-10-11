import jsQR from 'jsqr';

/**
 * Decode QR dari File gambar memakai jsQR + canvas (off-DOM).
 * Menghindari html5-qrcode.scanFile yang memanipulasi DOM React dan sering bikin layar putih.
 */
export async function decodeQrFromImageFile(file) {
  if (!file || !(file.type || '').startsWith('image/')) {
    throw new Error('Pilih file gambar (JPG, PNG, dll.)');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();

    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w < 1 || h < 1) {
      throw new Error('Ukuran gambar tidak valid');
    }

    const maxDim = 1600;
    let scale = 1;
    if (Math.max(w, h) > maxDim) {
      scale = maxDim / Math.max(w, h);
    }
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Browser tidak mendukung canvas');
    }
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });

    return result?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
