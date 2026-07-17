const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getFirestore } = require('../firebase');

const router = express.Router();
const db = getFirestore();
const usersCol = db.collection('users');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET wajib di-set di environment.');
}

// Simple username/password login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('[LOGIN] Attempt:', { username, hasPassword: !!password });
    
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    const snap = await usersCol.where('username', '==', username).limit(1).get();
    if (snap.empty) {
      console.log('[LOGIN] User not found:', username);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const doc = snap.docs[0];
    const user = doc.data();
    console.log('[LOGIN] User found:', { id: doc.id, username: user.username, role: user.role, hasPasswordHash: !!user.passwordHash });

    if (!user.passwordHash) {
      console.log('[LOGIN] User has no password hash:', doc.id);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log('[LOGIN] Password match:', ok);
    
    if (!ok) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: doc.id,
      username: user.username,
      name: user.name || '',
      role: user.role || 'student',
      studentId: user.studentId || null,
      homeroomClass: user.homeroomClass || null
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '8h'
    });

    console.log('[LOGIN] Success:', payload);
    res.json({ token, user: payload });
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    res.status(500).json({ message: 'Failed to login: ' + err.message });
  }
});

module.exports = router;
