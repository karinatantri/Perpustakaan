import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api.js';
import QrScanner from '../components/QrScanner.jsx';

export default function BorrowPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [codeInput, setCodeInput] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState([]);
  const [items, setItems] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerTitle, setOfficerTitle] = useState('Petugas Perpustakaan');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [successData, setSuccessData] = useState(null); // { transactionId, receiptNumber, barcode }

  useEffect(() => {
    const preset = location.state?.presetBorrowItems;
    if (!Array.isArray(preset) || preset.length === 0) return;
    setItems((prev) => {
      const next = [...prev];
      for (const row of preset) {
        if (!row?.code) continue;
        if (!next.find((i) => i.code === row.code)) {
          next.push({
            code: row.code,
            title: row.title || row.code,
            author: row.author
          });
        }
      }
      return next;
    });
    const added = preset.filter((r) => r?.code).length;
    setMessage(
      `✅ ${added} buku dari halaman Scan QR ditambahkan ke daftar. Pilih siswa untuk melanjutkan.`
    );
    navigate('/app/borrow', { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sinkronisasi dari Scan QR
  }, [location.state, navigate]);

  const searchStudents = async (q) => {
    if (!q) {
      setStudentResults([]);
      return;
    }
    try {
      const res = await api.get('/students/search', { params: { q } });
      setStudentResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const searchBooks = async (q) => {
    if (!q) {
      setBookResults([]);
      return;
    }
    try {
      const res = await api.get('/books/search', { params: { q } });
      setBookResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectStudent = (s) => {
    setSelectedStudent(s);
    setStudentResults([]);
    setStudentQuery(`${s.nis} - ${s.name}`);
  };

  const addItemCode = () => {
    const code = codeInput.trim();
    if (!code) return;
    if (items.find((i) => i.code === code)) {
      setMessage('⚠️ Kode sudah ada di daftar.');
      return;
    }
    setItems((prev) => [...prev, { code, title: code }]);
    setCodeInput('');
    setMessage('');
  };

  const handleSelectBook = (book) => {
    const bookId = book.id;
    if (items.find((i) => i.code === bookId)) {
      setMessage(`⚠️ Buku "${book.title}" sudah ada di daftar.`);
      return;
    }
    setItems((prev) => [...prev, { code: bookId, title: book.title, author: book.author }]);
    setBookQuery('');
    setBookResults([]);
    setMessage(`✅ Buku "${book.title}" berhasil ditambahkan.`);
  };

  const removeItem = (code) => {
    setItems((prev) => prev.filter((i) => i.code !== code));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      setMessage('Pilih siswa terlebih dahulu.');
      return;
    }
    if (items.length === 0) {
      setMessage('Tambahkan minimal satu kode buku.');
      return;
    }
    if (!officerName.trim()) {
      setMessage('Nama petugas wajib diisi.');
      return;
    }
    if (!officerTitle.trim()) {
      setMessage('Jabatan petugas wajib diisi.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const body = {
        studentId: selectedStudent.id,
        itemCodes: items.map((i) => i.code),
        dueDate: dueDate || null,
        officerName: officerName.trim(),
        officerTitle: officerTitle.trim()
      };
      const res = await api.post('/transactions/borrow', body);
      setSuccessData({
        transactionId: res.data.transactionId,
        receiptNumber: res.data.receiptNumber,
        barcode: res.data.barcode || res.data.receiptNumber
      });
      setMessage(`✅ Peminjaman berhasil disimpan!`);
      setItems([]);
      setSelectedStudent(null);
      setStudentQuery('');
      setOfficerName('');
      setOfficerTitle('Petugas Perpustakaan');
    } catch (err) {
      console.error(err);
      setMessage('❌ Gagal menyimpan peminjaman. Periksa kembali data dan kode buku.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📚 Peminjaman Buku</h2>
          <p className="page-subtitle">Lakukan peminjaman buku dengan scan QR code atau input manual</p>
        </div>
      </div>

      {message && (
        <div className={`form-message ${message.includes('berhasil') || message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="borrow-form">
        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">👤</span>
            <h3 className="form-card-title">Pilih Siswa</h3>
          </div>
          <div className="form-card-body">
            <label className="form-label">
              Cari Siswa (NIS / Nama)
              <input
                className="form-input"
                placeholder="🔍 Ketik NIS atau nama siswa..."
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
                {studentResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleSelectStudent(s)}
                  >
                    <div>
                      <strong>{s.name}</strong>
                      <div className="dropdown-meta">{s.nis} • {s.class}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedStudent && (
              <div className="selected-student-card">
                <div className="selected-student-icon">✓</div>
                <div className="selected-student-info">
                  <strong>{selectedStudent.name}</strong>
                  <div className="selected-student-meta">
                    NIS: {selectedStudent.nis} • {selectedStudent.class}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">📖</span>
            <h3 className="form-card-title">Cari Buku</h3>
          </div>
          <div className="form-card-body">
            {/* Search by Book Name */}
            <label className="form-label">
              Cari Buku (Nama / Penulis)
              <input
                className="form-input"
                placeholder="🔍 Ketik nama buku atau penulis..."
                value={bookQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setBookQuery(v);
                  searchBooks(v);
                }}
              />
            </label>
            {bookResults.length > 0 && (
              <div className="dropdown">
                {bookResults.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    className="dropdown-item"
                    onClick={() => handleSelectBook(book)}
                  >
                    <div>
                      <strong>{book.title}</strong>
                      <div className="dropdown-meta">
                        {book.author || '-'} • {book.category || '-'} • Stok: {book.totalCopies || 0}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Or Input Code Manually */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
              <label className="form-label">
                Atau Masukkan Kode Buku (dari QR)
                <div className="code-input-group">
                  <input
                    className="form-input code-input"
                    placeholder="Masukkan kode buku atau scan QR..."
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItemCode();
                      }
                    }}
                  />
                  <div className="code-input-buttons">
                    <button type="button" className="btn-secondary" onClick={addItemCode}>
                      ➕ Tambah
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-scan"
                      onClick={() => {
                        setShowScanner(true);
                        setMessage('');
                      }}
                    >
                      📷 Scan QR
                    </button>
                  </div>
                </div>
              </label>
            </div>
            <p className="form-hint">
              💡 Tips: Cari dengan nama buku, atau masukkan kode manual, scan QR code, atau gunakan scanner fisik
            </p>
            {items.length > 0 ? (
              <div className="code-list-container">
                <div className="code-list-header">
                  <span>Daftar Buku ({items.length})</span>
                </div>
                <div className="code-list-grid">
                  {items.map((i) => (
                    <div key={i.code} className="code-item-card">
                      <div className="code-item-info">
                        {i.title ? (
                          <>
                            <span className="code-item-title">{i.title}</span>
                            {i.author && <span className="code-item-meta">{i.author}</span>}
                            <span className="code-item-code">Kode: {i.code}</span>
                          </>
                        ) : (
                          <span className="code-item-text">{i.code}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removeItem(i.code)}
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="code-empty-state">
                <div className="code-empty-icon">📋</div>
                <p>Belum ada kode buku ditambahkan</p>
              </div>
            )}
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-header">
            <span className="form-card-icon">📅</span>
            <h3 className="form-card-title">Tanggal Jatuh Tempo</h3>
          </div>
          <div className="form-card-body">
            <label className="form-label">
              Pilih Tanggal
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </label>
          </div>
        </div>

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

        <div style={{ marginTop: '20px' }}>
          <button type="submit" className="btn-submit" disabled={loading || !selectedStudent || items.length === 0 || !officerName.trim() || !officerTitle.trim()}>
            {loading ? '⏳ Menyimpan...' : '✅ Simpan Peminjaman'}
          </button>
        </div>
      </form>

      {/* Success Modal with Barcode */}
      {successData && (
        <div className="modal-overlay" onClick={() => setSuccessData(null)}>
          <div className="modal-content modal-success" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Peminjaman Berhasil!</h3>
              <button className="modal-close" onClick={() => setSuccessData(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="barcode-display">
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px', fontWeight: '600' }}>
                  QR Code Peminjaman
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(successData.barcode)}`}
                    alt={`QR Code ${successData.barcode}`}
                    style={{ width: '200px', height: '200px', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: 'white' }}
                  />
                  <div style={{ textAlign: 'center' }}>
                    <div className="barcode-text-large" style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', letterSpacing: '1px', fontFamily: 'monospace' }}>
                      {successData.barcode}
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                      Simpan QR code ini untuk pengembalian buku
                    </p>
                  </div>
                </div>
              </div>
              <div className="success-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/transactions/${successData.transactionId}/receipt`, {
                        responseType: 'text'
                      });
                      const w = window.open('', '_blank');
                      if (w) {
                        w.document.open();
                        w.document.write(res.data);
                        w.document.close();
                      } else {
                        alert('Popup diblokir. Silakan izinkan popup untuk browser ini.');
                      }
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
                  onClick={() => setSuccessData(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QrScanner
          onResult={async (code) => {
            const trimmed = (code || '').trim();
            if (!trimmed) {
              setShowScanner(false);
              return;
            }

            if (items.find((i) => i.code === trimmed)) {
              setMessage(`⚠️ Kode ${trimmed} sudah ada di daftar.`);
              setShowScanner(false);
              return;
            }

            setLoading(true);
            try {
              const res = await api.get(
                `/books/by-code/${encodeURIComponent(trimmed)}`
              );
              const book = res.data;

              const itemCode = book.item?.uniqueCode || book.id;

              if (items.find((i) => i.code === itemCode)) {
                setMessage(`⚠️ Buku "${book.title}" sudah ada di daftar.`);
              } else {
                setItems((prev) => [
                  ...prev,
                  {
                    code: itemCode,
                    title: book.title,
                    author: book.author
                  }
                ]);
                setMessage(`✅ Buku "${book.title}" berhasil ditambahkan.`);
              }
            } catch (err) {
              console.error('Error searching book:', err);
              const errorMsg = err.response?.data?.message || 'Buku tidak ditemukan';
              setMessage(`❌ ${errorMsg}`);
            } finally {
              setLoading(false);
              setShowScanner(false);
            }
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}


