import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import jsQR from 'jsqr';
import { normalizeScannedText } from '../utils/scanNormalize.js';
import { decodeQrFromImageFile } from '../utils/decodeQrFromImage.js';

/**
 * Scanner baru (port dari proyek "web fadli").
 * - Cleanup instance sebelum start/stop
 * - Prefer kamera belakang, fps 20, qrbox dinamis
 * - Dukungan QR + barcode umum
 */
export default function QrScanner({ onResult, onClose }) {
  const scannerIdRef = useRef(`qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const scannerRef = useRef(null);
  const jsqrCanvasRef = useRef(null);
  const jsqrCtxRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(true);
  const scanConsumedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [scanStatus, setScanStatus] = useState('Memulai...');
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    initScanner();
    return () => {
      isMountedRef.current = false;
      safeStopAndClear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeStopAndClear = useCallback(() => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      const state = instance.getState?.();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        instance.stop().catch(() => {});
      }
      instance.clear().catch(() => {});
    } catch {
      /* ignore */
    }
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    jsqrCanvasRef.current = null;
    jsqrCtxRef.current = null;
    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  const initScanner = async () => {
    await new Promise((r) => setTimeout(r, 50));
    const el = document.getElementById(scannerIdRef.current);
    if (!el) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Browser tidak mendukung kamera. Gunakan HTTPS + browser modern.');
      onClose?.();
      return;
    }

    try {
      safeStopAndClear();

      const scanner = new Html5Qrcode(scannerIdRef.current, {
        verbose: false,
        useBarCodeDetectorIfSupported: true,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.PDF_417
        ],
        rememberLastUsedCamera: true
      });
      scannerRef.current = scanner;

      setScanStatus('Mencari kamera...');
      const devices = await Html5Qrcode.getCameras();
      if (!isMountedRef.current) return;
      if (!devices || devices.length === 0) {
        setLastError('Tidak ada kamera tersedia');
        alert('Tidak ada kamera tersedia.');
        onClose?.();
        return;
      }
      setAvailableCameras(devices);
      const back = devices.find((d) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      );
      const camId = back?.id || devices[0].id;
      setSelectedCameraId(camId);
      startScanning(scanner, camId);
    } catch (err) {
      console.error(err);
      setLastError(err.message);
      alert('Gagal mengakses kamera: ' + err.message);
      onClose?.();
    }
  };

  const startScanning = async (scanner, cameraId) => {
    if (!scanner) return;
    try {
      scanConsumedRef.current = false;
      setScanStatus('Memindai...');
      setIsScanning(true);
      setLastError(null);

      const minDim = (vw, vh) => Math.min(vw, vh);
      const config = {
        fps: 10,
        qrbox(viewfinderWidth, viewfinderHeight) {
          const size = Math.min(Math.max(minDim(viewfinderWidth, viewfinderHeight) * 0.95, 150), 600);
          return { width: size, height: size };
        },
        disableFlip: false,
        aspectRatio: 1.0,
        videoConstraints: {
          ...(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' }),
          width: { ideal: 1280, min: 720 },
          height: { ideal: 720, min: 480 }
        },
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true
      };

      await scanner.start(
        cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!decodedText) return;
          // Gunakan hasil normalisasi; jika kosong fallback ke raw text supaya tidak menolak kode yang sah.
          const normalized = normalizeScannedText(decodedText);
          const finalCode = normalized || decodedText.trim();
          if (!finalCode) return;
          if (scanConsumedRef.current) return;
          scanConsumedRef.current = true;
          setScanStatus(`✅ QR terbaca: ${finalCode}`);
          onResult?.(finalCode);
        },
        (errMsg, errObj) => {
          const benign =
            errMsg.includes('NotFound') ||
            errMsg.includes('QR code parse error') ||
            errMsg.includes('No MultiFormat Readers') ||
            errMsg.includes('No barcode detected');
          if (!benign) {
            console.warn('scan error', errMsg, errObj);
            setLastError(errMsg);
            if (errMsg.includes('NotAllowed')) setScanStatus('❌ Izin kamera ditolak');
          }
        }
      );

      // Fallback: capture frame dan decode dengan jsQR setiap 300ms jika html5-qrcode belum menemukan apa pun
      const ensureCanvas = () => {
        if (!jsqrCanvasRef.current) {
          jsqrCanvasRef.current = document.createElement('canvas');
          jsqrCtxRef.current = jsqrCanvasRef.current.getContext('2d', { willReadFrequently: true });
        }
      };
      ensureCanvas();
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = setInterval(() => {
        const video = document.querySelector(`#${scannerIdRef.current} video`);
        const ctx = jsqrCtxRef.current;
        const canvas = jsqrCanvasRef.current;
        if (!video || !ctx || !canvas) return;
        let vw = video.videoWidth;
        let vh = video.videoHeight;
        if (!vw || !vh) return;
        // Downscale untuk mengurangi noise & kontras berlebih
        const maxSize = 1280;
        let dw = vw;
        let dh = vh;
        if (Math.max(vw, vh) > maxSize) {
          const scale = maxSize / Math.max(vw, vh);
          dw = Math.floor(vw * scale);
          dh = Math.floor(vh * scale);
        }
        canvas.width = dw;
        canvas.height = dh;
        ctx.drawImage(video, 0, 0, dw, dh);
        const imageData = ctx.getImageData(0, 0, dw, dh);
        const result = jsQR(imageData.data, dw, dh, { inversionAttempts: 'attemptBoth' });
        if (result?.data) {
          const normalized = normalizeScannedText(result.data);
          const finalCode = normalized || result.data.trim();
          if (!finalCode) return;
          if (scanConsumedRef.current) return;
          scanConsumedRef.current = true;
          setScanStatus(`✅ QR terbaca: ${finalCode}`);
          onResult?.(finalCode);
        }
      }, 450);

      setTimeout(() => {
        const v = document.querySelector(`#${scannerIdRef.current} video`);
        if (v?.paused) v.play().catch(() => {});
        // Sedikit turunkan brightness/kontras untuk menghindari sorotan berlebih pada beberapa perangkat
        if (v) {
          v.style.filter = 'brightness(0.92) contrast(0.92)';
        }
      }, 400);
    } catch (err) {
      console.error('start error', err);
      setIsScanning(false);
      setScanStatus(`❌ ${err.message}`);
      setLastError(err.message);
    }
  };

  const handleStop = () => {
    safeStopAndClear();
    onClose?.();
  };

  const handleCameraChange = async (id) => {
    setSelectedCameraId(id);
    safeStopAndClear();
    await new Promise((r) => setTimeout(r, 120));
    if (scannerRef.current) startScanning(scannerRef.current, id);
  };

  const handleScanFromFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanStatus('Membaca QR dari gambar...');
    try {
      safeStopAndClear();
      await new Promise((r) => setTimeout(r, 120));
      const raw = await decodeQrFromImageFile(file);
      const normalized = normalizeScannedText(raw || '');
      if (!normalized) {
        alert('QR tidak terbaca dari gambar ini.');
        setScanStatus('QR tidak terbaca');
        return;
      }
      setScanStatus(`✅ QR terbaca: ${normalized}`);
      onResult?.(normalized);
    } catch (err) {
      console.error(err);
      setLastError(err.message);
      alert('Gagal membaca QR dari gambar: ' + err.message);
    }
  };

  const overlay = (
    <div
      onClick={handleStop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 18,
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Scan QR</div>
            <div style={{ fontSize: 13, color: '#475569' }}>{scanStatus}</div>
            {lastError && <div style={{ color: '#ef4444', fontSize: 12 }}>Error: {lastError}</div>}
          </div>
          <button onClick={handleStop} style={{ fontSize: 18, border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '6px 10px' }}>✕</button>
        </div>

        {availableCameras.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Pilih Kamera</label>
            <select
              value={selectedCameraId || ''}
              onChange={(e) => handleCameraChange(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #cbd5e1', marginTop: 6 }}
            >
              {availableCameras.map((cam) => (
                <option key={cam.id} value={cam.id}>{cam.label || cam.id}</option>
              ))}
            </select>
          </div>
        )}

        <div
          id={scannerIdRef.current}
          style={{
            width: '100%',
            minHeight: 420,
            background: '#000',
            borderRadius: 14,
            border: '2px solid #e2e8f0',
            overflow: 'hidden'
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc' }}
          >
            Scan dari gambar
          </button>
          <button
            type="button"
            onClick={handleStop}
            style={{ padding: 12, borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', minWidth: 120 }}
          >
            Tutup
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanFromFile} />
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

