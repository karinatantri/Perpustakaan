const express = require('express');
const bcrypt = require('bcryptjs');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');
const { generateAndUploadQR } = require('../utils/qrGenerator');

const router = express.Router();
const db = getFirestore();
const visitors = db.collection('visitors');
const visits = db.collection('libraryVisits');
const members = db.collection('students');
const users = db.collection('users');

const clean = (value) => String(value || '').trim();
const dateOnly = (value) => new Date(value).toISOString().slice(0, 10);
const toVisitor = (doc) => ({ id: doc.id, ...doc.data() });

async function makeVisitorCard(visitorId) {
  const ref = visitors.doc(visitorId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.qrCodeUrl) return { id: visitorId, ...data };
  const qr = await generateAndUploadQR(`VISITOR:${visitorId}`, 'library-visitor-cards');
  await ref.update({ qrCodeUrl: qr.url, qrCodePublicId: qr.publicId || null, updatedAt: new Date().toISOString() });
  return { id: visitorId, ...data, qrCodeUrl: qr.url };
}

// Visitor directory. This is intentionally separate from members: external guests do not receive a login account.
router.get('/', auth(['admin', 'officer', 'principal']), async (req, res) => {
  try {
    const { q = '', type = '' } = req.query;
    const snap = await visitors.get();
    const needle = clean(q).toLowerCase();
    const data = snap.docs.map(toVisitor).filter((visitor) => {
      const matchesType = !type || visitor.type === type;
      const matchesSearch = !needle || [visitor.name, visitor.identifier, visitor.class, visitor.subject]
        .some((field) => clean(field).toLowerCase().includes(needle));
      return matchesType && matchesSearch;
    }).sort((a, b) => clean(a.name).localeCompare(clean(b.name), 'id'));
    res.json(data);
  } catch (err) {
    console.error('[VISITORS LIST]', err);
    res.status(500).json({ message: 'Gagal memuat daftar pengunjung' });
  }
});

// Register a card from an existing student/teacher, or create the required master record first.
router.post('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const type = ['student', 'teacher', 'external'].includes(req.body?.type) ? req.body.type : 'external';
    const sourceMemberId = clean(req.body?.sourceMemberId);
    let name = clean(req.body?.name);
    let identifier = clean(req.body?.identifier);
    let className = clean(req.body?.class);
    let subject = clean(req.body?.subject);
    let memberId = null;

    if (sourceMemberId) {
      const memberSnap = await members.doc(sourceMemberId).get();
      if (!memberSnap.exists) return res.status(404).json({ message: 'Data siswa/guru tidak ditemukan' });
      const member = memberSnap.data();
      const expectedRole = type === 'teacher' ? 'teacher' : 'student';
      if (type !== 'external' && member.role !== expectedRole) {
        return res.status(400).json({ message: 'Jenis kartu tidak sesuai dengan data anggota yang dipilih' });
      }
      memberId = memberSnap.id;
      name = member.name || name;
      identifier = member.nis || identifier;
      className = member.class || className;
      subject = member.major || subject;
    } else if (type === 'external') {
      if (!name) return res.status(400).json({ message: 'Nama pengunjung luar wajib diisi' });
    } else {
      if (!name || !identifier) {
        return res.status(400).json({ message: type === 'teacher' ? 'Nama dan NUPTK wajib diisi' : 'Nama dan NIS wajib diisi' });
      }
      const duplicate = await members.where('nis', '==', identifier).limit(1).get();
      if (!duplicate.empty) {
        return res.status(400).json({ message: 'NIS/NUPTK sudah ada. Pilih data tersebut dari daftar.' });
      }
      const duplicateUser = await users.where('username', '==', identifier).limit(1).get();
      if (!duplicateUser.empty) {
        return res.status(400).json({ message: 'NIS/NUPTK sudah dipakai akun lain. Gunakan identitas yang berbeda.' });
      }
      const now = new Date().toISOString();
      const role = type === 'teacher' ? 'teacher' : 'student';
      const memberRef = await members.add({
        nis: identifier, name, class: className || '-', major: subject || (role === 'teacher' ? 'Guru' : '-'),
        role, phone: '-', email: '', status: 'active', createdAt: now, updatedAt: now
      });
      const passwordHash = await bcrypt.hash('password123', 10);
      await users.add({
        username: identifier, passwordHash, role, name, email: '', studentId: memberRef.id,
        homeroomClass: role === 'teacher' && className ? className : null, createdAt: now, updatedAt: now
      });
      memberId = memberRef.id;
    }

    // One card per member; external guests can have multiple cards only when they are distinct people.
    if (memberId) {
      const existing = await visitors.where('memberId', '==', memberId).limit(1).get();
      if (!existing.empty) return res.json(await makeVisitorCard(existing.docs[0].id));
    }
    const now = new Date().toISOString();
    const visitorRef = await visitors.add({
      type, memberId, name, identifier: identifier || null, class: className || null, subject: subject || null,
      status: 'active', createdAt: now, updatedAt: now, createdBy: req.user?.id || null
    });
    res.status(201).json(await makeVisitorCard(visitorRef.id));
  } catch (err) {
    console.error('[VISITOR CREATE]', err);
    res.status(500).json({ message: `Gagal mendaftarkan pengunjung: ${err.message}` });
  }
});

