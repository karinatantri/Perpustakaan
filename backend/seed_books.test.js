const test = require('node:test');
const assert = require('node:assert/strict');
const { seedBooks } = require('./seed_books');

test('seed creates both borrowing policies and preserves existing data on rerun', async () => {
  const documents = new Map([['books/existing', { title: 'Buku lama' }]]);
  const db = {
    collection: (name) => ({ doc: (id) => `${name}/${id}` }),
    runTransaction: async (callback) => {
      const pending = [];
      const result = await callback({
        get: async (ref) => ({ exists: documents.has(ref) }),
        create: (ref, data) => pending.push([ref, data])
      });
      for (const [ref] of pending) assert.equal(documents.has(ref), false);
      for (const [ref, data] of pending) documents.set(ref, data);
      return result;
    }
  };
  assert.deepEqual(await seedBooks(db), { created: 4, skipped: 0, itemsCreated: 8 });
  const books = [...documents].filter(([ref]) => ref.startsWith('books/contoh-'));
  assert.equal(books.filter(([, book]) => book.isBorrowable).length, 2);
  assert.equal(books.filter(([, book]) => !book.isBorrowable).length, 2);
  for (const [ref, book] of books) {
    const id = ref.slice('books/'.length);
    assert.equal([...documents.values()].filter((item) => item.bookId === id).length, book.totalCopies);
  }
  documents.get('books/contoh-buku-pelajaran').totalCopies = 2;
  documents.get('items/contoh-buku-pelajaran-1').status = 'borrowed';
  const before = JSON.stringify([...documents]);
  assert.deepEqual(await seedBooks(db), { created: 0, skipped: 4, itemsCreated: 0 });
  assert.equal(JSON.stringify([...documents]), before);
});
