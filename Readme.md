# Sistem Informasi Perpustakaan Sekolah YP. Tunas Karya

Aplikasi web dan mobile full-stack untuk mengelola sirkulasi perpustakaan sekolah: katalog dan stok buku, data anggota terpadu (siswa & guru), peminjaman/pengembalian, denda keterlambatan/kerusakan/kehilangan, pencetakan struk dan surat peringatan, akun berbasis peran, notifikasi, serta laporan. Tersedia sebagai web responsif, PWA, dan Android melalui Capacitor.

> Dokumentasi ini disusun berdasarkan implementasi terbaru pada `frontend/src` dan `backend/src`. Firestore adalah database NoSQL; relasi pada ERD adalah relasi logis melalui field ID dokumen.

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Teknologi](#teknologi)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Aktor dan Hak Akses](#aktor-dan-hak-akses)
- [Struktur Proyek](#struktur-proyek)
- [ERD (Entity Relationship Diagram)](#erd-entity-relationship-diagram)
- [Diagram Konteks dan DFD (Level 0, Level 1, Level 2)](#diagram-konteks)
- [Use Case Diagram](#use-case-diagram)
- [UML Diagram](#uml-diagram)
- [Alur Kerja dan Flowchart](#alur-kerja-dan-flowchart)
- [Activity dan Sequence Diagram](#activity-diagram)
- [State Diagram](#state-diagram)
- [Wireframe dan Navigasi](#wireframe)
- [Ringkasan API](#ringkasan-api)
- [Aturan Bisnis](#aturan-bisnis)
- [Menjalankan Proyek](#menjalankan-proyek)
- [Keamanan dan Operasional](#keamanan-dan-operasional)
- [Lisensi](#lisensi)

---

## Fitur Utama

1. **Autentikasi & Otorisasi RBAC**:
   - Berbasis JSON Web Token (JWT) dengan pembagian hak akses: Admin, Petugas, Guru, Siswa, dan Kepala Sekolah.
2. **Data Anggota Terpadu (Siswa & Guru)**:
   - Manajemen siswa (NIS, kelas, jurusan, kontak) dan guru (NIP/NUPTK, jabatan, kelas perwalian).
   - Pembuatan akun otomatis saat data siswa atau guru ditambahkan (sinkronisasi dua arah).
   - Impor dan ekspor data siswa/guru melalui format Excel (`.xlsx`).
   - Fitur reset password per akun dan reset seluruh akun massal ke default password (`password123`).
3. **Katalog & Stok Buku**:
   - Manajemen katalog buku, kategori, penulis, penerbit, dan lokasi rak.
   - Stok tersedia dikelola langsung pada data buku.
   - Generator QR code buku instan (mendukung base64 Data URL lokal offline dan penyimpanan Cloudinary).
   - Modal tampilan QR code buku, unduh gambar QR, serta cetak label buku.
4. **Sirkulasi Peminjaman Buku**:
   - Peminjaman beberapa buku sekaligus untuk Siswa maupun Guru.
   - Deteksi otomatis jatuh tempo berdasarkan aturan perpustakaan.
   - Pembuatan nomor struk transaksi unik (`TX-...`) dan barcode/QR peminjaman.
   - Cetak struk peminjaman berformat standar sekolah (A4/struk cetak) dengan logo resmi YP. Tunas Karya.
5. **Pengembalian & Manajemen Denda Transparan**:
   - Pencarian transaksi cepat via scan QR struk atau pemilihan anggota.
   - Pengembalian penuh maupun bertahap (parsial).
   - Pencatatan kondisi buku: **Baik**, **Rusak**, atau **Hilang**.
   - Perhitungan denda otomatis (tarif per hari keterlambatan, denda kerusakan, dan ganti rugi kehilangan).
   - Pelacakan status denda yang jelas: **`⚠️ Denda Belum Lunas`** (`has_problem_pending`) dengan rincian denda & buku terkait, serta tombol konfirmasi pelunasan langsung (**`💳 Lunasi Denda`**).
   - Cetak struk pengembalian resmi dengan rincian denda dan tanda tangan petugas.
6. **Surat Peringatan Keterlambatan**:
   - Cetak resmi Surat Peringatan Keterlambatan Pengembalian Buku ber-kop sekolah untuk siswa/peminjam yang melewati batas jatuh tempo.
7. **Scanner QR Interaktif**:
   - Pemindaian kamera real-time dengan pemilihan perangkat webcam (bebas dari error batasan kamera/`OverconstrainedError`).
   - Pemindaian QR dari file gambar (kompatibel desktop, tablet, dan smartphone).
   - Normalisasi kode hasil scan cerdas yang mendukung nomor transaksi bertanda sufiks (`TX-...-1`, `TX-...-2`).
8. **Pengaturan Aturan Perpustakaan Dinamis**:
   - Konfigurasi batas waktu peminjaman (hari), kuota maksimal buku, tarif denda harian, dan persentase ganti rugi rusak/hilang.
9. **Dashboard & Laporan**:
   - Ringkasan sirkulasi real-time, buku terpopuler, peminjaman terlambat, log aktivitas sistem, notifikasi audit, dan ekspor laporan Excel.

---

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18, React Router v6, Axios, Vite, Vanilla CSS Modern |
| Scanner / QR | html5-qrcode, jsQR, qrcode, bwip-js |
| Mobile & PWA | Capacitor Android, PWA Service Worker & Manifest, Push Notifications |
| Backend | Node.js, Express REST API |
| Keamanan | JWT (jsonwebtoken), bcryptjs, Helmet, Express Rate Limit, CORS |
| Database & Media | Cloud Firestore (Firebase Admin SDK), Cloudinary CDN (opsional), FCM |
| Pengolah Dokumen | SheetJS (xlsx), HTML Receipt Templates, Browser Print CSS |
| Deployment | Vercel, Netlify, Railway, Docker Compose |

---

## Arsitektur Sistem

```mermaid
flowchart LR
  subgraph Client ["Antarmuka Klien"]
    WEB["Web React Desktop / Tablet"]
    PWA["PWA Mobile Browser"]
    AND["Android App via Capacitor"]
  end
  subgraph Backend ["Server Backend"]
    API["Express REST API"] --> AUTH["JWT & RBAC Middleware"]
    AUTH --> SERVICE["Service Logika Bisnis Perpustakaan"]
  end
  subgraph Storage ["Layanan Data & Eksternal"]
    SERVICE --> DB[("Google Cloud Firestore")]
    SERVICE --> IMG[("Cloudinary CDN")]
    SERVICE --> FCM["Firebase Cloud Messaging"]
  end
  WEB --> API
  PWA --> API
  AND --> API
```

---

## Aktor dan Hak Akses

| Fitur / Modul | Admin | Petugas | Guru | Siswa | Kepala Sekolah |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard & Katalog Buku | Ya | Ya | Ya | Ya | Ya |
| Kelola Data Siswa & Guru | Ya | Ya (tambah/edit) | Baca (kelas wali) | Tidak | Baca |
| Hapus Siswa / Guru | Ya | Tidak | Tidak | Tidak | Tidak |
| Kelola Buku & Stok Buku | Ya | Ya (tambah/stok) | Baca | Baca | Baca |
| Hapus Judul Buku | Ya | Tidak | Tidak | Tidak | Tidak |
| Peminjaman Buku (Siswa & Guru) | Ya | Ya | Tidak | Tidak | Tidak |
| Pengembalian & Pelunasan Denda | Ya | Ya | Tidak | Tidak | Tidak |
| Perpanjang Masa Pinjam | Ya | Ya | Tidak | Ya (pinjaman sendiri) | Tidak |
| Cetak Surat Peringatan Terlambat | Ya | Ya | Tidak | Tidak | Tidak |
| Kelola Akun & Reset Password | Ya | Tidak | Tidak | Tidak | Tidak |
| Pengaturan Aturan Perpustakaan | Ya | Tidak | Tidak | Tidak | Tidak |
| Ekspor Laporan Excel | Ya | Ya | Tidak | Tidak | Ya |

*Catatan pembatasan data:*
- **Guru**: Dapat meminjam buku, melihat riwayat transaksi sendiri, dan melihat transaksi siswa pada kelas perwaliannya (`homeroomClass`).
- **Siswa**: Hanya dapat melihat katalog buku dan riwayat peminjaman miliknya sendiri (`studentId`).

---

## Struktur Proyek

```text
.
├── backend/
│   ├── api/index.js                 # Handler serverless (Vercel)
│   ├── src/
│   │   ├── server.js, app.js        # Bootstrapping Express & middleware
│   │   ├── firebase.js              # Inisialisasi Firebase Admin & Firestore
│   │   ├── cloudinary.js            # Inisialisasi Cloudinary SDK
│   │   ├── middleware/auth.js       # Verifikasi JWT dan pengecekan role
│   │   ├── routes/
│   │   │   ├── auth.js              # Login & verifikasi akun
│   │   │   ├── users.js             # Manajemen akun, reset per akun & massal
│   │   │   ├── students.js          # Data anggota (Siswa & Guru), import/export
│   │   │   ├── books.js             # Katalog buku, stok, barcode, dan QR code
│   │   │   ├── transactions.js      # Sirkulasi, denda, struk HTML, export
│   │   │   ├── settings.js          # Aturan perpustakaan
│   │   │   └── notifications.js     # Notifikasi audit & FCM
│   │   └── utils/
│   │       ├── qrGenerator.js       # Generator QR code (Data URL & Cloudinary)
│   │       ├── receiptGenerator.js  # Generator template struk cetak
│   │       ├── notifications.js     # Helper pembuatan notifikasi sistem
│   │       └── syncTeachers.js      # Sinkronisasi data akun guru ke data anggota
│   ├── seed.js, seed_data.js        # Seed database awal
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx, api.js          # Konfigurasi routing & Axios client
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    # Metrik, aktivitas sirkulasi, status denda
│   │   │   ├── StudentsPage.jsx     # Kelola Data Siswa & Guru (tab terpadu)
│   │   │   ├── BooksPage.jsx        # Katalog buku, tambah stok, modal QR code
│   │   │   ├── BorrowPage.jsx       # Sirkulasi peminjaman (siswa & guru)
│   │   │   ├── ReturnPage.jsx       # Sirkulasi pengembalian, denda, rincian buku
│   │   │   ├── TransactionsPage.jsx # Riwayat sirkulasi, filter denda, cetak SP
│   │   │   ├── AccountsPage.jsx     # Manajemen akun pengguna & reset password
│   │   │   ├── ScanQrPage.jsx       # Navigasi cepat via scanner QR
│   │   │   └── LandingPage.jsx      # Halaman publik & pencarian katalog
│   │   ├── components/
│   │   │   ├── MainLayout.jsx       # Sidebar navigasi, header, dan notifikasi
│   │   │   ├── QrScanner.jsx        # Komponen scanner QR responsif
│   │   │   ├── WarningLetterModal.jsx # Modal cetak resmi Surat Peringatan
│   │   │   └── ReceiptModal.jsx     # Modal preview struk transaksi
│   │   └── utils/
│   │       ├── scanNormalize.js     # Parser nomor struk dan barcode QR
│   │       └── downloadHelper.js    # Utilitas simpan gambar QR
│   ├── vite.config.mjs
│   ├── package.json
│   └── android/                     # Proyek aplikasi Android Capacitor
└── docker-compose.yml
```

---

## ERD (Entity Relationship Diagram)

```mermaid
erDiagram
  STUDENTS ||--o| USERS : memiliki_akun
  STUDENTS ||--o{ TRANSACTIONS : melakukan_peminjaman
  USERS ||--o{ FCM_TOKENS : mendaftarkan_perangkat
  BOOKS }o--o{ TRANSACTIONS : dipinjam_dalam

  USERS {
    string id PK
    string username UK
    string passwordHash
    string name
    string role "admin, officer, teacher, student, principal"
    string studentId FK "relasi ke collection students"
    string homeroomClass "kelas perwalian guru"
    datetime createdAt
  }
  STUDENTS {
    string id PK
    string nis UK "NIS siswa atau NIP/NUPTK guru"
    string name
    string role "student atau teacher"
    string class "kelas siswa atau wali kelas guru"
    string major "jurusan siswa atau jabatan guru"
    string email
    string phone
    string status "active atau inactive"
    datetime createdAt
  }
  BOOKS {
    string id PK
    string title
    string author
    string category
    string publisher
    string year
    string location "lokasi rak"
    string coverUrl
    string qrCodeUrl "QR code buku data URL atau Cloudinary"
    number stock "stok buku tersedia"
    datetime createdAt
  }
  TRANSACTIONS {
    string id PK
    string studentId FK "id anggota siswa atau guru"
    string receiptNumber UK "nomor struk resmi misal TX-1788002694178-2"
    datetime borrowDate
    datetime dueDate
    datetime returnDate
    string status "ongoing, partially_returned, completed, has_problem_pending, has_problem_resolved"
    json books "daftar/snapshot buku yang dipinjam"
    number bookCount
    number totalFine "total nominal denda"
    string problemSummary "ringkasan denda terlambat, rusak, hilang"
    string paymentStatus "paid atau pending"
    boolean renewed "status perpanjangan pinjaman"
    string officerName
    string officerTitle
  }
  FCM_TOKENS {
    string token PK
    string userId FK
    string platform
  }
```

---

## Diagram Konteks

```mermaid
flowchart LR
  A["Admin"] -->|"Kelola akun, anggota, buku, aturan"| SYS(("Sistem Perpustakaan Sekolah"))
  O["Petugas"] -->|"Sirkulasi pinjam & kembali, denda, surat SP"| SYS
  T["Guru"] -->|"Pinjam buku, pantau kelas wali, katalog"| SYS
  S["Siswa"] -->|"Katalog, cek pinjaman sendiri, perpanjang"| SYS
  P["Kepala Sekolah"] -->|"Monitoring statistik & ekspor laporan"| SYS

  SYS -->|"Data master, log audit, laporan"| A
  SYS -->|"Struk transaksi, surat SP, notifikasi"| O
  SYS -->|"Struk pinjam guru, riwayat siswa kelas"| T
  SYS -->|"Struk peminjaman, info jatuh tempo"| S
  SYS -->|"Dashboard eksekutif & file rekap"| P

  SYS -->|"Tulis & baca data sirkulasi"| DB[("Google Cloud Firestore")]
  DB -->|"Hasil data sirkulasi"| SYS
  SYS -->|"Unggah & unduh aset QR/gambar"| CL["Cloudinary / Data URL"]
  SYS -->|"Kirim notifikasi push"| FCM["Firebase Cloud Messaging"]
```

---

## DFD Level 0

```mermaid
flowchart LR
  U["Pengguna Perpustakaan"] -->|"Kredensial, data anggota, transaksi"| P0(("0. Sistem Perpustakaan Sekolah"))
  P0 -->|"Token JWT, struk, laporan, notifikasi"| U
  P0 -->|"Tulis data sirkulasi"| D[("Firestore NoSQL")]
  D -->|"Baca data sirkulasi"| P0
  P0 -->|"Penyimpanan QR & media"| C["Cloudinary / Data URL"]
  P0 -->|"Push notifikasi"| N["FCM Service"]
```

---

## DFD Level 1

```mermaid
flowchart TB
  U["Pengguna Perpustakaan"]

  P1(("1.0 Autentikasi & Akun"))
  P2(("2.0 Data Anggota (Siswa & Guru)"))
  P3(("3.0 Katalog & Stok Buku"))
  P4(("4.0 Sirkulasi Pinjam & Kembali"))
  P5(("5.0 Denda & Surat Peringatan"))
  P6(("6.0 Laporan & Notifikasi"))

  D1[("D1 Users & Tokens")]
  D2[("D2 Students & Teachers")]
  D3[("D3 Books")]
  D4[("D4 Transactions")]
  D5[("D5 Settings & Rules")]
  D6[("D6 Audit Notifications")]

  U --> P1
  P1 --> D1
  D1 --> P1
  P1 --> U

  U --> P2
  P2 --> D2
  D2 --> P2
  P2 -.->|"Auto-create user"| D1
  P2 --> U

  U --> P3
  P3 --> D3
  D3 --> P3
  P3 --> U

  U --> P4
  P4 --> D2
  D2 --> P4
  P4 --> D3
  D3 --> P4
  P4 --> D4
  D4 --> P4
  P4 --> D5
  D5 --> P4
  P4 --> U

  U --> P5
  P5 --> D4
  D4 --> P5
  P5 --> D5
  D5 --> P5
  P5 --> U

  U --> P6
  P6 --> D2
  P6 --> D3
  P6 --> D4
  P6 --> D6
  P6 --> U
```

---

## DFD Level 2

### Dekomposisi Proses 4.0 (Sirkulasi Peminjaman, Pengembalian & Denda)

Dekomposisi proses inti transaksi perpustakaan mulai dari pemindaian identitas, validasi buku, registrasi peminjaman, pemeriksaan pengembalian berbasis QR, kalkulasi denda otomatis, hingga pelunasan masalah tertunda (*has_problem_pending*):

```mermaid
flowchart TB
  Petugas["Petugas / Admin"]
  Peminjam["Anggota (Siswa / Guru)"]

  subgraph Sirkulasi["Proses 4.0 Sirkulasi Perpustakaan"]
    P41(("4.1 Identifikasi Peminjam"))
    P42(("4.2 Validasi & Pemindaian Buku"))
    P43(("4.3 Registrasi Peminjaman Baru"))
    P44(("4.4 Lookup Transaksi & Buku Kembali"))
    P45(("4.5 Penilaian Kondisi & Kalkulasi Denda"))
    P46(("4.6 Eksekusi Pengembalian & Cetak Struk"))
    P47(("4.7 Pelunasan Denda Tertunda (Problem Pending)"))
  end

  D2[("D2 Students & Teachers")]
  D3[("D3 Books")]
  D4[("D4 Transactions")]
  D5[("D5 Settings & Rules")]

  Petugas -->|"Input NIS/NIP/Nama"| P41
  P41 -->|"Cek status aktif & kuota pinjam"| D2
  D2 -->|"Data profil & limit peminjaman"| P41
  P41 -->|"Peminjam terverifikasi"| P43

  Petugas -->|"Scan QR Buku / Input Kode"| P42
  P42 -->|"Cek buku dan stok tersedia"| D3
  D3 -->|"Info judul & ketersediaan stok"| P42
  P42 -->|"Daftar buku valid"| P43

  P43 -->|"Aturan durasi & limit hari"| D5
  D5 -->|"Batas waktu pinjam"| P43
  P43 -->|"Generate TX-ID & simpan transaksi beserta daftar buku"| D4
  P43 -->|"Kurangi stok buku"| D3
  P43 -->|"Struk Peminjaman & QR Transaksi"| Peminjam

  Petugas -->|"Scan QR Struk / QR Buku / Cari Nama"| P44
  P44 -->|"Lookup transaksi ongoing / pending"| D4
  D4 -->|"Detail data peminjaman aktif"| P44
  P44 -->|"Buku pinjaman terkonfirmasi"| P45

  P45 -->|"Ambil tarif denda harian/rusak/hilang"| D5
  D5 -->|"Tarif denda & toleransi"| P45
  Petugas -->|"Input kondisi buku (baik/rusak/hilang)"| P45
  P45 -->|"Rincian denda & status pembayaran"| P46

  P46 -->|"Update transaksi (completed / has_problem_pending)"| D4
  P46 -->|"Tambahkan stok buku kembali bila kondisi baik"| D3
  P46 -->|"Struk Pengembalian / Surat Keterlambatan"| Peminjam

  Petugas -->|"Input pelunasan denda / penggantian buku"| P47
  P47 -->|"Update status (has_problem_resolved / paid)"| D4
  P47 -->|"Sesuaikan stok buku pengganti"| D3
  P47 -->|"Bukti Pelunasan Bebas Pustaka"| Peminjam
```

### Dekomposisi Proses 2.0 (Pengelolaan Data Anggota: Siswa & Guru)

Dekomposisi proses administrasi keanggotaan mulai dari input/impor data, pembuatan akun instan, pemetaan wali kelas, hingga reset password massal/individual ke kredensial bawaan:

```mermaid
flowchart TB
  Admin["Admin / Petugas"]
  Anggota["Anggota (Siswa / Guru)"]

  subgraph Keanggotaan["Proses 2.0 Pengelolaan Anggota"]
    P21(("2.1 Input & Impor Data Anggota"))
    P22(("2.2 Sinkronisasi Akun Pengguna Otomatis"))
    P23(("2.3 Pemetaan Relasi & Status Keanggotaan"))
    P24(("2.4 Reset Password Akun (Default: password123)"))
  end

  D1[("D1 Users & Tokens")]
  D2[("D2 Students & Teachers")]

  Admin -->|"Input form / Upload file Excel (NIS/NIP, Nama, Kelas)"| P21
  P21 -->|"Validasi duplikasi & simpan master data"| D2
  P21 -->|"Memicu trigger pembuatan akun baru"| P22

  P22 -->|"Generate user (Username: NIS/NIP, Pwd default: password123, Role)"| D1
  P22 -->|"Kartu Anggota & Kredensial Login Bawaan"| Anggota

  Admin -->|"Atur Wali Kelas guru & Mutasi kelas siswa"| P23
  P23 -->|"Update data siswa & relasi wali kelas"| D2

  Admin -->|"Pilih Reset Akun Satuan atau Seluruh Akun Non-Admin"| P24
  P24 -->|"Hash password baru (password123)"| D1
  P24 -->|"Notifikasi status reset password"| Admin
```

---

## Use Case Diagram

```mermaid
flowchart LR
  Admin["Admin"]
  Officer["Petugas Perpustakaan"]
  Teacher["Guru"]
  Student["Siswa"]
  Principal["Kepala Sekolah"]

  subgraph Sistem["Sistem Perpustakaan Sekolah"]
    UC1(["Login / Logout"])
    UC2(["Lihat Dashboard & Katalog Buku"])
    UC3(["Kelola Anggota (Siswa & Guru)"])
    UC4(["Kelola Buku, Stok & Cetak QR"])
    UC5(["Proses Peminjaman Buku"])
    UC6(["Proses Pengembalian & Denda"])
    UC7(["Cetak Struk & Surat Peringatan"])
    UC8(["Scan QR Code"])
    UC9(["Kelola Akun & Reset Password"])
    UC10(["Cetak & Ekspor Laporan Excel"])
    UC11(["Lihat Pinjaman Pribadi / Kelas"])
    UC12(["Perpanjang Peminjaman 1x"])
    UC13(["Pelunasan Denda Tertunda"])
  end

  Admin --- UC1
  Admin --- UC2
  Admin --- UC3
  Admin --- UC4
  Admin --- UC5
  Admin --- UC6
  Admin --- UC7
  Admin --- UC8
  Admin --- UC9
  Admin --- UC10
  Admin --- UC13

  Officer --- UC1
  Officer --- UC2
  Officer --- UC3
  Officer --- UC4
  Officer --- UC5
  Officer --- UC6
  Officer --- UC7
  Officer --- UC8
  Officer --- UC10
  Officer --- UC13

  Teacher --- UC1
  Teacher --- UC2
  Teacher --- UC11

  Student --- UC1
  Student --- UC2
  Student --- UC11
  Student --- UC12

  Principal --- UC1
  Principal --- UC2
  Principal --- UC10
```

---

## UML Diagram

### Class Diagram

```mermaid
classDiagram
  class User {
    +id: string
    +username: string
    +role: string
    +studentId: string
    +homeroomClass: string
    +resetPassword()
  }
  class Member {
    +id: string
    +nis: string
    +name: string
    +role: string
    +classGroup: string
    +major: string
    +status: string
  }
  class Book {
    +id: string
    +title: string
    +author: string
    +category: string
    +stock: number
    +qrCodeUrl: string
    +addStock(quantity)
    +reduceStock(quantity)
  }
  class Transaction {
    +id: string
    +studentId: string
    +receiptNumber: string
    +borrowDate: datetime
    +dueDate: datetime
    +returnDate: datetime
    +status: string
    +books: json
    +bookCount: number
    +totalFine: number
    +renew()
    +calculateFine()
    +resolvePendingFine()
  }
  Member "1" --> "0..1" User : memiliki_akun
  Member "1" --> "0..*" Transaction : meminjam
  Book "0..*" --> "0..*" Transaction : dicatat_dalam
```

---

## Alur Kerja dan Flowchart

### Flowchart Peminjaman Buku

```mermaid
flowchart TD
  A["Mulai Peminjaman"] --> B["Pilih Peminjam: Siswa atau Guru"]
  B --> C{"Peminjam Aktif & Kuota Cukup?"}
  C -- Tidak --> X["Tampilkan Peringatan & Batalkan"]
  C -- Ya --> D["Scan QR / Pilih Buku"]
  D --> E{"Stok Buku Tersedia?"}
  E -- Tidak --> D
  E -- Ya --> F["Tambahkan ke Daftar Peminjaman"]
  F --> G{"Tambah Buku Lain?"}
  G -- Ya --> D
  G -- Tidak --> H["Pilih Tanggal Jatuh Tempo"]
  H --> I["Simpan Transaksi Atomik ke Firestore"]
  I --> J["Kurangi Stok Buku"]
  J --> K["Generate Nomor Struk TX & QR Code"]
  K --> L["Tampilkan Struk Cetak & Kirim Notifikasi"]
  L --> M["Selesai"]
```

### Flowchart Pengembalian & Penanganan Denda

```mermaid
flowchart TD
  A["Scan QR Struk / Cari Anggota"] --> B["Ambil Data Transaksi Aktif"]
  B --> C["Pilih Buku yang Akan Dikembalikan"]
  C --> D["Pilih Kondisi Buku: Baik, Rusak, atau Hilang"]
  D --> E{"Kondisi Baik & Tepat Waktu?"}
  E -- Ya --> F["Hitung Denda = Rp 0; stok buku ditambahkan"]
  E -- Tidak --> G["Hitung Denda Keterlambatan / Kerusakan / Kehilangan"]
  G --> H{"Denda Langsung Dibayar Lunas?"}
  H -- Ya --> I["Status Transaksi = has_problem_resolved / completed"]
  H -- Tidak --> J["Status Transaksi = has_problem_pending / Denda Belum Lunas"]
  F --> K{"Semua Buku Telah Kembali?"}
  K -- Ya --> L["Status Transaksi = completed"]
  K -- Tidak --> M["Status Transaksi = partially_returned"]
  I & J & L & M --> N["Commit Update Atomik ke Firestore"]
  N --> O["Cetak Struk Pengembalian & Catat Notifikasi Audit"]
```

---

## Activity Diagram

### Aktivitas Peminjaman Terintegrasi

```mermaid
flowchart LR
  subgraph Anggota ["Siswa / Guru"]
    A1["Serahkan Kartu Anggota / Sebutkan NIS/NIP"]
    A2["Terima Struk Peminjaman Berisi QR"]
  end
  subgraph Petugas ["Petugas Perpustakaan"]
    O1["Pilih Data Anggota pada BorrowPage"]
    O2["Scan QR Buku"]
    O3["Periksa Batas Pinjam & Konfirmasi"]
  end
  subgraph Sistem ["Sistem Backend"]
    S1["Validasi Anggota & Status Buku"]
    S2["Eksekusi Batch Write Firestore"]
    S3["Generate Nomor Struk TX & QR Struk"]
  end
  A1 --> O1 --> S1 --> O2 --> O3 --> S2 --> S3 --> A2
```

### Aktivitas Pelunasan Denda Tertunda

```mermaid
flowchart TD
  A["Transaksi Berstatus Denda Belum Lunas"] --> B["Petugas Buka ReturnPage / Riwayat Transaksi"]
  B --> C["Klik Tombol 'Lunasi Denda'"]
  C --> D["Dialog Konfirmasi: Nama, Nomor Struk, dan Total Nominal"]
  D --> E["PUT /api/transactions/:id/resolve-pending"]
  E --> F["Update status menjadi has_problem_resolved & paymentStatus = paid"]
  F --> G["Cetak Struk Pengembalian dengan Status LUNAS"]
```

---

## Sequence Diagram

### Alur Scan QR & Pengembalian Buku

```mermaid
sequenceDiagram
  actor Petugas as Petugas Perpustakaan
  participant Scanner as QrScanner Component
  participant ReturnPage as ReturnPage (React)
  participant API as Express API
  participant DB as Cloud Firestore

  Petugas->>Scanner: Pindai QR Struk / Upload Gambar Struk
  Scanner->>Scanner: Normalisasi TX-[A-Za-z0-9_-]+
  Scanner-->>ReturnPage: Kode Struk Terbaca (TX-...)
  ReturnPage->>API: GET /api/transactions/by-receipt/:receiptNumber
  API->>DB: Query receiptNumber / prefix match
  DB-->>API: Data Transaksi + Daftar Buku
  API-->>ReturnPage: Payload Transaksi Lengkap (200 OK)
  ReturnPage-->>Petugas: Tampilkan Informasi Peminjam & Daftar Buku
  Petugas->>ReturnPage: Tentukan Kondisi & Konfirmasi Pengembalian
  ReturnPage->>API: POST /api/transactions/return
  API->>DB: Batch write (update stok buku & status transaksi)
  DB-->>API: Berhasil
  API-->>ReturnPage: Status Sukses & Data Denda
  ReturnPage-->>Petugas: Tampilkan Modal Sukses & Tombol Cetak Struk
```

---

## State Diagram

### Siklus Status Transaksi

```mermaid
stateDiagram-v2
  [*] --> ongoing: Peminjaman dibuat
  ongoing --> ongoing: Perpanjang masa pinjam satu kali
  ongoing --> partially_returned: Sebagian buku dikembalikan
  partially_returned --> partially_returned: Pengembalian bertahap berikutnya
  ongoing --> completed: Semua buku kembali baik dan lunas
  partially_returned --> completed: Sisa buku kembali baik dan lunas
  ongoing --> has_problem_pending: Buku kembali tapi denda belum lunas
  partially_returned --> has_problem_pending: Buku kembali tapi denda belum lunas
  has_problem_pending --> has_problem_resolved: Denda dibayar atau diselesaikan
  completed --> [*]
  has_problem_resolved --> [*]
```

---

## Wireframe

### Tata Letak Desktop Utama

```text
┌──────────────────────┬──────────────────────────────────────────────────────────┐
│ LOGO Perpustakaan    │ 📖 Sistem Informasi Perpustakaan           🔔 Petugas    │
│ YP. Tunas Karya      ├─────────────┬─────────────┬─────────────┬────────────────┤
│ ▣ Dashboard          │ Total Judul │ Stok Buku   │ Dipinjam    │ Total Anggota  │
│ ♟ Data Anggota       ├─────────────┴─────────────┴─────────────┴────────────────┤
│ ▤ Katalog Buku       │ Sirkulasi & Aktivitas Sirkulasi Terkini                  │
│ ◉ Scan QR            ├───────────────────────────┬──────────────────────────────┤
│ ⇧ Peminjaman         │ Peminjaman Terlambat      │ Transaksi Denda Belum Lunas  │
│ ⇩ Pengembalian       │ [Daftar jatuh tempo...]   │ [Badge nominal & tombol]     │
│ ☷ Riwayat Transaksi  │                           │                              │
│ ⚙ Kelola Akun        │                           │                              │
│ [Logout]             │                           │                              │
└──────────────────────┴───────────────────────────┴──────────────────────────────┘
```

### Navigasi Aplikasi

```mermaid
flowchart TD
  LANDING["Landing Page (/)"] --> LOGIN["Login (/login)"]
  LOGIN --> DASH["Dashboard (/app)"]
  DASH --> MEMBERS["Data Anggota: Siswa & Guru"]
  DASH --> BOOKS["Katalog & Stok Buku"]
  DASH --> SCAN["Scan QR Cepat"]
  DASH --> BORROW["Peminjaman Buku"]
  DASH --> RETURN["Pengembalian Buku"]
  DASH --> TRANSACTIONS["Riwayat Transaksi & Surat SP"]
  DASH --> ACCOUNTS["Manajemen Akun"]
  SCAN --> BORROW
  SCAN --> RETURN
```

---

## Ringkasan API

Semua endpoint privat mewajibkan header `Authorization: Bearer <token_jwt>`.

| Modul | Endpoint | Metode | Role yang Diizinkan | Keterangan |
|---|---|:---:|---|---|
| **Auth** | `/api/auth/login` | `POST` | Publik | Autentikasi username & password |
| **Anggota** | `/api/students` | `GET` | Semua | Daftar siswa & guru (bisa filter role/kelas) |
| | `/api/students/search` | `GET` | Semua | Pencarian cepat autocomplete anggota |
| | `/api/students` | `POST` | Admin, Petugas | Tambah anggota (otomatis membuat akun) |
| | `/api/students/:id` | `PUT` | Admin, Petugas | Perbarui data anggota & sinkronisasi akun |
| | `/api/students/:id` | `DELETE` | Admin | Hapus data anggota |
| | `/api/students/import` | `POST` | Admin, Petugas | Impor data massal via file Excel |
| | `/api/students/export` | `GET` | Admin, Petugas, Kepsek | Ekspor data anggota ke file Excel |
| **Katalog** | `/api/books` | `GET` | Semua | Daftar buku dan stok tersedia |
| | `/api/books/by-code/:code` | `GET` | Semua | Cari buku melalui ID atau QR code |
| | `/api/books/:id/qr-code` | `GET` | Semua | Ambil / buat QR code buku secara instan |
| | `/api/books` | `POST` | Admin, Petugas | Tambah judul buku baru |
| | `/api/books/:id/add-stock` | `POST` | Admin, Petugas | Tambah stok buku |
| | `/api/books/:id/reduce-stock`| `POST` | Admin, Petugas | Kurangi stok (alasan: rusak/hilang/ditarik) |
| | `/api/books/:id` | `PUT` | Admin, Petugas | Edit informasi metadata buku |
| | `/api/books/:id` | `DELETE` | Admin | Hapus data buku |
| | `/api/books/export` | `GET` | Admin, Petugas, Kepsek | Ekspor katalog buku ke file Excel |
| | `/api/books/import` | `POST` | Admin, Petugas | Impor katalog buku via file Excel |
| **Sirkulasi** | `/api/transactions/borrow` | `POST` | Admin, Petugas | Proses peminjaman buku baru |
| | `/api/transactions/return` | `POST` | Admin, Petugas | Proses pengembalian buku & hitung denda |
| | `/api/transactions/by-receipt/:receiptNumber` | `GET` | Admin, Petugas | Lookup transaksi via nomor/prefix struk QR |
| | `/api/transactions/:id/renew` | `PUT` | Admin, Petugas, Siswa | Perpanjang masa pinjam (maks. 1 kali) |
| | `/api/transactions/:id/resolve-pending` | `PUT` | Admin, Petugas | Konfirmasi pelunasan denda tertunda |
| | `/api/transactions/:id/receipt` | `GET` | Semua | Render struk cetak peminjaman resmi |
| | `/api/transactions/:id/return-receipt`| `GET` | Semua | Render struk cetak pengembalian resmi |
| | `/api/transactions/stats` | `GET` | Semua | Statistik sirkulasi dan transaksi terlambat |
| | `/api/transactions/export` | `GET` | Admin, Petugas, Kepsek | Ekspor laporan transaksi ke file Excel |
| **Akun** | `/api/users` | `GET` | Admin | Daftar seluruh akun pengguna sistem |
| | `/api/users` | `POST` | Admin | Buat akun manual baru |
| | `/api/users/:id` | `PUT` | Admin | Edit akun / role / kelas perwalian |
| | `/api/users/:id` | `DELETE` | Admin | Hapus akun |
| | `/api/users/:id/reset-password` | `POST` | Admin | Reset password satu akun ke default |
| | `/api/users/reset-all` | `POST` | Admin | Reset seluruh password akun non-admin |
| **Aturan** | `/api/settings` | `GET` | Semua | Ambil aturan operasional perpustakaan |
| | `/api/settings` | `PUT` | Admin | Perbarui tarif denda dan batas pinjam |
| **Audit** | `/api/notifications` | `GET` | Semua | Ambil log audit aktivitas sirkulasi |

---

## Aturan Bisnis

1. **Akun & Autentikasi**:
   - Token JWT berlaku selama 8 jam.
   - Penambahan siswa/guru otomatis membuat akun dengan username NIS (siswa) atau NIP/NUPTK (guru) dengan default password `password123`.
   - Fitur reset password per akun maupun reset massal seluruh akun non-admin akan mengembalikan kata sandi ke default `password123`.
2. **Katalog & Stok Buku**:
   - Stok tersedia disimpan dan diperbarui langsung pada data buku.
   - QR code mengidentifikasi data buku secara langsung.
3. **Peminjaman & Perpanjangan**:
   - Peminjaman hanya dapat dilakukan bila stok buku tersedia.
   - Perpanjangan masa pinjam hanya diizinkan untuk peminjaman aktif (`ongoing`) dengan batas maksimal 1 kali perpanjangan.
4. **Kondisi Pengembalian & Denda**:
   - Keterlambatan dikenakan denda harian per buku sesuai tarif aktif (default: Rp 1.000/hari).
   - Buku rusak atau hilang dapat dikenakan denda penggantian sesuai persentase dari harga buku.
   - Jika denda belum diselesaikan saat pengembalian buku, transaksi diberi status **`⚠️ Denda Belum Lunas`** (`has_problem_pending`).
   - Transaksi berstatus denda belum lunas dapat diselesaikan sewaktu-waktu oleh petugas/admin menjadi **`has_problem_resolved`**.

---

## Menjalankan Proyek

### Prasyarat

- Node.js versi 18 ke atas
- npm atau yarn
- Proyek Firebase dengan Cloud Firestore aktif
- Akun Cloudinary (opsional, sistem memiliki fallback lokal mandiri)

### Konfigurasi Environment Backend

Buat file `backend/.env`:

```env
PORT=4000
JWT_SECRET=rahasia_jwt_sangat_panjang_dan_aman_12345
FIREBASE_PROJECT_ID=nama-project-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@nama-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Opsional (jika Cloudinary digunakan):
CLOUDINARY_CLOUD_NAME=cloud_name
CLOUDINARY_API_KEY=api_key
CLOUDINARY_API_SECRET=api_secret
```

### Menjalankan Backend (Development)

```bash
cd backend
npm install
npm run dev
```

Server backend akan aktif di `http://localhost:4000`.

### Menjalankan Frontend (Development)

Buka terminal baru:

```bash
cd frontend
npm install
npm run dev
```

Aplikasi frontend akan aktif di `http://localhost:5173`.

### Build Produksi & Mobile Android

```bash
# Build Frontend Web
cd frontend
npm run build
npm run preview

# Sinkronisasi ke Aplikasi Android (Capacitor)
npx cap sync android
npx cap open android
```

---

## Keamanan dan Operasional

- **Kerahasiaan Kredensial**: Jangan menyimpan file `.env`, service account JSON, atau JWT Secret di dalam repository publik.
- **Kebijakan Password**: Anggota disarankan mengganti default password awal setelah login pertama kali.
- **Proteksi API**: Backend menerapkan pembatasan rate limit (`express-rate-limit`) dan proteksi header keamanan HTTP (`helmet`).
- **Pencadangan Data**: Lakukan ekspor laporan transaksi berkala dan aktifkan fitur automated backup pada Google Cloud Firestore.

---

## Lisensi

© 2026 Yayasan Perguruan Tunas Karya. Hak cipta dilindungi undang-undang.
