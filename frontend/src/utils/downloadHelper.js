/**
 * Mengunduh gambar atau membagikannya menggunakan Web Share API jika dijalankan di perangkat mobile (WebView/HP)
 * @param {string} imageUrl - URL gambar yang akan diunduh/dibagikan
 * @param {string} filename - Nama file target (misalnya: 'QR-Buku.png')
 */
export async function downloadOrShareImage(imageUrl, filename) {
  try {
    // 1. Ambil data gambar sebagai Blob
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Gagal mengambil data gambar');
    const blob = await response.blob();

    // Cek apakah berjalan di aplikasi Android (Capacitor) dengan interface kustom
    if (window.AndroidApp) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof window.AndroidApp.downloadFile === 'function') {
          window.AndroidApp.downloadFile(reader.result, filename, blob.type || 'image/png');
        } else {
          // Fallback ke share jika downloadFile tidak ada (untuk versi lawas)
          window.AndroidApp.shareFile(reader.result, filename, blob.type || 'image/png');
        }
      };
      reader.readAsDataURL(blob);
      return;
    }

    // 2. Unduh langsung ke perangkat via blob URL (Bypass Share API agar langsung unduh)
    const localUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = localUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Berikan sedikit jeda sebelum mencabut URL objek
    setTimeout(() => {
      URL.revokeObjectURL(localUrl);
    }, 150);

  } catch (error) {
    console.error('Error saat download/share gambar:', error);

    // Fallback darurat: Tampilkan pesan tips untuk pengguna Capacitor jika unduhan diblokir WebView
    const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
    if (isCapacitor) {
      alert('Fitur unduhan langsung dibatasi di HP Anda. Silakan tekan lama gambar QR Code, lalu pilih "Simpan gambar/Download image" atau "Bagikan gambar".');
    } else {
      // Di desktop browser umum, coba gunakan direct click a.download langsung ke remote URL
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
