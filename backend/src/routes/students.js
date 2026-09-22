const express = require('express');
const XLSX = require('xlsx');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const db = getFirestore();
const collection = db.collection('students');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  }
});

const { syncTeachers } = require('../utils/syncTeachers');

// List with optional filters
router.get('/', auth(['admin', 'officer', 'teacher', 'principal']), async (req, res) => {
  try {
    const user = req.user || {};
    const { class: className, role: filterRole } = req.query;
    let query = collection;

    if (user.role === 'teacher' && !filterRole) {
      const homeroom = user.homeroomClass;
      if (!homeroom) {
        // Return only teacher records or empty student list
        query = query.where('role', '==', 'teacher');
      } else {
        query = query.where('class', '==', homeroom);
      }
    } else {
      if (className) {
        query = query.where('class', '==', className);
      }
    }

    const snap = await query.get();
    let data = snap.docs.map((d) => {
      const dData = d.data();
      return {
        id: d.id,
        role: dData.role || 'student',
        ...dData
      };
    });

    if (filterRole === 'teacher') {
      data = data.filter((m) => m.role === 'teacher');
    } else if (filterRole === 'student') {
      data = data.filter((m) => m.role !== 'teacher');
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
});

// Autocomplete search (searches both students and teachers)
router.get('/search', auth(['admin', 'officer', 'teacher', 'principal']), async (req, res) => {
  try {
    const { q, role: filterRole } = req.query;
    if (!q) return res.json([]);

    const snap = await collection.get();
    const qLower = q.toLowerCase();
    let data = snap.docs
      .map((d) => {
        const dData = d.data();
        return {
          id: d.id,
          role: dData.role || 'student',
          ...dData
        };
      })
      .filter((member) => {
        const name = (member.name || '').toLowerCase();
        const nis = (member.nis || '').toLowerCase();
        return name.includes(qLower) || nis.includes(qLower);
      });

    if (filterRole === 'teacher') {
      data = data.filter((m) => m.role === 'teacher');
    } else if (filterRole === 'student') {
      data = data.filter((m) => m.role !== 'teacher');
    }

    res.json(data.slice(0, 10));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to search members' });
  }
});

// Create member (student or teacher) and automatically create user login account
router.post('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { nis, name, class: className, major, role = 'student', phone, email } = req.body;
    if (!nis || !name) {
      return res.status(400).json({ message: 'NIS / NIP / NUPTK dan nama wajib diisi' });
    }

    const memberRole = role === 'teacher' ? 'teacher' : 'student';

    // Check duplicate in students
    const dupMember = await collection.where('nis', '==', nis).limit(1).get();
    if (!dupMember.empty) {
      return res.status(400).json({ message: `NIS / NIP / NUPTK "${nis}" sudah terdaftar.` });
    }

    // Check duplicate in users
    const usersCol = db.collection('users');
    const dupUser = await usersCol.where('username', '==', nis).limit(1).get();
    if (!dupUser.empty) {
      return res.status(400).json({ message: `Username akun "${nis}" sudah digunakan.` });
    }

    const now = new Date().toISOString();
    const docRef = await collection.add({
      nis,
      name,
      class: className || '-',
      major: major || (memberRole === 'teacher' ? 'Guru' : '-'),
      role: memberRole,
      phone: phone || '-',
      email: email || '-',
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    // Automatically create a user account for the member (student or teacher)
    const passwordHash = await bcrypt.hash('password123', 10);
    const userDocRef = await usersCol.add({
      username: nis,
      passwordHash,
      role: memberRole,
      name: name,
      studentId: docRef.id,
      homeroomClass: (memberRole === 'teacher' && className && className !== '-') ? className : null,
      createdAt: now,
      updatedAt: now
    });

    console.log(`[CREATE MEMBER] Created member ${docRef.id} with user account ${userDocRef.id} (role: ${memberRole})`);

    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, role: memberRole, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat data anggota: ' + err.message });
  }
});

// Update (whitelist fields and sync to user account)
router.put('/:id', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nis, name, class: className, major, birthDate, address, email, phone, status, role } = req.body;
    const updates = {};
    if (nis !== undefined) updates.nis = nis;
    if (name !== undefined) updates.name = name;
    if (className !== undefined) updates.class = className;
    if (major !== undefined) updates.major = major;
    if (birthDate !== undefined) updates.birthDate = birthDate;
    if (address !== undefined) updates.address = address;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Tidak ada perubahan data' });
    }
    const now = new Date().toISOString();
    updates.updatedAt = now;
    const docRef = collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return res.status(404).json({ message: 'Anggota tidak ditemukan' });

    await docRef.update(updates);

    // Sync changes to user account if associated
    try {
      const usersCol = db.collection('users');
      const userSnap = await usersCol.where('studentId', '==', id).limit(1).get();
      if (!userSnap.empty) {
        const userUpdates = { updatedAt: now };
        if (name !== undefined) userUpdates.name = name;
        if (nis !== undefined) userUpdates.username = nis;
        if (className !== undefined) {
          userUpdates.homeroomClass = (className && className !== '-') ? className : null;
        }
        await userSnap.docs[0].ref.update(userUpdates);
      }
    } catch (syncErr) {
      console.warn('Failed to sync update to users collection:', syncErr);
    }

    const doc = await docRef.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui data: ' + err.message });
  }
});

