const API_BASE = 'http://localhost:4000/api';

let authToken = localStorage.getItem('token') || '';
let currentUser = localStorage.getItem('user');
if (currentUser) {
  try {
    currentUser = JSON.parse(currentUser);
  } catch {
    currentUser = null;
  }
}

function setLoggedIn(user, token) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('user-info').textContent = `${user.username} (${user.role})`;
  showPage('dashboard');
  loadDashboard();
}

function logout() {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  document.getElementById('login-overlay').classList.remove('hidden');
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((el) => {
    el.classList.toggle('hidden', el.id !== `page-${pageId}`);
  });
}

async function loadStudents(query = '') {
  try {
    const q = query ? `?search=${encodeURIComponent(query)}` : '';
    const data = await apiGet(`/students${q}`);
    const tbody = document.getElementById('student-table-body');
    tbody.innerHTML = '';
    data.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-2 py-1 border-b">${s.nis || ''}</td>
        <td class="px-2 py-1 border-b">${s.name || ''}</td>
        <td class="px-2 py-1 border-b">${s.class || ''}</td>
        <td class="px-2 py-1 border-b">${s.major || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadBooks() {
  try {
    const data = await apiGet('/books');
    const tbody = document.getElementById('books-table-body');
    tbody.innerHTML = '';
    data.forEach((b) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-2 py-1 border-b">${b.title || ''}</td>
        <td class="px-2 py-1 border-b">${b.author || ''}</td>
        <td class="px-2 py-1 border-b">${b.category || ''}</td>
        <td class="px-2 py-1 border-b">${b.totalCopies || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadTransactions() {
  try {
    const data = await apiGet('/transactions');
    const tbody = document.getElementById('tx-table-body');
    tbody.innerHTML = '';
    data.forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-2 py-1 border-b">${t.borrowDate || ''}</td>
        <td class="px-2 py-1 border-b">${t.studentId || ''}</td>
        <td class="px-2 py-1 border-b">${t.status || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

function loadDashboard() {
  // Placeholder: bisa diisi dengan ringkasan dari endpoint khusus
}

// Event listeners
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      showPage(page);
      if (page === 'students') loadStudents();
      if (page === 'books') loadBooks();
      if (page === 'transactions') loadTransactions();
    });
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
      const res = await apiPost('/auth/login', { username, password });
      setLoggedIn(res.user, res.token);
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Login gagal. Periksa username/password.';
    }
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  document.getElementById('btn-refresh-students').addEventListener('click', () => loadStudents());
  document.getElementById('btn-refresh-books').addEventListener('click', () => loadBooks());

  document.getElementById('student-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    loadStudents(q);
  });

  if (authToken && currentUser) {
    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('user-info').textContent = `${currentUser.username} (${currentUser.role})`;
    showPage('dashboard');
    loadDashboard();
  } else {
    document.getElementById('login-overlay').classList.remove('hidden');
  }
});


