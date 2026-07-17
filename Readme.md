# 📚 Perpustakaan

Aplikasi perpustakaan berbasis web yang digunakan untuk mengelola data buku, inventaris, serta proses peminjaman dan pengembalian. Sistem ini dibangun dengan arsitektur terpisah antara frontend dan backend agar lebih fleksibel dan mudah dikembangkan.

## 🚀 Fitur Utama

- Manajemen data buku
- Manajemen inventaris
- Peminjaman dan pengembalian
- Scan QR Code
- Autentikasi pengguna
- Ekspor data

## 🛠️ Teknologi

### Frontend
- React (Vite)
- React Router
- QR Code Scanner

### Backend
- Node.js
- Express
- Firebase Admin
- JWT Authentication

## 📂 Struktur Project

```bash
perpustakaan/
├── backend/     # API dan server
├── frontend/    # Tampilan web (React + Vite)
└── vercel.json  # Konfigurasi deployment Vercel