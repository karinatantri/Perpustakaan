import React, { useEffect, useState } from 'react';
import api from '../api';

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'officer', label: 'Karyawan/Petugas' },
  { value: 'teacher', label: 'Guru' },
  { value: 'student', label: 'Siswa' },
  { value: 'principal', label: 'Kepala Sekolah' }
];

export default function AccountsPage() {
  const [users, setUsers] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
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
      setMessage(err.response?.data?.message || 'Gagal memuat data');
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) {
      setMessage('Username wajib diisi');
      setMessageType('error');
      return;
    }
    if (!editId && !form.password) {
      setMessage('Password wajib diisi');
      setMessageType('error');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      let response;
      if (editId) {
        response = await api.put(`/users/${editId}`, {
          username: form.username || undefined,
          password: form.password || undefined,
          role: form.role,
          name: form.name,
          homeroomClass: form.role === 'teacher' ? (form.homeroomClass || null) : null
        });
        setMessage('Berhasil memperbarui akun');
        setMessageType('success');
      } else {
        // Ensure password is not empty and trimmed
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

        console.log('[AccountsPage] Creating user:', { username: userData.username, role: userData.role, hasPassword: !!userData.password });
        response = await api.post('/users', userData);
        console.log('[AccountsPage] User created:', response.data);
        setMessage(`✅ Berhasil menambah akun "${userData.username}". Silakan coba login dengan username dan password yang telah dibuat.`);
        setMessageType('success');
      }
      resetForm();
      loadUsers();
    } catch (err) {
      console.error('[AccountsPage] Error saving user:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan';
      setMessage(`Error: ${errorMsg}`);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u) => {
    setEditId(u.id);
    setForm({ username: u.username, password: '', role: u.role, name: u.name || '', homeroomClass: u.homeroomClass || '' });
    setMessage('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus akun ini?')) return;
    try {
      setDeletingId(id);
      await api.delete(`/users/${id}`);
      setMessage('Berhasil menghapus');
      setMessageType('success');
      loadUsers();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus');
      setMessageType('error');
    } finally {
      setDeletingId(null);
    }
  };

  const roleBadge = (role) => {
    const map = {
      admin: { text: 'Admin', cls: 'badge badge-admin' },
      officer: { text: 'Karyawan/Petugas', cls: 'badge badge-officer' },
      teacher: { text: 'Guru', cls: 'badge badge-teacher' },
      student: { text: 'Siswa', cls: 'badge badge-student' },
      principal: { text: 'Kepala Sekolah', cls: 'badge badge-principal' }
    };
    const r = map[role] || { text: role, cls: 'badge' };
    return <span className={r.cls}>{r.text}</span>;
  };

  return (
    <div className="accounts-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">🧑‍💼 Manajemen Akun</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Tambah, edit, atau hapus akun admin / petugas / guru / siswa / kepala sekolah
          </p>
        </div>
        <div className="badge badge-soft" style={{ fontSize: '14px', padding: '8px 16px' }}>
          Total: {users.length}
        </div>
      </div>

      {message && (
        <div className={`alert alert-${messageType}`} style={{ marginBottom: '20px' }}>
          {message}
        </div>
      )}

      <div className="card card-elevated" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
            {editId ? '✏️ Edit Akun' : '➕ Tambah Akun Baru'}
          </h3>
        </div>
        <form className="form-grid account-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="mis: petugas1"
            />
          </label>
          <label>
            Nama (opsional)
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama lengkap"
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {form.role === 'teacher' && (
            <label>
              Wali Kelas Kelas Berapa? (Opsional)
              <select
                value={form.homeroomClass || ''}
                onChange={(e) => setForm({ ...form, homeroomClass: e.target.value })}
              >
                <option value="">Bukan Wali Kelas (Guru Pelajaran Biasa)</option>
                {classesList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Password {editId ? '(kosongkan jika tidak diganti)' : ''}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editId}
              placeholder={editId ? 'Biarkan kosong jika tidak diubah' : 'Minimal 6 karakter'}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Akun'}
            </button>
            {editId && (
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card card-elevated">
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#0f172a' }}>
            📋 Daftar Akun
          </h3>
        </div>
        <div className="table-wrapper accounts-table-desktop">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama</th>
                <th>Role</th>
                <th style={{ width: 140 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>
                    Memuat...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: 16 }}>
                    Belum ada akun
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.name || '-'}</td>
                    <td>
                      {roleBadge(u.role)}
                      {u.role === 'teacher' && u.homeroomClass && (
                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '4px' }}>
                          💼 Wali Kelas: {u.homeroomClass}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-link" onClick={() => handleEdit(u)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-link danger"
                          onClick={() => handleDelete(u.id)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? '...' : 'Hapus'}
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
        <div className="accounts-cards-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
              Memuat...
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
              Belum ada akun
            </div>
          ) : (
            users.map((u) => (
              <div className="account-mobile-card" key={u.id}>
                <div className="account-mobile-card-header">
                  <span className="account-mobile-username">@{u.username}</span>
                  {roleBadge(u.role)}
                </div>
                <div className="account-mobile-card-body">
                  <p style={{ margin: 0 }}><strong>Nama:</strong> {u.name || '-'}</p>
                  {u.role === 'teacher' && u.homeroomClass && (
                    <p style={{ color: '#16a34a', marginTop: '4px', marginBottom: 0 }}>
                      <strong>Wali Kelas:</strong> {u.homeroomClass}
                    </p>
                  )}
                </div>
                <div className="account-mobile-card-actions">
                  <button type="button" className="btn-mobile-action" onClick={() => handleEdit(u)}>
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="btn-mobile-action danger"
                    onClick={() => handleDelete(u.id)}
                    disabled={deletingId === u.id}
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


