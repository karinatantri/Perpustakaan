# Sistem Informasi Perpustakaan & Inventaris Sekolah

Aplikasi full-stack untuk mengelola katalog dan eksemplar buku, siswa, peminjaman/pengembalian, denda, inventaris sekolah, akun berbasis peran, notifikasi, serta laporan. Aplikasi tersedia sebagai web responsif, PWA, dan Android melalui Capacitor.

> Dokumentasi ini disusun dari implementasi dalam `frontend/src` dan `backend/src`. Firestore adalah database NoSQL; relasi pada ERD adalah relasi logis melalui field ID.

## Daftar isi

- [Fitur dan arsitektur](#fitur-utama)
- [Aktor dan hak akses](#aktor-dan-hak-akses)
- [ERD](#erd-entity-relationship-diagram)
- [Diagram konteks dan DFD](#diagram-konteks)
- [Use case dan UML](#use-case-diagram)
- [Alur kerja dan flowchart](#alur-kerja-dan-flowchart)
- [Activity, sequence, dan state diagram](#activity-diagram)
- [Wireframe](#wireframe)
- [API dan instalasi](#ringkasan-api)

## Fitur utama

1. Autentikasi JWT dan otorisasi berbasis peran.
2. CRUD siswa, impor/ekspor Excel, dan pembuatan akun siswa otomatis.
3. Katalog buku beserta eksemplar fisik berkode unik/QR.
4. Peminjaman multi-buku, struk QR, perpanjangan satu kali, dan riwayat.
5. Pengembalian penuh/parsial; kondisi baik, rusak, atau hilang; denda lunas/tertunda.
6. Inventaris nonbuku dengan mutasi stok masuk/keluar dan audit log.
7. Dashboard, scanner QR, notifikasi audit, FCM, surat peringatan, dan laporan.
8. Aturan perpustakaan dinamis: lama pinjam, batas buku, dan tarif denda.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | React 18, React Router, Axios, Vite, CSS |
| Scanner/QR | html5-qrcode, jsQR, qrcode, bwip-js |
| Mobile | Capacitor Android, PWA, Push Notifications |
| Backend | Node.js, Express REST API |
| Keamanan | JWT, bcryptjs, Helmet, rate limiter |
| Data/media | Firestore, Firebase Admin, Cloudinary, FCM |
| Dokumen | SheetJS/XLSX, HTML receipt |
| Deployment | Vercel, Netlify, Railway, Docker |

## Arsitektur sistem

```mermaid
flowchart LR
  subgraph Client
    WEB[Web React]
    PWA[PWA]
    AND[Android Capacitor]
  end
  subgraph Backend
    API[Express REST API] --> AUTH[JWT dan RBAC] --> SERVICE[Logika bisnis]
  end
  WEB --> API
  PWA --> API
  AND --> API
  SERVICE --> DB[(Firestore)]
  SERVICE --> IMG[(Cloudinary)]
  SERVICE --> FCM[Firebase Cloud Messaging]
```

## Aktor dan hak akses

| Fitur | Admin | Petugas | Guru | Siswa | Kepala sekolah |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard, katalog, transaksi sesuai cakupan | Ya | Ya | Ya | Ya | Ya |
| Kelola siswa | Ya | Tambah/ubah | Baca kelas wali | Tidak | Baca |
| Hapus siswa | Ya | Tidak | Tidak | Tidak | Tidak |
| Kelola buku/eksemplar | Ya | Ya, kecuali hapus buku | Baca | Baca | Baca |
| Peminjaman dan pengembalian | Ya | Ya | Tidak | Tidak | Tidak |
| Perpanjang pinjaman | Ya | Ya | Tidak | Milik sendiri | Tidak |
| Kelola inventaris | Ya | Ya | Baca | Baca | Baca |
| Kelola akun/aturan | Ya | Tidak | Tidak | Tidak | Tidak |
| Ekspor laporan | Ya | Ya | Tidak | Tidak | Ya |

Guru hanya memperoleh siswa/transaksi pada `homeroomClass`; siswa hanya memperoleh transaksi sesuai `studentId`. Backend menerapkan kembali pembatasan tersebut.

## Struktur proyek

```text
.
├── backend/
│   ├── api/index.js
│   ├── src/
│   │   ├── app.js, server.js, firebase.js, cloudinary.js
│   │   ├── middleware/auth.js
│   │   ├── routes/        # auth, users, students, books, items,
│   │   │                  # transactions, inventories, settings, notifications
│   │   └── utils/         # QR, struk, dan notifikasi
│   ├── seed.js
│   └── seed_data.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx, api.js
│   │   ├── pages/
│   │   ├── components/
│   │   └── utils/
│   ├── public/            # manifest, service worker, ikon
│   └── android/           # proyek Capacitor
├── netlify/functions/api.js
├── firestore.indexes.json
├── docker-compose.yml
├── vercel.json
├── netlify.toml
└── railway.json
```

## ERD (Entity Relationship Diagram)

```mermaid
erDiagram
  STUDENTS ||--o| USERS : memiliki_akun
  STUDENTS ||--o{ TRANSACTIONS : melakukan
  USERS ||--o{ FCM_TOKENS : mendaftarkan
  BOOKS ||--o{ ITEMS : memiliki
  TRANSACTIONS ||--|{ TRANSACTION_ITEMS : berisi
  ITEMS ||--o{ TRANSACTION_ITEMS : dipinjam
  INVENTORIES ||--o{ INVENTORY_LOGS : memiliki
  ITEMS ||--o{ FOUND_BOOKS : ditemukan

  USERS {
    string id PK
    string username UK
    string passwordHash
    string name
    string role
    string studentId FK
    string homeroomClass
    datetime createdAt
  }
  STUDENTS {
    string id PK
    string nis UK
    string name
    string class
    string major
    string email
    string phone
    string status
  }
  BOOKS {
    string id PK
    string title
    string author
    string category
    string publisher
    string location
    string coverUrl
    string qrCodeUrl
    number totalCopies
  }
  ITEMS {
    string id PK
    string bookId FK
    string inventoryId FK
    string uniqueCode UK
    string barcode
    string status
    string location
  }
  TRANSACTIONS {
    string id PK
    string studentId FK
    string receiptNumber UK
    datetime borrowDate
    datetime dueDate
    datetime returnDate
    string status
    number itemCount
    number totalFine
    string paymentStatus
    boolean renewed
  }
  TRANSACTION_ITEMS {
    string id PK
    string transactionId FK
    string itemId FK
    string condition
    number fine
    string paymentStatus
    boolean resolved
    string resolvedAction
  }
  INVENTORIES {
    string id PK
    string name
    string category
    string unit
    number stock
    number minimumStock
    string itemCode UK
    string qrCodeUrl
  }
  INVENTORY_LOGS {
    string id PK
    string inventoryId FK
    string type
    number quantity
    string notes
    string actorName
    datetime createdAt
  }
  FCM_TOKENS {
    string token PK
    string userId FK
    string platform
  }
  FOUND_BOOKS {
    string id PK
    string itemId FK
    string status
    datetime foundDate
  }
```

Koleksi pendukung lain: `settings/library_rules` menyimpan tarif dan batas; `notifications` menyimpan audit aktivitas. Status utama:

- Item: `available`, `borrowed`, `damaged`, `lost`, `found`.
- Transaksi: `ongoing`, `partially_returned`, `completed`, `has_problem_pending`, `has_problem_resolved`.
- Kondisi pengembalian: `good`, `damaged`, `lost`.

## Diagram konteks

```mermaid
flowchart LR
  A[Admin] -->|akun, siswa, buku, aturan| SYS((Sistem Perpustakaan dan Inventaris))
  O[Petugas] -->|peminjaman, pengembalian, stok| SYS
  T[Guru] -->|permintaan data kelas/katalog| SYS
  S[Siswa] -->|login, pinjaman, perpanjangan| SYS
  P[Kepala Sekolah] -->|statistik dan laporan| SYS
  SYS -->|data master, audit, laporan| A
  SYS -->|struk, transaksi, notifikasi| O
  SYS -->|siswa wali dan transaksi kelas| T
  SYS -->|riwayat dan jatuh tempo| S
  SYS -->|dashboard dan ekspor| P
  SYS <-->|dokumen| DB[(Firestore)]
  SYS <-->|QR dan gambar| CL[Cloudinary]
  SYS -->|push| FCM[FCM]
```

## DFD Level 0

```mermaid
flowchart LR
  U[Pengguna] -->|kredensial dan permintaan| P0((0. Sistem Perpustakaan))
  P0 -->|token, data, hasil proses| U
  P0 <-->|data operasional| D[(Firestore)]
  P0 <-->|media| C[(Cloudinary)]
  P0 -->|pesan perangkat| N[FCM]
```

## DFD Level 1

```mermaid
flowchart TB
  U[Pengguna]
  P1((1.0 Autentikasi dan Akun))
  P2((2.0 Data Siswa))
  P3((3.0 Buku dan Eksemplar))
  P4((4.0 Sirkulasi))
  P5((5.0 Inventaris))
  P6((6.0 Laporan dan Notifikasi))
  D1[(D1 Users dan Tokens)]
  D2[(D2 Students)]
  D3[(D3 Books dan Items)]
  D4[(D4 Transactions dan Tx Items)]
  D5[(D5 Inventories dan Logs)]
  D6[(D6 Settings dan Notifications)]
  U <--> P1 <--> D1
  U <--> P2 <--> D2
  U <--> P3 <--> D3
  U <--> P4
  P4 <--> D2
  P4 <--> D3
  P4 <--> D4
  P4 <--> D6
  U <--> P5 <--> D5
  U <--> P6
  P6 <--> D2
  P6 <--> D3
  P6 <--> D4
  P6 <--> D5
  P6 <--> D6
```

## DFD Level 2

### Dekomposisi 4.0 — sirkulasi

```mermaid
flowchart TB
  O[Admin/Petugas] --> P41((4.1 Identifikasi siswa))
  P41 <--> DS[(Students)]
  P41 --> P42((4.2 Scan dan validasi item))
  P42 <--> DI[(Books dan Items)]
  P42 --> P43((4.3 Buat peminjaman))
  P43 --> DT[(Transactions dan Tx Items)]
  O --> P44((4.4 Cari transaksi aktif))
  P44 <--> DT
  P44 --> P45((4.5 Nilai kondisi dan denda))
  P45 <--> CFG[(Settings)]
  P45 --> P46((4.6 Proses pengembalian))
  P46 --> DI
  P46 --> DT
  P43 --> P47((4.7 Struk dan notifikasi))
  P46 --> P47
  P47 --> S[Siswa]
```

### Dekomposisi 5.0 — inventaris

```mermaid
flowchart LR
  U[Admin/Petugas] --> P51((5.1 Input/ubah barang))
  U --> P52((5.2 Mutasi stok))
  U --> P53((5.3 Generate/scan QR))
  P51 <--> D1[(Inventories)]
  P52 <--> D1
  P52 --> D2[(Inventory Logs)]
  P52 --> D3[(Notifications)]
  P53 <--> D1
  P53 <--> C[Cloudinary]
  R[Guru/Siswa/Kepsek] --> P54((5.4 Lihat inventaris)) --> D1
```

## Use Case Diagram

Mermaid belum memiliki bentuk use-case resmi; bentuk stadion berikut mewakili use case.

```mermaid
flowchart LR
  Admin[Admin]
  Officer[Petugas]
  Teacher[Guru]
  Student[Siswa]
  Principal[Kepala Sekolah]
  subgraph Sistem
    U1([Login/logout])
    U2([Lihat dashboard/katalog])
    U3([Kelola siswa])
    U4([Kelola buku/eksemplar])
    U5([Proses peminjaman])
    U6([Pengembalian dan denda])
    U7([Kelola inventaris])
    U8([Scan QR])
    U9([Kelola akun/aturan])
    U10([Cetak/ekspor laporan])
    U11([Lihat transaksi sendiri/kelas])
    U12([Perpanjang pinjaman])
  end
  Admin --- U1 & U2 & U3 & U4 & U5 & U6 & U7 & U8 & U9 & U10
  Officer --- U1 & U2 & U3 & U4 & U5 & U6 & U7 & U8 & U10
  Teacher --- U1 & U2 & U11
  Student --- U1 & U2 & U11 & U12
  Principal --- U1 & U2 & U10
```

## UML

### Class diagram

```mermaid
classDiagram
  class User {
    +username: string
    +role: Role
    +studentId: string
    +homeroomClass: string
  }
  class Student {
    +nis: string
    +name: string
    +class: string
    +status: string
  }
  class Book {
    +title: string
    +totalCopies: number
    +addStock()
    +reduceStock()
  }
  class Item {
    +uniqueCode: string
    +status: ItemStatus
  }
  class Transaction {
    +receiptNumber: string
    +status: TxStatus
    +dueDate: datetime
    +renew()
    +returnItems()
  }
  class TransactionItem {
    +condition: string
    +fine: number
    +paymentStatus: string
  }
  class Inventory {
    +name: string
    +stock: number
    +mutateStock()
  }
  class InventoryLog {
    +type: string
    +quantity: number
    +actorName: string
  }
  Student "1" --> "0..1" User
  Student "1" --> "0..*" Transaction
  Book "1" *-- "0..*" Item
  Transaction "1" *-- "1..*" TransactionItem
  TransactionItem "*" --> "1" Item
  Inventory "1" *-- "0..*" InventoryLog
```

### Component diagram

```mermaid
flowchart LR
  UI[React Pages/Components] --> HTTP[Axios Client]
  HTTP --> APP[Express App]
  APP --> MW[JWT/RBAC Middleware]
  MW --> ROUTES[Route Modules]
  ROUTES --> FIREBASE[Firebase Adapter] --> FS[(Firestore)]
  ROUTES --> QR[QR/Receipt Utilities] --> CLOUD[(Cloudinary)]
  ROUTES --> NOTIF[Notification Utility] --> FCM[FCM]
```

### Deployment diagram

```mermaid
flowchart TB
  DEVICE[Browser/PWA/Android] -->|HTTPS| HOST[Frontend hosting]
  DEVICE -->|REST JSON| API[Express: Vercel/Netlify/Railway/Docker]
  HOST --> API
  API --> FIRESTORE[(Firestore)]
  API --> CLOUDINARY[(Cloudinary CDN)]
  API --> FCM[Firebase Cloud Messaging]
```

## Alur kerja dan flowchart

### Alur umum

```mermaid
flowchart TD
  A[Buka aplikasi] --> B{Token valid?}
  B -- Tidak --> C[Login]
  C --> D{Kredensial valid?}
  D -- Tidak --> C
  D -- Ya --> E[JWT 8 jam dan profil]
  B -- Ya --> F[Dashboard]
  E --> F
  F --> G{Role}
  G -- Admin --> H[Semua modul]
  G -- Petugas --> I[Operasional]
  G -- Guru --> J[Kelas wali/katalog]
  G -- Siswa --> K[Pinjaman sendiri]
  G -- Kepsek --> L[Monitoring/laporan]
  H & I & J & K & L --> M[API verifikasi JWT dan role]
  M --> N[Firestore/layanan cloud]
```

### Flowchart peminjaman

```mermaid
flowchart TD
  A[Scan/pilih siswa] --> B{Siswa aktif?}
  B -- Tidak --> X[Tolak]
  B -- Ya --> C[Scan/cari eksemplar]
  C --> D{Item ditemukan dan available?}
  D -- Tidak --> C
  D -- Ya --> E[Masukkan keranjang]
  E --> F{Tambah buku?}
  F -- Ya --> C
  F -- Tidak --> G[Tentukan jatuh tempo]
  G --> H[Transaksi atomik Firestore]
  H --> I[Buat transaction dan transaction_items]
  I --> J[Item menjadi borrowed]
  J --> K[Buat nomor struk TX dan QR]
  K --> L[Kirim push dan tampilkan struk]
```

### Flowchart pengembalian

```mermaid
flowchart TD
  A[Scan struk/cari siswa] --> B[Ambil transaksi aktif]
  B --> C[Pilih item yang kembali]
  C --> D[Tentukan kondisi]
  D --> E{Kondisi baik?}
  E -- Ya --> F[Item available]
  E -- Tidak --> G[Isi denda/catatan]
  G --> H{Denda dibayar?}
  H -- Tidak --> I[has_problem_pending]
  H -- Ya --> J[has_problem_resolved]
  F --> K{Semua item kembali?}
  K -- Tidak --> L[partially_returned]
  K -- Ya --> M[completed]
  I & J & L & M --> N[Simpan atomik]
  N --> O[Notifikasi dan struk]
```

### Flowchart inventaris

```mermaid
flowchart TD
  A[Pilih/scan barang] --> B[Pilih stok masuk/keluar]
  B --> C[Jumlah dan catatan]
  C --> D{Jumlah valid?}
  D -- Tidak --> C
  D -- Ya --> E{Keluar melebihi stok?}
  E -- Ya --> F[Tolak]
  E -- Tidak --> G[Update stock]
  G --> H[Simpan inventory_log]
  H --> I[Buat notifikasi audit]
```

## Activity Diagram

```mermaid
flowchart LR
  subgraph Siswa
    S1[Tunjukkan kartu/QR]
    S2[Terima struk/notifikasi]
  end
  subgraph Petugas
    O1[Scan siswa]
    O2[Scan buku]
    O3[Konfirmasi]
  end
  subgraph Sistem
    X1[Validasi]
    X2[Simpan transaksi atomik]
    X3[Perbarui item]
    X4[Buat struk]
  end
  S1 --> O1 --> X1 --> O2 --> O3 --> X2 --> X3 --> X4 --> S2
```

Aktivitas penyelesaian denda:

```mermaid
flowchart TD
  A[has_problem_pending] --> B[Petugas buka transaksi]
  B --> C{Penyelesaian}
  C -- Bayar --> D[Payment paid]
  C -- Ganti buku --> E[Item pengganti available]
  D --> F[Tx item resolved]
  E --> F
  F --> G[has_problem_resolved]
```

## Sequence Diagram

### Login

```mermaid
sequenceDiagram
  actor U as Pengguna
  participant FE as React
  participant API as Express
  participant DB as Firestore
  U->>FE: username dan password
  FE->>API: POST /api/auth/login
  API->>DB: cari user
  DB-->>API: user dan passwordHash
  API->>API: bcrypt.compare + jwt.sign
  API-->>FE: token dan profil
  FE->>FE: simpan token/user
  FE-->>U: dashboard sesuai role
```

### Peminjaman

```mermaid
sequenceDiagram
  actor O as Petugas
  participant FE as BorrowPage
  participant API as Transactions API
  participant DB as Firestore
  participant PUSH as FCM
  O->>FE: pilih siswa dan scan buku
  FE->>API: GET book/item by code
  API->>DB: baca book/item
  DB-->>API: item available
  API-->>FE: detail item
  O->>FE: konfirmasi
  FE->>API: POST /transactions/borrow
  API->>DB: transaction atomik
  Note over API,DB: buat transaksi/item dan ubah status
  DB-->>API: commit
  API-->>PUSH: info jatuh tempo
  API-->>FE: transactionId + receiptNumber
  FE-->>O: struk QR
```

### Pengembalian

```mermaid
sequenceDiagram
  actor O as Petugas
  participant FE as ReturnPage
  participant API as Transactions API
  participant DB as Firestore
  participant PUSH as FCM
  O->>FE: scan receiptNumber
  FE->>API: GET /transactions/by-receipt/:number
  API->>DB: baca transaksi dan items
  DB-->>API: detail aktif
  API-->>FE: daftar eksemplar
  O->>FE: kondisi, denda, pembayaran
  FE->>API: POST /transactions/return
  API->>DB: update atomik
  DB-->>API: commit
  API-->>PUSH: hasil pengembalian
  API-->>FE: status dan totalFine
  FE-->>O: struk pengembalian
```

## State Diagram

### Eksemplar

```mermaid
stateDiagram-v2
  [*] --> available
  available --> borrowed: dipinjam
  borrowed --> available: kembali baik
  borrowed --> damaged: rusak
  borrowed --> lost: hilang
  available --> found: ditemukan
  damaged --> available: diperbaiki/diganti
  lost --> available: diganti
```

### Transaksi

```mermaid
stateDiagram-v2
  [*] --> ongoing
  ongoing --> ongoing: diperpanjang satu kali
  ongoing --> partially_returned: kembali sebagian
  partially_returned --> partially_returned: bertahap
  ongoing --> completed: semua baik
  partially_returned --> completed: sisa kembali
  ongoing --> has_problem_pending: masalah belum lunas
  partially_returned --> has_problem_pending: masalah belum lunas
  ongoing --> has_problem_resolved: langsung lunas
  has_problem_pending --> has_problem_resolved: bayar/ganti
  completed --> [*]
  has_problem_resolved --> [*]
```

## Wireframe

### Desktop — dashboard

```text
┌──────────────────────┬──────────────────────────────────────────────────────┐
│ LOGO Perpustakaan    │ Dashboard                              🔔 Pengguna   │
│ YP. Tunas Karya      ├────────────┬────────────┬────────────┬───────────────┤
│ ▣ Dashboard          │ Total Buku │ Tersedia   │ Dipinjam   │ Total Siswa   │
│ ♟ Data Siswa         ├────────────┴────────────┴────────────┴───────────────┤
│ ▤ Buku & Barang      │ Ringkasan transaksi / aktivitas terbaru             │
│ ◉ Scan QR            ├──────────────────────────┬───────────────────────────┤
│ ⇧ Peminjaman         │ Transaksi terlambat      │ Stok/notifikasi audit     │
│ ⇩ Pengembalian       │                          │                           │
│ ☷ Transaksi          │                          │                           │
│ ⚙ Akun (admin)       │                          │                           │
│ [profil] [Keluar]    │                          │                           │
└──────────────────────┴──────────────────────────┴───────────────────────────┘
```

### Desktop — peminjaman

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Peminjaman Buku                                                            │
├──────────────────────────────────┬─────────────────────────────────────────┤
│ 1. Siswa                         │ 2. Eksemplar                            │
│ [Cari NIS/nama........] [Scan]   │ [Scan/cari kode buku............]      │
│ [Nama / NIS / Kelas]             │ [Judul | Kode | Status | Hapus]         │
├──────────────────────────────────┴─────────────────────────────────────────┤
│ Pinjam [.....] Jatuh tempo [.....] Catatan [...........................]  │
│                                          [Batal] [Konfirmasi Peminjaman]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Mobile

```text
┌──────────────────────────┐
│ LOGO Perpustakaan  🔔 ◉  │
├──────────────────────────┤
│ Judul Halaman            │
│ ┌──────────────────────┐ │
│ │ Ringkasan / Form     │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Daftar berbentuk     │ │
│ │ kartu responsif      │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ Dashboard Katalog Scan ⋯ │
└──────────────────────────┘
```

### Navigasi halaman

```mermaid
flowchart TD
  LANDING[Landing /] --> LOGIN[Login /login] --> DASH[Dashboard /app]
  DASH --> STUDENTS[Data Siswa]
  DASH --> BOOKS[Buku dan Barang]
  DASH --> SCAN[Scan QR]
  DASH --> BORROW[Peminjaman]
  DASH --> RETURN[Pengembalian]
  DASH --> TX[Transaksi]
  DASH --> ACCOUNTS[Akun]
  BOOKS --> CATALOG[Katalog Buku]
  BOOKS --> INVENTORY[Inventaris]
  SCAN --> BORROW
  SCAN --> RETURN
```

## Ringkasan API

Selain login, health, dan statistik publik, endpoint memakai `Authorization: Bearer <JWT>`.

| Modul | Endpoint utama | Role |
|---|---|---|
| Auth | `POST /api/auth/login` | Publik |
| Siswa | `GET /api/students`, `/search`, `/export` | Sesuai endpoint |
| Siswa | `POST /api/students`, `/import`; `PUT /:id` | Admin, petugas |
| Siswa | `DELETE /api/students/:id` | Admin |
| Buku | `GET /api/books`, `/search`, `/by-code/:code` | Semua role |
| Buku | create/import/update/add-stock/reduce-stock | Admin, petugas |
| Buku | `DELETE /api/books/:id` | Admin |
| Item | `GET /api/items`, `/by-code/:code` | Sesuai endpoint |
| Sirkulasi | `POST /api/transactions/borrow`, `/return`, `/found-book` | Admin, petugas |
| Sirkulasi | `PUT /api/transactions/:id/renew` | Admin, petugas, siswa |
| Kasus | `PUT /api/transactions/:id/resolve-pending` | Admin, petugas |
| Transaksi | list, stats, receipt, return-receipt | Semua role; data difilter |
| Ekspor | `GET /api/transactions/export` | Admin, petugas, kepsek |
| Inventaris | list, QR | Semua role |
| Inventaris | create/update/delete/logs | Admin, petugas |
| Aturan | `GET /api/settings`; `PUT /api/settings` | Semua; update admin |
| Akun | CRUD `/api/users` | Admin |
| FCM | register/deregister token | Semua role |
| Notifikasi | `GET /api/notifications` | Semua role |

Health check: `GET /health`, `GET /api/health`. Statistik landing: `GET /api/public/stats`.

## Aturan bisnis

1. JWT berlaku 8 jam; route memverifikasi JWT dan role.
2. Pembuatan/impor siswa juga membuat akun siswa dengan username NIS.
3. Satu buku memiliki banyak `items` dengan `uniqueCode`.
4. Hanya item `available` dapat dipinjam; perubahan transaksi/item memakai operasi atomik.
5. Perpanjangan hanya untuk transaksi `ongoing` dan maksimal satu kali.
6. Pengembalian dapat parsial; rusak/hilang dapat memicu denda tertunda.
7. Kasus tertunda diselesaikan lewat pembayaran atau penggantian.
8. Stok inventaris tidak boleh negatif dan setiap mutasi dicatat.
9. Default aturan: 7 hari, 3 buku, Rp1.000/hari, rusak 50%, hilang 100%.

> Catatan: `books.totalCopies` juga dimutasi selama sirkulasi, sementara endpoint daftar menghitung ketersediaan aktual dari `items.status`. Untuk ketersediaan operasional, status item adalah sumber yang lebih kuat.

## Menjalankan proyek

### Prasyarat

Node.js 18+, npm, Firebase/Firestore, Cloudinary, dan kredensial FCM bila push digunakan.

### Environment backend

Buat `backend/.env`:

```env
PORT=4000
JWT_SECRET=ganti_dengan_rahasia_yang_panjang
FIREBASE_PROJECT_ID=project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLOUDINARY_CLOUD_NAME=cloud-name
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret
```

Environment frontend opsional:

```env
VITE_API_BASE_URL=http://localhost:4000/api
```

### Development

```bash
cd backend
npm install
npm run dev
```

Pada terminal lain:

```bash
cd frontend
npm install
npm run dev
```

### Seed, build, Android, dan Docker

```bash
# database development saja
cd backend
node seed.js
node seed_data.js

# web
cd ../frontend
npm run build
npm run preview

# Android
npx cap sync android
npx cap open android

# dari root proyek
docker compose up --build
```

## Keamanan dan operasional

- Jangan commit `.env`, service account, private key, atau secret Cloudinary.
- Ganti password awal siswa; proses create/import saat ini memakai password awal statis.
- Batasi origin CORS pada produksi; konfigurasi saat ini menerima semua origin.
- Gunakan HTTPS, JWT secret kuat, backup Firestore, dan retensi log.
- Deploy `firestore.indexes.json` agar query gabungan tetap efisien.

## Lisensi

© 2026 YP Tunas Karya. Hak cipta dilindungi undang-undang.

# Perpustakaan
