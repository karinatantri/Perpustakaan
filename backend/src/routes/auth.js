const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getFirestore, getAuth } = require('../firebase');

const router = express.Router();
const db = getFirestore();
const usersCol = db.collection('users');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET wajib di-set di environment.');
}

function createLoginResponse(doc) {
  const user = doc.data();
  const payload = {
    id: doc.id,
    username: user.username,
    name: user.name || '',
    role: user.role || 'student',
    studentId: user.studentId || null,
    homeroomClass: user.homeroomClass || null
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  return { token, user: payload };
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

    const response = createLoginResponse(doc);
    console.log('[LOGIN] Success:', response.user);
    res.json(response);
  } catch (err) {
    console.error('[LOGIN] Error:', err);
    res.status(500).json({ message: 'Failed to login: ' + err.message });
  }
});

// Exchange a Firebase Authentication ID token for the application's JWT.
// Legacy username/password login remains available while accounts are migrated.
router.post('/firebase-session', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ message: 'Firebase ID token wajib diisi' });

    const decoded = await getAuth().verifyIdToken(idToken);
    let snap = await usersCol.where('firebaseUid', '==', decoded.uid).limit(1).get();

    // Backward-compatible fallback for an account whose Firebase UID has not
    // been persisted yet but whose member email matches.
    if (snap.empty && decoded.email) {
      const memberSnap = await db.collection('students').where('email', '==', decoded.email).limit(1).get();
      if (!memberSnap.empty) {
        snap = await usersCol.where('studentId', '==', memberSnap.docs[0].id).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ firebaseUid: decoded.uid, email: decoded.email, updatedAt: new Date().toISOString() });
        }
      }
    }

    if (snap.empty) return res.status(403).json({ message: 'Akun Firebase ini belum terhubung ke pengguna perpustakaan' });
    res.json(createLoginResponse(snap.docs[0]));
  } catch (err) {
    console.error('[FIREBASE LOGIN] Error:', err.message);
    res.status(401).json({ message: 'Sesi Firebase tidak valid' });
  }
});

// Prepares an existing library account for Firebase's password-reset email.
// Sending is intentionally done by Firebase's client SDK so it uses the
// password-reset template configured in Firebase Authentication.
router.post('/forgot-password', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || req.body?.email || '').trim();
    if (!identifier) return res.status(400).json({ message: 'Masukkan username atau email akun Anda.' });

    let userDoc = null;
    let memberDoc = null;
    const isEmail = /^\S+@\S+\.\S+$/.test(identifier);

    if (isEmail) {
      const email = identifier.toLowerCase();
      const directUser = await usersCol.where('email', '==', email).limit(1).get();
      if (!directUser.empty) userDoc = directUser.docs[0];

      if (!userDoc) {
        const memberSnap = await db.collection('students').where('email', '==', email).limit(1).get();
        if (!memberSnap.empty) memberDoc = memberSnap.docs[0];
      }
    } else {
      const directUser = await usersCol.where('username', '==', identifier).limit(1).get();
      if (!directUser.empty) userDoc = directUser.docs[0];
      if (!userDoc) {
        const memberSnap = await db.collection('students').where('nis', '==', identifier).limit(1).get();
        if (!memberSnap.empty) memberDoc = memberSnap.docs[0];
      }
    }

    if (!userDoc && memberDoc) {
      const linkedUser = await usersCol.where('studentId', '==', memberDoc.id).limit(1).get();
      if (!linkedUser.empty) userDoc = linkedUser.docs[0];
    }

    if (!userDoc) {
      return res.json({ ready: false, message: 'Username atau email tidak tercatat pada akun perpustakaan.' });
    }

    const userData = userDoc.data();
    if (!memberDoc && userData.studentId) {
      const memberSnap = await db.collection('students').doc(userData.studentId).get();
      if (memberSnap.exists) memberDoc = memberSnap;
    }

    let email = String(userData.email || memberDoc?.data()?.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.json({
        ready: false,
        message: 'Email Anda tidak tercatat di data Anda. Segera hubungi admin sistem untuk memperbarui email.'
      });
    }

    const firebaseAuth = getAuth();
    let firebaseUser;
    try {
      firebaseUser = await firebaseAuth.getUserByEmail(email);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      firebaseUser = await firebaseAuth.createUser({
        email,
        displayName: userData.name || userData.username || '',
        password: crypto.randomBytes(32).toString('base64url')
      });
    }

    await userDoc.ref.update({ firebaseUid: firebaseUser.uid, email, updatedAt: new Date().toISOString() });
    res.json({ ready: true, email, message: 'Tautan reset akan dikirim ke email akun Anda.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD] Error:', err.message);
    res.status(500).json({ message: 'Gagal menyiapkan reset password. Coba lagi nanti.' });
  }
});

module.exports = router;
