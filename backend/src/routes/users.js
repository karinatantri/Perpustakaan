const express = require('express');
const bcrypt = require('bcryptjs');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const db = getFirestore();
const usersCol = db.collection('users');

const allowedRoles = ['admin', 'officer', 'teacher', 'student', 'principal'];

// List users (admin only)
router.get('/', auth(['admin']), async (req, res) => {
  try {
    const snap = await usersCol.orderBy('username', 'asc').get();
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        username: data.username,
        role: data.role || 'officer',
        name: data.name || ''
      };
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data pengguna' });
  }
});

// Create user
router.post('/', auth(['admin']), async (req, res) => {
  try {
    const { username, password, role = 'officer', name = '', homeroomClass = null } = req.body || {};
    console.log('[CREATE USER] Request:', { username, role, name, hasPassword: !!password, homeroomClass });
    
    if (!username || !password) {
      console.log('[CREATE USER] Validation failed: missing username or password');
      return res.status(400).json({ message: 'Username dan password wajib' });
    }
    if (!allowedRoles.includes(role)) {
      console.log('[CREATE USER] Validation failed: invalid role', role);
      return res.status(400).json({ message: 'Role tidak valid' });
    }

    const dupSnap = await usersCol.where('username', '==', username).limit(1).get();
    if (!dupSnap.empty) {
      console.log('[CREATE USER] Username already exists:', username);
      return res.status(400).json({ message: 'Username sudah digunakan' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    console.log('[CREATE USER] Password hashed successfully');
    
    let studentId = null;
    const now = new Date().toISOString();

    // If role is teacher, ensure corresponding teacher member record exists in students collection
    if (role === 'teacher') {
      const studentsCol = db.collection('students');
      const existingMemberSnap = await studentsCol.where('nis', '==', username).limit(1).get();
      if (!existingMemberSnap.empty) {
        studentId = existingMemberSnap.docs[0].id;
        await studentsCol.doc(studentId).update({
          name: name || existingMemberSnap.docs[0].data().name,
          class: homeroomClass || existingMemberSnap.docs[0].data().class || '-',
          role: 'teacher',
          updatedAt: now
        });
      } else {
        const newMemberRef = await studentsCol.add({
          nis: username,
          name: name || username,
          class: homeroomClass || '-',
          major: 'Guru',
          role: 'teacher',
          status: 'active',
          createdAt: now,
          updatedAt: now
        });
        studentId = newMemberRef.id;
      }
    }

    const docRef = await usersCol.add({
      username,
      passwordHash,
      role,
      name,
      studentId,
      homeroomClass: role === 'teacher' ? homeroomClass : null,
      createdAt: now,
      updatedAt: now
    });

    console.log('[CREATE USER] User created successfully:', { id: docRef.id, username, role, studentId });
    res.status(201).json({ id: docRef.id, username, role, name, homeroomClass, studentId });
  } catch (err) {
    console.error('[CREATE USER] Error:', err);
    res.status(500).json({ message: 'Gagal membuat pengguna: ' + err.message });
  }
});

// Reset all users' password to default 'password123' except role 'admin'
router.post('/reset-all-passwords', auth(['admin']), async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    const now = new Date().toISOString();

    const snap = await usersCol.get();
    const nonAdminDocs = snap.docs.filter((doc) => {
      const data = doc.data();
      return data.role !== 'admin';
    });

    if (nonAdminDocs.length === 0) {
      return res.json({ message: 'Tidak ada akun non-admin yang perlu direset', count: 0 });
    }

    // Firestore batch supports up to 500 operations per batch
    const BATCH_SIZE = 400;
    for (let i = 0; i < nonAdminDocs.length; i += BATCH_SIZE) {
      const chunk = nonAdminDocs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          passwordHash,
          updatedAt: now
        });
      });
      await batch.commit();
    }

    console.log(`[RESET ALL PASSWORDS] Successfully reset passwords for ${nonAdminDocs.length} non-admin accounts`);
    res.json({
      message: `Berhasil mereset kata sandi ${nonAdminDocs.length} akun ke password default ("password123"). Akun admin tidak diubah.`,
      count: nonAdminDocs.length
    });
  } catch (err) {
    console.error('[RESET ALL PASSWORDS] Error:', err);
    res.status(500).json({ message: 'Gagal mereset kata sandi seluruh akun: ' + err.message });
  }
});

