const express = require('express');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const db = getFirestore();
const inventoriesCol = db.collection('inventories');
const logsCol = db.collection('inventory_logs');

// List inventories
router.get('/', auth(['admin', 'officer', 'teacher']), async (req, res) => {
  try {
    const snap = await inventoriesCol.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch inventories' });
  }
});

// Create inventory item
router.post('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { name, category, unit, stock = 0, minStock = 0, imageUrl, branchId } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const now = new Date().toISOString();
    const docRef = await inventoriesCol.add({
      name,
      category: category || '',
      unit: unit || 'pcs',
      stock,
      minStock,
      imageUrl: imageUrl || '',
      branchId: branchId || '',
      createdAt: now,
      updatedAt: now
    });
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create inventory' });
  }
});

// Log stock in/out
router.post('/:id/logs', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { type, quantity, studentId, notes } = req.body;
    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({ message: 'type must be in or out' });
    }
    const qty = Number(quantity || 0);
    if (qty <= 0) return res.status(400).json({ message: 'quantity must be > 0' });

    const now = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const invRef = inventoriesCol.doc(id);
      const invSnap = await t.get(invRef);
      if (!invSnap.exists) throw new Error('Inventory not found');
      const inv = invSnap.data();
      let newStock = inv.stock || 0;
      if (type === 'in') newStock += qty;
      else {
        if (newStock < qty) throw new Error('Insufficient stock');
        newStock -= qty;
      }

      t.update(invRef, { stock: newStock, updatedAt: now });

      const logRef = logsCol.doc();
      t.set(logRef, {
        inventoryId: id,
        type,
        quantity: qty,
        byUserId: (req.user && req.user.id) || null,
        studentId: studentId || null,
        notes: notes || '',
        createdAt: now
      });
    });

    res.json({ message: 'Stock updated & log created' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to log inventory' });
  }
});

// Get logs
router.get('/:id/logs', auth(['admin', 'officer', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;
    const snap = await logsCol.where('inventoryId', '==', id).orderBy('createdAt', 'desc').get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;


