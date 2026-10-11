import React, { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import QrScanner from '../components/QrScanner.jsx';
import { downloadOrShareImage } from '../utils/downloadHelper.js';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const labels = { student: 'Siswa', teacher: 'Guru', external: 'Luar sekolah' };
const typeBadge = (type) => ({ student: '#dbeafe', teacher: '#ede9fe', external: '#dcfce7' }[type] || '#f1f5f9');

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState([]);
  const [members, setMembers] = useState([]);
  const [report, setReport] = useState({ rows: [], recentVisits: [], totalVisits: 0, uniqueVisitors: 0 });
  const [type, setType] = useState('student');
  const [sourceMemberId, setSourceMemberId] = useState('');
  const [form, setForm] = useState({ name: '', identifier: '', class: '', subject: '' });
  const [filters, setFilters] = useState({ q: '', type: '', class: '', from: monthStart(), to: today() });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const isStaff = (() => {
    try { return ['admin', 'officer'].includes(JSON.parse(localStorage.getItem('user') || '{}').role); } catch { return false; }
  })();

  const load = async () => {
    setLoading(true);
    try {
      const [visitorRes, memberRes, reportRes] = await Promise.all([
        api.get('/visitors'), api.get('/students'), api.get('/visitors/reports/summary', { params: filters })
      ]);
      setVisitors(visitorRes.data || []);
      setMembers(memberRes.data || []);
      setReport(reportRes.data || { rows: [], recentVisits: [] });
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Gagal memuat data pengunjung'}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const matchingMembers = useMemo(() => members.filter((m) => type === 'teacher' ? m.role === 'teacher' : m.role !== 'teacher'), [members, type]);
  const selectedMember = members.find((m) => m.id === sourceMemberId);
  const classList = useMemo(() => Array.from(new Set(visitors.filter((visitor) => visitor.type === 'student').map((visitor) => visitor.class).filter((className) => className && className !== '-'))).sort(), [visitors]);

  const changeType = (next) => {
    setType(next); setSourceMemberId(''); setForm({ name: '', identifier: '', class: '', subject: '' });
  };
  const chooseMember = (id) => {
    setSourceMemberId(id);
    const member = members.find((m) => m.id === id);
    if (member) setForm({ name: member.name || '', identifier: member.nis || '', class: member.class || '', subject: member.major || '' });
  };
  const createCard = async (e) => {
    e.preventDefault();
    setSaving(true); setMessage('');
    try {
      const response = await api.post('/visitors', { type, sourceMemberId: sourceMemberId || undefined, ...form });
      setSelectedCard(response.data);
      setMessage(`✅ Kartu ${labels[type].toLowerCase()} untuk ${response.data.name} siap digunakan.`);
      setSourceMemberId(''); setForm({ name: '', identifier: '', class: '', subject: '' });
      await load();
    } catch (err) { setMessage(`❌ ${err.response?.data?.message || 'Gagal membuat kartu pengunjung'}`); }
    finally { setSaving(false); }
  };
  const scan = async (code) => {
    setShowScanner(false);
    try {
      const { data } = await api.post('/visitors/scan', { code });
      setMessage(`${data.action === 'checkin' ? '✅ Masuk' : '✅ Keluar'} tercatat: ${data.visitor.name} (${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}).`);
      await load();
    } catch (err) { setMessage(`❌ ${err.response?.data?.message || 'QR tidak dapat diproses'}`); }
  };
  const openCard = async (visitor) => {
    try { const { data } = await api.get(`/visitors/card/${visitor.id}`); setSelectedCard(data); }
    catch (err) { setMessage(`❌ ${err.response?.data?.message || 'Gagal menyiapkan kartu'}`); }
  };
  const applyFilter = async (e) => { e.preventDefault(); await load(); };
  const visibleVisitors = visitors.filter((visitor) => {
    const q = filters.q.toLowerCase();
    return (!filters.type || visitor.type === filters.type) && (!filters.class || visitor.class === filters.class) && (!q || [visitor.name, visitor.identifier, visitor.class, visitor.subject].some((value) => String(value || '').toLowerCase().includes(q)));
  });
  const selectedClassStudents = filters.class ? visibleVisitors.filter((visitor) => visitor.type === 'student') : [];
  const selectedClassVisits = filters.class ? report.rows.filter((visitor) => visitor.type === 'student' && visitor.class === filters.class).reduce((sum, visitor) => sum + Number(visitor.visitCount || 0), 0) : 0;
  const printVisitorReport = () => {
    const escapeHtml = (value) => String(value ?? '-').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
    const rows = visibleVisitors.map((visitor, index) => {
      const visits = report.rows.find((row) => row.id === visitor.id)?.visitCount || 0;
      return `<tr><td>${index + 1}</td><td>${escapeHtml(visitor.name)}</td><td>${escapeHtml(labels[visitor.type])}</td><td>${escapeHtml(visitor.identifier || '-')}</td><td>${escapeHtml(visitor.class || visitor.subject || '-')}</td><td>${visits} kali</td></tr>`;
    }).join('');
    const popup = window.open('', '_blank');
    if (!popup) return alert('Izinkan pop-up untuk mencetak laporan.');
    const classSummary = filters.class ? `Siswa kelas ${escapeHtml(filters.class)}: ${selectedClassStudents.length} orang · Kunjungan siswa: ${selectedClassVisits} kali` : `Pengunjung unik: ${report.uniqueVisitors || 0} · Total kunjungan: ${report.totalVisits || 0} kali`;
    popup.document.write(`<!doctype html><html><head><base href="${window.location.origin}/"><title>Laporan Kunjungan Perpustakaan</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:10px;margin:0;padding:0}.report{border:2px solid #1d4ed8;border-radius:8px;padding:12px}.header{background:#1d4ed8;color:#fff;border-radius:6px;padding:10px;text-align:center}.brand{display:flex;align-items:center;justify-content:center;gap:8px;font-size:20px;font-weight:800}.brand img{height:40px;width:40px;object-fit:contain;background:#fff;border-radius:50%;padding:2px}.school{font-size:12px;font-weight:700;margin-top:2px}.title{font-size:11px;margin-top:3px;opacity:.95}.meta{display:flex;justify-content:space-between;gap:12px;padding:9px 10px;margin:10px 0;background:#f8fafc;border:1px solid #dbeafe;border-radius:6px;color:#475569}.summary{margin:0 0 10px;padding:9px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;color:#1e3a8a;font-weight:700}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#1d4ed8;color:#fff;text-align:center;font-weight:700}tr:nth-child(even){background:#f8fafc}.sign{display:flex;justify-content:space-between;gap:50px;margin-top:28px;text-align:center}.sign>div{width:190px}.line{border-top:1px solid #0f172a;margin-top:42px;padding-top:4px;color:#475569}.footer{border-top:1px solid #dbeafe;margin-top:16px;padding-top:8px;text-align:center;color:#64748b;font-size:9px}</style></head><body><main class="report"><header class="header"><div class="brand"><img src="Logo/logo.png" alt="Logo"><span>YP. TUNAS KARYA</span></div><div class="school">SEKOLAH YP. TUNAS KARYA</div><div class="title">LAPORAN KUNJUNGAN PERPUSTAKAAN</div></header><section class="meta"><span><strong>Periode:</strong> ${escapeHtml(filters.from)} s.d. ${escapeHtml(filters.to)}</span><span><strong>Dicetak:</strong> ${escapeHtml(new Date().toLocaleString('id-ID'))}</span></section><div class="summary">${classSummary}</div><table><thead><tr><th>No</th><th>Nama</th><th>Jenis</th><th>Identitas</th><th>Kelas / Keterangan</th><th>Jumlah kunjungan</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Tidak ada data sesuai filter.</td></tr>'}</tbody></table><section class="sign"><div>Mengetahui,<div class="line">Kepala Perpustakaan</div></div><div>Petugas Perpustakaan,<div class="line">_____________________</div></div></section><footer class="footer">Laporan ini dibuat oleh Sistem Perpustakaan YP. Tunas Karya</footer></main></body></html>`);
    popup.document.head.insertAdjacentHTML('beforeend', '<style>@page{size:A4 portrait;margin:0}html,body{width:210mm;min-height:297mm}.report{min-height:297mm;border-radius:0;padding:10mm}table{table-layout:fixed;font-size:8px}th,td{padding:4px;overflow-wrap:anywhere}.brand{font-size:17px}</style>');
    popup.document.close(); popup.focus(); popup.print();
  };
  const inputStyle = { width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };
  const sectionStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,.04)' };

  return <div style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 36 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', padding: '22px 24px', background: 'linear-gradient(120deg, #0f3d7a 0%, #1d4ed8 100%)', borderRadius: 16, borderBottom: '5px solid #f3c561', color: '#fff' }}>
      <div><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, color: '#fde68a' }}>YP. TUNAS KARYA</div><h1 style={{ margin: '4px 0 0', fontSize: 27 }}>Kunjungan perpustakaan</h1><p style={{ margin: '6px 0 0', color: '#dbeafe' }}>Pendaftaran kartu identitas dan presensi QR pengunjung.</p></div>
      {isStaff && <button type="button" onClick={() => setShowScanner(true)} style={{ padding: '11px 16px', background: '#fff', color: '#0f3d7a', border: 'none', borderRadius: 9, fontWeight: 800, cursor: 'pointer' }}>📷 Scan masuk / keluar</button>}
    </div>
    {message && <div role="status" style={{ marginBottom: 16, padding: '11px 14px', background: message.startsWith('❌') ? '#fef2f2' : '#f0fdf4', color: message.startsWith('❌') ? '#991b1b' : '#166534', borderRadius: 9 }}>{message}</div>}

    {isStaff && <section style={{ ...sectionStyle, marginBottom: 20 }} aria-labelledby="card-form-title">
      <h2 id="card-form-title" style={{ marginTop: 0, fontSize: 18 }}>Buat kartu pengunjung</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginTop: -5 }}>Pilih data siswa/guru yang sudah ada, atau buat data master sekaligus saat belum terdaftar.</p>
      <div role="tablist" aria-label="Jenis pengunjung" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(labels).map(([key, value]) => <button key={key} type="button" role="tab" aria-selected={type === key} onClick={() => changeType(key)} style={{ padding: '8px 12px', borderRadius: 99, border: type === key ? '1px solid #2563eb' : '1px solid #cbd5e1', background: type === key ? '#eff6ff' : '#fff', color: type === key ? '#1d4ed8' : '#475569', fontWeight: 700 }}>{value}</button>)}
      </div>
      <form onSubmit={createCard}>
        {type !== 'external' && <label style={{ display: 'block', marginBottom: 12, fontWeight: 600 }}>Pilih dari data {type === 'teacher' ? 'guru' : 'siswa'} (opsional)
          <select value={sourceMemberId} onChange={(e) => chooseMember(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}><option value="">— Belum terdaftar, input data baru —</option>{matchingMembers.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.nis} {m.class && m.class !== '-' ? `(${m.class})` : ''}</option>)}</select>
        </label>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <label style={{ fontWeight: 600 }}>Nama *<input required value={form.name} disabled={Boolean(selectedMember)} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, marginTop: 6, background: selectedMember ? '#f8fafc' : '#fff' }} /></label>
          {type !== 'external' && <label style={{ fontWeight: 600 }}>{type === 'teacher' ? 'NUPTK / NIP *' : 'NIS *'}<input required value={form.identifier} disabled={Boolean(selectedMember)} onChange={(e) => setForm({ ...form, identifier: e.target.value })} style={{ ...inputStyle, marginTop: 6, background: selectedMember ? '#f8fafc' : '#fff' }} /></label>}
          {type === 'student' && <label style={{ fontWeight: 600 }}>Kelas<input value={form.class} disabled={Boolean(selectedMember)} onChange={(e) => setForm({ ...form, class: e.target.value })} style={{ ...inputStyle, marginTop: 6, background: selectedMember ? '#f8fafc' : '#fff' }} /></label>}
          {type === 'teacher' && <label style={{ fontWeight: 600 }}>Mata pelajaran<input value={form.subject} disabled={Boolean(selectedMember)} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ ...inputStyle, marginTop: 6, background: selectedMember ? '#f8fafc' : '#fff' }} /></label>}
        </div>
        <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 15px' }}>{saving ? 'Membuat kartu…' : 'Buat kartu QR'}</button>{!sourceMemberId && type !== 'external' && <span style={{ color: '#64748b', fontSize: 13 }}>Data ini juga akan tersimpan pada daftar {type === 'teacher' ? 'guru' : 'siswa'}.</span>}</div>
      </form>
    </section>}

    <section style={{ ...sectionStyle, marginBottom: 20 }} aria-labelledby="report-title">
      <h2 id="report-title" style={{ marginTop: 0, fontSize: 18 }}>Rekap kunjungan</h2>
      <form onSubmit={applyFilter} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, alignItems: 'end' }}>
        <label>Dari<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} /></label>
        <label>Sampai<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} /></label>
        <label>Jenis<select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} style={{ ...inputStyle, marginTop: 5 }}><option value="">Semua</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Kelas<select value={filters.class} onChange={(e) => setFilters({ ...filters, class: e.target.value })} style={{ ...inputStyle, marginTop: 5 }}><option value="">Semua kelas</option>{classList.map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
        <label>Cari nama / identitas<input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} /></label>
        <button type="submit" className="btn-secondary" style={{ padding: 10 }}>Terapkan filter</button>
        <button type="button" className="btn-primary" onClick={printVisitorReport} style={{ padding: 10 }}>🖨 Cetak / Simpan PDF</button>
      </form>
      <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}><div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: 10, color: '#1d4ed8' }}><strong style={{ fontSize: 22 }}>{report.totalVisits || 0}</strong><br /><span style={{ fontSize: 13 }}>Total kunjungan</span></div><div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, color: '#166534' }}><strong style={{ fontSize: 22 }}>{report.uniqueVisitors || 0}</strong><br /><span style={{ fontSize: 13 }}>Pengunjung unik</span></div>{filters.class && <><div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 10, color: '#92400e' }}><strong style={{ fontSize: 22 }}>{selectedClassStudents.length}</strong><br /><span style={{ fontSize: 13 }}>Siswa kelas {filters.class}</span></div><div style={{ padding: '12px 16px', background: '#ede9fe', borderRadius: 10, color: '#5b21b6' }}><strong style={{ fontSize: 22 }}>{selectedClassVisits}</strong><br /><span style={{ fontSize: 13 }}>Kunjungan siswa kelas ini</span></div></>}</div>
    </section>

    <section style={sectionStyle} aria-labelledby="directory-title"><h2 id="directory-title" style={{ marginTop: 0, fontSize: 18 }}>Daftar kartu pengunjung</h2>
      {loading ? <p>Memuat data…</p> : visibleVisitors.length === 0 ? <p style={{ color: '#64748b' }}>Belum ada kartu yang sesuai. Daftarkan pengunjung untuk membuat kartu QR.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 690 }}><thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={{ padding: 10 }}>Nama</th><th>Jenis</th><th>Identitas / keterangan</th><th>Datang pada periode ini</th><th>Kartu</th></tr></thead><tbody>{visibleVisitors.map((visitor) => { const count = report.rows.find((row) => row.id === visitor.id)?.visitCount || 0; return <tr key={visitor.id} style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: 10, fontWeight: 700 }}>{visitor.name}</td><td><span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 99, fontSize: 12, background: typeBadge(visitor.type) }}>{labels[visitor.type]}</span></td><td>{visitor.identifier || '-'} {visitor.class ? `• ${visitor.class}` : visitor.subject ? `• ${visitor.subject}` : ''}</td><td>{count} kali</td><td><button type="button" className="btn-secondary" onClick={() => openCard(visitor)} style={{ padding: '7px 10px' }}>Lihat QR</button></td></tr>; })}</tbody></table></div>}
    </section>
    {showScanner && <QrScanner onResult={scan} onClose={() => setShowScanner(false)} />}
    {selectedCard && <div role="dialog" aria-modal="true" aria-label="Kartu identitas pengunjung" onClick={() => setSelectedCard(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.65)', zIndex: 10000, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', maxWidth: 650, width: '100%', borderRadius: 16, padding: 18, boxShadow: '0 24px 60px rgba(15,23,42,.3)' }}>
        <style>{`@media print { body * { visibility: hidden !important; } #visitor-id-card, #visitor-id-card * { visibility: visible !important; } #visitor-id-card { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } }`}</style>
        <button type="button" onClick={() => setSelectedCard(null)} aria-label="Tutup kartu" style={{ float: 'right', border: 0, background: '#f1f5f9', borderRadius: 7, padding: '5px 9px', cursor: 'pointer' }}>✕</button>
        <div id="visitor-id-card" className="visitor-id-card" style={{ clear: 'both', overflow: 'hidden', marginTop: 14, background: '#fff', borderRadius: 13, border: '1px solid #bfd4ee', boxShadow: '0 8px 20px rgba(15,61,122,.14)' }}>
          <div style={{ height: 9, background: '#f3c561' }} />
          <div style={{ background: '#0f3d7a', color: '#fff', padding: '13px 17px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" style={{ width: 35, height: 35, objectFit: 'contain', background: '#fff', borderRadius: '50%', padding: 3 }} />
            <div><div style={{ fontWeight: 800, fontSize: 12, letterSpacing: .8 }}>YP. TUNAS KARYA</div><div style={{ fontSize: 10, color: '#dbeafe', letterSpacing: .6 }}>KARTU IDENTITAS PENGUNJUNG PERPUSTAKAAN</div></div>
          </div>
          <div style={{ padding: 17, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px', minWidth: 0 }}>
              <div style={{ display: 'inline-block', background: typeBadge(selectedCard.type), color: '#0f3d7a', fontWeight: 800, fontSize: 11, borderRadius: 99, padding: '4px 9px', marginBottom: 10 }}>{labels[selectedCard.type]}</div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: 22, lineHeight: 1.16, wordBreak: 'break-word' }}>{selectedCard.name}</h2>
              <div style={{ marginTop: 12, borderTop: '1px solid #dbeafe', paddingTop: 10, display: 'grid', gap: 5, color: '#475569', fontSize: 12 }}>
                {selectedCard.identifier && <div><span style={{ color: '#64748b' }}>{selectedCard.type === 'teacher' ? 'NUPTK / NIP' : 'NIS'}</span><strong style={{ marginLeft: 8, color: '#0f172a' }}>{selectedCard.identifier}</strong></div>}
                {selectedCard.class && <div><span style={{ color: '#64748b' }}>Kelas</span><strong style={{ marginLeft: 8, color: '#0f172a' }}>{selectedCard.class}</strong></div>}
                {selectedCard.subject && <div><span style={{ color: '#64748b' }}>Mata pelajaran</span><strong style={{ marginLeft: 8, color: '#0f172a' }}>{selectedCard.subject}</strong></div>}
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>Tunjukkan kartu ini saat memasuki atau keluar dari perpustakaan.</div>
              </div>
            </div>
            <div style={{ padding: 8, background: '#fff', border: '1px dashed #94a3b8', borderRadius: 10, textAlign: 'center', flex: '0 0 auto' }}>
              {selectedCard.qrCodeUrl ? <img src={selectedCard.qrCodeUrl} alt={`QR kartu ${selectedCard.name}`} style={{ width: 142, height: 142, display: 'block', objectFit: 'contain' }} /> : <p style={{ width: 142 }}>QR belum tersedia.</p>}
              <div style={{ color: '#0f3d7a', fontSize: 9, fontWeight: 800, letterSpacing: .5, marginTop: 2 }}>SCAN UNTUK PRESENSI</div>
            </div>
          </div>
          <div style={{ padding: '7px 17px', background: '#eff6ff', color: '#1e3a8a', fontSize: 10, fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>PERPUSTAKAAN SEKOLAH</span><span>ID: {selectedCard.id.slice(-8).toUpperCase()}</span></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 15, flexWrap: 'wrap' }}><button type="button" className="btn-secondary" onClick={() => window.print()} style={{ padding: '10px 14px' }}>Cetak kartu</button><button type="button" className="btn-primary" onClick={() => downloadOrShareImage(selectedCard.qrCodeUrl, `kartu-pengunjung-${selectedCard.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`)} style={{ padding: '10px 14px' }}>Unduh QR kartu</button></div>
      </div>
    </div>}
  </div>;
}
