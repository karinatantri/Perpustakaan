const express = require('express');
const router = express.Router();
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const db = getFirestore();
const notificationsCol = db.collection('notifications');

// Get system notifications (sorted by createdAt desc, max 50)
router.get('/', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const snap = await notificationsCol.orderBy('createdAt', 'desc').limit(50).get();
    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

module.exports = router;
