const express = require('express');
const XLSX = require('xlsx');
const multer = require('multer');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');
const { generateAndUploadQR } = require('../utils/qrGenerator');

const router = express.Router();
const db = getFirestore();
const booksCol = db.collection('books');
const itemsCol = db.collection('items');

const upload = multer({ storage: multer.memoryStorage() });

// List books
router.get('/', auth(['admin', 'officer', 'intern', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const snap = await booksCol.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch books' });
  }
});

// Search books by title (autocomplete)
router.get('/search', auth(['admin', 'officer', 'intern', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const qLower = q.toLowerCase();
    const snap = await booksCol.get();
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((book) => {
        const title = (book.title || '').toLowerCase();
        const author = (book.author || '').toLowerCase();
        return title.includes(qLower) || author.includes(qLower);
      })
      .slice(0, 10); // Limit to 10 results

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to search books' });
  }
});

// Get book by code (bookId or item uniqueCode)
// Returns book info with available item if found
router.get('/by-code/:code', auth(['admin', 'officer', 'intern', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: 'Code is required' });

    // Try as bookId first
    const bookDoc = await booksCol.doc(code).get();
    if (bookDoc.exists) {
      const bookData = bookDoc.data();
      // Find an available item for this book
      const itemSnap = await itemsCol
        .where('bookId', '==', code)
        .where('status', '==', 'available')
        .limit(1)
        .get();
      
      const item = itemSnap.empty ? null : { id: itemSnap.docs[0].id, ...itemSnap.docs[0].data() };
      
      return res.json({
        id: bookDoc.id,
        ...bookData,
        item, // Available item if any
        codeType: 'bookId'
      });
    }

    // Try as item uniqueCode
    const itemSnap = await itemsCol.where('uniqueCode', '==', code).limit(1).get();
    if (!itemSnap.empty) {
      const itemDoc = itemSnap.docs[0];
      const itemData = itemDoc.data();
      
      // Get book info
      const bookDoc = await booksCol.doc(itemData.bookId).get();
      if (bookDoc.exists) {
        return res.json({
          id: bookDoc.id,
          ...bookDoc.data(),
          item: { id: itemDoc.id, ...itemData },
          codeType: 'uniqueCode'
        });
      }
    }

    return res.status(404).json({ message: 'Buku tidak ditemukan' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch book by code' });
  }
});

