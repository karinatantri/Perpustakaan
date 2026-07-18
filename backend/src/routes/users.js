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
    
    const docRef = await usersCol.add({
      username,
      passwordHash,
      role,
      name,
      homeroomClass: role === 'teacher' ? homeroomClass : null,
      createdAt: new Date().toISOString()
    });

    console.log('[CREATE USER] User created successfully:', { id: docRef.id, username, role });
    res.status(201).json({ id: docRef.id, username, role, name, homeroomClass });
  } catch (err) {
    console.error('[CREATE USER] Error:', err);
    res.status(500).json({ message: 'Gagal membuat pengguna: ' + err.message });
  }
});

// Update user (role/name/password)
router.put('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, name, homeroomClass } = req.body || {};

    const updates = {};
    const targetRole = role || 'officer'; // Fallback to check role changes
    
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
      updates.homeroomClass = (role === 'teacher' || (!role && updates.homeroomClass)) ? homeroomClass : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Tidak ada perubahan' });
    }

    await usersCol.doc(id).update(updates);
    res.json({ id, ...updates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui pengguna' });
  }
});

// Delete user
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await usersCol.doc(id).delete();
    res.json({ id });
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


