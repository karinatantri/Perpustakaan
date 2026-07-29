import React, { useEffect, useState } from 'react';
import api from '../api';
import { downloadOrShareImage } from '../utils/downloadHelper.js';

export default function InventoriesPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = ['admin', 'officer'].includes(user.role);

  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showReduceStockModal, setShowReduceStockModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedQrItem, setSelectedQrItem] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    unit: 'pcs',
    stock: 0,
    minStock: 0,
    imageUrl: ''
  });

  const [editItem, setEditItem] = useState({
    name: '',
    category: '',
    unit: 'pcs',
    stock: 0,
    minStock: 0
  });

  const [addStockQty, setAddStockQty] = useState(1);
  const [addStockNotes, setAddStockNotes] = useState('');

  const [reduceStockQty, setReduceStockQty] = useState(1);
  const [reduceStockNotes, setReduceStockNotes] = useState('');

  const [logForm, setLogForm] = useState({
    type: 'in',
    quantity: 1,
    notes: ''
  });

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchInventories();
  }, []);

  const fetchInventories = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/inventories');
      setInventories(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Gagal mengambil data inventaris');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return alert('Nama barang wajib diisi');

    try {
      await api.post('/inventories', {
        ...newItem,
        stock: Number(newItem.stock) || 0,
        minStock: Number(newItem.minStock) || 0
      });
      setShowAddModal(false);
      setNewItem({ name: '', category: '', unit: 'pcs', stock: 0, minStock: 0, imageUrl: '' });
      fetchInventories();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambahkan barang');
    }
  };

  const handleOpenLogModal = (item) => {
    setSelectedItem(item);
    setLogForm({ type: 'in', quantity: 1, notes: '' });
    setShowLogModal(true);
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await api.post(`/inventories/${selectedItem.id}/logs`, {
        type: logForm.type,
        quantity: Number(logForm.quantity) || 1,
        notes: logForm.notes
      });
      setShowLogModal(false);
      fetchInventories();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mencatat stok');
    }
  };

  const handleViewHistory = async (item) => {
    setSelectedItem(item);
    setShowHistoryModal(true);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/inventories/${item.id}/logs`);
      setLogs(res.data || []);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleShowQr = async (item) => {
    const itemCode = item.itemCode || `INV-${item.id}`;
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(itemCode)}`;
    const initialUrl = item.qrCodeUrl || fallbackUrl;

    setSelectedQrItem({ ...item, itemCode, qrCodeUrl: initialUrl });
    setShowQrModal(true);
    setLoadingQr(false);

    try {
      const res = await api.get(`/inventories/${item.id}/qr`);
      const finalUrl = res.data?.qrCodeUrl || fallbackUrl;
      const finalCode = res.data?.itemCode || itemCode;
      setSelectedQrItem((prev) => (prev && prev.id === item.id ? { ...prev, itemCode: finalCode, qrCodeUrl: finalUrl } : prev));
      setInventories((prev) =>
        prev.map((inv) => (inv.id === item.id ? { ...inv, itemCode: finalCode, qrCodeUrl: finalUrl } : inv))
      );
    } catch (err) {
      console.warn('Backend QR fetch fallback active:', err);
    }
  };

  const handleOpenEdit = (item) => {
    setSelectedItem(item);
    setEditItem({
      name: item.name || '',
      category: item.category || '',
      unit: item.unit || 'pcs',
      stock: item.stock || 0,
      minStock: item.minStock || 0
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await api.put(`/inventories/${selectedItem.id}`, editItem);
      setShowEditModal(false);
      fetchInventories();
    } catch (err) {
      setError('Gagal memperbarui barang inventaris');
    }
  };

  const handleOpenAddStock = (item) => {
    setSelectedItem(item);
    setAddStockQty(1);
    setAddStockNotes('');
    setShowAddStockModal(true);
  };

  const handleAddStockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await api.post(`/inventories/${selectedItem.id}/logs`, {
        type: 'in',
        quantity: Number(addStockQty) || 1,
        notes: addStockNotes || 'Penambahan stok'
      });
      setShowAddStockModal(false);
      fetchInventories();
    } catch (err) {
      setError('Gagal menambah stok barang');
    }
  };

  const handleOpenReduceStock = (item) => {
    setSelectedItem(item);
    setReduceStockQty(1);
    setReduceStockNotes('');
    setShowReduceStockModal(true);
  };

  const handleReduceStockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await api.post(`/inventories/${selectedItem.id}/logs`, {
        type: 'out',
        quantity: Number(reduceStockQty) || 1,
        notes: reduceStockNotes || 'Pengurangan stok'
      });
      setShowReduceStockModal(false);
      fetchInventories();
    } catch (err) {
      setError('Gagal mengurangi stok barang');
    }
  };

  const handleOpenDelete = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteInventory = async () => {
    if (!selectedItem) return;
    setDeleting(true);
    try {
      await api.delete(`/inventories/${selectedItem.id}`);
      setShowDeleteModal(false);
      setSelectedItem(null);
      fetchInventories();
    } catch (err) {
      setError('Gagal menghapus barang inventaris');
    } finally {
      setDeleting(false);
    }
  };

  // Categories list
  const categories = Array.from(new Set(inventories.map((i) => i.category).filter(Boolean)));

  // Filtered inventories
  const filtered = inventories.filter((item) => {
    const matchSearch = (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
                        (item.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Inventaris Barang</h1>
          <p className="page-subtitle">Kelola stok perlengkapan dan peralatan sekolah</p>
        </div>
        {isStaff && (
          <button type="button" onClick={() => setShowAddModal(!showAddModal)} className="btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
            {showAddModal ? 'Batal' : '📦 + Tambah Barang'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Inline Form-Card Tambah Barang (Desain persis Tambah Buku) */}
      {showAddModal && (
        <div className="form-card" style={{ borderLeft: '4px solid #059669', marginBottom: 20 }}>
          <h3 className="form-card-title">📦 Tambah Barang Inventaris Baru</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <label className="form-label">
                Nama Barang *
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="form-input"
                  placeholder="Misal: Spidol Boardmarker, Meja Baca, Laptop"
                />
              </label>
              <label className="form-label">
                Kategori
                <input
                  type="text"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="form-input"
                  placeholder="Misal: Alat Tulis, Kebersihan, Meubel, Elektronik"
                />
              </label>
              <label className="form-label">
                Stok Awal
                <input
                  type="number"
                  min="0"
                  value={newItem.stock}
                  onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                  className="form-input"
                />
              </label>
              <label className="form-label">
                Satuan
                <input
                  type="text"
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="form-input"
                  placeholder="pcs, box, pack, unit"
                />
              </label>
              <label className="form-label">
                Batas Minimal Stok (Alert)
                <input
                  type="number"
                  min="0"
                  value={newItem.minStock}
                  onChange={(e) => setNewItem({ ...newItem, minStock: e.target.value })}
                  className="form-input"
                  placeholder="Alert stok menipis"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>
                💾 Simpan Barang
              </button>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📦 Total Jenis Barang</div>
          <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 800, marginTop: 4 }}>{inventories.length}</div>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>📊 Total Unit Stok</div>
          <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 800, marginTop: 4 }}>
            {inventories.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0)}
          </div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠️ Stok Menipis</div>
          <div style={{ fontSize: 22, color: '#dc2626', fontWeight: 800, marginTop: 4 }}>
            {inventories.filter((i) => (Number(i.stock) || 0) <= (Number(i.minStock) || 0)).length}
          </div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>🏷️ Kategori</div>
          <div style={{ fontSize: 22, color: '#16a34a', fontWeight: 800, marginTop: 4 }}>{categories.length}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari berdasarkan nama barang, kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          <div style={{ width: 200 }}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="">📁 Semua Kategori ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>📁 {cat}</option>
              ))}
            </select>
          </div>

          {(search || selectedCategory) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory(''); }}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
          <p>Memuat data inventaris...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
          <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
            {search || selectedCategory ? 'Tidak ada barang yang cocok dengan pencarian.' : 'Belum ada data barang inventaris.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <table className="table" style={{ margin: 0, minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 50, textAlign: 'center' }}>No</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th style={{ textAlign: 'center' }}>Stok</th>
                <th style={{ textAlign: 'center' }}>Satuan</th>
                <th style={{ textAlign: 'center' }}>Min. Stok</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: 220 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const isLow = (Number(item.stock) || 0) <= (Number(item.minStock) || 0);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                    <td>
                      {item.category ? (
                        <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                          📁 {item.category}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: isLow ? '#dc2626' : '#059669' }}>
                      {item.stock}
                    </td>
                    <td style={{ textAlign: 'center', color: '#475569', fontSize: 13 }}>{item.unit || 'pcs'}</td>
                    <td style={{ textAlign: 'center', color: '#64748b', fontSize: 13 }}>{item.minStock || 0}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isLow ? (
                        <span style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          ⚠️ Stok Menipis
                        </span>
                      ) : (
                        <span style={{ padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          ✅ Tersedia
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleShowQr(item)}
                          className="btn-sm btn-secondary"
                          style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 700, padding: '4px 8px' }}
                          title="Lihat & Cetak QR Code Barang"
                        >
                          📷 QR
                        </button>
                        {isStaff && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="btn-sm btn-outline"
                              style={{ padding: '4px 8px' }}
                              title="Edit Barang"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAddStock(item)}
                              className="btn-sm btn-secondary"
                              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0', fontWeight: 700, padding: '4px 8px' }}
                              title="Tambah Stok"
                            >
                              ➕
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReduceStock(item)}
                              className="btn-sm btn-secondary"
                              style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#ffedd5', fontWeight: 700, padding: '4px 8px' }}
                              title="Kurangi Stok"
                              disabled={!item.stock || item.stock === 0}
                            >
                              ➖
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(item)}
                              className="btn-sm btn-danger"
                              style={{ padding: '4px 8px' }}
                              title="Hapus Barang"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleViewHistory(item)}
                          className="btn-sm btn-outline"
                          style={{ fontWeight: 600, padding: '4px 8px' }}
                          title="Lihat Riwayat Log"
                        >
                          📜
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Update Stok */}
      {showLogModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔄 Mutasi Stok: {selectedItem.name}</h3>
              <button type="button" onClick={() => setShowLogModal(false)} className="btn-close">✕</button>
            </div>
            <form onSubmit={handleSaveLog}>
              <div className="form-group">
                <label>Jenis Transaksi</label>
                <select
                  value={logForm.type}
                  onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                  className="form-control"
                >
                  <option value="in">📥 Stok Masuk (+)</option>
                  <option value="out">📤 Stok Keluar (-)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Jumlah ({selectedItem.unit || 'pcs'})</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={logForm.quantity}
                  onChange={(e) => setLogForm({ ...logForm, quantity: e.target.value })}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Keterangan / Catatan</label>
                <textarea
                  rows="3"
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  className="form-control"
                  placeholder="Misal: Pembelian barang baru / Dipakai untuk Kelas 7A"
                />
              </div>
              <div className="modal-footer" style={{ marginTop: 20 }}>
                <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">Catat Stok</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Logs */}
      {showHistoryModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📜 Riwayat Stok: {selectedItem.name}</h3>
              <button type="button" onClick={() => setShowHistoryModal(false)} className="btn-close">✕</button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {loadingLogs ? (
                <p style={{ textAlign: 'center', padding: 20 }}>Memuat riwayat...</p>
              ) : logs.length === 0 ? (
                <p style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Belum ada catatan transaksi stok.</p>
              ) : (
                <table className="table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Tipe</th>
                      <th>Jumlah</th>
                      <th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.createdAt ? new Date(log.createdAt).toLocaleString('id-ID') : '-'}</td>
                        <td>
                          {log.type === 'in' ? (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>📥 Masuk</span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>📤 Keluar</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 700 }}>{log.quantity} {selectedItem.unit || 'pcs'}</td>
                        <td>{log.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button type="button" onClick={() => setShowHistoryModal(false)} className="btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code Barang Inventaris */}
      {showQrModal && selectedQrItem && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📱 QR Code Barang Inventaris</h3>
              <button type="button" onClick={() => setShowQrModal(false)} className="btn-close">✕</button>
            </div>
            
            <div style={{ padding: '16px 0' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>{selectedQrItem.name}</h4>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                Kode: <strong>{selectedQrItem.itemCode || `INV-${selectedQrItem.id}`}</strong>
                {selectedQrItem.category ? ` • ${selectedQrItem.category}` : ''}
              </p>

              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', margin: '16px 0', display: 'inline-block' }}>
                {loadingQr ? (
                  <div style={{ padding: 40 }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 8px' }}></div>
                    <p style={{ fontSize: 13, color: '#64748b' }}>Membuat QR Code...</p>
                  </div>
                ) : selectedQrItem.qrCodeUrl ? (
                  <img
                    src={selectedQrItem.qrCodeUrl}
                    alt={`QR Code ${selectedQrItem.name}`}
                    style={{ width: 220, height: 220, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    onError={(e) => {
                      const itemCode = selectedQrItem.itemCode || `INV-${selectedQrItem.id}`;
                      e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(itemCode)}`;
                    }}
                  />
                ) : (
                  <div style={{ padding: 30, color: '#dc2626' }}>Gagal memuat QR Code</div>
                )}
              </div>

              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Tempelkan QR code ini pada fisik barang/perlengkapan untuk memudahkan pencatatan & scan inventaris.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => downloadOrShareImage(selectedQrItem.qrCodeUrl, `QR_${selectedQrItem.name}.png`)}
                disabled={!selectedQrItem.qrCodeUrl}
              >
                📥 Download QR
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
                disabled={!selectedQrItem.qrCodeUrl}
              >
                🖨️ Cetak
              </button>
              <button type="button" onClick={() => setShowQrModal(false)} className="btn-secondary">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Barang */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Barang Inventaris</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="btn-close">✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Nama Barang *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editItem.name}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Kategori</label>
                <input
                  type="text"
                  className="form-input"
                  value={editItem.category}
                  onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label">Satuan</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editItem.unit}
                    onChange={(e) => setEditItem({ ...editItem, unit: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Batas Minimal Stok Alert</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={editItem.minStock}
                    onChange={(e) => setEditItem({ ...editItem, minStock: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">💾 Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Stok Barang */}
      {showAddStockModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowAddStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Tambah Stok: {selectedItem.name}</h3>
              <button type="button" onClick={() => setShowAddStockModal(false)} className="btn-close">✕</button>
            </div>
            <form onSubmit={handleAddStockSubmit}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#64748b' }}>
                Stok saat ini: <strong>{selectedItem.stock} {selectedItem.unit || 'pcs'}</strong>
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Jumlah Stok Ditambahkan *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  value={addStockQty}
                  onChange={(e) => setAddStockQty(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Catatan Pembelian / Masuk</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Misal: Pembelian APBD Triwulan 1"
                  value={addStockNotes}
                  onChange={(e) => setAddStockNotes(e.target.value)}
                />
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddStockModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" style={{ background: '#059669', borderColor: '#059669' }}>➕ Tambah Stok</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kurangi Stok Barang */}
      {showReduceStockModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowReduceStockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➖ Kurangi Stok: {selectedItem.name}</h3>
              <button type="button" onClick={() => setShowReduceStockModal(false)} className="btn-close">✕</button>
            </div>
            <form onSubmit={handleReduceStockSubmit}>
              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#64748b' }}>
                Stok tersedia: <strong>{selectedItem.stock} {selectedItem.unit || 'pcs'}</strong>
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Jumlah Stok Dikurangi *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.stock || 1}
                  required
                  className="form-input"
                  value={reduceStockQty}
                  onChange={(e) => setReduceStockQty(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Alasan Pengurangan / Pemakaian</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Misal: Spidol habis dipakai mengajar, meja rusak"
                  value={reduceStockNotes}
                  onChange={(e) => setReduceStockNotes(e.target.value)}
                />
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReduceStockModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" style={{ background: '#ea580c', borderColor: '#ea580c' }}>➖ Kurangi Stok</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Barang */}
      {showDeleteModal && selectedItem && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3 className="confirm-title">Hapus Barang Inventaris?</h3>
            <p className="confirm-message">
              Apakah Anda yakin ingin menghapus barang <strong>"{selectedItem.name}"</strong>?
            </p>
            <div className="confirm-warning-box">
              <p className="confirm-warning">
                ⚠️ Tindakan ini akan menghapus data barang dan riwayat mutasi stok terkait secara permanen!
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
                onClick={handleDeleteInventory}
                disabled={deleting}
              >
                {deleting ? '⏳ Menghapus...' : '🗑️ Ya, Hapus Barang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
