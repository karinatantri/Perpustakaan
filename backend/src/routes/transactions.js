const express = require('express');
const XLSX = require('xlsx');
const bwipjs = require('bwip-js');
const { getFirestore } = require('../firebase');
const { auth } = require('../middleware/auth');
const { sendPushNotificationToStudent } = require('../utils/notifications');

const router = express.Router();
const db = getFirestore();
const transactionsCol = db.collection('transactions');
const txItemsCol = db.collection('transaction_items');
const itemsCol = db.collection('items');
const studentsCol = db.collection('students');
const booksCol = db.collection('books');
const usersCol = db.collection('users');

// Borrow items
router.post('/borrow', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { studentId, itemCodes = [], dueDate, branchId, notes, officerName, officerTitle } = req.body;
    if (!studentId || !Array.isArray(itemCodes) || itemCodes.length === 0) {
      return res.status(400).json({ message: 'studentId and itemCodes are required' });
    }

    const now = new Date().toISOString();
    const due = dueDate || null;

    // Fetch items by code
    // Jika code adalah bookId (dari QR code), ambil eksemplar yang available
    // Jika code adalah uniqueCode, cari langsung
    const itemDocs = [];
    for (const code of itemCodes) {
      // Cek apakah code adalah bookId (format Firestore ID biasanya panjang dan alphanumeric)
      // Atau cek apakah ada buku dengan ID tersebut
      let itemDoc = null;
      
      // Coba cari sebagai uniqueCode dulu
      let snap = await itemsCol.where('uniqueCode', '==', code).limit(1).get();
      if (!snap.empty) {
        itemDoc = snap.docs[0];
      } else {
        // Jika tidak ditemukan sebagai uniqueCode, coba sebagai bookId
        // Ambil eksemplar pertama yang available dari buku tersebut
        snap = await itemsCol
          .where('bookId', '==', code)
          .where('status', '==', 'available')
          .limit(1)
          .get();
        if (!snap.empty) {
          itemDoc = snap.docs[0];
        }
      }
      
      if (!itemDoc) {
        return res.status(400).json({ message: `Buku dengan kode ${code} tidak ditemukan atau tidak tersedia` });
      }
      
      const data = itemDoc.data();
      if (data.status !== 'available') {
        return res.status(400).json({ message: `Eksemplar dengan kode ${code} tidak tersedia` });
      }
      itemDocs.push({ id: itemDoc.id, data });
    }

    let transactionId;
    let receiptNumber;
    
    await db.runTransaction(async (t) => {
      const txRef = transactionsCol.doc();
      transactionId = txRef.id;
      receiptNumber = `TX-${Date.now()}`;
      t.set(txRef, {
        studentId,
        officerId: (req.user && req.user.id) || null,
        officerName: officerName || '',
        officerTitle: officerTitle || 'Petugas Perpustakaan',
        type: 'borrow',
        borrowDate: now,
        dueDate: due,
        returnDate: null,
        status: 'ongoing',
        branchId: branchId || '',
        notes: notes || '',
        receiptNumber,
        barcode: receiptNumber, // Barcode untuk scan di pengembalian
        createdAt: now,
        updatedAt: now
      });

      for (const { id: itemId } of itemDocs) {
        const txItemRef = txItemsCol.doc();
        t.set(txItemRef, {
          transactionId: txRef.id,
          itemId,
          condition: 'good',
          fine: 0,
          notes: '',
          createdAt: now,
          updatedAt: now
        });

        const itemRef = itemsCol.doc(itemId);
        t.update(itemRef, { status: 'borrowed', updatedAt: now });
      }
    });

    // Send push notification asynchronously (do not block client response)
    const formattedDueDate = due ? new Date(due).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
    sendPushNotificationToStudent(
      studentId,
      'Buku Berhasil Dipinjam 📚',
      `Kamu telah berhasil meminjam ${itemDocs.length} buku. Batas jatuh tempo: ${formattedDueDate}.`
    ).catch(e => console.error('Failed to trigger borrow notification:', e));

    res.status(201).json({ 
      message: 'Borrow transaction created',
      transactionId,
      receiptNumber,
      barcode: receiptNumber
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create borrow transaction' });
  }
});