// Delete (hard delete member and cascade to user account)
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await collection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Anggota tidak ditemukan' });
    }

    // Delete associated user account
    const usersCol = db.collection('users');
    const userSnap = await usersCol.where('studentId', '==', id).get();
    const batch = db.batch();
    userSnap.docs.forEach((uDoc) => batch.delete(uDoc.ref));
    batch.delete(collection.doc(id));
    await batch.commit();

    res.json({ message: 'Anggota dan akun terkait berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data: ' + err.message });
  }
});

// Manual trigger for teacher sync
router.post('/sync-teachers', auth(['admin']), async (req, res) => {
  try {
    const result = await syncTeachers();
    res.json({ message: 'Sinkronisasi akun guru berhasil', ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menyinkronkan data guru: ' + err.message });
  }
});

// Export students to Excel
router.get('/export', auth(['admin', 'officer', 'principal']), async (req, res) => {
  try {
    const snap = await collection.get();
    const data = snap.docs.map((d, idx) => ({
      No: idx + 1,
      'NIS/NIM': d.data().nis || '-',
      'Nama Siswa': d.data().name || '-',
      'Kelas/Prodi': d.data().class || '-',
      'Tanggal Lahir': d.data().birthDate || '-',
      Alamat: d.data().address || '-',
      Email: d.data().email || '-',
      'No HP': d.data().phone || '-',
      Jurusan: d.data().major || '-',
      Status: d.data().status || 'active'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-siswa.xlsx');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to export students' });
  }
});

// Import students from Excel
router.post('/import', auth(['admin', 'officer']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const now = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Collect valid rows first
    const validRows = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const nis = String(row['NIS/NIM'] || row.nis || '').trim();
      const name = String(row['Nama Siswa'] || row.name || '').trim();

      if (!nis || !name) {
        errorCount++;
        errors.push(`Row ${i + 2}: Missing NIS or Name`);
        continue;
      }

      // Check if student already exists
      const existingSnap = await collection.where('nis', '==', nis).limit(1).get();
      if (!existingSnap.empty) {
        errorCount++;
        errors.push(`Row ${i + 2}: NIS ${nis} already exists`);
        continue;
      }

      validRows.push({ nis, name, row });
    }

    // Chunk into batches of max 200 writes (each row = 2 writes: student + user)
    const CHUNK_SIZE = 200;
    for (let c = 0; c < validRows.length; c += CHUNK_SIZE) {
      const chunk = validRows.slice(c, c + CHUNK_SIZE);
      const batch = db.batch();

      for (const { nis, name, row } of chunk) {
        const docRef = collection.doc();
        batch.set(docRef, {
          nis,
          name,
          class: String(row['Kelas/Prodi'] || row.class || '').trim() || '-',
          major: String(row.Jurusan || row.major || '').trim() || '-',
          birthDate: row['Tanggal Lahir'] || row.birthDate || '-',
          address: row.Alamat || row.address || '-',
          email: row.Email || row.email || '-',
          phone: String(row['No HP'] || row.phone || '').trim() || '-',
          status: 'active',
          createdAt: now,
          updatedAt: now
        });

        // Automatically create user account with correct field name
        const userRef = db.collection('users').doc();
        batch.set(userRef, {
          username: nis,
          passwordHash,
          role: 'student',
          name: name,
          studentId: docRef.id,
          createdAt: now,
          updatedAt: now
        });

        successCount++;
      }

      await batch.commit();
    }

    res.json({
      message: 'Import completed',
      success: successCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10) // Limit error details
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to import students' });
  }
});

// Reset password of student/teacher to default 'password123'
router.post('/:id/reset-password', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const memberDoc = await collection.doc(id).get();
    if (!memberDoc.exists) {
      return res.status(404).json({ message: 'Data anggota tidak ditemukan' });
    }
    const memberData = memberDoc.data();
    const nis = memberData.nis;

    const usersCol = db.collection('users');
    let userDocRef = null;
    let userSnap = await usersCol.where('studentId', '==', id).limit(1).get();
    if (!userSnap.empty) {
      userDocRef = userSnap.docs[0].ref;
    } else if (nis) {
      userSnap = await usersCol.where('username', '==', nis).limit(1).get();
      if (!userSnap.empty) {
        userDocRef = userSnap.docs[0].ref;
      }
    }

    const passwordHash = await bcrypt.hash('password123', 10);
    const now = new Date().toISOString();

    if (userDocRef) {
      await userDocRef.update({
        passwordHash,
        updatedAt: now
      });
    } else {
      await usersCol.add({
        username: nis,
        passwordHash,
        role: memberData.role || 'student',
        name: memberData.name || '',
        studentId: id,
        homeroomClass: memberData.class && memberData.class !== '-' ? memberData.class : null,
        createdAt: now,
        updatedAt: now
      });
    }

    res.json({
      message: `Kata sandi akun @${nis} berhasil direset ke password default ("password123").`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mereset kata sandi: ' + err.message });
  }
});

module.exports = router;


