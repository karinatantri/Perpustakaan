import React, { useEffect, useState, useRef } from 'react';
import api from '../api.js';

export default function StudentsPage() {
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'teachers'
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [loading, setLoading] = useState(true);

  // Forms visibility
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showTeacherForm, setShowTeacherForm] = useState(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Student Form Data
  const [studentFormData, setStudentFormData] = useState({
    nis: '',
    name: '',
    class: '',
    major: ''
  });

  // Teacher Form Data
  const [teacherFormData, setTeacherFormData] = useState({
    nis: '',
    name: '',
    class: '',
    major: '',
    phone: '',
    email: ''
  });

  // Edit Form Data
  const [editFormData, setEditFormData] = useState({
    nis: '',
    name: '',
    class: '',
    major: '',
    phone: '',
    email: '',
    role: 'student'
  });

  const [classesList, setClassesList] = useState([]);
  const [resettingPw, setResettingPw] = useState(false);
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

  const loadMembers = async (q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/students');
      let data = res.data || [];
      const distinctClasses = Array.from(
        new Set(
          data
            .filter((m) => m.role !== 'teacher')
            .map((m) => m.class)
            .filter((c) => c && c !== '-')
        )
      ).sort();
      setClassesList(distinctClasses);

      if (q) {
        const qLower = q.toLowerCase();
        data = data.filter(
          (m) =>
            (m.nis && m.nis.toLowerCase().includes(qLower)) ||
            (m.name && m.name.toLowerCase().includes(qLower))
        );
      }
      setMembers(data);
    } catch (err) {
      console.error(err);
      setMessage('Gagal memuat data anggota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      loadMembers(search);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  // Separate data for students and teachers
  const studentsList = members.filter((m) => m.role !== 'teacher');
  const teachersList = members.filter((m) => m.role === 'teacher');

  // Classes list from all members
  const classList = Array.from(new Set(studentsList.map((s) => s.class).filter(Boolean))).sort();
  const majorList = Array.from(new Set(studentsList.map((s) => s.major).filter(Boolean))).sort();

  // Filtered lists
  const filteredStudents = studentsList.filter((s) => {
    const matchClass = !selectedClass || s.class === selectedClass;
    const matchMajor = !selectedMajor || s.major === selectedMajor;
    return matchClass && matchMajor;
  });

  const filteredTeachers = teachersList;

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
      setMessage('✅ Data siswa berhasil diekspor ke Excel');
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
      loadMembers();
    } catch (err) {
      setMessage('❌ Gagal mengimpor data');
      console.error(err);
    }
  };

  // Submit Student
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/students', {
        ...studentFormData,
        role: 'student'
      });
      setMessage(`✅ Siswa "${studentFormData.name}" berhasil ditambahkan & akun login @${studentFormData.nis} otomatis dibuat!`);
      setShowStudentForm(false);
      setStudentFormData({ nis: '', name: '', class: '', major: '' });
      setActiveTab('students');
      setSearch('');
      await loadMembers('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal menambahkan siswa';
      setMessage(`❌ ${msg}`);
      console.error(err);
    }
  };

  // Submit Teacher
  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/students', {
        nis: teacherFormData.nis.trim(),
        name: teacherFormData.name.trim(),
        class: teacherFormData.class || '-',
        major: teacherFormData.major.trim() || 'Guru',
        phone: teacherFormData.phone.trim() || '-',
        email: teacherFormData.email.trim() || '-',
        role: 'teacher'
      });
      setMessage(`✅ Guru "${teacherFormData.name}" berhasil ditambahkan & akun login @${teacherFormData.nis} otomatis dibuat!`);
      setShowTeacherForm(false);
      setTeacherFormData({ nis: '', name: '', class: '', major: '', phone: '', email: '' });
      setActiveTab('teachers');
      setSearch('');
      await loadMembers('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Gagal menambahkan guru';
      setMessage(`❌ ${msg}`);
      console.error(err);
    }
  };

  // Open Edit Modal
  const openEditModal = (member) => {
    setSelectedMember(member);
    setEditFormData({
      nis: member.nis || '',
      name: member.name || '',
      class: (member.class && member.class !== '-') ? member.class : '',
      major: member.major || '',
      phone: member.phone || '',
      email: member.email || '',
      role: member.role || 'student'
    });
    setShowEditModal(true);
  };

  // Submit Edit
  const handleEdit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const payload = {
        ...editFormData,
        class: editFormData.role === 'teacher' ? (editFormData.class || '-') : (editFormData.class || '-')
      };
      await api.put(`/students/${selectedMember.id}`, payload);
      setMessage(`✅ Data ${selectedMember.role === 'teacher' ? 'guru' : 'siswa'} berhasil diperbarui`);
      setShowEditModal(false);
      setSelectedMember(null);
      await loadMembers(search);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal memperbarui data';
      setMessage(`❌ ${errorMsg}`);
      console.error('Edit error:', err);
    }
  };

  // Reset Password for Member Account in Edit Modal
  const handleResetPasswordInModal = async () => {
    if (!selectedMember) return;
    const label = selectedMember.role === 'teacher' ? 'guru' : 'siswa';
    if (!window.confirm(`Yakin ingin mereset password akun login ${label} "${selectedMember.name}" (@${selectedMember.nis}) ke password default ("password123")?`)) return;

    try {
      setResettingPw(true);
      const res = await api.post(`/students/${selectedMember.id}/reset-password`);
      setMessage(`✅ ${res.data.message || `Password akun @${selectedMember.nis} berhasil direset ke password123!`}`);
      alert(`✅ Password akun @${selectedMember.nis} berhasil direset ke password default ("password123")!`);
    } catch (err) {
      console.error('Reset password error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gagal mereset password akun';
      alert(`❌ ${errorMsg}`);
    } finally {
      setResettingPw(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (member) => {
    setSelectedMember(member);
    setShowDeleteModal(true);
  };

  // Submit Delete
  const handleDelete = async () => {
    if (!selectedMember) return;
    setDeleting(true);
    setMessage('');
    try {
      await api.delete(`/students/${selectedMember.id}`);
      setMessage(`✅ Data ${selectedMember.role === 'teacher' ? 'guru' : 'siswa'} dan akun terkait berhasil dihapus`);
      setShowDeleteModal(false);
      setSelectedMember(null);
      setSearch('');
      await loadMembers('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menghapus data';
      setMessage(`❌ ${errorMsg}`);
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h2 className="page-title">👥 Data Anggota (Siswa & Guru)</h2>
          <p className="page-subtitle">Kelola direktori keanggotaan perpustakaan, akun login otomatis, serta hak pinjam siswa dan guru</p>
        </div>
      </div>

      {/* Tab Switcher Panel */}
      <div className="tab-switcher" style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '2px solid #cbd5e1', paddingBottom: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          style={{
            padding: '10px 22px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'students' ? '#1d4ed8' : '#f1f5f9',
            color: activeTab === 'students' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'students' ? '0 4px 12px rgba(29,78,216,0.25)' : 'none'
          }}
        >
          🎓 Data Siswa ({studentsList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          style={{
            padding: '10px 22px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            background: activeTab === 'teachers' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'teachers' ? '#ffffff' : '#475569',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'teachers' ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
          }}
        >
          👨‍🏫 Data Guru ({teachersList.length})
        </button>
      </div>

      {/* Stats Summary Cards */}
      {activeTab === 'students' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>🎓 Total Siswa</div>
            <div style={{ fontSize: 22, color: '#0f172a', fontWeight: 800, marginTop: 4 }}>{studentsList.length}</div>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>🏫 Kelas Terdaftar</div>
            <div style={{ fontSize: 22, color: '#1d4ed8', fontWeight: 800, marginTop: 4 }}>{classList.length}</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>📚 Jurusan / Keahlian</div>
            <div style={{ fontSize: 22, color: '#16a34a', fontWeight: 800, marginTop: 4 }}>{majorList.length}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>👨‍🏫 Total Guru Terdaftar</div>
            <div style={{ fontSize: 22, color: '#1d4ed8', fontWeight: 800, marginTop: 4 }}>{teachersList.length}</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>🏫 Guru Wali Kelas</div>
            <div style={{ fontSize: 22, color: '#16a34a', fontWeight: 800, marginTop: 4 }}>
              {teachersList.filter((t) => t.class && t.class !== '-').length}
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>🔑 Status Akun Login</div>
            <div style={{ fontSize: 14, color: '#059669', fontWeight: 700, marginTop: 6 }}>
              ✓ Semua Memiliki Akun
            </div>
          </div>
        </div>
      )}

      {/* Directory Actions Row */}
      <div
        className="page-actions-row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
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
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Aksi:</span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8 }}
            onClick={() => loadMembers()}
          >
            🔄 Refresh Data
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {activeTab === 'students' && (
            <>
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
                    onClick={() => setShowStudentForm(!showStudentForm)}
                  >
                    {showStudentForm ? '✕ Batal' : '🎓 + Tambah Siswa'}
                  </button>
                </>
              )}
            </>
          )}

          {activeTab === 'teachers' && isStaff && (
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, background: '#2563eb', borderColor: '#2563eb' }}
              onClick={() => setShowTeacherForm(!showTeacherForm)}
            >
              {showTeacherForm ? '✕ Batal' : '👨‍🏫 + Tambah Guru'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`form-message ${message.includes('✅') ? 'form-message-success' : 'form-message-error'}`}>
          {message}
        </div>
      )}

      {/* Form Tambah Siswa */}
      {showStudentForm && activeTab === 'students' && (
        <div className="form-card" style={{ marginBottom: 20 }}>
          <h3 className="form-card-title">🎓 Tambah Siswa Baru</h3>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
            ℹ️ Akun login siswa otomatis dibuat: <strong>Username = NIS</strong>, <strong>Password = password123</strong> (Role: Siswa).
          </p>
          <form onSubmit={handleStudentSubmit}>
            <div className="form-grid">
              <label className="form-label">
                NIS *
                <input
                  className="form-input"
                  required
                  value={studentFormData.nis}
                  onChange={(e) => setStudentFormData({ ...studentFormData, nis: e.target.value })}
                  placeholder="Nomor Induk Siswa (untuk login)"
                />
              </label>
              <label className="form-label">
                Nama Lengkap Siswa *
                <input
                  className="form-input"
                  required
                  value={studentFormData.name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                  placeholder="Contoh: Muhammad Rizki"
                />
              </label>
              <label className="form-label">
                Kelas
                <input
                  className="form-input"
                  value={studentFormData.class}
                  onChange={(e) => setStudentFormData({ ...studentFormData, class: e.target.value })}
                  placeholder="Contoh: X RPL 1, XI TKJ 2"
                />
              </label>
              <label className="form-label">
                Jurusan / Keahlian
                <input
                  className="form-input"
                  value={studentFormData.major}
                  onChange={(e) => setStudentFormData({ ...studentFormData, major: e.target.value })}
                  placeholder="Contoh: Rekayasa Perangkat Lunak"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary">
                💾 Simpan Siswa
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowStudentForm(false)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Form Tambah Guru */}
      {showTeacherForm && activeTab === 'teachers' && (
        <div className="form-card" style={{ marginBottom: 20, borderLeft: '4px solid #2563eb' }}>
          <h3 className="form-card-title">👨‍🏫 Tambah Data Guru Baru</h3>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
            ℹ️ <strong>Akun Login Otomatis:</strong> Menambahkan guru di sini otomatis membuat akun login dengan <strong>Username = NIP/NUPTK/Username</strong> dan <strong>Password bawaan = password123</strong> (Role: Guru). Guru langsung dapat meminjam buku.
          </div>
          <form onSubmit={handleTeacherSubmit}>
            <div className="form-grid">
              <label className="form-label">
                NIP / NUPTK / Username Guru *
                <input
                  className="form-input"
                  required
                  value={teacherFormData.nis}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, nis: e.target.value })}
                  placeholder="Contoh: NIP, NUPTK, atau nama_guru"
                />
              </label>
              <label className="form-label">
                Nama Lengkap & Gelar *
                <input
                  className="form-input"
                  required
                  value={teacherFormData.name}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, name: e.target.value })}
                  placeholder="Contoh: Budi Santoso, S.Pd., M.Kom"
                />
              </label>
              <label className="form-label">
                Mata Pelajaran / Jabatan
                <input
                  className="form-input"
                  value={teacherFormData.major}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, major: e.target.value })}
                  placeholder="Contoh: Matematika, Bahasa Inggris, Guru BK"
                />
              </label>
              <label className="form-label">
                Wali Kelas (Opsional)
                <select
                  className="form-input"
                  value={teacherFormData.class || ''}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, class: e.target.value })}
                  style={{
                    border: '1px solid #a7f3d0',
                    background: '#ecfdf5',
                    color: '#065f46',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Bukan Wali Kelas (Guru Biasa)</option>
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>
                      💼 Wali Kelas {cls}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label">
                No HP / WhatsApp (Opsional)
                <input
                  className="form-input"
                  value={teacherFormData.phone}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </label>
              <label className="form-label">
                Email (Opsional)
                <input
                  type="email"
                  className="form-input"
                  value={teacherFormData.email}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
                  placeholder="guru@sekolah.sch.id"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="btn-primary" style={{ background: '#2563eb', borderColor: '#2563eb' }}>
                💾 Simpan Guru & Buat Akun
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowTeacherForm(false)}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              className="form-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === 'students' ? '🔍 Cari siswa berdasarkan nama atau NIS...' : '🔍 Cari guru berdasarkan nama atau NIP/NUPTK...'}
              style={{ width: '100%' }}
            />
          </div>

          {activeTab === 'students' && (
            <>
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
            </>
          )}

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
          <p>Memuat data direktori...</p>
        </div>
      ) : activeTab === 'students' ? (
        /* TAB DATA SISWA */
        filteredStudents.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎓</div>
            <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
              {search || selectedClass || selectedMajor ? 'Tidak ada siswa yang sesuai filter pencarian.' : 'Belum ada data siswa.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ margin: 0, minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: 50, textAlign: 'center' }}>No</th>
                  <th>NIS</th>
                  <th>Nama Siswa</th>
                  <th>Kelas</th>
                  <th>Jurusan</th>
                  <th>Akun Login</th>
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
                    <td>
                      <span style={{ fontSize: 12, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                        @{s.nis || s.username || '-'}
                      </span>
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
        )
      ) : (
        /* TAB DATA GURU */
        filteredTeachers.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👨‍🏫</div>
            <p style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>
              {search ? 'Tidak ada guru yang sesuai pencarian.' : 'Belum ada data guru.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <table className="table" style={{ margin: 0, minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: 50, textAlign: 'center' }}>No</th>
                  <th>NIP / NUPTK</th>
                  <th>Nama Guru</th>
                  <th>Mata Pelajaran / Jabatan</th>
                  <th>Wali Kelas</th>
                  <th>Akun Login</th>
                  {isStaff && <th style={{ textAlign: 'center', width: 140 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((g, idx) => (
                  <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: '#2563eb' }}>{g.nis || '-'}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>👨‍🏫</span>
                        <span>{g.name || '-'}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ padding: '3px 8px', background: '#f8fafc', color: '#475569', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0' }}>
                        📖 {g.major && g.major !== '-' ? g.major : 'Guru Pengajar'}
                      </span>
                    </td>
                    <td>
                      {g.class && g.class !== '-' ? (
                        <span style={{ padding: '3px 8px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                          💼 Wali Kelas {g.class}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Bukan Wali Kelas</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                        @{g.nis || g.username || '-'}
                      </span>
                    </td>
                    {isStaff && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-sm btn-outline"
                            onClick={() => openEditModal(g)}
                            title="Edit Guru"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-sm btn-danger"
                            onClick={() => openDeleteModal(g)}
                            title="Hapus Guru"
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
        )
      )}

      {/* Modal Edit Member (Siswa atau Guru) */}
      {showEditModal && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✏️ Edit Data {selectedMember.role === 'teacher' ? 'Guru' : 'Siswa'}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit} className="modal-body">
              <div className="form-grid">
                <label className="form-label">
                  {selectedMember.role === 'teacher' ? 'NIP / NUPTK / Username *' : 'NIS *'}
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
                {selectedMember.role === 'teacher' ? (
                  <label className="form-label">
                    Wali Kelas (Opsional)
                    <select
                      className="form-input"
                      value={editFormData.class || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                      style={{
                        border: '1px solid #a7f3d0',
                        background: '#ecfdf5',
                        color: '#065f46',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Bukan Wali Kelas (Guru Biasa)</option>
                      {Array.from(new Set([...classesList, editFormData.class].filter((c) => c && c !== '-'))).sort().map((cls) => (
                        <option key={cls} value={cls}>
                          💼 Wali Kelas {cls}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="form-label">
                    Kelas
                    <input
                      className="form-input"
                      placeholder="Contoh: XII RPL 1"
                      value={editFormData.class}
                      onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                    />
                  </label>
                )}
                <label className="form-label">
                  {selectedMember.role === 'teacher' ? 'Mata Pelajaran / Jabatan' : 'Jurusan'}
                  <input
                    className="form-input"
                    placeholder={selectedMember.role === 'teacher' ? 'Contoh: Matematika' : 'Contoh: RPL, TKJ'}
                    value={editFormData.major}
                    onChange={(e) => setEditFormData({ ...editFormData, major: e.target.value })}
                  />
                </label>
                {selectedMember.role === 'teacher' && (
                  <>
                    <label className="form-label">
                      No HP / WhatsApp
                      <input
                        className="form-input"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        placeholder="08xxxxxxxxxx"
                      />
                    </label>
                    <label className="form-label">
                      Email
                      <input
                        type="email"
                        className="form-input"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        placeholder="guru@sekolah.sch.id"
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                {isStaff && (
                  <button
                    type="button"
                    onClick={handleResetPasswordInModal}
                    disabled={resettingPw}
                    style={{
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: '#fff7ed',
                      color: '#c2410c',
                      border: '1px solid #fed7aa',
                      borderRadius: 8,
                      cursor: resettingPw ? 'not-allowed' : 'pointer'
                    }}
                    title="Reset kata sandi akun login ke default (password123)"
                  >
                    🔑 {resettingPw ? '⏳ Mereset...' : 'Reset Password Akun ("password123")'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn-primary">
                    💾 Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Member */}
      {showDeleteModal && selectedMember && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3 className="confirm-title">
              Hapus Data {selectedMember.role === 'teacher' ? 'Guru' : 'Siswa'}?
            </h3>
            <p className="confirm-message">
              Apakah Anda yakin ingin menghapus data {selectedMember.role === 'teacher' ? 'guru' : 'siswa'}{' '}
              <strong>{selectedMember.name}</strong> ({selectedMember.role === 'teacher' ? 'NIP / NUPTK' : 'NIS'}: {selectedMember.nis})?
            </p>
            <p className="confirm-warning">
              ⚠️ Tindakan ini akan sekaligus menghapus akun login terkait (@{selectedMember.nis}). Data tidak dapat dikembalikan.
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
