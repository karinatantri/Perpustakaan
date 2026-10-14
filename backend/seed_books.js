const examples = require('./data/example-books.json');

async function seedBooks(db) {
  const result = { created: 0, skipped: 0, itemsCreated: 0 };
  for (const { id, ...book } of examples) {
    const created = await db.runTransaction(async (transaction) => {
      const bookRef = db.collection('books').doc(id);
      const existing = await transaction.get(bookRef);
      if (existing.exists) return false;

      const now = new Date().toISOString();
      transaction.create(bookRef, {
        ...book, coverUrl: '', createdAt: now, updatedAt: now
      });
      for (let copy = 1; copy <= book.totalCopies; copy++) {
        const uniqueCode = `CONTOH-${id}-${copy}`;
        transaction.create(db.collection('items').doc(`${id}-${copy}`), {
          bookId: id, uniqueCode, barcode: uniqueCode,
          status: 'available', location: book.location,
          inventoryId: null, branchId: '', createdAt: now, updatedAt: now
        });
      }
      return true;
    });
    if (created) {
      result.created++;
      result.itemsCreated += book.totalCopies;
    } else {
      result.skipped++;
    }
  }
  return result;
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
  const { getFirestore } = require('./src/firebase');
  Promise.resolve().then(() => seedBooks(getFirestore())).then((result) => {
    console.log('Seed contoh buku selesai:', result);
    process.exit(0);
  }).catch((error) => {
    console.error('Seed contoh buku gagal:', error.message);
    process.exit(1);
  });
}

module.exports = { seedBooks };
