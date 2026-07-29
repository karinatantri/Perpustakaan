import React, { useEffect, useState, useRef } from 'react';
import api from '../api.js';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
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

  const classList = Array.from(new Set(students.map((s) => s.class).filter(Boolean)));
  const majorList = Array.from(new Set(students.map((s) => s.major).filter(Boolean)));

  const filteredStudents = students.filter((s) => {
    const matchClass = !selectedClass || s.class === selectedClass;
    const matchMajor = !selectedMajor || s.major === selectedMajor;
    return matchClass && matchMajor;
  });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="page-title">👥 Data Siswa</h2>
          <p className="page-subtitle">Kelola direktori siswa, kelas, dan data keanggotaan perpustakaan</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>👥 Total Siswa</div>
          <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 800, marginTop: 4 }}>{students.length}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>🏫 Kelas Terdaftar</div>
          <div style={{ fontSize: 22, color: '#1d4ed8', fontWeight: 800, marginTop: 4 }}>{classList.length}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>🎓 Jurusan / Keahlian</div>
          <div style={{ fontSize: 22, color: '#16a34a', fontWeight: 800, marginTop: 4 }}>{majorList.length}</div>
        </div>
      </div>

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
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Aksi Direktori:</span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
            onClick={() => loadStudents()}
          >
            🔄 Refresh Data
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
            onClick={handleExport}
          >
            📥 Export Excel
          </button>
          {isStaff && (
            <>
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
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? '✕ Batal' : '👥 + Tambah Siswa'}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`form-message ${message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {showForm && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <h3 className="form-card-title">👥 Tambah Siswa Baru</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label className="form-label">
                NIS *
                <input
                  className="form-input"
                  required
                  value={formData.nis}
                  onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                  placeholder="Nomor Induk Siswa"
                />
              </label>
              <label className="form-label">
                Nama Lengkap *
                <input
                  className="form-input"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nama Siswa"
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
            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn-primary">
                💾 Simpan Siswa
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Cari berdasarkan NIS, nama siswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>

          <div style={{ width: 170 }}>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="">🏫 Semua Kelas ({classList.length})</option>
              {classList.map((cls) => (
                <option key={cls} value={cls}>🏫 {cls}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 170 }}>
            <select
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            >
              <option value="">🎓 Semua Jurusan ({majorList.length})</option>
              {majorList.map((mj) => (
                <option key={mj} value={mj}>🎓 {mj}</option>
              ))}
            </select>
          </div>

          {(search || selectedClass || selectedMajor) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedClass(''); setSelectedMajor(''); }}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }}
            >
              ✕ Reset Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 50, textAlign: 'center', color: '#64748b' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
          <p>Memuat data siswa...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
          <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
            {search || selectedClass || selectedMajor ? 'Tidak ada siswa yang sesuai dengan filter pencarian.' : 'Belum ada data siswa.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <table className="table" style={{ margin: 0, minWidth: 650 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 60, textAlign: 'center' }}>No</th>
                <th>NIS</th>
                <th>Nama Lengkap</th>
                <th>Kelas</th>
                <th>Jurusan</th>
                {isStaff && <th style={{ textAlign: 'center', width: 140 }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s, idx) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: '#1d4ed8' }}>{s.nis || '-'}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.name || '-'}</td>
                  <td>
                    {s.class ? (
                      <span style={{ padding: '3px 8px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        🏫 {s.class}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td>
                    {s.major ? (
                      <span style={{ padding: '3px 8px', background: '#f0fdf4', color: '#166534', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                        🎓 {s.major}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  {isStaff && (
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-sm btn-outline"
                          onClick={() => openEditModal(s)}
                          title="Edit Siswa"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-danger"
                          onClick={() => openDeleteModal(s)}
                          title="Hapus Siswa"
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