router.get('/card/:id', auth(['admin', 'officer', 'principal']), async (req, res) => {
  try {
    const visitor = await makeVisitorCard(req.params.id);
    if (!visitor) return res.status(404).json({ message: 'Kartu pengunjung tidak ditemukan' });
    res.json(visitor);
  } catch (err) {
    console.error('[VISITOR CARD]', err);
    res.status(500).json({ message: 'Gagal membuat kartu pengunjung' });
  }
});

// A scan alternates an active visit between check-in and check-out.
router.post('/scan', auth(['admin', 'officer']), async (req, res) => {
  try {
    const raw = clean(req.body?.code);
    const visitorId = raw.startsWith('VISITOR:') ? raw.slice('VISITOR:'.length) : raw;
    if (!visitorId) return res.status(400).json({ message: 'Kode QR pengunjung tidak valid' });
    const visitorSnap = await visitors.doc(visitorId).get();
    if (!visitorSnap.exists || visitorSnap.data().status !== 'active') {
      return res.status(404).json({ message: 'Kartu pengunjung tidak aktif atau tidak ditemukan' });
    }
    const now = new Date().toISOString();
    const openVisit = await visits.where('visitorId', '==', visitorId).where('checkedOutAt', '==', null).limit(1).get();
    if (!openVisit.empty) {
      const doc = openVisit.docs[0];
      await doc.ref.update({ checkedOutAt: now, updatedBy: req.user?.id || null });
      return res.json({ action: 'checkout', visitor: toVisitor(visitorSnap), visit: { id: doc.id, ...doc.data(), checkedOutAt: now } });
    }
    const visitRef = await visits.add({ visitorId, checkedInAt: now, checkedOutAt: null, createdBy: req.user?.id || null });
    res.status(201).json({ action: 'checkin', visitor: toVisitor(visitorSnap), visit: { id: visitRef.id, visitorId, checkedInAt: now, checkedOutAt: null } });
  } catch (err) {
    console.error('[VISITOR SCAN]', err);
    res.status(500).json({ message: 'Gagal memproses pemindaian kartu' });
  }
});

// Reporting is filtered in memory so the first deployment needs no composite Firestore index.
router.get('/reports/summary', auth(['admin', 'officer', 'principal']), async (req, res) => {
  try {
    const from = clean(req.query.from) || dateOnly(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const to = clean(req.query.to) || dateOnly(new Date());
    const type = clean(req.query.type);
    const className = clean(req.query.class);
    const q = clean(req.query.q).toLowerCase();
    const [visitorSnap, visitSnap] = await Promise.all([visitors.get(), visits.get()]);
    const visitorMap = Object.fromEntries(visitorSnap.docs.map((doc) => [doc.id, toVisitor(doc)]));
    const filtered = visitSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((visit) => {
      const visitor = visitorMap[visit.visitorId];
      const day = dateOnly(visit.checkedInAt);
      return visitor && day >= from && day <= to && (!type || visitor.type === type) && (!className || visitor.class === className) &&
        (!q || [visitor.name, visitor.identifier, visitor.class, visitor.subject].some((f) => clean(f).toLowerCase().includes(q)));
    });
    const countByVisitor = filtered.reduce((result, visit) => ({ ...result, [visit.visitorId]: (result[visit.visitorId] || 0) + 1 }), {});
    const rows = Object.entries(countByVisitor).map(([visitorId, visitCount]) => ({ ...visitorMap[visitorId], visitCount }))
      .sort((a, b) => b.visitCount - a.visitCount || clean(a.name).localeCompare(clean(b.name), 'id'));
    res.json({ from, to, totalVisits: filtered.length, uniqueVisitors: rows.length, rows, recentVisits: filtered.sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt)).slice(0, 30).map((visit) => ({ ...visit, visitor: visitorMap[visit.visitorId] })) });
  } catch (err) {
    console.error('[VISIT REPORT]', err);
    res.status(500).json({ message: 'Gagal memuat laporan kunjungan' });
  }
});

module.exports = router;
