import React, { useEffect, useState } from 'react';
import api from '../api';

const roles = [
  { value: 'admin', label: '🛡️ Admin' },
  { value: 'officer', label: '👨‍💼 Karyawan / Petugas' },
  { value: 'teacher', label: '👨‍🏫 Guru / Tenaga Pendidik' },
  { value: 'student', label: '🎓 Siswa' },
  { value: 'principal', label: '👑 Kepala Sekolah' }
];

export default function AccountsPage() {
  const [users, setUsers] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({ username: '', password: '', role: 'officer', name: '', homeroomClass: '' });
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'error' | 'success'

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data || []);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data akun');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await api.get('/students');
      const students = res.data || [];
      const classes = Array.from(new Set(students.map(s => s.class).filter(Boolean)));
      setClassesList(classes.sort());
    } catch (err) {
      console.error('Failed to load classes:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadClasses();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setForm({ username: '', password: '', role: 'officer', name: '', homeroomClass: '' });
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) {
      setMessage('Username wajib diisi');
      setMessageType('error');
      return;
    }
    if (!editId && !form.password) {
      setMessage('Password wajib diisi untuk akun baru');
      setMessageType('error');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      if (editId) {
        await api.put(`/users/${editId}`, {
          username: form.username || undefined,
          password: form.password || undefined,
          role: form.role,
          name: form.name,
          homeroomClass: form.role === 'teacher' ? (form.homeroomClass || null) : null
        });
        setMessage('✅ Berhasil memperbarui data akun');
        setMessageType('success');
      } else {
        const password = form.password?.trim();
        if (!password || password.length < 1) {
          setMessage('Password wajib diisi');
          setMessageType('error');
          setSaving(false);
          return;
        }

        const userData = {
          username: form.username.trim(),
          password: password,
          role: form.role,
          name: form.name?.trim() || '',
          homeroomClass: form.role === 'teacher' ? (form.homeroomClass || null) : null
        };

        await api.post('/users', userData);
        setMessage(`✅ Berhasil menambah akun "@${userData.username}". Akun siap digunakan untuk login.`);
        setMessageType('success');
      }
      resetForm();
      loadUsers();
    } catch (err) {
      console.error('[AccountsPage] Error saving user:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan akun';
      setMessage(`❌ Error: ${errorMsg}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u) => {
    setEditId(u.id);
    setForm({ username: u.username, password: '', role: u.role, name: u.name || '', homeroomClass: u.homeroomClass || '' });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Yakin ingin menghapus akun "@${username}"?`)) return;
    try {
      setDeletingId(id);
      await api.delete(`/users/${id}`);
      setMessage('✅ Berhasil menghapus akun');
      setMessageType('success');
      loadUsers();
    } catch (err) {
      setMessage(err.response?.data?.message || '❌ Gagal menghapus akun');
      setMessageType('error');
    } finally {
      setDeletingId(null);
    }
  };

  const roleBadge = (role) => {
    const map = {
      admin: { label: '🛡️ Admin', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
      officer: { label: '👨‍💼 Petugas', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
      teacher: { label: '👨‍🏫 Guru', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
      student: { label: '🎓 Siswa', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
      principal: { label: '👑 Kepsek', bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
    };
    const r = map[role] || { label: role, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 700,
        background: r.bg,
        color: r.color,
        border: `1px solid ${r.border}`
      }}>
        {r.label}
      </span>
    );
  };

  const getRoleAvatarBg = (role) => {
    switch (role) {
      case 'admin': return 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
      case 'officer': return 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
      case 'teacher': return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
      case 'student': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'principal': return 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)';
      default: return 'linear-gradient(135deg, #64748b 0%, #334155 100%)';
    }
  };

  // Filter users based on search & role
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (u.username || '').toLowerCase().includes(q) ||
      (u.name || '').toLowerCase().includes(q);
    const matchesRole = selectedRoleFilter ? u.role === selectedRoleFilter : true;
    return matchesSearch && matchesRole;
  });

  // Calculate summary counts
  const totalUsers = users.length;
  const adminOfficerCount = users.filter((u) => u.role === 'admin' || u.role === 'officer').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const studentCount = users.filter((u) => u.role === 'student').length;

  return (
    <div className="accounts-page" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="page-title" style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🧑‍💼</span> Manajemen Akun & Pengguna
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Kelola data akun, peranan (role), kata sandi, dan hak akses pengguna sistem perpustakaan
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={resetForm}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: '700', borderRadius: '8px' }}
        >
          <span>➕</span> Tambah Akun Baru
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            👥
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Akun</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{totalUsers}</div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Admin & Petugas</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{adminOfficerCount}</div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            👨‍🏫
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Guru & Wali Kelas</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '2px' }}>{teacherCount}</div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
            🎓
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Akun Siswa</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', marginTop: '2px' }}>{studentCount}</div>
          </div>
        </div>
      </div>

      {/* Global Alert Message */}
      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: 600,
          background: messageType === 'success' ? '#f0fdf4' : messageType === 'error' ? '#fef2f2' : '#eff6ff',
          color: messageType === 'success' ? '#15803d' : messageType === 'error' ? '#b91c1c' : '#1d4ed8',
          border: `1px solid ${messageType === 'success' ? '#bbf7d0' : messageType === 'error' ? '#fecaca' : '#bfdbfe'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {message}
        </div>
      )}

      {/* Add / Edit Form Card */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editId ? '✏️ Edit Akun Pengguna' : '➕ Form Tambah Akun Baru'}
          </h3>
          {editId && (
            <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
              Editing ID: #{editId}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Username <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 700 }}>@</span>
                <input
                  required
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="misal: petugas1 atau ahmad"
                  style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Nama Lengkap (Opsional)
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Ahmad Fadli, S.Pd."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Role / Peranan <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: 'white', fontWeight: 600 }}
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {form.role === 'teacher' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Wali Kelas (Opsional)
                </label>
                <select
                  value={form.homeroomClass || ''}
                  onChange={(e) => setForm({ ...form, homeroomClass: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#065f46', fontSize: '14px', outline: 'none', fontWeight: 700 }}
                >
                  <option value="">Bukan Wali Kelas (Guru Biasa)</option>
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>
                      💼 Wali Kelas {cls}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Password {editId ? <span style={{ color: '#64748b', fontWeight: 400 }}>(kosongkan jika tak diubah)</span> : <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editId}
                  placeholder={editId ? 'Biarkan kosong jika tidak diubah' : 'Masukkan password baru'}
                  style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
                  title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            {editId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
                disabled={saving}
                style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 700 }}
              >
                ✖️ Batal Edit
              </button>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {saving ? '⏳ Menyimpan...' : editId ? '💾 Simpan Perubahan' : '➕ Tambah Akun'}
            </button>
          </div>
        </form>
      </div>

      {/* Accounts List & Filter Section */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📋 Daftar Akun Terdaftar
            <span style={{ fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', padding: '2px 10px', borderRadius: '20px', fontWeight: 700 }}>
              {filteredUsers.length} Akun
            </span>
          </h3>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Cari username / nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '220px' }}
            />
            <select
              className="form-input"
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white', fontWeight: 600 }}
            >
              <option value="">Semua Role</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="table-wrapper accounts-table-desktop">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Pengguna</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Nama Lengkap</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Role / Jabatan</th>
                <th style={{ padding: '14px 20px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center', width: '140px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    ⏳ Memuat daftar akun...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    🔍 Tidak ada akun yang sesuai pencarian / filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: getRoleAvatarBg(u.role),
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center',
                          fontWeight: 800,
                          fontSize: '15px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          {(u.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>@{u.username}</strong>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>ID: #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#334155', fontWeight: 600 }}>
                      {u.name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Tidak diisi</span>}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        {roleBadge(u.role)}
                        {u.role === 'teacher' && u.homeroomClass && (
                          <span style={{ fontSize: '11px', color: '#065f46', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                            💼 Wali Kelas {u.homeroomClass}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn-sm btn-secondary"
                          onClick={() => handleEdit(u)}
                          style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-danger"
                          onClick={() => handleDelete(u.id, u.username)}
                          disabled={deletingId === u.id}
                          style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 700, background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                        >
                          {deletingId === u.id ? '...' : '🗑️ Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card layout for mobile screens */}
        <div className="accounts-cards-mobile" style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
              ⏳ Memuat...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
              Tidak ada akun
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div className="account-mobile-card" key={u.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                <div className="account-mobile-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>@{u.username}</strong>
                  {roleBadge(u.role)}
                </div>
                <div className="account-mobile-card-body" style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                  <p style={{ margin: 0 }}><strong>Nama:</strong> {u.name || '-'}</p>
                  {u.role === 'teacher' && u.homeroomClass && (
                    <p style={{ color: '#059669', marginTop: '4px', marginBottom: 0, fontWeight: 700 }}>
                      💼 Wali Kelas {u.homeroomClass}
                    </p>
                  )}
                </div>
                <div className="account-mobile-card-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn-mobile-action" onClick={() => handleEdit(u)} style={{ flex: 1, padding: '6px', fontSize: '12px' }}>
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn-mobile-action danger"
                    onClick={() => handleDelete(u.id, u.username)}
                    disabled={deletingId === u.id}
                    style={{ flex: 1, padding: '6px', fontSize: '12px' }}
                  >
                    {deletingId === u.id ? '⏳ ...' : '🗑️ Hapus'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