// Return items (by transaction ID and item conditions)
router.post('/return', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { transactionId, items = [], paymentStatus = 'paid', officerName, officerTitle } = req.body; 
    // items: [{ itemId, condition, fine, notes }]
    // paymentStatus: 'paid' (langsung bayar) or 'pending' (bayar nanti)
    
    if (!transactionId) {
      return res.status(400).json({ message: 'transactionId is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const now = new Date().toISOString();
    const txDoc = await transactionsCol.doc(transactionId).get();
    if (!txDoc.exists) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    let hasProblem = false; // Check if any item is lost or damaged
    let totalFine = 0;

    await db.runTransaction(async (t) => {
      const txRef = transactionsCol.doc(transactionId);
      const tx = txDoc.data();

      for (const itemReturn of items) {
        const { itemId, condition = 'good', fine = 0, notes = '' } = itemReturn;
        
        if (condition === 'lost' || condition === 'damaged') {
          hasProblem = true;
          totalFine += Number(fine) || 0;
        }
        
        // Find transaction_item
        const txItemsSnap = await txItemsCol
          .where('transactionId', '==', transactionId)
          .where('itemId', '==', itemId)
          .limit(1)
          .get();

        if (txItemsSnap.empty) {
          throw new Error(`Item ${itemId} not found in transaction`);
        }

        const txItemDoc = txItemsSnap.docs[0];
        const itemDoc = await itemsCol.doc(itemId).get();
        if (!itemDoc.exists) {
          throw new Error(`Item ${itemId} not found`);
        }

        // Update item status
        let newStatus = 'available';
        if (condition === 'lost') newStatus = 'lost';
        else if (condition === 'damaged') newStatus = 'damaged';
        
        t.update(itemsCol.doc(itemId), { 
          status: newStatus, 
          updatedAt: now 
        });

        // Update transaction_item
        t.update(txItemsCol.doc(txItemDoc.id), {
          condition,
          fine: Number(fine) || 0,
          notes: notes || '',
          paymentStatus: paymentStatus, // 'paid' or 'pending'
          paidAt: paymentStatus === 'paid' ? now : null,
          updatedAt: now
        });
      }

      // Check if all items returned
      const allTxItemsSnap = await txItemsCol
        .where('transactionId', '==', transactionId)
        .get();
      
      let allReturned = true;
      for (const doc of allTxItemsSnap.docs) {
        const txItem = doc.data();
        if (!items.find((i) => i.itemId === txItem.itemId)) {
          allReturned = false;
          break;
        }
      }

      // Determine transaction status
      let newStatus = 'completed';
      if (hasProblem && paymentStatus === 'pending') {
        newStatus = 'has_problem_pending'; // Ada masalah, denda belum dibayar
      } else if (hasProblem && paymentStatus === 'paid') {
        newStatus = 'has_problem_resolved'; // Ada masalah, denda sudah dibayar
      } else if (!allReturned) {
        newStatus = 'partially_returned';
      }

      if (tx.status === 'ongoing' || tx.status === 'partially_returned') {
        const updateData = {
          status: newStatus,
          returnDate: now,
          totalFine: totalFine,
          paymentStatus: paymentStatus,
          updatedAt: now
        };
        if (officerName) {
          updateData.officerName = officerName;
        }
        if (officerTitle) {
          updateData.officerTitle = officerTitle;
        }
        t.update(txRef, updateData);
      }
    });

    // Send push notification asynchronously (do not block client response)
    const returnMsg = hasProblem 
      ? `Pengembalian buku selesai dengan catatan denda: Rp ${totalFine.toLocaleString('id-ID')}.` 
      : 'Terima kasih, buku kamu telah berhasil dikembalikan.';
    sendPushNotificationToStudent(
      txDoc.data().studentId,
      hasProblem ? 'Pengembalian Buku (Ada Catatan) ⚠️' : 'Buku Berhasil Dikembalikan 💚',
      returnMsg
    ).catch(e => console.error('Failed to trigger return notification:', e));

    res.json({ 
      message: 'Return processed successfully',
      status: hasProblem ? (paymentStatus === 'paid' ? 'has_problem_resolved' : 'has_problem_pending') : 'completed',
      totalFine
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to process return' });
  }
});

// Found book (book found without owner)
router.post('/found-book', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { itemCode, description = '' } = req.body;
    if (!itemCode) {
      return res.status(400).json({ message: 'itemCode is required' });
    }

    // Find item
    let itemDoc = null;
    let snap = await itemsCol.where('uniqueCode', '==', itemCode).limit(1).get();
    if (!snap.empty) {
      itemDoc = snap.docs[0];
    } else {
      snap = await itemsCol.where('bookId', '==', itemCode).limit(1).get();
      if (!snap.empty) {
        itemDoc = snap.docs[0];
      }
    }

    if (!itemDoc) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemData = itemDoc.data();
    const now = new Date().toISOString();

    // Create found book record
    const foundBooksCol = db.collection('found_books');
    await foundBooksCol.add({
      itemId: itemDoc.id,
      itemCode,
      description,
      status: 'found', // found, returned_to_owner, resolved
      foundDate: now,
      createdAt: now,
      updatedAt: now
    });

    // Update item status to found (but still count in stock)
    await itemsCol.doc(itemDoc.id).update({
      status: 'found',
      updatedAt: now
    });

    res.json({ message: 'Found book recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to record found book' });
  }
});

// Resolve lost/damaged case (after student paid fine or replaced book)
router.put('/:id/resolve-pending', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { action = 'paid' } = req.body; // action: 'paid' or 'replaced'

    const txDoc = await transactionsCol.doc(id).get();
    if (!txDoc.exists) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const tx = txDoc.data();
    if (tx.status !== 'has_problem_pending') {
      return res.status(400).json({ message: 'Transaction is not in pending payment status' });
    }

    const now = new Date().toISOString();

    // Get all transaction items with pending payment
    const txItemsSnap = await txItemsCol
      .where('transactionId', '==', id)
      .get();

    const batch = db.batch();

    for (const doc of txItemsSnap.docs) {
      const txItem = doc.data();
      if (txItem.paymentStatus === 'pending' && (txItem.condition === 'lost' || txItem.condition === 'damaged')) {
        if (action === 'replaced') {
          // If replaced, mark item as available (new book)
          batch.update(itemsCol.doc(txItem.itemId), {
            status: 'available',
            updatedAt: now
          });
        }

        // Update transaction_item to mark as paid
        batch.update(txItemsCol.doc(doc.id), {
          paymentStatus: 'paid',
          paidAt: now,
          resolved: true,
          resolvedDate: now,
          resolvedAction: action,
          updatedAt: now
        });
      }
    }

    // Update transaction status
    batch.update(transactionsCol.doc(id), {
      status: 'has_problem_resolved',
      paymentStatus: 'paid',
      paidAt: now,
      updatedAt: now
    });

    await batch.commit();

    res.json({ message: 'Pending payment resolved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to resolve pending payment' });
  }
});