// Create book (auto-generate items if copies > 0)
router.post('/', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { title, author, category, year, publisher, coverUrl, totalCopies = 0, location = '' } = req.body;
    if (!title) return res.status(400).json({ message: 'title is required' });
    
    const now = new Date().toISOString();
    
    const existingSnap = await booksCol.where('title', '==', title.trim()).limit(1).get();
    
    if (!existingSnap.empty) {
      // Book exists, add to stock
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();
      const newTotalCopies = (existingData.totalCopies || 0) + (totalCopies || 0);
      
      // Generate QR code jika belum ada
      let qrCodeUrl = existingData.qrCodeUrl || '';
      if (!qrCodeUrl) {
        try {
          const qrResult = await generateAndUploadQR(existingDoc.id);
          qrCodeUrl = qrResult.url;
        } catch (qrErr) {
          console.warn('Failed to generate QR for book:', qrErr.message);
        }
      }
      
      // Generate items for new copies
      const batch = db.batch();
      const createdItemIds = [];
      
      for (let i = 0; i < (totalCopies || 0); i++) {
        const itemRef = itemsCol.doc();
        const uniqueCode = `BOOK-${existingDoc.id}-${Date.now()}-${i}`;
        batch.set(itemRef, {
          bookId: existingDoc.id,
          inventoryId: null,
          uniqueCode,
          barcode: uniqueCode,
          status: 'available',
          location: location || '',
          branchId: '',
          createdAt: now,
          updatedAt: now
        });
        createdItemIds.push(itemRef.id);
      }
      
      batch.update(booksCol.doc(existingDoc.id), {
        totalCopies: newTotalCopies,
        qrCodeUrl, // Update QR code jika baru dibuat
        updatedAt: now
      });
      
      await batch.commit();
      
      return res.json({
        message: 'Stock added to existing book',
        id: existingDoc.id,
        totalCopies: newTotalCopies,
        itemsGenerated: createdItemIds.length
      });
    }
    
    // New book, create it
    const docRef = await booksCol.doc();
    const bookId = docRef.id;
    
    // Generate QR code untuk buku (sama untuk semua eksemplar)
    let qrCodeUrl = '';
    try {
      const qrResult = await generateAndUploadQR(bookId);
      qrCodeUrl = qrResult.url;
    } catch (qrErr) {
      console.warn('Failed to generate QR for book:', qrErr.message);
    }
    
    // Simpan dokumen buku (commit terpisah agar payload kecil)
    await docRef.set({
      title: title.trim(),
      author: author || '',
      category: category || '',
      year: year || '',
      publisher: publisher || '',
      coverUrl: coverUrl || '',
      totalCopies: totalCopies || 0,
      qrCodeUrl, // QR code disimpan di level buku
      createdAt: now,
      updatedAt: now
    });
    
    // Auto-generate items if copies > 0, chunk per 400 write untuk hindari limit 10MB/500 writes
    const createdItemIds = [];
    const total = totalCopies || 0;
    const chunkSize = 400;
    let index = 0;
    while (index < total) {
      const batch = db.batch();
      const end = Math.min(index + chunkSize, total);
      for (let i = index; i < end; i++) {
        const itemRef = itemsCol.doc();
        const uniqueCode = `BOOK-${bookId}-${Date.now()}-${i}`;
        batch.set(itemRef, {
          bookId,
          inventoryId: null,
          uniqueCode,
          barcode: uniqueCode,
          status: 'available',
          location: location || '',
          branchId: '',
          createdAt: now,
          updatedAt: now
        });
        createdItemIds.push(itemRef.id);
      }
      await batch.commit();
      index = end;
    }
    
    const doc = await docRef.get();
    res.status(201).json({
      id: doc.id,
      ...doc.data(),
      itemsGenerated: createdItemIds.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create book' });
  }
});

