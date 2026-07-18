# 📚 Perpustakaan & Inventaris Sekolah (YP Tunas Karya)

Sistem Informasi Perpustakaan & Inventaris Barang Sekolah adalah aplikasi full-stack terintegrasi yang dirancang untuk mengelola operasional perpustakaan sekolah (buku, katalog, sirkulasi peminjaman/pengembalian, denda keterlambatan) serta inventarisasi aset barang umum sekolah (alat tulis, barang elektronik, dsb.).

Aplikasi ini menggunakan arsitektur **decoupled (client-server)** dan dikembangkan dengan kapabilitas **Multi-platform**. Pengguna dapat mengakses sistem ini melalui aplikasi Web responsif, Progressive Web App (PWA), maupun aplikasi Mobile Android Native (menggunakan Capacitor).

---

## 🛠️ Bahasa Pemrograman & Framework (Stack Teknologi)

Aplikasi dibangun menggunakan teknologi modern untuk menjamin kecepatan, performa, dan kemudahan pengembangan:

### 1. Frontend (Client-Side)
* **Bahasa Pemrograman:** JavaScript (ES6+ / JSX)
* **Framework Utama:** React.js v18
* **Build System & Dev Server:** Vite
* **Routing:** React Router Dom v6 untuk navigasi client-side SPA.
* **HTTP Client:** Axios (dilengkapi Request Interceptor untuk menyematkan token JWT secara otomatis pada header `Authorization` dan Response Interceptor untuk pembersihan sesi/auto-logout otomatis jika server mengembalikan status 401 Unauthorized).
* **QR & Barcode Scanner:** Integrasi pustaka `html5-qrcode` & `jsqr` guna mengakses kamera perangkat secara langsung untuk proses pemindaian kartu siswa dan barcode buku.
* **Integrasi Native Android:** Capacitor JS untuk pembungkusan (bridging) aset web menjadi aplikasi native Android, lengkap dengan splash screen dan push notifications.
* **Desain & UI:** Vanilla CSS Premium ([frontend/src/styles.css](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/frontend/src/styles.css)) dengan sistem grid, tata letak modern (glassmorphism/sleek dashboard), mikro-animasi pada komponen tombol, card statis, serta dialog modal interaktif.

### 2. Backend (Server-Side)
* **Runtime Environment:** Node.js
* **Framework API:** Express.js (REST API Server)
* **Database:** Firestore (Google Firebase Cloud NoSQL Database via SDK Firebase Admin)
* **Media & Cloud Storage:** Cloudinary (digunakan untuk mengunggah dan menyimpan gambar cover buku serta file gambar QR Code siswa/eksemplar yang digenerate oleh server).
* **Keamanan & Autentikasi:** JSON Web Token (JWT) untuk sesi login yang aman dan `bcryptjs` untuk enkripsi (hashing) kata sandi pengguna di database.
* **Generator Barcode & QR Code:** Pustaka `bwip-js` & `qrcode` untuk membuat gambar kode respons cepat (QR Code) eksemplar buku maupun kartu siswa dengan tingkat koreksi kesalahan (Error Correction Level M).
* **Manajemen Dokumen & Excel:** `xlsx` (SheetJS) untuk mengekstrak data dari lembar Excel saat proses import massal serta menyusun dokumen Excel dinamis saat ekspor laporan.
* **Serverless Adapter:** `serverless-http` yang membungkus aplikasi Express agar dapat dieksekusi sebagai Serverless Functions di platform Vercel atau Netlify.

---

## 🔑 Level Pengguna & Hak Akses (Role-Based Access Control)

Aplikasi memiliki pembagian otorisasi yang sangat ketat baik di level navigasi Frontend maupun verifikasi endpoint API Backend menggunakan middleware ([backend/src/middleware/auth.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/middleware/auth.js)):