// Get transactions by student
router.get('/', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { studentId: requestedStudentId } = req.query;
    const user = req.user || {};

    if (user.role === 'teacher') {
      const homeroom = user.homeroomClass;
      if (!homeroom) {
        return res.json([]); // Regular teacher has no access to student transactions
      }
      
      // Fetch all student IDs in this class
      const studentsSnap = await studentsCol.where('class', '==', homeroom).get();
      const studentIds = new Set(studentsSnap.docs.map(doc => doc.id));
      if (studentIds.size === 0) {
        return res.json([]);
      }
      
      // Fetch recent transactions and filter in-memory to avoid fetching the entire database
      const snap = await transactionsCol.orderBy('borrowDate', 'desc').limit(300).get();
      const filteredTxs = [];
      for (const doc of snap.docs) {
        const tx = doc.data();
        if (studentIds.has(tx.studentId)) {
          filteredTxs.push({ doc, tx });
        }
      }

      // Slice to top 50
      const slicedTxs = filteredTxs.slice(0, 50);

      // Fetch transaction items in parallel
      const data = await Promise.all(slicedTxs.map(async ({ doc, tx }) => {
        const studentDoc = studentsSnap.docs.find(d => d.id === tx.studentId);
        const s = studentDoc ? studentDoc.data() : null;
        const student = s ? { id: studentDoc.id, name: s.name, nis: s.nis || '' } : null;
        
        const itemsSnap = await txItemsCol.where('transactionId', '==', doc.id).get();
        return {
          id: doc.id,
          ...tx,
          student,
          itemCount: itemsSnap.size
        };
      }));

      return res.json(data);
    }

    let query = transactionsCol;
    let isLimited = false;

    if (user.role === 'student') {
      const studentId = user.studentId;
      if (!studentId) {
        return res.status(403).json({ message: 'ID Anggota tidak ditemukan pada token' });
      }
      query = query.where('studentId', '==', studentId);
    } else if (requestedStudentId) {
      query = query.where('studentId', '==', requestedStudentId);
    } else {
      // Admin, officer, principal: limit to 50 recent transactions directly
      query = query.orderBy('borrowDate', 'desc').limit(50);
      isLimited = true;
    }

    const snap = await query.get();
    
    // Sort in memory by borrowDate descending if not already sorted on database
    const docs = snap.docs;
    if (!isLimited) {
      docs.sort((a, b) => {
        const txA = a.data();
        const txB = b.data();
        const dateA = txA.borrowDate ? new Date(txA.borrowDate).getTime() : 0;
        const dateB = txB.borrowDate ? new Date(txB.borrowDate).getTime() : 0;
        return dateB - dateA;
      });
    }

    // Slice to top 50 before running extra database queries
    const slicedDocs = isLimited ? docs : docs.slice(0, 50);

    // Fetch details in parallel using Promise.all
    const data = await Promise.all(slicedDocs.map(async (doc) => {
      const tx = doc.data();
      
      const studentPromise = tx.studentId 
        ? studentsCol.doc(tx.studentId).get() 
        : Promise.resolve(null);
      const itemsPromise = txItemsCol.where('transactionId', '==', doc.id).get();
      
      const [studentDoc, itemsSnap] = await Promise.all([studentPromise, itemsPromise]);
      
      let student = null;
      if (studentDoc && studentDoc.exists) {
        const s = studentDoc.data();
        student = { id: studentDoc.id, name: s.name, nis: s.nis || '' };
      }

      return {
        id: doc.id,
        ...tx,
        student,
        itemCount: itemsSnap.size
      };
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

// Search transactions by student name
router.get('/search-by-student', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const qLower = q.toLowerCase().trim();

    // Fetch all students and filter (case-insensitive)
    // For better performance with large datasets, consider adding a lowercase name field
    const studentsSnap = await studentsCol.get();
    const matchingStudents = studentsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((student) => {
        const name = (student.name || '').toLowerCase();
        const nis = (student.nis || '').toLowerCase();
        return name.includes(qLower) || nis.includes(qLower);
      })
      .slice(0, 10); // Limit to 10 students

    if (matchingStudents.length === 0) return res.json([]);

    const studentIds = matchingStudents.map((s) => s.id);
    const transactions = [];

    // Get transactions for each student
    for (const studentId of studentIds) {
      try {
        const txSnap = await transactionsCol
          .where('studentId', '==', studentId)
          .where('status', '==', 'ongoing')
          .get();
        
        for (const doc of txSnap.docs) {
          const tx = doc.data();
          const student = matchingStudents.find((s) => s.id === studentId);
          transactions.push({
            id: doc.id,
            ...tx,
            student: student || null
          });
        }
      } catch (err) {
        // If query fails (e.g., missing index), try without status filter
        console.warn(`Query with status filter failed for student ${studentId}, trying without filter`);
        try {
          const txSnap = await transactionsCol
            .where('studentId', '==', studentId)
            .get();
          
          for (const doc of txSnap.docs) {
            const tx = doc.data();
            // Only include ongoing transactions
            if (tx.status === 'ongoing') {
              const student = matchingStudents.find((s) => s.id === studentId);
              transactions.push({
                id: doc.id,
                ...tx,
                student: student || null
              });
            }
          }
        } catch (err2) {
          console.error(`Failed to get transactions for student ${studentId}:`, err2);
        }
      }
    }

    // Sort by borrowDate descending
    transactions.sort((a, b) => {
      const dateA = a.borrowDate ? new Date(a.borrowDate).getTime() : 0;
      const dateB = b.borrowDate ? new Date(b.borrowDate).getTime() : 0;
      return dateB - dateA;
    });

    res.json(transactions.slice(0, 20)); // Limit to 20
  } catch (err) {
    console.error('Search transactions error:', err);
    res.status(500).json({ message: 'Failed to search transactions', error: err.message });
  }
});

// Get transaction by receipt number
router.get('/by-receipt/:receiptNumber', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const snap = await transactionsCol
      .where('receiptNumber', '==', receiptNumber)
      .limit(1)
      .get();
    
    if (snap.empty) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const doc = snap.docs[0];
    const tx = doc.data();
    
    // Get student info
    let student = null;
    if (tx.studentId) {
      const studentDoc = await studentsCol.doc(tx.studentId).get();
      if (studentDoc.exists) {
        student = { id: studentDoc.id, ...studentDoc.data() };
      }
    }

    res.json({
      id: doc.id,
      ...tx,
      student
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch transaction' });
  }
});

// Get dashboard stats and recent activity (highly optimized)
router.get('/stats', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const user = req.user || {};
    const today = new Date();

    // 1. Get total counts using Firestore count() aggregation (extremely fast)
    const [booksCountSnap, studentsCountSnap] = await Promise.all([
      booksCol.count().get(),
      studentsCol.count().get()
    ]);
    const totalBooks = booksCountSnap.data().count;
    const totalStudents = studentsCountSnap.data().count;

    // 2. Fetch active loans (ongoing transactions)
    let activeLoansQuery = transactionsCol.where('status', '==', 'ongoing');
    if (user.role === 'student') {
      activeLoansQuery = activeLoansQuery.where('studentId', '==', user.studentId);
    }
    const activeSnap = await activeLoansQuery.get();
    
    let activeLoansCount = 0;
    let overdueBooksCount = 0;
    let teacherStudentIds = new Set();

    if (user.role === 'teacher') {
      const homeroom = user.homeroomClass;
      if (homeroom) {
        const studentsSnap = await studentsCol.where('class', '==', homeroom).get();
        studentsSnap.docs.forEach(doc => teacherStudentIds.add(doc.id));
      }
    }

    activeSnap.forEach((doc) => {
      const tx = doc.data();
      if (user.role === 'teacher' && !teacherStudentIds.has(tx.studentId)) {
        return; // Skip if not their homeroom student
      }
      activeLoansCount++;
      if (tx.dueDate && new Date(tx.dueDate) < today) {
        overdueBooksCount++;
      }
    });

    // 3. Get recent transactions (top 8)
    let recentSnap = [];
    if (user.role === 'student') {
      // Students have few transactions, so we can fetch all and sort/slice in-memory to avoid index requirement
      const allStudentSnap = await transactionsCol.where('studentId', '==', user.studentId).get();
      const sorted = allStudentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      sorted.sort((a, b) => {
        const dateA = a.borrowDate ? new Date(a.borrowDate).getTime() : 0;
        const dateB = b.borrowDate ? new Date(b.borrowDate).getTime() : 0;
        return dateB - dateA;
      });
      recentSnap = sorted.slice(0, 8);
    } else if (user.role === 'teacher') {
      // Fetch recent 150 transactions and filter in-memory to find their students' recent transactions
      const snap = await transactionsCol.orderBy('borrowDate', 'desc').limit(150).get();
      const filtered = [];
      for (const doc of snap.docs) {
        const tx = doc.data();
        if (teacherStudentIds.has(tx.studentId)) {
          filtered.push({ id: doc.id, ...tx });
        }
        if (filtered.length >= 8) break;
      }
      recentSnap = filtered;
    } else {
      // Admin/officer/principal see recent globally
      const snap = await transactionsCol.orderBy('borrowDate', 'desc').limit(8).get();
      recentSnap = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Resolve student info and count items for recent transactions
    const recentTransactions = await Promise.all(recentSnap.map(async (txData) => {
      const id = txData.id;
      const tx = txData;
      
      const studentPromise = tx.studentId 
        ? studentsCol.doc(tx.studentId).get() 
        : Promise.resolve(null);
      const itemsPromise = txItemsCol.where('transactionId', '==', id).get();
      
      const [studentDoc, itemsSnap] = await Promise.all([studentPromise, itemsPromise]);
      
      let student = null;
      if (studentDoc && studentDoc.exists) {
        const s = studentDoc.data();
        student = { id: studentDoc.id, name: s.name, nis: s.nis || '' };
      }

      return {
        id,
        ...tx,
        student,
        itemCount: itemsSnap.size
      };
    }));

    res.json({
      totalBooks,
      totalStudents,
      activeLoans: activeLoansCount,
      overdueBooks: overdueBooksCount,
      recentTransactions
    });
  } catch (err) {
    console.error('Failed to get dashboard stats:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

// Get transaction items with book details
router.get('/:id/items', auth(['admin', 'officer']), async (req, res) => {
  try {
    const { id } = req.params;
    const txItemsSnap = await txItemsCol.where('transactionId', '==', id).get();
    
    const txItems = txItemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch all items in parallel
    const itemDocs = txItems.length > 0 
      ? await Promise.all(txItems.map(txItem => itemsCol.doc(txItem.itemId).get()))
      : [];

    const itemsMap = {};
    itemDocs.forEach(doc => {
      if (doc.exists) {
        itemsMap[doc.id] = { id: doc.id, ...doc.data() };
      }
    });

    // Extract unique bookIds
    const bookIds = [...new Set(
      Object.values(itemsMap)
        .map(item => item.bookId)
        .filter(Boolean)
    )];

    // Fetch all books in parallel
    const bookDocs = bookIds.length > 0
      ? await Promise.all(bookIds.map(bookId => booksCol.doc(bookId).get()))
      : [];

    const booksMap = {};
    bookDocs.forEach(doc => {
      if (doc.exists) {
        booksMap[doc.id] = { id: doc.id, ...doc.data() };
      }
    });

    const items = txItems.map(txItem => {
      const itemData = itemsMap[txItem.itemId] || {};
      const bookData = itemData.bookId ? booksMap[itemData.bookId] : null;

      return {
        id: txItem.id,
        itemId: txItem.itemId,
        condition: txItem.condition || 'good',
        fine: txItem.fine || 0,
        notes: txItem.notes || '',
        item: {
          id: itemData.id || txItem.itemId,
          uniqueCode: itemData.uniqueCode,
          status: itemData.status,
          ...itemData
        },
        book: bookData
      };
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch transaction items' });
  }
});

// Return receipt (for return transaction) - must be before /:id/receipt
router.get('/:id/return-receipt', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { id } = req.params;
    const txDoc = await transactionsCol.doc(id).get();
    if (!txDoc.exists) {
      return res.status(404).send('<html><body><h1>Transaksi tidak ditemukan</h1><p>ID transaksi: ' + id + '</p></body></html>');
    }
    const tx = txDoc.data();

    const studentDoc = tx.studentId
      ? await studentsCol.doc(tx.studentId).get()
      : null;
    const student = studentDoc && studentDoc.exists ? studentDoc.data() : null;

    const txItemsSnap = await txItemsCol.where('transactionId', '==', id).get();
    const items = [];
    let totalFine = 0;
    
    const txItems = txItemsSnap.docs.map(doc => doc.data());

    // Fetch all items in parallel
    const itemDocs = txItems.length > 0 
      ? await Promise.all(txItems.map(txItem => itemsCol.doc(txItem.itemId).get()))
      : [];

    const itemsMap = {};
    itemDocs.forEach(doc => {
      if (doc.exists) {
        itemsMap[doc.id] = doc.data();
      }
    });

    // Extract unique bookIds
    const bookIds = [...new Set(
      Object.values(itemsMap)
        .map(item => item.bookId)
        .filter(Boolean)
    )];

    // Fetch all books in parallel
    const bookDocs = bookIds.length > 0
      ? await Promise.all(bookIds.map(bookId => booksCol.doc(bookId).get()))
      : [];

    const booksMap = {};
    bookDocs.forEach(doc => {
      if (doc.exists) {
        booksMap[doc.id] = doc.data();
      }
    });

    for (const txItem of txItems) {
      const itemData = itemsMap[txItem.itemId] || {};
      const bookData = itemData.bookId ? booksMap[itemData.bookId] : null;
      const bookTitle = bookData ? (bookData.title || '') : '';

      const fine = Number(txItem.fine) || 0;
      totalFine += fine;
      items.push({
        code: itemData.uniqueCode || '',
        title: bookTitle,
        condition: txItem.condition || 'good',
        fine: fine,
        notes: txItem.notes || ''
      });
    }

    const borrowDate = tx.borrowDate || '';
    const returnDate = tx.returnDate || new Date().toISOString();
    const receiptNumber = tx.receiptNumber || id;
    const paymentStatus = tx.paymentStatus || 'paid';
    const status = tx.status || 'completed';

    // Get officer name and title from transaction (preferred) or logged in user
    let officerName = tx.officerName || '';
    let officerTitle = tx.officerTitle || 'Petugas Perpustakaan';
    if (!officerName) {
      try {
        if (req.user && req.user.id) {
          const userDoc = await usersCol.doc(req.user.id).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            officerName = userData.name || userData.username || 'Petugas Perpustakaan';
            if (userData.role === 'admin') {
              officerTitle = 'Administrator';
            }
          }
        }
      } catch (err) {
        console.error('Failed to get officer name:', err);
      }
    }
    if (!officerName) {
      officerName = 'Petugas Perpustakaan';
    }
    if (!officerTitle) {
      officerTitle = 'Petugas Perpustakaan';
    }

    // Generate QR only
    let qrBase64 = '';
    try {
      const qrBuffer = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: receiptNumber,
        scale: 4,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF'
      });
      qrBase64 = qrBuffer.toString('base64');
    } catch (qrErr) {
      console.error('Failed to generate QR code:', qrErr.message);
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
  <title>Struk Pengembalian Buku</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; background: white; margin: 0 auto; padding: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media screen {
      body {
        width: 100%;
        max-width: 210mm;
      }
    }
    @media print {
      body {
        width: 210mm;
        min-height: 297mm;
        padding: 10mm;
      }
    }
    .receipt-container { width: 100%; background: white; border: 2px solid #1d4ed8; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 12px; padding: 10px; background-color: #1d4ed8; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); border-radius: 6px; color: white; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 4px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .logo-img { height: 50px; width: auto; object-fit: contain; }
    .school-name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .receipt-title { font-size: 12px; opacity: 0.95; margin-top: 2px; }
    .top-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 8px; align-items: start; }
    .qr-side { text-align: center; padding: 10px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; justify-self: end; max-width: 170px; }
    .code-label { font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; line-height: 1.2; }
    .qr-image { width: 110px; height: 110px; object-fit: contain; margin: 4px auto; display: block; }
    .qr-text { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: 1px; margin-top: 2px; }
    .qr-hint { font-size: 9px; color: #64748b; margin-top: 3px; font-style: italic; }
    .meta { margin: 8px 0; font-size: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; padding: 10px; background: #f8fafc; border-radius: 6px; }
    .meta-row { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { color: #64748b; font-weight: 600; font-size: 9px; }
    .meta-value { color: #0f172a; font-weight: 700; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 6px 0; font-size: 9px; page-break-inside: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 4px; text-align: left; page-break-inside: avoid; page-break-before: auto; page-break-after: auto; }
    th { background-color: #1d4ed8; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: white; font-weight: 700; font-size: 10px; text-align: center; }
    td { font-size: 9px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #e0e7ff; }
    .condition-badge { display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
    .condition-good { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .condition-damaged { background: #fef3c7; color: #92400e; border: 1px solid #fde047; }
    .condition-lost { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .summary { margin-top: 14px; padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #cbd5e1; border-radius: 6px; }
    .summary-row { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #cbd5e1; }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { color: #475569; font-weight: 600; font-size: 11px; }
    .summary-value { font-weight: 800; color: #0f172a; font-size: 16px; }
    .payment-status { margin-top: 10px; padding: 10px; border-radius: 6px; text-align: center; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border: 2px solid; }
    .payment-paid { background: #dcfce7; color: #166534; border-color: #86efac; }
    .payment-pending { background: #fef3c7; color: #92400e; border-color: #fde047; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; font-style: italic; }
    .sign-row { margin-top: 18px; display: flex; justify-content: space-between; gap: 16px; }
    .sign-box { flex: 1; text-align: center; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; }
    .sign-label { font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 40px; display: block; }
    .sign-line { border-top: 2px solid #0f172a; padding-top: 4px; margin-top: 4px; font-size: 10px; color: #64748b; }
    @media print {
      html, body, .receipt-container, .header, th, td, .qr-side, .meta, .sign-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: white !important;
        padding: 0;
        margin: 0;
        width: 210mm;
        min-height: 297mm;
      }
      .receipt-container {
        box-shadow: none !important;
        border: 2px solid #1d4ed8 !important;
        padding: 12mm !important;
      }
      .header {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 2px solid #1d4ed8 !important;
      }
      th {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 1px solid #1d4ed8 !important;
      }

      .qr-side {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 2px dashed #cbd5e1 !important;
      }
      .meta {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
      }
      .sign-box {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
      }
      @page {
        margin: 0;
      }
    }



    @media (max-width: 600px) {
      .top-grid {
        grid-template-columns: 1fr !important;
      }
      .qr-side {
        justify-self: center !important;
        margin-top: 10px !important;
        width: 100% !important;
        max-width: 170px !important;
      }
      .sign-row {
        flex-direction: column !important;
        gap: 12px !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" class="logo-img" />
        <span>YP. TUNAS KARYA</span>
      </div>
      <div class="school-name">SEKOLAH YP. TUNAS KARYA</div>
      <div class="receipt-title">Struk Pengembalian Buku Perpustakaan</div>
    </div>
    <div class="top-grid">
      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">Nomor Struk</span>
          <span class="meta-value">${receiptNumber}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Nama Siswa</span>
          <span class="meta-value">${student ? student.name : '-'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">NIS / Kelas</span>
          <span class="meta-value">${student ? (student.nis || '-') + ' / ' + (student.class || '-') : '-'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Tanggal Pinjam</span>
          <span class="meta-value">${borrowDate ? new Date(borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Tanggal Kembali</span>
          <span class="meta-value">${returnDate ? new Date(returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
        </div>
      </div>
      <div class="qr-side">
        <div class="code-label">QR CODE (SCAN UNTUK PENGEMBALIAN)</div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR ${receiptNumber}" class="qr-image" />` : `<div style="padding: 20px; background: #fee2e2; border-radius: 4px; color: #991b1b; font-size: 10px;">⚠️ QR tidak dapat ditampilkan</div>`}
        <div class="qr-text">${receiptNumber}</div>
        <div class="qr-hint">Simpan kode ini untuk pengembalian buku</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Judul Buku</th>
          <th>Kode</th>
          <th>Kondisi</th>
          <th>Denda</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const conditionClass = it.condition === 'good' ? 'condition-good' : 
                                 it.condition === 'damaged' ? 'condition-damaged' : 'condition-lost';
          const conditionText = it.condition === 'good' ? '✅ Baik' : 
                               it.condition === 'damaged' ? '⚠️ Rusak' : '❌ Hilang';
          return `<tr>
            <td>${idx + 1}</td>
            <td>${it.title || '-'}</td>
            <td>${it.code || '-'}</td>
            <td><span class="condition-badge ${conditionClass}">${conditionText}</span></td>
            <td>${it.fine > 0 ? 'Rp ' + it.fine.toLocaleString('id-ID') : '-'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Jumlah Buku</span>
        <span class="summary-value">${items.length} Buku</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Denda</span>
        <span class="summary-value">Rp ${totalFine.toLocaleString('id-ID')}</span>
      </div>
      <div class="payment-status ${paymentStatus === 'paid' ? 'payment-paid' : 'payment-pending'}">
        Status Pembayaran: ${paymentStatus === 'paid' ? '✅ LUNAS' : '⏳ BELUM LUNAS'}
      </div>
      ${status === 'has_problem_pending' ? '<div style="margin-top: 8px; padding: 8px; background: #fee2e2; border-radius: 4px; text-align: center; font-size: 11px; color: #991b1b; font-weight: 600;">⚠️ Transaksi Bermasalah - Menunggu Pembayaran Denda</div>' : ''}
      ${status === 'has_problem_resolved' ? '<div style="margin-top: 8px; padding: 8px; background: #d1fae5; border-radius: 4px; text-align: center; font-size: 11px; color: #065f46; font-weight: 600;">✅ Transaksi Bermasalah - Sudah Diselesaikan</div>' : ''}
    </div>
    <div class="sign-row">
      <div class="sign-box">
        <div class="sign-label">Siswa</div>
        <div style="border-top: 1px solid #000; padding-top: 5px;">(${student ? student.name : '_____________________'})</div>
      </div>
      <div class="sign-box">
        <div class="sign-label">${officerTitle}</div>
        <div style="border-top: 1px solid #000; padding-top: 5px;">(${officerName})</div>
      </div>
    </div>
    <div class="footer">
      Terima kasih telah mengembalikan buku tepat waktu
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[RETURN RECEIPT ERROR]', err);
    res.status(500).send(`<html><body><h1>Gagal membuat struk pengembalian</h1><p>Error: ${err.message}</p><pre>${err.stack}</pre></body></html>`);
  }
});

// Simple HTML receipt for a transaction (borrow receipt)
// Note: For returned transactions, use /:id/return-receipt instead
router.get('/:id/receipt', auth(['admin', 'officer', 'teacher', 'student', 'principal']), async (req, res) => {
  try {
    const { id } = req.params;
    const txDoc = await transactionsCol.doc(id).get();
    if (!txDoc.exists) {
      return res.status(404).send('<html><body><h1>Transaksi tidak ditemukan</h1><p>ID transaksi: ' + id + '</p></body></html>');
    }
    const tx = txDoc.data();
    
    // If transaction is returned (any status except ongoing), show return receipt
    if (tx.status && tx.status !== 'ongoing') {
      // Return return receipt instead
      const studentDoc = tx.studentId ? await studentsCol.doc(tx.studentId).get() : null;
      const student = studentDoc && studentDoc.exists ? studentDoc.data() : null;
      const txItemsSnap = await txItemsCol.where('transactionId', '==', id).get();
      const items = [];
      let totalFine = 0;
      
      const txItems = txItemsSnap.docs.map(doc => doc.data());

      // Fetch all items in parallel
      const itemDocs = txItems.length > 0 
        ? await Promise.all(txItems.map(txItem => itemsCol.doc(txItem.itemId).get()))
        : [];

      const itemsMap = {};
      itemDocs.forEach(doc => {
        if (doc.exists) {
          itemsMap[doc.id] = doc.data();
        }
      });

      // Extract unique bookIds
      const bookIds = [...new Set(
        Object.values(itemsMap)
          .map(item => item.bookId)
          .filter(Boolean)
      )];

      // Fetch all books in parallel
      const bookDocs = bookIds.length > 0
        ? await Promise.all(bookIds.map(bookId => booksCol.doc(bookId).get()))
        : [];

      const booksMap = {};
      bookDocs.forEach(doc => {
        if (doc.exists) {
          booksMap[doc.id] = doc.data();
        }
      });

      for (const txItem of txItems) {
        const itemData = itemsMap[txItem.itemId] || {};
        const bookData = itemData.bookId ? booksMap[itemData.bookId] : null;
        const bookTitle = bookData ? (bookData.title || '') : '';

        const fine = Number(txItem.fine) || 0;
        totalFine += fine;
        items.push({
          code: itemData.uniqueCode || '',
          title: bookTitle,
          condition: txItem.condition || 'good',
          fine: fine,
          notes: txItem.notes || ''
        });
      }

      const borrowDate = tx.borrowDate || '';
      const returnDate = tx.returnDate || new Date().toISOString();
      const receiptNumber = tx.receiptNumber || id;
      const paymentStatus = tx.paymentStatus || 'paid';
      const status = tx.status || 'completed';

      // Get officer name and title from transaction (preferred) or logged in user
      let officerName = tx.officerName || '';
      let officerTitle = tx.officerTitle || 'Petugas Perpustakaan';
      if (!officerName) {
        try {
          if (req.user && req.user.id) {
            const userDoc = await usersCol.doc(req.user.id).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              officerName = userData.name || userData.username || '';
              if (!officerTitle || officerTitle === 'Petugas Perpustakaan') {
                officerTitle = 'Petugas Perpustakaan';
              }
            }
          }
        } catch (err) {
          console.error('Failed to get officer name:', err);
        }
      }
      if (!officerName) {
        officerName = 'Petugas Perpustakaan';
      }
      if (!officerTitle) {
        officerTitle = 'Petugas Perpustakaan';
      }

      // Generate QR only (tanpa barcode)
      let qrBase64 = '';
      try {
        const qrBuffer = await bwipjs.toBuffer({
          bcid: 'qrcode',
          text: receiptNumber,
          scale: 4,
          includetext: true,
          textxalign: 'center',
          backgroundcolor: 'FFFFFF'
        });
        qrBase64 = qrBuffer.toString('base64');
      } catch (qrErr) {
        console.error('Failed to generate QR code:', qrErr.message);
      }

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
  <title>Struk Pengembalian Buku</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page {
      size: A4;
      margin: 15mm;
    }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      font-size: 10px; 
      background: white;
      margin: 0 auto;
      padding: 15px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @media screen {
      body {
        width: 100%;
        max-width: 210mm;
      }
    }
    @media print {
      body {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm;
      }
    }
    .receipt-container {
      width: 100%;
      background: white;
      border: 2px solid #1d4ed8;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding: 15px;
      background-color: #1d4ed8;
      background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
      border-radius: 6px;
      color: white;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .logo-img {
      height: 50px;
      width: auto;
      object-fit: contain;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .school-name {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .receipt-title {
      font-size: 14px;
      opacity: 0.95;
      margin-top: 5px;
    }
    .top-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; align-items: start; }
    .qr-side { text-align: center; padding: 12px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; }
    .qr-section { display: none; }
    .code-label { font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
    .qr-image { width: 120px; height: 120px; object-fit: contain; margin: 6px auto; display: block; }
    .qr-text { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: 2px; margin-top: 4px; }
    .qr-hint { font-size: 9px; color: #64748b; margin-top: 4px; font-style: italic; }
    .meta {
      margin: 12px 0;
      font-size: 10px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
    }
    .meta-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
      font-size: 9px;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 700;
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 9px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background-color: #1d4ed8;
      background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
      color: white;
      font-weight: 700;
      font-size: 10px;
      text-align: center;
    }
    td {
      font-size: 9px;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }
    tr:hover {
      background: #e0e7ff;
    }
    .condition-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .condition-good { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .condition-damaged { background: #fef3c7; color: #92400e; border: 1px solid #fde047; }
    .condition-lost { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .summary {
      margin-top: 20px;
      padding: 15px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border: 2px solid #cbd5e1;
      border-radius: 6px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px solid #cbd5e1;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-label {
      color: #475569;
      font-weight: 600;
      font-size: 11px;
    }
    .summary-value {
      font-weight: 800;
      color: #0f172a;
      font-size: 16px;
    }
    .payment-status {
      margin-top: 12px;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 2px solid;
    }
    .payment-paid {
      background: #dcfce7;
      color: #166534;
      border-color: #86efac;
    }
    .payment-pending {
      background: #fef3c7;
      color: #92400e;
      border-color: #fde047;
    }
    .footer {
      margin-top: 25px;
      padding-top: 15px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      font-style: italic;
    }
    .sign-row {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
    .sign-box {
      flex: 1;
      text-align: center;
      padding: 15px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
    }
    .sign-label {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 50px;
      display: block;
    }
    .sign-line {
      border-top: 2px solid #0f172a;
      padding-top: 5px;
      margin-top: 5px;
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      html, body, .receipt-container, .header, th, td, .qr-side, .meta, .sign-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body { 
        background: white !important; 
        padding: 0;
        margin: 0;
        width: 210mm;
        min-height: 297mm;
      }
      .receipt-container { 
        box-shadow: none !important;
        border: 2px solid #1d4ed8 !important;
        padding: 15mm !important;
      }
      .header {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 2px solid #1d4ed8 !important;
      }
      th {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 1px solid #1d4ed8 !important;
      }

      .qr-side {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 2px dashed #cbd5e1 !important;
      }
      .meta {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
      }
      .sign-box {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
      }
      @page {
        margin: 0;
      }
    }



    @media (max-width: 600px) {
      .top-grid {
        grid-template-columns: 1fr !important;
      }
      .qr-side {
        justify-self: center !important;
        margin-top: 10px !important;
        width: 100% !important;
        max-width: 170px !important;
      }
      .sign-row {
        flex-direction: column !important;
        gap: 12px !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" class="logo-img" />
        <span>YP. TUNAS KARYA</span>
      </div>
      <div class="school-name">SEKOLAH YP. TUNAS KARYA</div>
      <div class="receipt-title">Struk Pengembalian Buku Perpustakaan</div>
    </div>
    <div class="top-grid">
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Nomor Struk</span><span class="meta-value">${receiptNumber}</span></div>
        <div class="meta-row"><span class="meta-label">Nama Siswa</span><span class="meta-value">${student ? student.name : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">NIS / Kelas</span><span class="meta-value">${student ? (student.nis || '-') + ' / ' + (student.class || '-') : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Pinjam</span><span class="meta-value">${borrowDate ? new Date(borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Kembali</span><span class="meta-value">${returnDate ? new Date(returnDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></div>
      </div>
      <div class="qr-side">
        <div class="code-label">QR CODE (SCAN UNTUK PENGEMBALIAN)</div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR ${receiptNumber}" class="qr-image" />` : `<div style="padding: 20px; background: #fee2e2; border-radius: 4px; color: #991b1b; font-size: 10px;">⚠️ QR tidak dapat ditampilkan</div>`}
        <div class="qr-text">${receiptNumber}</div>
        <div class="qr-hint">Simpan kode ini untuk pengembalian buku</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Judul Buku</th>
          <th>Kode</th>
          <th>Kondisi</th>
          <th>Denda</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => {
          const conditionClass = it.condition === 'good' ? 'condition-good' : 
                                 it.condition === 'damaged' ? 'condition-damaged' : 'condition-lost';
          const conditionText = it.condition === 'good' ? '✅ Baik' : 
                               it.condition === 'damaged' ? '⚠️ Rusak' : '❌ Hilang';
          return `<tr>
            <td>${idx + 1}</td>
            <td>${it.title || '-'}</td>
            <td>${it.code || '-'}</td>
            <td><span class="condition-badge ${conditionClass}">${conditionText}</span></td>
            <td>${it.fine > 0 ? 'Rp ' + it.fine.toLocaleString('id-ID') : '-'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Jumlah Buku</span>
        <span class="summary-value">${items.length} Buku</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Denda</span>
        <span class="summary-value">Rp ${totalFine.toLocaleString('id-ID')}</span>
      </div>
      <div class="payment-status ${paymentStatus === 'paid' ? 'payment-paid' : 'payment-pending'}">
        Status Pembayaran: ${paymentStatus === 'paid' ? '✅ LUNAS' : '⏳ BELUM LUNAS'}
      </div>
      ${status === 'has_problem_pending' ? '<div style="margin-top: 8px; padding: 8px; background: #fee2e2; border-radius: 4px; text-align: center; font-size: 11px; color: #991b1b; font-weight: 600;">⚠️ Transaksi Bermasalah - Menunggu Pembayaran Denda</div>' : ''}
      ${status === 'has_problem_resolved' ? '<div style="margin-top: 8px; padding: 8px; background: #d1fae5; border-radius: 4px; text-align: center; font-size: 11px; color: #065f46; font-weight: 600;">✅ Transaksi Bermasalah - Sudah Diselesaikan</div>' : ''}
    </div>
    <div class="sign-row">
      <div class="sign-box">
        <span class="sign-label">Siswa</span>
        <div class="sign-line">${student ? student.name : '_____________________'}</div>
      </div>
      <div class="sign-box">
        <span class="sign-label">${officerTitle}</span>
        <div class="sign-line">${officerName}</div>
      </div>
    </div>
    <div class="footer">
      Terima kasih telah mengembalikan buku tepat waktu
    </div>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    const studentDoc = tx.studentId
      ? await studentsCol.doc(tx.studentId).get()
      : null;
    const student = studentDoc && studentDoc.exists ? studentDoc.data() : null;

    const txItemsSnap = await txItemsCol.where('transactionId', '==', id).get();
    const items = [];
    
    const txItems = txItemsSnap.docs.map(doc => doc.data());

    // Fetch all items in parallel
    const itemDocs = txItems.length > 0 
      ? await Promise.all(txItems.map(txItem => itemsCol.doc(txItem.itemId).get()))
      : [];

    const itemsMap = {};
    itemDocs.forEach(doc => {
      if (doc.exists) {
        itemsMap[doc.id] = doc.data();
      }
    });

    // Extract unique bookIds
    const bookIds = [...new Set(
      Object.values(itemsMap)
        .map(item => item.bookId)
        .filter(Boolean)
    )];

    // Fetch all books in parallel
    const bookDocs = bookIds.length > 0
      ? await Promise.all(bookIds.map(bookId => booksCol.doc(bookId).get()))
      : [];

    const booksMap = {};
    bookDocs.forEach(doc => {
      if (doc.exists) {
        booksMap[doc.id] = doc.data();
      }
    });

    for (const txItem of txItems) {
      const itemData = itemsMap[txItem.itemId] || {};
      const bookData = itemData.bookId ? booksMap[itemData.bookId] : null;
      const bookTitle = bookData ? (bookData.title || '') : '';

      items.push({
        code: itemData.uniqueCode || '',
        title: bookTitle
      });
    }

    const borrowDate = tx.borrowDate || '';
    const dueDate = tx.dueDate || '';
    const receiptNumber = tx.receiptNumber || id;

    // Get officer name and title from transaction (preferred) or logged in user
    let officerName = tx.officerName || '';
    let officerTitle = tx.officerTitle || 'Petugas Perpustakaan';
    if (!officerName) {
      try {
        if (req.user && req.user.id) {
          const userDoc = await usersCol.doc(req.user.id).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            officerName = userData.name || userData.username || '';
            if (!officerTitle || officerTitle === 'Petugas Perpustakaan') {
              officerTitle = 'Petugas Perpustakaan';
            }
          }
        }
      } catch (err) {
        console.error('Failed to get officer name:', err);
      }
    }
    if (!officerName) {
      officerName = 'Petugas Perpustakaan';
    }
    if (!officerTitle) {
      officerTitle = 'Petugas Perpustakaan';
    }

    // Generate QR only (tanpa barcode)
    let qrBase64 = '';
    try {
      const qrBuffer = await bwipjs.toBuffer({
        bcid: 'qrcode',
        text: receiptNumber,
        scale: 4,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF'
      });
      qrBase64 = qrBuffer.toString('base64');
    } catch (qrErr) {
      console.error('Failed to generate QR code:', qrErr.message);
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
  <title>Struk Peminjaman Buku</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; background: white; margin: 0 auto; padding: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media screen {
      body {
        width: 100%;
        max-width: 210mm;
      }
    }
    @media print {
      body {
        width: 210mm;
        min-height: 297mm;
        padding: 10mm;
      }
    }
    .receipt-container { width: 100%; background: white; border: 2px solid #1d4ed8; border-radius: 8px; padding: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 12px; padding: 10px; background-color: #1d4ed8; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); border-radius: 6px; color: white; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 4px; text-shadow: 2px 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .logo-img { height: 50px; width: auto; object-fit: contain; }
    .school-name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .receipt-title { font-size: 12px; opacity: 0.95; margin-top: 2px; }
    .top-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 8px; align-items: start; }
    .qr-side { text-align: center; padding: 10px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; justify-self: end; max-width: 170px; }
    .qr-section { display: none; } /* tidak dipakai, diganti top-grid */
    .code-label { font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; line-height: 1.2; }
    .qr-image { width: 110px; height: 110px; object-fit: contain; margin: 4px auto; display: block; }
    .qr-text { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: 1px; margin-top: 2px; }
    .qr-hint { font-size: 9px; color: #64748b; margin-top: 3px; font-style: italic; }
    .meta { margin: 8px 0; font-size: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; padding: 10px; background: #f8fafc; border-radius: 6px; }
    .meta-row { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { color: #64748b; font-weight: 600; font-size: 9px; }
    .meta-value { color: #0f172a; font-weight: 700; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 6px 0; font-size: 9px; page-break-inside: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 4px; text-align: left; page-break-inside: avoid; page-break-before: auto; page-break-after: auto; }
    th { background-color: #1d4ed8; background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: white; font-weight: 700; font-size: 10px; text-align: center; }
    td { font-size: 9px; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #e0e7ff; }
    .sign-row { margin-top: 18px; display: flex; justify-content: space-between; gap: 16px; }
    .sign-box { flex: 1; text-align: center; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1; }
    .sign-label { font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 40px; display: block; }
    .sign-line { border-top: 2px solid #0f172a; padding-top: 4px; margin-top: 4px; font-size: 10px; color: #64748b; }
    .footer { margin-top: 18px; padding-top: 12px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 9px; color: #94a3b8; font-style: italic; }
    @media print {
      html, body, .receipt-container, .header, th, td, .qr-side, .meta, .sign-box {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background: white !important;
        padding: 0;
        margin: 0;
        width: 210mm;
        min-height: 297mm;
      }
      .receipt-container {
        box-shadow: none !important;
        border: 2px solid #1d4ed8 !important;
        padding: 12mm !important;
      }
      .header {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 2px solid #1d4ed8 !important;
      }
      th {
        background-color: #1d4ed8 !important;
        background: #1d4ed8 !important;
        color: white !important;
        border: 1px solid #1d4ed8 !important;
      }

      .qr-side {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 2px dashed #cbd5e1 !important;
      }
      .meta {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
      }
      .sign-box {
        background-color: #f8fafc !important;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
      }
      @page {
        margin: 0;
      }
    }



    @media (max-width: 600px) {
      .top-grid {
        grid-template-columns: 1fr !important;
      }
      .qr-side {
        justify-self: center !important;
        margin-top: 10px !important;
        width: 100% !important;
        max-width: 170px !important;
      }
      .sign-row {
        flex-direction: column !important;
        gap: 12px !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="logo">
        <img src="/Logo/logo.png" alt="Logo YP. Tunas Karya" class="logo-img" />
        <span>YP. TUNAS KARYA</span>
      </div>
      <div class="school-name">SEKOLAH YP. TUNAS KARYA</div>
      <div class="receipt-title">Struk Peminjaman Buku Perpustakaan</div>
    </div>
    <div class="top-grid">
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Nomor Struk</span><span class="meta-value">${receiptNumber}</span></div>
        <div class="meta-row"><span class="meta-label">Nama Siswa</span><span class="meta-value">${student ? student.name : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">NIS / Kelas</span><span class="meta-value">${student ? (student.nis || '-') + ' / ' + (student.class || '-') : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Pinjam</span><span class="meta-value">${borrowDate ? new Date(borrowDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></div>
        <div class="meta-row"><span class="meta-label">Tanggal Jatuh Tempo</span><span class="meta-value">${dueDate ? new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span></div>
      </div>
      <div class="qr-side">
        <div class="code-label">QR CODE (SCAN UNTUK PENGEMBALIAN)</div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR ${receiptNumber}" class="qr-image" />` : `<div style="padding: 20px; background: #fee2e2; border-radius: 4px; color: #991b1b; font-size: 10px;">⚠️ QR tidak dapat ditampilkan</div>`}
        <div class="qr-text">${receiptNumber}</div>
        <div class="qr-hint">Simpan kode ini untuk pengembalian buku</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Judul Buku</th>
          <th>Kode</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it, idx) => 
          `<tr>
            <td>${idx + 1}</td>
            <td>${it.title || '-'}</td>
            <td>${it.code || '-'}</td>
          </tr>`
        ).join('')}
      </tbody>
    </table>
    <div class="summary" style="margin-top: 14px; padding: 12px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border: 2px solid #cbd5e1; border-radius: 6px;">
      <div class="summary-row">
        <span class="summary-label">Jumlah Buku</span>
        <span class="summary-value">${items.length} Buku</span>
      </div>
    </div>
    <div class="sign-row">
      <div class="sign-box">
        <span class="sign-label">Siswa</span>
        <div class="sign-line">${student ? student.name : '_____________________'}</div>
      </div>
      <div class="sign-box">
        <span class="sign-label">${officerTitle}</span>
        <div class="sign-line">${officerName}</div>
      </div>
    </div>
    <div class="footer">
      Harap kembalikan buku tepat waktu dan dalam kondisi baik
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[BORROW RECEIPT ERROR]', err);
    res.status(500).send(`<html><body><h1>Gagal membuat struk peminjaman</h1><p>Error: ${err.message}</p><pre>${err.stack}</pre></body></html>`);
  }
});



// Export transactions to Excel
router.get('/export', auth(['admin', 'officer', 'principal']), async (req, res) => {
  try {
    const snap = await transactionsCol.orderBy('borrowDate', 'desc').limit(1000).get();
    const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Get all students and books for lookup
    const [studentsSnap, booksSnap] = await Promise.all([
      studentsCol.get(),
      booksCol.get()
    ]);
    
    const studentsMap = {};
    studentsSnap.docs.forEach((d) => {
      studentsMap[d.id] = d.data();
    });
    
    const booksMap = {};
    booksSnap.docs.forEach((d) => {
      booksMap[d.id] = d.data();
    });
    
    // Fetch all transaction items in parallel batches of 30 transaction IDs
    const txIds = transactions.map(tx => tx.id);
    const batchSize = 30;
    const txItemsPromises = [];
    for (let i = 0; i < txIds.length; i += batchSize) {
      const batchIds = txIds.slice(i, i + batchSize);
      txItemsPromises.push(txItemsCol.where('transactionId', 'in', batchIds).get());
    }
    const txItemsSnaps = await Promise.all(txItemsPromises);
    
    // Group transaction items by transactionId
    const txItemsMap = {};
    txItemsSnaps.forEach(snap => {
      snap.docs.forEach(doc => {
        const item = doc.data();
        if (!txItemsMap[item.transactionId]) {
          txItemsMap[item.transactionId] = [];
        }
        txItemsMap[item.transactionId].push(item);
      });
    });

    // Extract all unique itemIds
    const allItemIds = [...new Set(
      Object.values(txItemsMap)
        .flat()
        .map(txItem => txItem.itemId)
        .filter(Boolean)
    )];

    // Fetch all items in parallel
    const itemDocs = allItemIds.length > 0
      ? await Promise.all(allItemIds.map(itemId => itemsCol.doc(itemId).get()))
      : [];

    const itemsMap = {};
    itemDocs.forEach(doc => {
      if (doc.exists) {
        itemsMap[doc.id] = doc.data();
      }
    });

    const data = [];
    for (const tx of transactions) {
      const student = studentsMap[tx.studentId] || {};
      const txItems = txItemsMap[tx.id] || [];
      
      if (txItems.length === 0) {
        // Transaction without items
        data.push({
          No: data.length + 1,
          'ID Pinjam': tx.receiptNumber || tx.id,
          'NIS/NIM': student.nis || '-',
          Nama: student.name || '-',
          'ID Buku': '-',
          'Judul Buku': '-',
          'Tgl Pinjam': tx.borrowDate ? new Date(tx.borrowDate).toLocaleDateString('id-ID') : '-',
          'Tgl Kembali': tx.returnDate ? new Date(tx.returnDate).toLocaleDateString('id-ID') : '-',
          Status: tx.status || '-'
        });
      } else {
        // Transaction with items
        for (const txItem of txItems) {
          const item = itemsMap[txItem.itemId] || {};
          const book = booksMap[item.bookId] || {};
          
          data.push({
            No: data.length + 1,
            'ID Pinjam': tx.receiptNumber || tx.id,
            'NIS/NIM': student.nis || '-',
            Nama: student.name || '-',
            'ID Buku': item.uniqueCode || '-',
            'Judul Buku': book.title || '-',
            'Tgl Pinjam': tx.borrowDate ? new Date(tx.borrowDate).toLocaleDateString('id-ID') : '-',
            'Tgl Kembali': tx.returnDate ? new Date(tx.returnDate).toLocaleDateString('id-ID') : '-',
            Status: tx.status || '-'
          });
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Peminjaman Buku');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-peminjaman.xlsx');
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to export transactions' });
  }
});

module.exports = router;

