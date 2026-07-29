import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { downloadOrShareImage } from '../utils/downloadHelper.js';
import InventoriesPage from './InventoriesPage.jsx';

export default function BooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'inventories' ? 'inventories' : 'books';
  const [activeTab, setActiveTab] = useState(initialTab);

  const userStr = localStorage.getItem('user');
  let userRole = 'student';
  if (userStr) {
    try {
      userRole = JSON.parse(userStr).role || 'student';
    } catch (_) {}
  }
  const isStaff = userRole === 'admin' || userRole === 'officer';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showReduceStockModal, setShowReduceStockModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: '',
    year: '',
    publisher: '',
    totalCopies: 1,
    location: ''
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    author: '',
    category: '',
    year: '',
    publisher: '',
    location: ''
  });
  const [addStockData, setAddStockData] = useState({ quantity: 1, entryDate: '', location: '' });
  const [reduceStockData, setReduceStockData] = useState({ quantity: 1, reason: '', notes: '' });
  const [showAddBarangForm, setShowAddBarangForm] = useState(false);
  const [barangFormData, setBarangFormData] = useState({
    name: '',
    category: '',
    unit: 'pcs',
    stock: 1,
    minStock: 0
  });
  const [selectedBookCategory, setSelectedBookCategory] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const bookCategories = Array.from(new Set(books.map((b) => b.category).filter(Boolean)));

  const filteredBooks = books.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.location || '').toLowerCase().includes(q) ||
      (b.year || '').toString().includes(q);
    const matchCat = !selectedBookCategory || b.category === selectedBookCategory;
    return matchSearch && matchCat;
  });

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/books');
      setBooks(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage('Gagal memuat data buku');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/books', formData);
      setMessage('✅ Buku berhasil ditambahkan. QR code otomatis dibuat untuk buku ini.');
      setShowForm(false);
      setFormData({ title: '', author: '', category: '', year: '', publisher: '', totalCopies: 1, location: '' });
      loadBooks();
    } catch (err) {
      setMessage('❌ Gagal menambahkan buku');
      console.error(err);
    }
  };

  const handleAddBarangSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/inventories', {
        ...barangFormData,
        stock: Number(barangFormData.stock) || 0,
        minStock: Number(barangFormData.minStock) || 0
      });
      setMessage('✅ Barang inventaris berhasil ditambahkan!');
      setShowAddBarangForm(false);
      setBarangFormData({ name: '', category: '', unit: 'pcs', stock: 1, minStock: 0 });
    } catch (err) {
      setMessage('❌ Gagal menambahkan barang inventaris');
      console.error(err);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/books/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data-buku-${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage('✅ Data berhasil diekspor');
    } catch (err) {
      setMessage('❌ Gagal mengekspor data');
      console.error(err);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/books/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(`✅ Import selesai: ${res.data.success} berhasil, ${res.data.errors} error`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadBooks();
    } catch (err) {
      setMessage('❌ Gagal mengimpor data');
      console.error(err);
    }
  };

  const openAddStockModal = (book) => {
    setSelectedBook(book);
    setAddStockData({ quantity: 1, entryDate: new Date().toISOString().split('T')[0], location: book.location || '' });
    setShowAddStockModal(true);
  };

  const openReduceStockModal = (book) => {
    setSelectedBook(book);
    setReduceStockData({ quantity: 1, reason: '', notes: '' });
    setShowReduceStockModal(true);
  };

  const handleAddStock = async () => {
    if (!selectedBook) return;
    try {
      await api.post(`/books/${selectedBook.id}/add-stock`, addStockData);
      setMessage(`✅ Stok berhasil ditambahkan: ${addStockData.quantity} eksemplar`);
      setShowAddStockModal(false);
      loadBooks();
    } catch (err) {
      setMessage('❌ Gagal menambahkan stok');
      console.error(err);
    }
  };

  const handleReduceStock = async () => {
    if (!selectedBook) return;
    if (!reduceStockData.reason) {
      setMessage('⚠️ Pilih alasan pengurangan stok');
      return;
    }
    try {
      await api.post(`/books/${selectedBook.id}/reduce-stock`, reduceStockData);
      setMessage(`✅ Stok berhasil dikurangi: ${reduceStockData.quantity} eksemplar (${reduceStockData.reason})`);
      setShowReduceStockModal(false);
      loadBooks();
    } catch (err) {
      setMessage('❌ Gagal mengurangi stok');
      console.error(err);
    }
  };

  const openQrModal = async (book) => {
    setSelectedBook(book);
    // QR code sekarang disimpan di level buku, tidak perlu fetch items
    setShowQrModal(true);
  };

  const openEditModal = (book) => {
    setSelectedBook(book);
    setEditFormData({
      title: book.title || '',
      author: book.author || '',
      category: book.category || '',
      year: book.year || '',
      publisher: book.publisher || '',
      location: book.location || ''
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedBook) return;
    setMessage('');
    try {
      await api.put(`/books/${selectedBook.id}`, editFormData);
      setMessage('✅ Data buku berhasil diperbarui');
      setShowEditModal(false);
      setSelectedBook(null);
      await loadBooks();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memperbarui data buku';
      setMessage(`❌ ${errorMsg}`);
      console.error('Edit book error:', err);
    }
  };

  const openDeleteModal = (book) => {
    setSelectedBook(book);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedBook) return;
    setDeleting(true);
    setMessage('');
    try {
      const res = await api.delete(`/books/${selectedBook.id}`);
      setMessage(`✅ Data buku berhasil dihapus. ${res.data.itemsDeleted || 0} eksemplar juga terhapus.`);
      setShowDeleteModal(false);
      setSelectedBook(null);
      await loadBooks();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menghapus data buku';
      setMessage(`❌ ${errorMsg}`);
      console.error('Delete book error:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Memuat data...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h2 className="page-title">📖 {isStaff ? 'Data Buku & Barang' : 'Katalog Buku & Barang'}</h2>
      </div>

      {/* Tab Switcher Panel */}
      <div className="tab-switcher" style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #cbd5e1', paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => handleTabChange('books')}
          style={{
            padding: '10px 22px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'books' ? '#1d4ed8' : '#f1f5f9',
            color: activeTab === 'books' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'books' ? '0 4px 12px rgba(29,78,216,0.25)' : 'none'
          }}
        >
          📖 Katalog Buku ({books.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('inventories')}
          style={{
            padding: '10px 22px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'inventories' ? '#059669' : '#f1f5f9',
            color: activeTab === 'inventories' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'inventories' ? '0 4px 12px rgba(5,150,105,0.25)' : 'none'
          }}
        >
          📦 Inventaris Barang
        </button>
      </div>

      {activeTab === 'inventories' ? (
        <InventoriesPage />
      ) : (
        <>
          <div
            className="page-actions-row"
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
              background: '#ffffff',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Aksi Katalog:</span>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
                onClick={loadBooks}
              >
                🔄 Refresh Data
              </button>
            </div>

            {isStaff && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
                  onClick={handleExport}
                >
                  📥 Export Excel
                </button>
                <label
                  className="btn-secondary"
                  style={{ cursor: 'pointer', margin: 0, padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
                >
                  📤 Import Excel
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                  />
                </label>

                <div style={{ width: 1, height: 24, background: '#cbd5e1', margin: '0 2px' }}></div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, background: '#1d4ed8', borderColor: '#1d4ed8' }}
                  onClick={() => {
                    setShowForm(!showForm);
                    if (!showForm) setShowAddBarangForm(false);
                  }}
                >
                  {showForm ? '✕ Batal' : '📚 + Tambah Buku'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, background: '#059669', borderColor: '#059669' }}
                  onClick={() => {
                    setShowAddBarangForm(!showAddBarangForm);
                    if (!showAddBarangForm) setShowForm(false);
                  }}
                >
                  {showAddBarangForm ? '✕ Batal' : '📦 + Tambah Barang'}
                </button>
              </div>
            )}
          </div>

      {message && (
        <div className={`form-message ${message.includes('✅') ? 'form-message-success' : message.includes('⚠️') ? 'form-message-warning' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3 className="form-card-title">Tambah Buku Baru</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="form-label">
                Judul Buku *
                <input
                  className="form-input"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </label>
              <label className="form-label">
                Penulis *
                <input
                  className="form-input"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                />
              </label>
              <label className="form-label">
                Kategori
                <input
                  className="form-input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </label>
              <label className="form-label">
                Tahun Terbit
                <input
                  type="number"
                  className="form-input"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </label>
              <label className="form-label">
                Penerbit
                <input
                  className="form-input"
                  value={formData.publisher}
                  onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                />
              </label>
              <label className="form-label">
                Jumlah Eksemplar *
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  required
                  value={formData.totalCopies}
                  onChange={(e) => setFormData({ ...formData, totalCopies: parseInt(e.target.value) || 1 })}
                />
                <small style={{ color: '#64748b', fontSize: '12px' }}>
                  QR code akan otomatis dibuat untuk setiap eksemplar
                </small>
              </label>
              <label className="form-label">
                Lokasi Rak
                <input
                  className="form-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Contoh: Rak A-1"
                />
              </label>
            </div>
            <button type="submit" className="btn-primary">
              💾 Simpan
            </button>
          </form>
        </div>
      )}

      {showAddBarangForm && (
        <div className="form-card" style={{ borderLeft: '4px solid #059669' }}>
          <h3 className="form-card-title">📦 Tambah Barang Inventaris Baru</h3>
          <form onSubmit={handleAddBarangSubmit}>
            <div className="form-grid">
              <label className="form-label">
                Nama Barang *
                <input
                  className="form-input"
                  required
                  value={barangFormData.name}
                  onChange={(e) => setBarangFormData({ ...barangFormData, name: e.target.value })}
                  placeholder="Contoh: Spidol Boardmarker, Meja Baca, Laptop"
                />
              </label>

              <label className="form-label">
                Kategori
                <input
                  className="form-input"
                  value={barangFormData.category}
                  onChange={(e) => setBarangFormData({ ...barangFormData, category: e.target.value })}
                  placeholder="Contoh: Alat Tulis, Kebersihan, Meubel, Elektronik"
                />
              </label>

              <label className="form-label">
                Stok Awal *
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  required
                  value={barangFormData.stock}
                  onChange={(e) => setBarangFormData({ ...barangFormData, stock: e.target.value })}
                />
              </label>

              <label className="form-label">
                Satuan
                <input
                  className="form-input"
                  value={barangFormData.unit}
                  onChange={(e) => setBarangFormData({ ...barangFormData, unit: e.target.value })}
                  placeholder="pcs, box, pack, unit"
                />
              </label>

              <label className="form-label">
                Batas Minimal Stok (Alert)
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={barangFormData.minStock}
                  onChange={(e) => setBarangFormData({ ...barangFormData, minStock: e.target.value })}
                  placeholder="Batas minimal peringatan stok menipis"
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                💾 Simpan Barang
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowAddBarangForm(false)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Stat Cards for Books */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📚 Total Judul Buku</div>
          <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 800, marginTop: 4 }}>{books.length}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>📦 Total Eksemplar Stok</div>
          <div style={{ fontSize: 22, color: '#1d4ed8', fontWeight: 800, marginTop: 4 }}>
            {books.reduce((acc, curr) => acc + (Number(curr.totalCopies) || 0), 0)}
          </div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>🏷️ Kategori Buku</div>
          <div style={{ fontSize: 22, color: '#16a34a', fontWeight: 800, marginTop: 4 }}>{bookCategories.length}</div>
        </div>
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#6b21a8', fontWeight: 600 }}>📍 Lokasi Terdaftar</div>
          <div style={{ fontSize: 22, color: '#7e22ce', fontWeight: 800, marginTop: 4 }}>
            {Array.from(new Set(books.map((b) => b.location).filter(Boolean))).length}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar for Books */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari judul buku, penulis, rak, atau penerbit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          <div style={{ width: 200 }}>
            <select
              value={selectedBookCategory}
              onChange={(e) => setSelectedBookCategory(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="">📁 Semua Kategori ({bookCategories.length})</option>
              {bookCategories.map((cat) => (
                <option key={cat} value={cat}>📁 {cat}</option>
              ))}
            </select>
          </div>

          {(search || selectedBookCategory) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedBookCategory(''); }}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Data Buku */}
      {filteredBooks.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
          <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
            {search || selectedBookCategory ? 'Tidak ada buku yang cocok dengan pencarian.' : 'Belum ada data buku.'}
          </p>
          {isStaff && !search && (
            <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
              + Tambah Buku Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <table className="table" style={{ margin: 0, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 50, textAlign: 'center' }}>No</th>
                <th>Judul Buku</th>
                <th>Penulis</th>
                <th>Kategori</th>
                <th style={{ textAlign: 'center' }}>Tahun</th>
                <th style={{ textAlign: 'center' }}>Stok</th>
                <th>Lokasi Rak</th>
                {isStaff && <th style={{ textAlign: 'center', width: 220 }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((b, idx) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{b.title || '-'}</td>
                  <td style={{ color: '#475569' }}>{b.author || '-'}</td>
                  <td>
                    {b.category ? (
                      <span style={{ padding: '3px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        📁 {b.category}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>{b.year || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: (b.stock === 0) ? '#dc2626' : '#059669' }}>
                      {b.stock !== undefined ? b.stock : (b.totalCopies || 0)}
                    </span>
                    {b.totalCopies !== undefined && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        dari {b.totalCopies} total
                      </div>
                    )}
                  </td>
                  <td style={{ color: '#475569', fontSize: 13 }}>{b.location || '-'}</td>
                  {isStaff && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 700, padding: '4px 8px' }}
                          onClick={() => openQrModal(b)}
                          title="Lihat QR Codes"
                          disabled={!b.totalCopies || b.totalCopies === 0}
                        >
                          📷 QR
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-outline"
                          style={{ padding: '4px 8px' }}
                          onClick={() => openEditModal(b)}
                          title="Edit Buku"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', fontWeight: 700, padding: '4px 8px' }}
                          onClick={() => openAddStockModal(b)}
                          title="Tambah Stok"
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5', fontWeight: 700, padding: '4px 8px' }}
                          onClick={() => openReduceStockModal(b)}
                          title="Kurangi Stok"
                          disabled={!b.totalCopies || b.totalCopies === 0}
                        >
                          ➖
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-danger"
                          style={{ padding: '4px 8px' }}
                          onClick={() => openDeleteModal(b)}
                          title="Hapus Buku"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah Stok */}
      {showAddStockModal && selectedBook && (
        <div className="modal-overlay" onClick={() => setShowAddStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tambah Stok: {selectedBook.title}</h3>
              <button className="modal-close" onClick={() => setShowAddStockModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">
                Jumlah Stok yang Ditambahkan *
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  required
                  value={addStockData.quantity}
                  onChange={(e) => setAddStockData({ ...addStockData, quantity: parseInt(e.target.value) || 1 })}
                />
              </label>
              <label className="form-label">
                Tanggal Masuk
                <input
                  type="date"
                  className="form-input"
                  value={addStockData.entryDate}
                  onChange={(e) => setAddStockData({ ...addStockData, entryDate: e.target.value })}
                />
              </label>
              <label className="form-label">
                Lokasi Rak
                <input
                  className="form-input"
                  value={addStockData.location}
                  onChange={(e) => setAddStockData({ ...addStockData, location: e.target.value })}
                  placeholder={selectedBook.location || 'Contoh: Rak A-1'}
                />
              </label>
              <p className="form-hint">
                💡 QR code akan otomatis dibuat untuk setiap eksemplar baru
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowAddStockModal(false)}>
                Batal
              </button>
              <button type="button" className="btn-primary" onClick={handleAddStock}>
                ✅ Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kurangi Stok */}
      {showReduceStockModal && selectedBook && (
        <div className="modal-overlay" onClick={() => setShowReduceStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Kurangi Stok: {selectedBook.title}</h3>
              <button className="modal-close" onClick={() => setShowReduceStockModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">
                Jumlah Stok yang Dikurangi *
                <input
                  type="number"
                  min="1"
                  max={selectedBook.totalCopies || 0}
                  className="form-input"
                  required
                  value={reduceStockData.quantity}
                  onChange={(e) => setReduceStockData({ ...reduceStockData, quantity: parseInt(e.target.value) || 1 })}
                />
                <small style={{ color: '#64748b' }}>Stok saat ini: {selectedBook.totalCopies || 0}</small>
              </label>
              <label className="form-label">
                Alasan Pengurangan *
                <select
                  className="form-input"
                  required
                  value={reduceStockData.reason}
                  onChange={(e) => setReduceStockData({ ...reduceStockData, reason: e.target.value })}
                >
                  <option value="">Pilih alasan...</option>
                  <option value="hilang">❌ Hilang</option>
                  <option value="rusak">⚠️ Rusak</option>
                  <option value="ditarik">📤 Ditarik</option>
                  <option value="lainnya">📝 Lainnya</option>
                </select>
              </label>
              <label className="form-label">
                Catatan Tambahan
                <textarea
                  className="form-input"
                  rows="3"
                  value={reduceStockData.notes}
                  onChange={(e) => setReduceStockData({ ...reduceStockData, notes: e.target.value })}
                  placeholder="Keterangan tambahan (opsional)"
                />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowReduceStockModal(false)}>
                Batal
              </button>
              <button type="button" className="btn-primary" onClick={handleReduceStock}>
                ✅ Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Codes */}
      {showQrModal && selectedBook && createPortal(
        <div 
          className="modal-overlay modal-overlay-fullscreen" 
          onClick={() => setShowQrModal(false)}
          style={{
            zIndex: 99999,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(15, 23, 42, 0.45)'
          }}
        >
          <div className="modal-content modal-large modal-fullscreen-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>QR Codes: {selectedBook.title}</h3>
              <button className="modal-close" onClick={() => setShowQrModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {selectedBook.qrCodeUrl ? (
                <div className="qr-display-container">
                  <div className="qr-main-card">
                    <img src={selectedBook.qrCodeUrl} alt={`QR ${selectedBook.title}`} className="qr-image-large" />
                    <div className="qr-book-info">
                      <h4>{selectedBook.title}</h4>
                      <p><strong>Penulis:</strong> {selectedBook.author || '-'}</p>
                      <p><strong>Kategori:</strong> {selectedBook.category || '-'}</p>
                      <p><strong>Kode Buku:</strong> <span className="qr-code-text">{selectedBook.id}</span></p>
                      <p><strong>Stok:</strong> {selectedBook.totalCopies || 0} eksemplar</p>
                      <p className="qr-note">
                        📌 QR code ini sama untuk semua eksemplar buku ini.
                        {window.Capacitor && ' Tips: Jika unduhan otomatis tidak merespon, silakan tekan lama gambar QR Code di atas untuk menyimpannya langsung ke galeri.'}
                      </p>
                    </div>
                  </div>
                  <div className="qr-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const filename = `QR-${selectedBook.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                        downloadOrShareImage(selectedBook.qrCodeUrl, filename);
                      }}
                    >
                      💾 Download QR Code
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        if (window.AndroidApp) {
                          const qrHtml = `
                            <html>
                              <body style="text-align: center; margin: 0; padding: 20px; font-family: sans-serif;">
                                <div style="margin: 50px auto; max-width: 320px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                  <img src="${selectedBook.qrCodeUrl}" style="width: 240px; height: 240px; display: block; margin: 0 auto 15px auto;" />
                                  <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #1e293b;">${selectedBook.title}</h3>
                                  <p style="margin: 0; font-size: 14px; color: #64748b;">Kode Buku: ${selectedBook.id}</p>
                                </div>
                              </body>
                            </html>
                          `;
                          window.AndroidApp.printHtml(qrHtml);
                        } else {
                          window.print();
                        }
                      }}
                    >
                      🖨️ Cetak QR Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📷</div>
                  <p>QR code belum dibuat untuk buku ini</p>
                  <small>QR code akan otomatis dibuat saat menambah stok</small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowQrModal(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Edit Buku */}
      {showEditModal && selectedBook && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Data Buku</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit} className="modal-body">
              <div className="form-grid">
                <label className="form-label">
                  Judul Buku *
                  <input
                    className="form-input"
                    required
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Penulis
                  <input
                    className="form-input"
                    value={editFormData.author}
                    onChange={(e) => setEditFormData({ ...editFormData, author: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Kategori
                  <input
                    className="form-input"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Tahun Terbit
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.year}
                    onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Penerbit
                  <input
                    className="form-input"
                    value={editFormData.publisher}
                    onChange={(e) => setEditFormData({ ...editFormData, publisher: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Lokasi Rak
                  <input
                    className="form-input"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    placeholder="Contoh: Rak A-1"
                  />
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  💾 Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Buku */}
      {showDeleteModal && selectedBook && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3 className="confirm-title">Hapus Data Buku?</h3>
            <p className="confirm-message">
              Apakah Anda yakin ingin menghapus buku <strong>"{selectedBook.title}"</strong>?
            </p>
            <div className="confirm-warning-box">
              <p className="confirm-warning">
                ⚠️ <strong>PERINGATAN:</strong> Tindakan ini akan menghapus:
              </p>
              <ul className="confirm-warning-list">
                <li>📚 Data buku secara permanen</li>
                <li>📦 Seluruh stok buku ({selectedBook.totalCopies || 0} eksemplar)</li>
                <li>🔗 Semua data eksemplar terkait</li>
              </ul>
              <p className="confirm-warning">
                Tindakan ini <strong>tidak dapat dibatalkan</strong>!
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '⏳ Menghapus...' : '🗑️ Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

