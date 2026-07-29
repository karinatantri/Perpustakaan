const express = require('express');
const QRCode = require('qrcode');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');
const { generateAndUploadQR } = require('../utils/qrGenerator');
const { createSystemNotification } = require('../utils/notifications');

const router = express.Router();
const db = getFirestore();
const inventoriesCol = db.collection('inventories');
const logsCol = db.collection('inventory_logs');

// List inventories
router.get('/', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
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
    
    // Create doc ref first to get ID
    const docRef = inventoriesCol.doc();
    const itemId = docRef.id;
    const itemCode = `INV-${itemId}`;

    let qrCodeUrl = '';
    try {
      const qrRes = await generateAndUploadQR(itemCode, 'inventory-qrcodes');
      qrCodeUrl = qrRes.url;
    } catch (qrErr) {
      console.warn('Cloudinary QR upload failed, fallback to base64 QR:', qrErr.message);
      qrCodeUrl = await QRCode.toDataURL(itemCode, { width: 360, margin: 2 });
    }

    const newItemData = {
      name,
      itemCode,
      category: category || '',
      unit: unit || 'pcs',
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      imageUrl: imageUrl || '',
      qrCodeUrl,
      branchId: branchId || '',
      createdAt: now,
      updatedAt: now
    };

    await docRef.set(newItemData);

    await createSystemNotification({
      title: '📦 Barang Inventaris Baru',
      message: `Barang "${name}" (${newItemData.stock} ${newItemData.unit}) ditambahkan ke inventaris oleh ${req.user?.name || req.user?.username || 'Petugas'}.`,
      type: 'inventory_add',
      actorName: req.user?.name || req.user?.username || 'Petugas'
    });

    res.status(201).json({ id: itemId, ...newItemData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create inventory' });
  }
});

// Get QR Code for Inventory item (generate if missing)
router.get('/:id/qr', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { id } = req.params;
    const invDoc = await inventoriesCol.doc(id).get();
    if (!invDoc.exists) return res.status(404).json({ message: 'Inventory not found' });

    const data = invDoc.data();
    let qrCodeUrl = data.qrCodeUrl;
    const itemCode = data.itemCode || `INV-${id}`;

    if (!qrCodeUrl) {
      try {
        const qrRes = await generateAndUploadQR(itemCode, 'inventory-qrcodes');
        qrCodeUrl = qrRes.url;
      } catch (err) {
        qrCodeUrl = await QRCode.toDataURL(itemCode, { width: 360, margin: 2 });
      }
      await inventoriesCol.doc(id).update({ qrCodeUrl, itemCode });
    }

    res.json({ id, itemCode, ...data, qrCodeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to get inventory QR code' });
  }
});

// Update inventory item
router.put('/:id', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, unit, stock, minStock, imageUrl, branchId } = req.body;
    const invDoc = await inventoriesCol.doc(id).get();
    if (!invDoc.exists) return res.status(404).json({ message: 'Inventory not found' });

    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (unit !== undefined) updates.unit = unit;
    if (stock !== undefined) updates.stock = Number(stock) || 0;
    if (minStock !== undefined) updates.minStock = Number(minStock) || 0;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (branchId !== undefined) updates.branchId = branchId;

    await inventoriesCol.doc(id).update(updates);
    const updated = await inventoriesCol.doc(id).get();
    res.json({ id, ...updated.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update inventory' });
  }
});

// Delete inventory item
router.delete('/:id', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const invDoc = await inventoriesCol.doc(id).get();
    if (!invDoc.exists) return res.status(404).json({ message: 'Inventory not found' });

    const invData = invDoc.data();
    await inventoriesCol.doc(id).delete();

    await createSystemNotification({
      title: '🗑️ Barang Inventaris Dihapus',
      message: `Barang "${invData.name}" telah dihapus dari inventaris oleh ${req.user?.name || req.user?.username || 'Petugas'}.`,
      type: 'inventory_delete',
      actorName: req.user?.name || req.user?.username || 'Petugas'
    });

    res.json({ id, message: 'Inventory deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete inventory' });
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
    let updatedInvName = 'Barang';
    let updatedInvUnit = 'pcs';

    await db.runTransaction(async (t) => {
      const invRef = inventoriesCol.doc(id);
      const invSnap = await t.get(invRef);
      if (!invSnap.exists) throw new Error('Inventory not found');
      const inv = invSnap.data();
      updatedInvName = inv.name || 'Barang';
      updatedInvUnit = inv.unit || 'pcs';

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

    const actor = req.user?.name || req.user?.username || 'Petugas';
    const timeStr = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    await createSystemNotification({
      title: type === 'in' ? '➕ Stok Barang Ditambahkan' : '➖ Stok Barang Dikurangi',
      message: `Admin/Petugas (${actor}) ${type === 'in' ? 'menambah' : 'mengurangi'} stok barang "${updatedInvName}" sebanyak ${qty} ${updatedInvUnit} pada ${timeStr}.${notes ? ` Catatan: ${notes}` : ''}`,
      type: type === 'in' ? 'inventory_add' : 'inventory_reduce',
      actorName: actor
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