// Export books to Excel (must be before /:id routes)
router.get('/export', auth(['admin', 'officer', 'intern', 'principal']), async (req, res) => {
  try {
    const snap = await booksCol.get();
    const data = snap.docs.map((d, idx) => ({
      No: idx + 1,
      'ID Buku': d.id,
      Judul: d.data().title || '-',
      Penulis: d.data().author || '-',
      Kategori: d.data().category || '-',
      Tahun: d.data().year || '-',
      Penerbit: d.data().publisher || '-',
      Stok: d.data().totalCopies || 0,
      'Lokasi Rak': d.data().location || '-'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data Buku');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-buku.xlsx');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to export books' });
  }
});

// Import books from Excel (must be before /:id routes)
router.post('/import', auth(['admin', 'officer']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const now = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const title = String(row.Judul || row.title || '').trim();
      const stok = parseInt(row.Stok || row.stock || row.totalCopies || 0) || 0;

      if (!title) {
        errorCount++;
        errors.push(`Row ${i + 2}: Missing title`);
        continue;
      }

      try {
        // Check if book exists
        const existingSnap = await booksCol.where('title', '==', title).limit(1).get();
        
        if (!existingSnap.empty) {
          // Add to existing book
          const existingDoc = existingSnap.docs[0];
          const existingData = existingDoc.data();
          const newTotalCopies = (existingData.totalCopies || 0) + stok;
          
          const batch = db.batch();
          for (let j = 0; j < stok; j++) {
            const itemRef = itemsCol.doc();
            const uniqueCode = `BOOK-${existingDoc.id}-${Date.now()}-${j}`;
            let qrCodeUrl = '';
            try {
              const qrResult = await generateAndUploadQR(uniqueCode);
              qrCodeUrl = qrResult.url;
            } catch (qrErr) {
              console.warn('Failed to generate QR for item:', qrErr.message);
            }
            batch.set(itemRef, {
              bookId: existingDoc.id,
              uniqueCode,
              barcode: uniqueCode,
              qrCodeUrl,
              status: 'available',
              location: String(row['Lokasi Rak'] || row.location || '').trim() || '-',
              createdAt: now,
              updatedAt: now
            });
          }
          batch.update(booksCol.doc(existingDoc.id), {
            totalCopies: newTotalCopies,
            updatedAt: now
          });
          await batch.commit();
        } else {
          // Create new book
          const docRef = booksCol.doc();
          
          // Generate QR code untuk buku
          let qrCodeUrl = '';
          try {
            const qrResult = await generateAndUploadQR(docRef.id);
            qrCodeUrl = qrResult.url;
          } catch (qrErr) {
            console.warn('Failed to generate QR for book:', qrErr.message);
          }
          
          const batch = db.batch();
          
          batch.set(docRef, {
            title,
            author: String(row.Penulis || row.author || '').trim() || '-',
            category: String(row.Kategori || row.category || '').trim() || '-',
            year: String(row.Tahun || row.year || '').trim() || '-',
            publisher: String(row.Penerbit || row.publisher || '').trim() || '-',
            totalCopies: stok,
            location: String(row['Lokasi Rak'] || row.location || '').trim() || '-',
            qrCodeUrl, // QR code disimpan di level buku
            createdAt: now,
            updatedAt: now
          });
          
          for (let j = 0; j < stok; j++) {
            const itemRef = itemsCol.doc();
            const uniqueCode = `BOOK-${docRef.id}-${Date.now()}-${j}`;
            batch.set(itemRef, {
              bookId: docRef.id,
              uniqueCode,
              barcode: uniqueCode,
              status: 'available',
              location: String(row['Lokasi Rak'] || row.location || '').trim() || '-',
              createdAt: now,
              updatedAt: now
            });
          }
          
          await batch.commit();
        }
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({
      message: 'Import completed',
      success: successCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to import books' });
  }
});

// Update book (must be before /:id/... routes)
router.put('/:id', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, category, year, publisher, coverUrl, location } = req.body;
    
    const bookDoc = await booksCol.doc(id).get();
    if (!bookDoc.exists) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    const now = new Date().toISOString();
    const updateData = {
      updatedAt: now
    };
    
    if (title !== undefined) updateData.title = title.trim();
    if (author !== undefined) updateData.author = author;
    if (category !== undefined) updateData.category = category;
    if (year !== undefined) updateData.year = year;
    if (publisher !== undefined) updateData.publisher = publisher;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
    if (location !== undefined) updateData.location = location;
    
    await booksCol.doc(id).update(updateData);
    const updatedDoc = await booksCol.doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    console.error('Update book error:', err);
    res.status(500).json({ message: err.message || 'Failed to update book' });
  }
});

// Delete book (also deletes all related items) - must be before /:id/... routes
router.delete('/:id', auth(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const bookDoc = await booksCol.doc(id).get();
    if (!bookDoc.exists) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    // Get all items for this book
    const itemsSnap = await itemsCol.where('bookId', '==', id).get();
    
    const batch = db.batch();
    
    // Delete all items
    itemsSnap.docs.forEach((doc) => {
      batch.delete(itemsCol.doc(doc.id));
    });
    
    // Delete the book
    batch.delete(booksCol.doc(id));
    
    await batch.commit();
    
    res.json({ 
      message: 'Book and all related items deleted successfully',
      itemsDeleted: itemsSnap.size
    });
  } catch (err) {
    console.error('Delete book error:', err);
    res.status(500).json({ message: err.message || 'Failed to delete book' });
  }
});

// Get items (exemplars) for a book
router.get('/:id/items', auth(['admin', 'officer', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;
    const snap = await itemsCol.where('bookId', '==', id).get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch book items' });
  }
});