| Role | Deskripsi & Hak Akses |
| :--- | :--- |
| **Admin (`admin`)** | Pemegang kontrol penuh atas sistem. Dapat melakukan CRUD data siswa, buku, inventaris umum, registrasi akun petugas baru, memproses transaksi peminjaman/pengembalian, serta impor/ekspor data massal. |
| **Officer (`officer`)** | Petugas / Pustakawan. Bertanggung jawab atas sirkulasi sehari-hari: melayani transaksi peminjaman, memproses pengembalian buku, menghitung denda, dan mengelola stok barang masuk/keluar di inventaris umum. |
| **Teacher (`teacher`)** | Guru Sekolah. Dapat memantau ketersediaan buku, inventarisasi barang umum, serta logs keluar-masuk barang demi kepentingan pembelajaran, tanpa akses mutasi data sirkulasi buku. |
| **Student (`student`)** | Siswa Sekolah. Dapat masuk ke portal siswa untuk memantau buku apa saja yang sedang mereka pinjam, melihat histori pinjaman pribadi, meninjau tanggal jatuh tempo, dan menerima notifikasi push. |
| **Principal (`principal`)** | Kepala Sekolah. Akses *Read-Only* ke seluruh dashboard laporan, statistik peminjaman, data inventaris, serta opsi ekspor laporan riwayat ke Excel untuk proses pengawasan. |

---

## 🚀 Fitur Utama & Cara Kerja Sistem

### A. Fitur Manajemen Perpustakaan (Library Management)
1. **Pemisahan Buku & Eksemplar Fisik (Copies)**
   * Sistem membedakan data katalog utama buku ([backend/src/routes/books.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/routes/books.js)) dengan unit fisik buku (eksemplar / items) ([backend/src/routes/items.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/routes/items.js)).
   * Satu judul buku bisa memiliki banyak eksemplar fisik yang masing-masing memiliki kode unik buatan sistem (contoh: `BK-001-1`, `BK-001-2`, `BK-001-3`).
   * Status setiap eksemplar dipantau secara real-time: `available` (tersedia), `borrowed` (dipinjam), `lost` (hilang), atau `damaged` (rusak).
2. **Kartu Anggota Digital & QR Code Siswa**
   * Pendaftaran siswa baru ([backend/src/routes/students.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/routes/students.js)) otomatis memicu generator QR Code berbasis NIS (Nomor Induk Siswa).
   * QR Code diunggah langsung ke Cloudinary dan disematkan pada data siswa. Petugas dapat mengunduh serta mencetak kartu anggota fisik berisi QR Code tersebut.
3. **Alur Peminjaman Instan (Borrow Workflow)**
   * Siswa menunjukkan Kartu Anggota Fisik/Digital. Petugas memindai QR Code kartu tersebut via kamera laptop/HP.
   * Petugas memindai barcode/QR Code yang tertempel pada eksemplar fisik buku.
   * Transaksi disimpan ke Firestore dalam satu kesatuan batch terproteksi (Firestore Transaction) untuk menjaga konsistensi stok dan status eksemplar.
   * Sistem mengirimkan **Push Notification** real-time ke akun siswa menggunakan Firebase Cloud Messaging (FCM) berisi informasi tanggal peminjaman dan batas waktu kembali.
   * Petugas dapat mengunduh atau mencetak struk peminjaman digital.
4. **Alur Pengembalian & Kalkulator Denda (Return Workflow)**
   * Petugas mencari transaksi peminjaman aktif dengan memindai struk transaksi atau mencari nama/NIS siswa ([backend/src/routes/transactions.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/routes/transactions.js)).
   * Petugas memeriksa kondisi fisik buku saat diserahkan (`good`, `damaged`, `lost`).
   * Sistem secara otomatis menghitung durasi keterlambatan berdasarkan tanggal jatuh tempo dan mengalikan dengan tarif denda yang berlaku.
   * Pembayaran denda tercatat secara dinamis. Jika denda belum lunas, transaksi diubah ke status `has_problem_pending` agar mudah dilacak di kemudian hari.
   * Eksemplar buku otomatis dialihkan kembali ke status `available` (atau `damaged`/`lost` tergantung kondisi akhir).
   * Siswa menerima push notification konfirmasi pengembalian sukses beserta rincian denda (jika ada).

### B. Fitur Manajemen Inventaris Barang Umum (General Assets)
1. **Katalog Barang Non-Buku**
   * Mengelola barang habis pakai (kertas, pulpen, tinta printer) maupun aset sekolah (proyektor, kabel converter) pada database terpisah ([backend/src/routes/inventories.js](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/backend/src/routes/inventories.js)).
2. **Histori Mutasi Stok (Stock Logs)**
   * Mencatat setiap aktivitas penambahan barang masuk (restock) dan barang keluar (dipakai/rusak), lengkap dengan pencatatan nama petugas penanggung jawab dan tujuan pengeluaran.
3. **Threshold Stok Minimum (Stock Alert)**
   * Menampilkan tanda peringatan warna merah pada baris barang jika tingkat persediaan saat ini menyentuh atau berada di bawah batas stok minimum (`minStock`).

