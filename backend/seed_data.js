const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const { getFirestore } = require('./src/firebase');

const db = getFirestore();
const studentsCol = db.collection('students');
const booksCol = db.collection('books');
const itemsCol = db.collection('items');
const transactionsCol = db.collection('transactions');
const txItemsCol = db.collection('transaction_items');

// 1. Mock Students
const mockStudents = [
  { nis: '1001', name: 'Aditya Saputra', class: 'XI OTKP 1', gender: 'L' },
  { nis: '1002', name: 'Dewi Lestari', class: 'XI AKL 2', gender: 'P' },
  { nis: '1003', name: 'Budi Santoso', class: 'XII Perhotelan', gender: 'L' },
  { nis: '1004', name: 'Siti Rahma', class: 'X Tata Boga 2', gender: 'P' },
  { nis: '1005', name: 'Fajar Nugroho', class: 'XII AKL 1', gender: 'L' },
  { nis: '1006', name: 'Rini Amalia', class: 'XI OTKP 2', gender: 'P' },
  { nis: '1007', name: 'Hendra Wijaya', class: 'X Perhotelan 1', gender: 'L' },
  { nis: '1008', name: 'Anisa Putri', class: 'XII Tata Boga 1', gender: 'P' }
];

// 2. Mock Books
const mockBooks = [
  { title: 'Matematika Kelas XI', author: 'Dr. Suparman', category: 'Pelajaran', year: '2021', publisher: 'Erlangga', location: 'Rak A-1', totalCopies: 5 },
  { title: 'Laskar Pelangi', author: 'Andrea Hirata', category: 'Fiksi', year: '2005', publisher: 'Bentang Pustaka', location: 'Rak B-3', totalCopies: 3 },
  { title: 'Belajar Javascript Modern', author: 'Rian Prasetyo', category: 'Teknologi', year: '2023', publisher: 'Informatika', location: 'Rak C-2', totalCopies: 4 },
  { title: 'Pengantar Akuntansi dasar', author: 'Sri Wahyuni', category: 'Pelajaran', year: '2020', publisher: 'Salemba Empat', location: 'Rak A-3', totalCopies: 3 },
  { title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer', category: 'Fiksi', year: '1980', publisher: 'Hasta Mitra', location: 'Rak B-1', totalCopies: 2 },
  { title: 'Manajemen Perkantoran Praktis', author: 'M. Dahlan', category: 'Pelajaran', year: '2019', publisher: 'Erlangga', location: 'Rak A-2', totalCopies: 3 }
];

async function clearCollection(colRef) {
  const snap = await colRef.get();
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

async function clearStudentUsers() {
  const snap = await db.collection('users').where('role', '==', 'student').get();
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    // Also skip deleting the default generic 'siswa' user
    if (doc.data().username !== 'siswa') {
      batch.delete(doc.ref);
    }
  });
  await batch.commit();
}

