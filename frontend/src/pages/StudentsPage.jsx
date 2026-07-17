import React, { useEffect, useState, useRef } from 'react';
import api from '../api.js';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState({
    nis: '',
    name: '',
    class: '',
    major: ''
  });
  const [editFormData, setEditFormData] = useState({
    nis: '',
    name: '',
    class: '',
    major: ''
  });
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const userStr = localStorage.getItem('user');
  let userObj = null;
  if (userStr) {
    try {
      userObj = JSON.parse(userStr);
    } catch {}
  }
  const userRole = userObj?.role || 'student';
  const isStaff = userRole === 'admin' || userRole === 'officer';

  const loadStudents = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/students');
      let data = res.data || [];
      if (q) {
        const qLower = q.toLowerCase();
        data = data.filter(
          (s) =>
            (s.nis && s.nis.toLowerCase().includes(qLower)) ||
            (s.name && s.name.toLowerCase().includes(qLower))
        );
      }
      setStudents(data);
    } catch (err) {
      console.error(err);
      setMessage('Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      loadStudents(search);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const handleExport = async () => {
    try {
      const res = await api.get('/students/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `data-siswa-${new Date().toISOString().split('T')[0]}.xlsx`);
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
      const res = await api.post('/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(`✅ Import selesai: ${res.data.success} berhasil, ${res.data.errors} error`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadStudents();
    } catch (err) {
      setMessage('❌ Gagal mengimpor data');
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/students', formData);
      setMessage('✅ Siswa berhasil ditambahkan');
      setShowForm(false);
      setFormData({ nis: '', name: '', class: '', major: '' });
      loadStudents();
    } catch (err) {
      setMessage('❌ Gagal menambahkan siswa');
      console.error(err);
    }
  };

  const openEditModal = (student) => {
    setSelectedStudent(student);
    setEditFormData({
      nis: student.nis || '',
      name: student.name || '',
      class: student.class || '',
      major: student.major || ''
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.put(`/students/${selectedStudent.id}`, editFormData);
      setMessage('✅ Data siswa berhasil diperbarui');
      setShowEditModal(false);
      setSelectedStudent(null);
      await loadStudents(search);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memperbarui data siswa';
      setMessage(`❌ ${errorMsg}`);
      console.error('Edit student error:', err);
    }
  };

  const openDeleteModal = (student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedStudent) return;
    setDeleting(true);
    setMessage('');
    try {
      await api.delete(`/students/${selectedStudent.id}`);
      setMessage('✅ Data siswa berhasil dihapus');
      setShowDeleteModal(false);
      setSelectedStudent(null);
      // Clear search to show all students after delete
      setSearch('');
      await loadStudents('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menghapus data siswa';
      setMessage(`❌ ${errorMsg}`);
      console.error('Delete student error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Data Siswa</h2>
        <div className="page-actions">
          <button type="button" className="btn-secondary" onClick={handleExport}>
            📥 Export Excel
          </button>
          {isStaff && (
            <>
              <label className="btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                📤 Import Excel
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </label>
              <button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Batal' : '+ Tambah Siswa'}
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => loadStudents()}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`form-message ${message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3 className="form-card-title">Tambah Siswa Baru</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="form-label">
                NIS *
                <input
                  className="form-input"
                  required
                  value={formData.nis}
                  onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                />
              </label>
              <label className="form-label">
                Nama Lengkap *
                <input
                  className="form-input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>
              <label className="form-label">
                Kelas
                <input
                  className="form-input"
                  placeholder="Contoh: XII RPL 1"
                  value={formData.class}
                  onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                />
              </label>
              <label className="form-label">
                Jurusan
                <input
                  className="form-input"
                  placeholder="Contoh: RPL, TKJ, dll"
                  value={formData.major}
                  onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                />
              </label>
            </div>
            {message && <div className="form-message">{message}</div>}
            <button type="submit" className="btn-primary">
              Simpan
            </button>
          </form>
        </div>
      )}

      <div className="search-box">
        <input
          className="form-input"
          placeholder="🔍 Cari siswa (NIS / nama)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Memuat data...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>NIS</th>
                <th>Nama</th>
                <th>Kelas</th>
                <th>Jurusan</th>
                {isStaff && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.nis || '-'}</strong></td>
                  <td>{s.name || '-'}</td>
                  <td>{s.class || '-'}</td>
                  <td>{s.major || '-'}</td>
                  {isStaff && (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-icon btn-edit"
                          onClick={() => openEditModal(s)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-delete"
                          onClick={() => openDeleteModal(s)}
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 5 : 4} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <p>{search ? 'Tidak ada hasil pencarian' : 'Belum ada data siswa'}</p>
                      {!search && isStaff && (
                        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                          Tambah Siswa Pertama
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Edit Siswa */}
      {showEditModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Data Siswa</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit} className="modal-body">
              <div className="form-grid">
                <label className="form-label">
                  NIS *
                  <input
                    className="form-input"
                    required
                    value={editFormData.nis}
                    onChange={(e) => setEditFormData({ ...editFormData, nis: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Nama Lengkap *
                  <input
                    className="form-input"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Kelas
                  <input
                    className="form-input"
                    placeholder="Contoh: XII RPL 1"
                    value={editFormData.class}
                    onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                  />
                </label>
                <label className="form-label">
                  Jurusan
                  <input
                    className="form-input"
                    placeholder="Contoh: RPL, TKJ, dll"
                    value={editFormData.major}
                    onChange={(e) => setEditFormData({ ...editFormData, major: e.target.value })}
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

      {/* Modal Konfirmasi Hapus Siswa */}
      {showDeleteModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3 className="confirm-title">Hapus Data Siswa?</h3>
            <p className="confirm-message">
              Apakah Anda yakin ingin menghapus data siswa <strong>{selectedStudent.name}</strong> (NIS: {selectedStudent.nis})?
            </p>
            <p className="confirm-warning">
              ⚠️ Tindakan ini tidak dapat dibatalkan. Data akan dihapus secara permanen.
            </p>
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
                {deleting ? '⏳ Menghapus...' : '🗑️ Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


