export const normalizeBookText = (value) => String(value ?? '').trim().toLocaleLowerCase('id-ID');

export function bookFilterOptions(books, field) {
  const options = new Map();
  for (const book of books) {
    const label = String(book[field] ?? '').trim();
    if (label) options.set(normalizeBookText(label), label);
  }
  return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'id', { numeric: true }));
}

export function filterBooks(books, { search = '', category = '', location = '', borrowing = '', stock = '', sort = 'title-asc' } = {}) {
  const terms = normalizeBookText(search).split(/\s+/).filter(Boolean);
  const result = books.filter((book) => {
    const text = [book.title, book.author, book.category, book.location, book.publisher, book.year, book.id]
      .map(normalizeBookText).join(' ');
    const available = Number(book.availableCopies ?? book.stock ?? book.totalCopies ?? 0);
    return terms.every((term) => text.includes(term))
      && (!category || normalizeBookText(book.category) === category)
      && (!location || normalizeBookText(book.location) === location)
      && (!borrowing || (borrowing === 'allowed' ? book.isBorrowable !== false : book.isBorrowable === false))
      && (!stock || (stock === 'available' ? available > 0 : available <= 0));
  });
  return result.sort((a, b) => {
    const titleOrder = String(a.title ?? '').localeCompare(String(b.title ?? ''), 'id', { numeric: true, sensitivity: 'base' });
    if (sort === 'title-desc') return -titleOrder;
    if (sort === 'year-desc') return (Number(b.year) || 0) - (Number(a.year) || 0) || titleOrder;
    return titleOrder;
  });
}