async function seed() {
  try {
    console.log('Clearing existing mock data (students, books, items, transactions, transaction_items)...');
    await clearCollection(studentsCol);
    await clearCollection(booksCol);
    await clearCollection(itemsCol);
    await clearCollection(transactionsCol);
    await clearCollection(txItemsCol);
    await clearStudentUsers();
    console.log('✓ Collections cleared successfully.');

    const now = new Date().toISOString();

    // 1. Seed Students
    console.log('Seeding students and user accounts...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const usersCol = db.collection('users');

    const studentIds = [];
    const studentNisMap = {};
    for (const s of mockStudents) {
      const docRef = await studentsCol.add({
        ...s,
        createdAt: now,
        updatedAt: now
      });
      studentIds.push(docRef.id);
      studentNisMap[s.nis] = docRef.id;

      // Auto-create a student user account
      await usersCol.add({
        username: s.nis,
        password: hashedPassword,
        role: 'student',
        name: s.name,
        studentId: docRef.id,
        createdAt: now,
        updatedAt: now
      });

      console.log(`  - Student created: ${s.name} (${s.nis}) & user account added`);
    }

    // 2. Seed Books and Items (copies)
    console.log('Seeding books and items...');
    const bookList = []; // stores { bookId, itemIds: [] }
    let bookIndex = 1;
    for (const b of mockBooks) {
      const bookRef = await booksCol.add({
        title: b.title,
        author: b.author,
        category: b.category,
        year: b.year,
        publisher: b.publisher,
        location: b.location,
        totalCopies: b.totalCopies,
        coverUrl: '',
        createdAt: now,
        updatedAt: now
      });

      const itemIds = [];
      // Generate items for this book
      for (let i = 1; i <= b.totalCopies; i++) {
        const uniqueCode = `BK-${String(bookIndex).padStart(3, '0')}-${i}`;
        const itemRef = await itemsCol.add({
          bookId: bookRef.id,
          uniqueCode,
          status: 'available', // default status
          createdAt: now,
          updatedAt: now
        });
        itemIds.push(itemRef.id);
      }

      bookList.push({ bookId: bookRef.id, title: b.title, itemIds });
      console.log(`  - Book created: ${b.title} (${b.totalCopies} copies)`);
      bookIndex++;
    }

    // 3. Seed Transactions
    console.log('Seeding transactions...');
    
    // Setup time offsets for transactions
    const parseDateOffset = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString();
    };

    // A. Completed borrow: आदित्य (1001) borrowed Erlangga Math, returned it.
    const student1 = studentIds[0]; // Aditya
    const book1 = bookList[0]; // Matematika Kelas XI
    const itemId1 = book1.itemIds[0];
    
    const txRef1 = transactionsCol.doc();
    await txRef1.set({
      studentId: student1,
      officerId: 'seed-officer',
      officerName: 'Petugas Utama',
      officerTitle: 'Kepala Perpustakaan',
      type: 'borrow',
      borrowDate: parseDateOffset(-10), // 10 days ago
      dueDate: parseDateOffset(-3),     // due 3 days ago
      returnDate: parseDateOffset(-4),   // returned 4 days ago (on time!)
      status: 'completed',
      receiptNumber: `TX-${Date.now()}-1`,
      createdAt: parseDateOffset(-10),
      updatedAt: parseDateOffset(-4)
    });
    await txItemsCol.add({
      transactionId: txRef1.id,
      itemId: itemId1,
      condition: 'good',
      fine: 0,
      notes: 'Dikembalikan dalam kondisi rapi.',
      createdAt: parseDateOffset(-10),
      updatedAt: parseDateOffset(-4)
    });
    // Set item status back to available
    await itemsCol.doc(itemId1).update({ status: 'available' });
    console.log('  - Transaction created: Aditya returned Mathematics.');

    // B. Ongoing borrow: Dewi (1002) borrowed Laskar Pelangi (ongoing)
    const student2 = studentIds[1]; // Dewi
    const book2 = bookList[1]; // Laskar Pelangi
    const itemId2 = book2.itemIds[0];

    const txRef2 = transactionsCol.doc();
    await txRef2.set({
      studentId: student2,
      officerId: 'seed-officer',
      officerName: 'Petugas Utama',
      officerTitle: 'Kepala Perpustakaan',
      type: 'borrow',
      borrowDate: parseDateOffset(-2), // 2 days ago
      dueDate: parseDateOffset(5),     // due in 5 days
      returnDate: null,
      status: 'ongoing',
      receiptNumber: `TX-${Date.now()}-2`,
      createdAt: parseDateOffset(-2),
      updatedAt: parseDateOffset(-2)
    });
    await txItemsCol.add({
      transactionId: txRef2.id,
      itemId: itemId2,
      condition: 'good',
      fine: 0,
      notes: '',
      createdAt: parseDateOffset(-2),
      updatedAt: parseDateOffset(-2)
    });
    // Update item status to borrowed
    await itemsCol.doc(itemId2).update({ status: 'borrowed' });
    console.log('  - Transaction created: Dewi currently borrowing Laskar Pelangi.');

    // C. Overdue borrow: Budi (1003) borrowed Javascript Modern, currently overdue!
    const student3 = studentIds[2]; // Budi
    const book3 = bookList[2]; // Javascript Modern
    const itemId3 = book3.itemIds[0];

    const txRef3 = transactionsCol.doc();
    await txRef3.set({
      studentId: student3,
      officerId: 'seed-officer',
      officerName: 'Petugas Utama',
      officerTitle: 'Kepala Perpustakaan',
      type: 'borrow',
      borrowDate: parseDateOffset(-12), // 12 days ago
      dueDate: parseDateOffset(-5),     // due 5 days ago (OVERDUE!)
      returnDate: null,
      status: 'ongoing',
      receiptNumber: `TX-${Date.now()}-3`,
      createdAt: parseDateOffset(-12),
      updatedAt: parseDateOffset(-12)
    });
    await txItemsCol.add({
      transactionId: txRef3.id,
      itemId: itemId3,
      condition: 'good',
      fine: 0,
      notes: '',
      createdAt: parseDateOffset(-12),
      updatedAt: parseDateOffset(-12)
    });
    await itemsCol.doc(itemId3).update({ status: 'borrowed' });
    console.log('  - Transaction created: Budi has OVERDUE Javascript Book.');

    // D. Problem Pending borrow: Siti (1004) returned Basic Accounting late, has pending fine
    const student4 = studentIds[3]; // Siti
    const book4 = bookList[3]; // Pengantar Akuntansi
    const itemId4 = book4.itemIds[0];

    const txRef4 = transactionsCol.doc();
    await txRef4.set({
      studentId: student4,
      officerId: 'seed-officer',
      officerName: 'Petugas Utama',
      officerTitle: 'Kepala Perpustakaan',
      type: 'borrow',
      borrowDate: parseDateOffset(-15),
      dueDate: parseDateOffset(-8),
      returnDate: parseDateOffset(-2), // returned 2 days ago (6 days late!)
      status: 'has_problem_pending', // pending fine payment
      receiptNumber: `TX-${Date.now()}-4`,
      createdAt: parseDateOffset(-15),
      updatedAt: parseDateOffset(-2)
    });
    await txItemsCol.add({
      transactionId: txRef4.id,
      itemId: itemId4,
      condition: 'good',
      fine: 3000, // Late fee 3000
      notes: 'Terlambat 6 hari.',
      createdAt: parseDateOffset(-15),
      updatedAt: parseDateOffset(-2)
    });
    // Set item back to available because returned
    await itemsCol.doc(itemId4).update({ status: 'available' });
    console.log('  - Transaction created: Siti returned Accounting book late, fine pending.');

    console.log('Seeding database completely finished!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal Seeding Error:', err);
    process.exit(1);
  }
}

seed();