// Reset single user's password to default 'password123'
router.post('/:id/reset-password', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await usersCol.doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const userData = userDoc.data();
    const passwordHash = await bcrypt.hash('password123', 10);
    const now = new Date().toISOString();

    await usersCol.doc(id).update({
      passwordHash,
      updatedAt: now
    });

    console.log(`[RESET SINGLE PASSWORD] Reset password for @${userData.username} to password123`);
    res.json({
      message: `Kata sandi akun @${userData.username} berhasil direset ke password default ("password123").`,
      userId: id,
      username: userData.username
    });
  } catch (err) {
    console.error('[RESET SINGLE PASSWORD] Error:', err);
    res.status(500).json({ message: 'Gagal mereset kata sandi akun: ' + err.message });
  }
});

// Update user (role/name/password)
router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, name, homeroomClass } = req.body || {};

    const userDoc = await usersCol.doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const currentData = userDoc.data();
    const updates = {};
    
    if (username) {
      // ensure unique
      const dupSnap = await usersCol.where('username', '==', username).limit(1).get();
      if (!dupSnap.empty && dupSnap.docs[0].id !== id) {
        return res.status(400).json({ message: 'Username sudah digunakan' });
      }
      updates.username = username;
    }
    if (role) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Role tidak valid' });
      }
      updates.role = role;
    }
    if (typeof name === 'string') {
      updates.name = name;
    }
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    if (typeof homeroomClass !== 'undefined') {
      updates.homeroomClass = (role === 'teacher' || (!role && (currentData.role === 'teacher' || updates.homeroomClass))) ? homeroomClass : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Tidak ada perubahan' });
    }

    const now = new Date().toISOString();
    updates.updatedAt = now;

    // Sync to member record in students if this is a teacher
    const isTeacher = (role === 'teacher') || (!role && currentData.role === 'teacher');
    let memberId = currentData.studentId;
    const studentsCol = db.collection('students');

    if (isTeacher) {
      const memberUpdates = { role: 'teacher', updatedAt: now };
      if (name !== undefined) memberUpdates.name = name;
      if (username !== undefined) memberUpdates.nis = username;
      if (typeof homeroomClass !== 'undefined') memberUpdates.class = homeroomClass || '-';

      if (memberId) {
        const memDoc = await studentsCol.doc(memberId).get();
        if (memDoc.exists) {
          await studentsCol.doc(memberId).update(memberUpdates);
        } else {
          memberId = null;
        }
      }

      if (!memberId) {
        // Find by username/nis or create
        const memSnap = await studentsCol.where('nis', '==', username || currentData.username).limit(1).get();
        if (!memSnap.empty) {
          memberId = memSnap.docs[0].id;
          await studentsCol.doc(memberId).update(memberUpdates);
        } else {
          const newMem = await studentsCol.add({
            nis: username || currentData.username,
            name: name || currentData.name || currentData.username,
            class: homeroomClass || currentData.homeroomClass || '-',
            major: 'Guru',
            role: 'teacher',
            status: 'active',
            createdAt: now,
            updatedAt: now
          });
          memberId = newMem.id;
        }
        updates.studentId = memberId;
      }
    }

    await usersCol.doc(id).update(updates);
    res.json({ id, ...updates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui pengguna' });
  }
});

// Delete user (with member doc and FCM token cleanup)
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userDoc = await usersCol.doc(id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }

    const userData = userDoc.data();

    // Clean up FCM tokens associated with this user
    const fcmSnap = await db.collection('fcm_tokens').where('userId', '==', id).get();
    const batch = db.batch();
    fcmSnap.docs.forEach(doc => batch.delete(doc.ref));

    // If teacher has associated member doc in students, clean up member record as well
    if (userData.studentId) {
      batch.delete(db.collection('students').doc(userData.studentId));
    }

    batch.delete(usersCol.doc(id));
    await batch.commit();

    res.json({ id, message: 'Pengguna dan data anggota terkait berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus pengguna' });
  }
});

// Register FCM token
router.post('/register-fcm-token', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    const userId = req.user.id;
    
    // Save to fcm_tokens collection
    const fcmTokensCol = db.collection('fcm_tokens');
    await fcmTokensCol.doc(token).set({
      userId,
      token,
      updatedAt: new Date().toISOString()
    });
    
    res.json({ message: 'FCM token registered successfully' });
  } catch (err) {
    console.error('Failed to register FCM token:', err);
    res.status(500).json({ message: 'Failed to register token' });
  }
});

// Deregister FCM token
router.post('/deregister-fcm-token', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    const fcmTokensCol = db.collection('fcm_tokens');
    await fcmTokensCol.doc(token).delete();
    res.json({ message: 'FCM token deregistered successfully' });
  } catch (err) {
    console.error('Failed to deregister FCM token:', err);
    res.status(500).json({ message: 'Failed to deregister token' });
  }
});

module.exports = router;


