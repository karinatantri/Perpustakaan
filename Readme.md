# 📚 Sistem Informasi Perpustakaan & Inventaris Sekolah (YP Tunas Karya)

Sistem Informasi Perpustakaan & Inventaris Barang Sekolah adalah aplikasi *full-stack* terintegrasi yang dirancang khusus untuk mengelola operasional perpustakaan sekolah (katalog buku, pemisahan eksemplar fisik, sirkulasi peminjaman/pengembalian, kalkulator denda otomatis, generator Surat Peringatan keterlambatan) serta inventarisasi aset barang umum sekolah (alat tulis, barang habis pakai, media pembelajaran, dan perangkat elektronik).

Aplikasi dibangun menggunakan arsitektur **Decoupled (Client-Server)** dan berkemampuan **Multi-Platform**. Sistem dapat diakses melalui aplikasi Web responsif, Progressive Web App (PWA), maupun aplikasi Mobile Android Native (menggunakan Ionic Capacitor).

---

## 🏗️ Arsitektur Sistem (System Architecture)

Aplikasi ini mengadopsi pola arsitektur *Client-Server RESTful API* terpisah (*Decoupled Monorepo*), di mana frontend mengelola antarmuka pengguna interaktif dan backend menangani logika bisnis, otentikasi, serta integrasi layanan *Cloud*.

```mermaid
flowchart TD
    subgraph Clients["📱 Client Layer (Frontend)"]
        WebBrowser["🌐 Web App (Vite + React.js)"]
        PWA["📲 PWA (Mobile Browser)"]
        APK["📱 Android Native (Capacitor)"]
    end

    subgraph CDN["🚀 Deployment & Hosting Infrastructure"]
        Vercel["Vercel (Fullstack Serverless API & Static Web)"]
        Netlify["Netlify (Static Web Hosting & Functions)"]
        Railway["Railway (Node.js Express Backend Service)"]
    end

    subgraph Server["⚡ Backend Engine (Node.js & Express REST API)"]
        API["Express.js Core Engine"]
        AuthMiddleware["JWT Auth & Role-Based Authorization"]
        Routes["API Controllers (Books, Items, Transactions, Students, Inventories, Notifications, Users)"]
    end

    subgraph Services["☁️ Cloud Services & Persistence"]
        Firestore["🔥 Google Firebase Firestore (Cloud NoSQL Database)"]
        Cloudinary["☁️ Cloudinary Storage (Book Covers & Student QR Codes)"]
        FCM["🔔 Firebase Cloud Messaging (Push Notifications)"]
    end

    Clients --> CDN
    CDN --> API
    API --> AuthMiddleware
    AuthMiddleware --> Routes
    Routes --> Firestore
    Routes --> Cloudinary
    Routes --> FCM
```

---

## ⭐ Fitur Utama & Keunggulan Sistem

### 📚 1. Penggabungan Data Buku & Barang Inventaris (Single Page Tab Panel)
- Integrated Management Page (`BooksPage.jsx`) yang menyatukan katalog buku dan inventaris barang sekolah ke dalam satu antarmuka terpadu berbasis tab panel.
- Pengelolaan eksemplar fisik buku secara terpisah dengan kode unik (`uniqueCode`) dan QR Code khusus.
- Generator dan detektor QR Code pintar untuk eksemplar buku (`BOOK-...`) dan barang inventaris (`INV-...`).

### 📦 2. Sinkronisasi Stok Real-Time & Audit Notifikasi
- Perhitungan stok otomatis (`availableCopies` & `totalCopies`) secara real-time yang ter-update saat peminjaman maupun pengembalian buku.
- **Pusat Notifikasi Audit Stok:** Setiap penambahan, pengurangan, maupun penghapusan stok buku atau barang mencatat nama petugas, jumlah, item target, dan stempel waktu (*timestamp*) bahasa Indonesia ke dalam database Firestore dan ditampilkan pada 🔔 Notifications Drawer.

### 📋 3. Sirkulasi Peminjaman & Pengembalian Buku Interaktif
- **Multi-Search Loan Return (`ReturnPage.jsx`):** Tab *Scan Kode Peminjaman* dilengkapi dropdown pencarian transaksi aktif (`ongoing` / `partially_returned`) berbasis Kode TX, Nama Siswa, atau NIS.
- **Deteksi Pemindai QR Code:** Pemindai kamera otomatis membedakan antara QR Struk (`TX-...`), QR Kartu Siswa (`SISWA-...`), QR Buku (`BOOK-...`), dan QR Barang (`INV-...`).
- Kuota transaksi peminjaman fleksibel tanpa batasan kaku (*unlimited active loan support*).

