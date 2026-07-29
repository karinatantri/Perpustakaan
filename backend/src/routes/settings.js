const express = require('express');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const db = getFirestore();
const settingsCol = db.collection('settings');
const DEFAULT_DOC_ID = 'library_rules';

// Default configuration settings
const DEFAULT_SETTINGS = {
  fineRatePerDay: 1000,        // Rp 1.000 per hari keterlambatan
  maxBorrowDays: 7,            // Maksimal 7 hari peminjaman
  maxBooksPerStudent: 3,       // Maksimal 3 buku dipinjam bersamaan
  damagedFinePercentage: 50,  // Denda rusak = 50% harga buku
  lostFinePercentage: 100,    // Denda hilang = 100% harga buku
  updatedAt: new Date().toISOString()
};

// Get settings
router.get('/', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const doc = await settingsCol.doc(DEFAULT_DOC_ID).get();
    if (!doc.exists) {
      return res.json(DEFAULT_SETTINGS);
    }
    res.json({ ...DEFAULT_SETTINGS, ...doc.data() });
  } catch (err) {
    console.error('Failed to fetch settings:', err);
    res.status(500).json({ message: 'Gagal mengambil pengaturan perpustakaan' });
  }
});

// Update settings (Admin only)
router.put('/', auth(['admin']), async (req, res) => {
  try {
    const {
      fineRatePerDay,
      maxBorrowDays,
      maxBooksPerStudent,
      damagedFinePercentage,
      lostFinePercentage
    } = req.body || {};

    const updates = { updatedAt: new Date().toISOString() };
    if (fineRatePerDay !== undefined) updates.fineRatePerDay = Number(fineRatePerDay) || 0;
    if (maxBorrowDays !== undefined) updates.maxBorrowDays = Number(maxBorrowDays) || 1;
    if (maxBooksPerStudent !== undefined) updates.maxBooksPerStudent = Number(maxBooksPerStudent) || 1;
    if (damagedFinePercentage !== undefined) updates.damagedFinePercentage = Number(damagedFinePercentage) || 0;
    if (lostFinePercentage !== undefined) updates.lostFinePercentage = Number(lostFinePercentage) || 0;

    await settingsCol.doc(DEFAULT_DOC_ID).set(updates, { merge: true });
    const doc = await settingsCol.doc(DEFAULT_DOC_ID).get();
    res.json({ message: 'Pengaturan berhasil diperbarui', settings: { ...DEFAULT_SETTINGS, ...doc.data() } });
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ message: 'Gagal memperbarui pengaturan' });
  }
});

module.exports = router;
