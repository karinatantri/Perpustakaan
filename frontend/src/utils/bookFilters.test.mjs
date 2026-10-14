import test from 'node:test';
import assert from 'node:assert/strict';
import { filterBooks, bookFilterOptions } from './bookFilters.mjs';

const books = [
  { id: 'a', title: 'Sains 2', category: ' Referensi ', location: 'Rak A', publisher: 'Pustaka', year: 2020, isBorrowable: false, totalCopies: 3, availableCopies: 0 },
  { id: 'b', title: 'Cerita', category: 'Fiksi', location: 'Rak B', publisher: 'Pustaka', year: '2024', totalCopies: 2 },
  { id: 'c', title: 'Sains 10', category: 'referensi', location: 'Rak A', publisher: 'Sekolah', year: '2023', isBorrowable: true, stock: 1 }
];
const ids = (options) => filterBooks(books, options).map((book) => book.id);

test('search handles publisher, numeric years, spaces and multiple terms', () => {
  assert.deepEqual(ids({ search: '  PUSTAKA   2020 ' }), ['a']);
  assert.deepEqual(ids({ search: 'rak a sains' }), ['a', 'c']);
});
test('filters combine and legacy books remain borrowable', () => {
  assert.deepEqual(ids({ category: 'referensi', location: 'rak a', borrowing: 'allowed', stock: 'available' }), ['c']);
  assert.deepEqual(ids({ borrowing: 'restricted', stock: 'empty' }), ['a']);
  assert.deepEqual(ids({ borrowing: 'allowed' }), ['b', 'c']);
  assert.deepEqual(ids({ category: 'fiksi', borrowing: 'restricted' }), []);
});
test('zero available copies overrides total copies', () => {
  assert.deepEqual(ids({ stock: 'empty' }), ['a']);
});
test('sort uses numeric title order and does not mutate input', () => {
  assert.deepEqual(ids({ sort: 'title-desc' }), ['c', 'a', 'b']);
  assert.deepEqual(ids({ sort: 'year-desc' }), ['b', 'c', 'a']);
  assert.deepEqual(books.map((book) => book.id), ['a', 'b', 'c']);
});
test('options merge case and whitespace differences and omit missing values', () => {
  assert.deepEqual(bookFilterOptions([...books, {}], 'category').map(([value]) => value), ['fiksi', 'referensi']);
});