### 📜 4. Highlight Visual Keterlambatan & Generator Surat Peringatan
- **Highlight Transaksi Terlambat:** Baris transaksi yang melewati tanggal jatuh tempo secara otomatis di-highlight dengan warna latar merah soft (`#fff5f5`) dan badge `⚠️ TERLAMBAT (X Hari)`.
- **Official Warning Letter Generator (`WarningLetterModal.jsx`):** Tombol **`⚠️ Surat Peringatan`** memicu dokumen resmi **SURAT PERINGATAN KETERLAMBATAN PENGEMBALIAN BUKU** lengkap dengan kop resmi Yayasan Perguruan Tunas Karya, nomor surat resmi, kalkulasi denda (Rp 1.000/hari), dan kolom tanda tangan siap cetak A4/PDF.

### 🧑‍💼 5. Redesain Manajemen Akun & Hak Akses (`AccountsPage.jsx`)
- Tampilan modern dengan 4 Stat Cards ringkasan peranan pengguna.
- Pencarian username (`@username`) & nama lengkap serta filter role terpadu.
- Opsi tampilkan/sembunyikan kata sandi (`👁️/🙈`).
- Badge avatar peranan berwarna (Admin: Merah, Petugas: Hijau Emerald, Guru: Biru, Siswa: Hijau, Kepsek: Amber).
- Penugasan Wali Kelas otomatis bagi pengguna ber-role Guru.

---

## 🛠️ Bahasa Pemrograman & Framework (Stack Teknologi)

### 1. Frontend (Client-Side)
* **Bahasa Pemrograman:** JavaScript (ES6+ / JSX)
* **Framework Utama:** React.js v18
* **Build Tool & Dev Server:** Vite
* **Routing:** React Router Dom v6 untuk navigasi Single Page Application (SPA).
* **HTTP Client:** Axios (Dilengkapi *Request Interceptor* untuk JWT bearer token otomatis dan *Response Interceptor* untuk penanganan error 401 / auto-logout).
* **QR & Barcode Scanner:** Pustaka `html5-qrcode` & `jsqr` untuk mengakses kamera perangkat guna memindai QR Code kartu siswa, barcode buku, dan barang.
* **Integrasi Native Android:** Capacitor JS (`@capacitor/android`, `@capacitor/core`, `@capacitor/push-notifications`, `@capacitor/splash-screen`) untuk pembungkusan (*bridging*) aset web menjadi aplikasi native Android.
* **Desain & Styling:** Vanilla CSS Premium dengan Emerald Green Palette (`#065f46`), Glassmorphism UI, Responsive Grid Layout, dan Micro-Animations.

### 2. Backend (Server-Side)
* **Runtime Environment:** Node.js
* **Framework API:** Express.js (REST API Server)
* **Database:** Firestore (Google Firebase Cloud NoSQL Database via SDK Firebase Admin)
* **Cloud Storage:** Cloudinary (Penyimpanan gambar cover buku dan file QR Code siswa/barang).
* **Keamanan & Otentikasi:** JSON Web Token (JWT) dan Hashing Kata Sandi menggunakan `bcryptjs`.
* **Generator Barcode & QR Code:** Pustaka `bwip-js` & `qrcode` untuk membuat gambar kode respons cepat (QR Code) eksemplar buku, barang, maupun kartu siswa.
* **Manajemen Excel:** Pustaka `xlsx` (SheetJS) untuk parser import masal dan generator ekspor dokumen Excel `.xlsx`.
* **Serverless Adapter:** `serverless-http` untuk kompatibilitas deployment serverless Vercel & Netlify.

---

## 🔑 Level Pengguna & Hak Akses (Role-Based Access Control)