### C. Fitur Pendukung Lanjutan
* **Smart PWA Installer Dialog:** Jika diakses via browser HP, aplikasi menampilkan popup dialog instalasi terpandu (khusus safari iOS maupun chrome Android) agar pengguna dapat menyematkan aplikasi ke Home Screen layaknya aplikasi native.
* **Impor Data Massal (Excel Import):** Mempersingkat waktu konfigurasi awal dengan menyediakan template pengunggahan data Buku dan data Siswa secara masif dari file Excel `.xlsx`.
* **Ekspor Laporan Fleksibel:** Seluruh daftar data buku, siswa, maupun log riwayat transaksi dapat diekspor menjadi dokumen Excel yang rapi hanya dalam sekali klik.
* **Pencarian Komprehensif:** Menyediakan kolom filter multi-kategori dan pencarian teks cepat yang berjalan di sisi klien (Vite React) untuk efisiensi loading data.

---

## 📂 Struktur Project

Aplikasi ini dikelola dalam format monorepo terstruktur sebagai berikut:

```bash
perpustakaan/
├── backend/                  # REST API Server (Node.js & Express)
│   ├── api/                  # Entrypoint tambahan untuk deployment serverless
│   ├── src/
│   │   ├── middleware/       # Middleware Express (Autentikasi JWT & Otorisasi Role)
│   │   │   └── auth.js
│   │   ├── routes/           # Endpoint API per modul bisnis
│   │   │   ├── auth.js       # Autentikasi Login Admin/Staff
│   │   │   ├── books.js      # CRUD Katalog & Manajemen Stok Buku
│   │   │   ├── inventories.js# CRUD Aset Barang Sekolah & Logs
│   │   │   ├── items.js      # Manajemen Ketersediaan Eksemplar
│   │   │   ├── students.js   # CRUD & Ekspor-Impor Data Siswa
│   │   │   ├── transactions.js# Logika Inti Sirkulasi Peminjaman & Pengembalian
│   │   │   └── users.js      # CRUD Pengguna Sistem & Token FCM
│   │   ├── utils/            # Helper Utilities
│   │   │   ├── notifications.js# Logika Pengiriman FCM Push Notification
│   │   │   └── qrGenerator.js  # Generator QR Code & Integrasi Cloudinary Upload
│   │   ├── app.js            # Express Initialization & Global Error Handling
│   │   ├── cloudinary.js     # Konfigurasi Koneksi Cloudinary SDK
│   │   ├── firebase.js       # Inisialisasi Firebase Admin SDK & Koneksi Firestore
│   │   └── server.js         # Port Listener untuk local development (Port 4000)
│   ├── .env.example          # Template Environment Variables Backend
│   ├── package.json          # Library & Dependencies Backend
│   ├── seed.js               # Script Seeding Akun Pengguna Default (Role-based)
│   └── seed_data.js          # Script Seeding Data Buku, Siswa, dan Transaksi Dummy
│
├── frontend/                 # Aplikasi Antarmuka (Vite, React & Capacitor)
│   ├── android/              # Folder Project Android Native (Capacitor)
│   ├── public/               # Static assets & Manifest PWA
│   ├── src/
│   │   ├── components/       # Komponen UI global (MainLayout, QrScanner, ReceiptModal)
│   │   ├── pages/            # Komponen halaman utama (Dashboard, Sirkulasi, dsb.)
│   │   ├── utils/            # Helper utilitas frontend
│   │   ├── App.jsx           # Routing client-side & logic PWA installation prompt
│   │   ├── api.js            # Axios client setup, baseUrl resolver, & token interceptor
│   │   ├── main.jsx          # Entry point render React DOM
│   │   └── styles.css        # File CSS kustom (Desain UI responsif & layout modern)
│   ├── capacitor.config.json # Konfigurasi Aplikasi Android Native Capacitor
│   ├── vite.config.mjs       # Konfigurasi build Vite, https certs, & API proxy server
│   └── package.json          # Library & Dependencies Frontend
│
├── vercel.json               # Konfigurasi Deploy Monorepo ke Vercel (API & Static Routing)
├── railway.json              # Konfigurasi Build & Run Backend ke Railway
└── netlify.toml              # Konfigurasi Build & Redirect Routing ke Netlify
```

---

## 🚀 Panduan Memulai & Pengembangan Lokal

