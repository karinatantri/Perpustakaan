const express = require('express');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const db = getFirestore();
const itemsCol = db.collection('items');

// Get item by barcode/uniqueCode
router.get('/by-code/:code', auth(['admin', 'officer', 'teacher', 'student']), async (req, res) => {
  try {
    const { code } = req.params;
    const snap = await itemsCol.where('uniqueCode', '==', code).limit(1).get();
    if (snap.empty) return res.status(404).json({ message: 'Item not found' });
    const doc = snap.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch item' });
  }
});

// Simple list (for admin/officer)
router.get('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const snap = await itemsCol.limit(100).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

module.exports = router;


