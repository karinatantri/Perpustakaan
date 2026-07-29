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

// List with optional filters
router.get('/', auth(['admin', 'officer', 'teacher', 'principal']), async (req, res) => {
  try {
    const user = req.user || {};
    let query = collection;

    if (user.role === 'teacher') {
      const homeroom = user.homeroomClass;
      if (!homeroom) {
        return res.json([]); // Regular teacher has no access to student list
      }
      query = query.where('class', '==', homeroom);
    } else {
      const { class: className } = req.query;
      if (className) {
        query = query.where('class', '==', className);
      }
    }

    const snap = await query.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch students' });
  }
});

// Autocomplete search
router.get('/search', auth(['admin', 'officer', 'teacher', 'principal']), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const user = req.user || {};
    let query = collection;

    if (user.role === 'teacher') {
      const homeroom = user.homeroomClass;
      if (!homeroom) {
        return res.json([]);
      }
      query = query.where('class', '==', homeroom);
    }

    const snap = await query.get();
    const qLower = q.toLowerCase();
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((student) => {
        const name = (student.name || '').toLowerCase();
        const nis = (student.nis || '').toLowerCase();
        return name.includes(qLower) || nis.includes(qLower);
      })
      .slice(0, 10);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to search students' });
  }
});

// Create
router.post('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { nis, name, class: className, major } = req.body;
    if (!nis || !name) {
      return res.status(400).json({ message: 'nis and name are required' });
    }
    const now = new Date().toISOString();
    const docRef = await collection.add({
      nis,
      name,
      class: className || '',
      major: major || '',
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    // Automatically create a user account for the student
    const passwordHash = await bcrypt.hash('password123', 10);
    const usersCol = db.collection('users');
    await usersCol.add({
      username: nis,
      passwordHash,
      role: 'student',
      name: name,
      studentId: docRef.id,
      createdAt: now,
      updatedAt: now
    });

    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create student' });
  }
});

// Update (whitelist fields to prevent mass assignment)
router.put('/:id', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { nis, name, class: className, major, birthDate, address, email, phone, status } = req.body;
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
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    const now = new Date().toISOString();
    updates.updatedAt = now;
    const docRef = collection.doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return res.status(404).json({ message: 'Student not found' });
    await docRef.update(updates);
    const doc = await docRef.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update student' });
  }
});

// Delete (hard delete)
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await collection.doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Student not found' });
    }
    await collection.doc(id).delete();
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete student' });
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

module.exports = router;