Ikuti langkah-langkah di bawah ini untuk menjalankan project di komputer lokal Anda:

### Prerequisites (Prasyarat)
Pastikan Anda sudah menginstal:
* [Node.js](https://nodejs.org/) (versi 16 atau lebih tinggi)
* Akun Firebase (dengan database **Firestore** aktif)
* Akun Cloudinary (untuk penyimpanan gambar/QR Code)

---

### Langkah 1: Kloning & Pengaturan Environment Variables

1. Duplikat berkas `.env.example` di dalam folder `backend/` menjadi `.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Isi nilai variabel di dalam `backend/.env` sesuai dengan kredensial Firebase dan Cloudinary Anda:
   * **Firebase:** Masukkan `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY` (pastikan tanda baris baru `\n` pada private key tertulis dengan benar).
   * **Cloudinary:** Isi `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET`.
   * **JWT Secret:** Tentukan string acak panjang untuk `JWT_SECRET`.
3. Buat berkas `.env` di dalam folder `frontend/` jika ingin mengubah alamat API default, atau biarkan kosong agar otomatis menggunakan proxy development:
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   ```

---

### Langkah 2: Instalasi Dependencies & Seeding Database

Jalankan terminal dan instal pustaka di kedua direktori:

1. **Instalasi Backend & Seeding Akun:**
   ```bash
   cd backend
   npm install
   
   # Seed akun dasar sistem (admin, petugas, guru, siswa, kepsek)
   node seed.js
   
   # (Opsional) Seed data dummy siswa, buku, serta riwayat transaksi peminjaman
   node seed_data.js
   ```
2. **Instalasi Frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

---

### Langkah 3: Menjalankan Server Pengembangan

Untuk menjalankan backend dan frontend secara bersamaan pada lingkungan lokal:

1. **Jalankan Backend (Port 4000):**
   ```bash
   cd backend
   npm run dev
   ```
2. **Jalankan Frontend (Port 5173):**
   Buka jendela terminal baru, lalu jalankan:
   ```bash
   cd frontend
   npm run dev
   ```
3. Akses aplikasi melalui browser di tautan `http://localhost:5173`.
4. Masuk menggunakan akun bawaan hasil *seeding*:
   * **Admin:** Username: `admin` | Password: `admin123`
   * **Petugas:** Username: `petugas` | Password: `petugas123`
   * **Kepala Sekolah:** Username: `kepsek` | Password: `kepsek123`

## 📱 Membangun & Mengunduh Aplikasi Android Native (Capacitor)

### 📥 Unduh Langsung Aplikasi Android (.APK)
Anda dapat langsung mengunduh dan memasang aplikasi Android siap pakai untuk sistem perpustakaan ini melalui tautan berikut:
* **[Download base.apk](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/base.apk)** (Atau klik tautan relatif GitHub: [base.apk](./base.apk))

### 🛠️ Membangun APK Sendiri dari Source Code
Jika Anda ingin mengompilasi tampilan frontend menjadi berkas `.apk` Android secara mandiri:

1. Pastikan Anda telah menginstal Android Studio dan SDK terkait.
2. Build aset web frontend terlebih dahulu:
   ```bash
   cd frontend
   npm run build
   ```
3. Sinkronisasikan aset kompilasi web ke folder project Android:
   ```bash
   npx cap sync android
   ```
4. Buka project Android di Android Studio untuk menjalankan emulator atau mengekspor APK:
   ```bash
   npx cap open android
   ```

---

## 🌍 Konfigurasi Deployment Produksi

Project ini telah siap dideploy ke berbagai platform hosting modern menggunakan konfigurasi monorepo bawaan:

* **Vercel:** Menangani deployment full-stack secara otomatis menggunakan berkas [vercel.json](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/vercel.json) di root directory. Endpoint API diarahkan ke backend node, sedangkan routing non-aset diarahkan ke `index.html` frontend.
* **Netlify:** Mengompilasi dan meng-host frontend statis dari folder `frontend/dist`, serta merutekan request `/api/*` ke serverless function Express di folder `netlify/functions/` berdasarkan berkas [netlify.toml](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/netlify.toml).
* **Railway:** Membaca berkas [railway.json](file:///c:/Users/fadli/Downloads/perpustakaan-main/perpustakaan-main/railway.json) untuk langsung menginstal dependensi backend dan menyalakan server Express Node.js secara persisten sebagai API backend utama.