// Generate items (copies) for a book
router.post('/:id/generate-items', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 1, branchId, location } = req.body;
    const bookDoc = await booksCol.doc(id).get();
    if (!bookDoc.exists) return res.status(404).json({ message: 'Book not found' });

    const batch = db.batch();
    const now = new Date().toISOString();
    const createdItemIds = [];

    for (let i = 0; i < count; i++) {
      const itemRef = itemsCol.doc();
      const uniqueCode = `BOOK-${id}-${Date.now()}-${i}`;
      batch.set(itemRef, {
        bookId: id,
        inventoryId: null,
        uniqueCode,
        barcode: uniqueCode,
        status: 'available',
        location: location || '',
        branchId: branchId || '',
        createdAt: now,
        updatedAt: now
      });
      createdItemIds.push(itemRef.id);
    }

    const totalCopies = (bookDoc.data().totalCopies || 0) + count;
    batch.update(booksCol.doc(id), { totalCopies, updatedAt: new Date().toISOString() });

    await batch.commit();

    res.json({ message: 'Items generated', itemIds: createdItemIds, totalCopies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate book items' });
  }
});

// Add stock to book
router.post('/:id/add-stock', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity = 1, location = '', entryDate } = req.body;
    
    const bookDoc = await booksCol.doc(id).get();
    if (!bookDoc.exists) return res.status(404).json({ message: 'Book not found' });
    
    const now = new Date().toISOString();
    const batch = db.batch();
    const createdItemIds = [];
    
    // Generate QR code untuk buku jika belum ada
    const bookData = bookDoc.data();
    let qrCodeUrl = bookData.qrCodeUrl || '';
    if (!qrCodeUrl) {
      try {
        const qrResult = await generateAndUploadQR(id);
        qrCodeUrl = qrResult.url;
      } catch (qrErr) {
        console.warn('Failed to generate QR for book:', qrErr.message);
      }
    }
    
    for (let i = 0; i < quantity; i++) {
      const itemRef = itemsCol.doc();
      const uniqueCode = `BOOK-${id}-${Date.now()}-${i}`;
      batch.set(itemRef, {
        bookId: id,
        inventoryId: null,
        uniqueCode,
        barcode: uniqueCode,
        status: 'available',
        location: location || '',
        branchId: '',
        createdAt: entryDate || now,
        updatedAt: now
      });
      createdItemIds.push(itemRef.id);
    }
    
    // Update QR code di buku jika baru dibuat
    if (qrCodeUrl && !bookData.qrCodeUrl) {
      batch.update(booksCol.doc(id), {
        qrCodeUrl,
        updatedAt: now
      });
    }
    
    const currentCopies = bookDoc.data().totalCopies || 0;
    batch.update(booksCol.doc(id), {
      totalCopies: currentCopies + quantity,
      updatedAt: now
    });
    
    await batch.commit();
    
    res.json({
      message: 'Stock added',
      quantity,
      totalCopies: currentCopies + quantity,
      itemsGenerated: createdItemIds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add stock' });
  }
});

// Reduce stock from book
router.post('/:id/reduce-stock', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity = 1, reason = '', notes = '' } = req.body;
    
    const bookDoc = await booksCol.doc(id).get();
    if (!bookDoc.exists) return res.status(404).json({ message: 'Book not found' });
    
    const currentCopies = bookDoc.data().totalCopies || 0;
    if (currentCopies < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    
    // Find available items to mark as removed
    const itemsSnap = await itemsCol
      .where('bookId', '==', id)
      .where('status', '==', 'available')
      .limit(quantity)
      .get();
    
    if (itemsSnap.size < quantity) {
      return res.status(400).json({ message: 'Not enough available items' });
    }
    
    const now = new Date().toISOString();
    const batch = db.batch();
    const updatedItemIds = [];
    
    let status = 'available';
    if (reason === 'hilang' || reason === 'lost') status = 'lost';
    else if (reason === 'rusak' || reason === 'damaged') status = 'damaged';
    else if (reason === 'ditarik' || reason === 'withdrawn') status = 'damaged'; // or create new status
    
    itemsSnap.docs.forEach((doc) => {
      batch.update(itemsCol.doc(doc.id), {
        status,
        updatedAt: now,
        notes: notes || reason || ''
      });
      updatedItemIds.push(doc.id);
    });
    
    batch.update(booksCol.doc(id), {
      totalCopies: currentCopies - quantity,
      updatedAt: now
    });
    
    await batch.commit();
    
    res.json({
      message: 'Stock reduced',
      quantity,
      totalCopies: currentCopies - quantity,
      reason,
      itemsUpdated: updatedItemIds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to reduce stock' });
  }
});

module.exports = router;


