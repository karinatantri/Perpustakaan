# Penjelasan Database `items` dan `transaction_items`

Kedua koleksi ini dipakai untuk mencatat **eksemplar fisik** buku dan riwayat peminjamannya. Mereka berbeda dari koleksi `books`, yang menyimpan informasi judul buku secara umum.

## `items` — eksemplar fisik buku

Satu dokumen `items` mewakili satu buku fisik yang memiliki kode unik/QR sendiri. Contohnya, buku dengan judul *Laskar Pelangi* tersedia tiga buah; koleksi `books` menyimpan data judulnya satu kali, sementara koleksi `items` memiliki tiga dokumen eksemplar.

| Field | Fungsi |
| --- | --- |
| `id` | ID dokumen eksemplar di Firestore. |
| `bookId` | Relasi ke `books.id`, yaitu judul/metadata buku induknya. |
| `uniqueCode` | Kode inventaris atau nilai QR yang dipindai saat pinjam dan kembali. Harus unik per eksemplar. |
| `status` | Keadaan ketersediaan: `available`, `borrowed`, `lost`, atau `damaged`. |
| `createdAt`, `updatedAt` | Waktu pembuatan dan perubahan terakhir data. |

Saat buku dipinjam, status `items` berubah dari `available` menjadi `borrowed`. Saat kembali dalam kondisi baik, status menjadi `available`; bila hilang atau rusak, status disimpan sebagai `lost` atau `damaged` agar eksemplar tersebut tidak dapat dipinjam lagi.

## `transaction_items` — detail buku di dalam transaksi

Satu transaksi peminjaman dapat berisi lebih dari satu eksemplar buku. Koleksi `transaction_items` adalah detail penghubung antara `transactions` dan `items`: satu dokumen menyatakan **satu eksemplar dalam satu transaksi**.

| Field | Fungsi |
| --- | --- |
| `id` | ID dokumen detail transaksi. |
| `transactionId` | Relasi ke `transactions.id`, yaitu transaksi peminjaman induknya. |
| `itemId` | Relasi ke `items.id`, yaitu eksemplar fisik yang dipinjam. |
| `condition` | Kondisi saat pengembalian: `good`, `damaged`, atau `lost`. Pada saat pinjam nilainya `good`. |
| `fine` | Nominal denda untuk eksemplar ini. |
| `notes` | Catatan petugas, misalnya jenis kerusakan. |
| `paymentStatus` | Status pelunasan denda: `paid` atau `pending`, bila ada denda. |
| `paidAt` | Waktu denda dibayar. |
| `createdAt`, `updatedAt` | Waktu pembuatan dan perubahan detail. |

Relasinya:

```text
books (judul buku)
  └── items (eksemplar fisik + QR unik)
        └── transaction_items (eksemplar tersebut pada transaksi tertentu)
              └── transactions (peminjam, tanggal, dan status transaksi)
```

Dengan struktur ini, sistem dapat mengetahui eksemplar mana yang sedang dipinjam, menghitung stok tersedia dengan tepat, mendukung pengembalian sebagian, serta mencatat denda atau kerusakan per buku tanpa mengganggu buku lain dalam transaksi yang sama.
