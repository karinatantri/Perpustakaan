import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { downloadOrShareImage } from '../utils/downloadHelper.js';

/**
 * Modal untuk menampilkan struk transaksi.
 * Menggunakan <iframe> terisolasi untuk mencegah CSS struk memengaruhi CSS utama aplikasi.
 * Menggunakan React Portal untuk merender modal di document.body agar menutupi sidebar/navbar dan topbar.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Menentukan apakah modal terbuka
 * @param {Function} props.onClose - Fungsi callback saat modal ditutup
 * @param {string} props.htmlContent - Konten HTML struk dari server
 */
export default function ReceiptModal({ isOpen, onClose, htmlContent }) {
  const [loadingImage, setLoadingImage] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (window.AndroidApp) {
      window.AndroidApp.printHtml(htmlContent);
    } else {
      const iframe = document.getElementById('receipt-iframe');
      if (iframe) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }
  };

  const handleDownload = async () => {
    setLoadingImage(true);
    try {
      const iframe = document.getElementById('receipt-iframe');
      if (!iframe) {
        throw new Error('Elemen iframe struk tidak ditemukan');
      }

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const elementToCapture = doc.body;

      // Konversi body di dalam iframe ke Canvas
      const canvas = await html2canvas(elementToCapture, {
        useCORS: true,
        scale: 2.5, // Kualitas HD/Retina lebih tajam
        backgroundColor: '#ffffff',
        logging: false
      });

      // Konversi Canvas ke Data URL PNG
      const imgUrl = canvas.toDataURL('image/png');
      const filename = `struk-transaksi-${new Date().getTime()}.png`;

      // Bagikan atau unduh gambar
      await downloadOrShareImage(imgUrl, filename);
    } catch (err) {
      console.error('Gagal mengunduh gambar struk:', err);
      alert('Gagal memproses struk menjadi gambar. Silakan coba kembali.');
    } finally {
      setLoadingImage(false);
    }
  };

  return createPortal(
    <div 
      className="modal-overlay modal-overlay-fullscreen" 
      onClick={onClose} 
      style={{ 
        zIndex: 99999,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(15, 23, 42, 0.45)'
      }}
    >
      <div 
        className="modal-content modal-fullscreen-mobile" 
        style={{ 
          maxWidth: '650px', 
          width: '90%', 
          height: '85vh', 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden'
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📄 Struk Transaksi</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden', background: '#f8fafc' }}>
          <iframe
            id="receipt-iframe"
            srcDoc={htmlContent}
            title="Struk Transaksi"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
        <div 
          className="modal-footer" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'stretch',
            padding: '12px 20px', 
            borderTop: '1px solid #e2e8f0', 
            gap: '10px'
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', gap: '6px', alignItems: 'center' }}>
            💡 <span><strong>Tips Cetak:</strong> Centang opsi <strong>"Grafik latar belakang" (Background graphics)</strong> di setelan printer agar warna biru dan elemen desain struk muncul dengan sempurna.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handlePrint} 
                disabled={loadingImage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontWeight: '600' }}
              >
                🖨️ Cetak Struk
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleDownload} 
                disabled={loadingImage}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontWeight: '600' }}
              >
                {loadingImage ? '⏳ Memproses...' : '💾 Download Struk'}
              </button>
            </div>
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              style={{ padding: '8px 14px', borderRadius: '8px' }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