Aplikasi memiliki pembagian otorisasi yang ketat baik pada navigasi Frontend maupun verifikasi endpoint API Backend menggunakan middleware otentikasi ([backend/src/middleware/auth.js](file:///d:/perpustakaan-main/perpustakaan-main/backend/src/middleware/auth.js)):

| Role | Deskripsi & Hak Akses |
| :--- | :--- |
| **Admin (`admin`)** | Akses penuh atas sistem. Melakukan CRUD data siswa, katalog buku, eksemplar, inventaris umum, registrasi akun petugas/guru/siswa, sirkulasi transaksi, serta impor/ekspor data massal. |
| **Officer (`officer`)** | Petugas / Pustakawan. Melayani transaksi peminjaman, memproses pengembalian buku, menghitung denda, mencetak Surat Peringatan, dan mengelola mutasi stok masuk/keluar inventaris umum. |
| **Teacher (`teacher`)** | Guru Sekolah / Wali Kelas. Memantau ketersediaan buku katalog, data siswa wali, dan daftar inventaris barang umum demi kepentingan KBM (*Read-Only* sirkulasi). |
| **Student (`student`)** | Siswa Sekolah. Mengakses portal siswa untuk melihat riwayat peminjaman pribadi, tanggal jatuh tempo, QR Code kartu siswa, dan menerima *push notification*. |
| **Principal (`principal`)** | Kepala Sekolah. Akses *Read-Only* ke seluruh dashboard statistik, laporan transaksi, inventaris barang, serta opsi ekspor laporan riwayat ke Excel. |

---

## 📊 Pemodelan & Diagram Sistem (System Modeling & Diagrams)

### 1. DFD (Data Flow Diagram)

#### A. DFD Level 0 (Context Diagram)
Context Diagram menggambarkan aliran data global antara entitas luar (Aktor) dengan Sistem Informasi Perpustakaan & Inventaris.

```mermaid
flowchart LR
    Admin(("👤 Admin"))
    Petugas(("👤 Officer / Petugas"))
    Guru(("👤 Teacher / Guru"))
    Siswa(("👤 Student / Siswa"))
    Kepsek(("👤 Principal / Kepsek"))

    subgraph System["📚 Sistem Informasi Perpustakaan & Inventaris YP Tunas Karya"]
        Core["Main Application Engine"]
    end

    Admin -- "Input Data Buku, Barang, Siswa, & Akun User" --> Core
    Core -- "Laporan Transaksi, Data Akun, & QR Code" --> Admin

    Petugas -- "Input Peminjaman, Pengembalian, & Mutasi Stok" --> Core
    Core -- "Struk Transaksi, Surat Peringatan, & Notifikasi Audit" --> Petugas

    Guru -- "Request Data Buku & Barang Kelas" --> Core
    Core -- "Katalog Buku & Inventaris Barang" --> Guru

    Siswa -- "Scan Card QR & Request Riwayat Pinjaman" --> Core
    Core -- "Kartu Digital, Riwayat Pinjam, & Push Notification" --> Siswa

    Kepsek -- "Request Laporan Operasional & Statistik" --> Core
    Core -- "Dashboard Analytics & File Ekspor Excel" --> Kepsek
```

---

## 🌐 Rincian Endpoint API Backend (API Reference)

### 1. Otentikasi & Akun (`/api/auth` & `/api/users`)
* `POST /api/auth/login`: Autentikasi pengguna, mengembalikan JWT Token & User Profile.
* `GET /api/users`: Mengambil daftar akun pengguna terdaftar (*Auth: Admin*).
* `POST /api/users`: Membuat akun pengguna baru (*Auth: Admin*).
* `PUT /api/users/:id`: Memperbarui username, nama, role, wali kelas, atau password (*Auth: Admin*).
* `DELETE /api/users/:id`: Menghapus akun pengguna (*Auth: Admin*).

### 2. Data Buku & Eksemplar (`/api/books` & `/api/items`)
* `GET /api/books`: Mengambil seluruh katalog buku lengkap dengan hitungan stok real-time (`stock` & `totalCopies`).
* `POST /api/books`: Menambah buku baru atau menambah stok pada buku yang sudah ada (*Auth: Admin, Officer*).
* `POST /api/books/:id/add-stock`: Menambah stok eksemplar fisik buku (*Auth: Admin, Officer*).
* `POST /api/books/:id/reduce-stock`: Mengurangi stok eksemplar buku (*Auth: Admin, Officer*).
* `DELETE /api/books/:id`: Menghapus buku beserta seluruh eksemplar fisiknya (*Auth: Admin, Officer*).
* `GET /api/books/:id/qr`: Mengambil atau membuat QR Code eksemplar buku.

### 3. Sirkulasi Transaksi (`/api/transactions`)
* `GET /api/transactions`: Mengambil seluruh transaksi peminjaman/pengembalian.
* `POST /api/transactions/borrow`: Membuat transaksi peminjaman baru & mengurangi stok buku (*Auth: Admin, Officer*).
* `POST /api/transactions/return`: Memproses pengembalian buku, menghitung denda, & mengembalikan stok buku (*Auth: Admin, Officer*).
* `GET /api/transactions/by-receipt/:code`: Mengambil detail transaksi berdasarkan kode struk `TX-...`.
* `GET /api/transactions/:id/warning-letter`: Mengambil data resmi Surat Peringatan Keterlambatan.

### 4. Inventaris Barang Sekolah (`/api/inventories`)
* `GET /api/inventories`: Mengambil daftar barang inventaris sekolah.
* `POST /api/inventories`: Menambah barang inventaris baru (*Auth: Admin, Officer*).
* `POST /api/inventories/:id/logs`: Mencatat mutasi stok masuk (`in`) atau keluar (`out`) (*Auth: Admin, Officer*).
* `DELETE /api/inventories/:id`: Menghapus barang dari inventaris (*Auth: Admin, Officer*).

### 5. Audit Notifikasi (`/api/notifications`)
* `GET /api/notifications`: Mengambil 50 notifikasi audit sistem terbaru (penambahan, pengurangan, dan penghapusan stok real-time).

---

## ⚡ Panduan Memulai (Getting Started Guide)

### Langkah 1: Kebutuhan Sistem (Prerequisites)
- **Node.js:** v18.0.0 atau lebih baru.
- **npm:** v9.0.0 atau lebih baru.
- **Google Firebase:** Proyek Firebase dengan Cloud Firestore aktif.

---

### Langkah 2: Konfigurasi Environment Variable (`.env`)

#### Backend Environment (`backend/.env`):
```env
PORT=4000
JWT_SECRET=your_super_secret_jwt_key_here
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

#### Frontend Environment (`frontend/.env`):
```env
VITE_API_URL=http://localhost:4000/api
```

---

### Langkah 3: Menjalankan Server Pengembangan Lokal

1. **Instal & Jalankan Server Backend (Port 4000):**
   ```bash
   cd backend
   npm install
   node seed.js        # Seeding akun awal (admin, petugas, guru, siswa, kepsek)
   npm start           # Jalankan server backend
   ```

2. **Instal & Jalankan Server Frontend Vite (Port 5173):**
   Buka jendela terminal baru:
   ```bash
   cd frontend
   npm install
   npm run dev         # Jalankan server frontend Vite
   ```

3. Akses aplikasi melalui browser di tautan `http://localhost:5173`.

---

## 📱 Membangun Aplikasi Android Native (Capacitor)

Untuk mengompilasi tampilan web frontend menjadi proyek & file `.apk` Android Native:

1. Build aset web frontend terlebih dahulu:
   ```bash
   cd frontend
   npm run build
   ```
2. Sinkronisasikan hasil build web ke proyek Android Native:
   ```bash
   npx cap sync android
   ```
3. (Opsional) Buka proyek Android di Android Studio:
   ```bash
   npx cap open android
   ```

---

## 🌍 Konfigurasi Deployment Produksi

Aplikasi siap dideploy secara otomatis ke platform hosting cloud:

* **Vercel:** Menggunakan berkas [vercel.json](file:///d:/perpustakaan-main/perpustakaan-main/vercel.json) di root directory.
* **Netlify:** Menggunakan berkas [netlify.toml](file:///d:/perpustakaan-main/perpustakaan-main/netlify.toml) untuk meng-host frontend statis dari `frontend/dist`.
* **Railway:** Menggunakan berkas [railway.json](file:///d:/perpustakaan-main/perpustakaan-main/railway.json) untuk menjalankan backend Express Node.js secara persisten.

---

## ⚖️ Lisensi & Hak Cipta

© 2026 YP Tunas Karya - Hak Cipta Dilindungi Undang-Undang. Dikembangkan untuk efisiensi operasional perpustakaan dan inventarisasi aset sekolah.