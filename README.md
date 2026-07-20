# KasirKita POS & Inventory Minimarket (Full-Stack Enterprise)

Sistem Point of Sale (POS) dan Inventori Retail/Grosir modern bertaraf enterprise yang dirancang khusus untuk minimarket dan toko retail. Menggabungkan akurasi akuntansi (**HPP Weighted Average Cost immutable**) dengan otomatisasi modern (**AI OCR Ekstraksi Nota Supplier**), terminal kasir cepat dengan barcode scanner, dan dasbor analitik real-time.

---

## 🌟 Fitur Utama & Keunggulan Arsitektur

1. **🔒 Akuntansi & Stok Immutable (Append-Only Ledger)**
   - Semua pergerakan barang dicatat pada tabel `StockMutation` dan tidak pernah dihapus atau diedit oleh aplikasi (`append-only`).
   - Setiap perubahan HPP (baik otomatis dari pembelian maupun koreksi manual) wajib mencantumkan alasan dan dicatat di `HppHistory`.
   - Transaksi penjualan (`Sale`) tidak pernah dihapus — pembatalan hanya mengubah status menjadi `VOID` dan mengembalikan stok secara atomik di dalam database transaction.

2. **🤖 AI OCR Ekstraksi Nota Supplier (Claude Powered)**
   - Staf gudang/owner cukup mengunggah foto nota fisik supplier.
   - AI mengenali nama barang, kuantitas, harga satuan, dan mencocokkan secara otomatis (`fuzzy match`) dengan master produk sebelum stok diposting.

3. **🛒 Terminal POS Kasir Kecepatan Tinggi**
   - Dukungan scan barcode SKU langsung (auto-focus trigger) maupun pencarian nama produk kilat.
   - Kalkulator pembayaran cerdas dengan tombol shortcut pecahan uang pas / nominal genap.
   - Cetak struk thermal 58mm / 80mm yang bersahabat dengan printer thermal kasir standar.

4. **👥 Role-Based Access Control (RBAC) Bertingkat**
   - Matriks izin berlapis di sisi backend (API middleware) dan frontend (conditional layout):
     - **OWNER**: Akses penuh ke seluruh modul, manajemen user, dan otorisasi VOID transaksi.
     - **MANAGER**: Akses baca laporan finansial, dashboard, dan analisa margin produk.
     - **KASIR**: Khusus terminal transaksi POS kasir.
     - **GUDANG**: Khusus penerimaan barang, upload OCR nota, mutasi, dan opname stok.

5. **📈 Dashboard & Laporan Analitik Realtime (Recharts)**
   - Laba Rugi (P&L) akurat berdasar pendapatan bersih dikurangi HPP Weighted Average aktual.
   - Analisa margin laba per produk dan klasifikasi produk terlaris.
   - Prediksi restock otomatis berdasarkan kecepatan rata-rata penjualan harian (*velocity*).

---

## 🏗️ Arsitektur & Teknologi Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Recharts (`/frontend`)
- **Backend API**: Node.js + Express.js + Prisma ORM + Argon2id Auth (`/backend`)
- **Database**: PostgreSQL 16 (Parametrized query anti-SQL Injection)
- **Orkestrasi**: Docker Compose 3-Service (Zero-configuration startup)

```
[ Web Browser / Kasir ] <---> [ Next.js 14 App Router :3000 ]
                                         ^
                                         | REST API (JWT Bearer / httpOnly Proxy)
                                         v
                              [ Node.js Express API :4000 ]
                                         ^
                                         | Prisma ORM Transactions
                                         v
                              [ PostgreSQL 16 Database :5432 ]
```

---

## 🚀 Mulai Cepat dengan Docker Compose (Direkomendasikan)

Hanya perlu **satu perintah** untuk menjalankan seluruh ekosistem (PostgreSQL, Backend API, dan Frontend Next.js) beserta migrasi skema & seed data awal:

### 1. Prasyarat
Pastikan komputer / server Anda telah terinstal [Docker Desktop / Docker Engine](https://docs.docker.com/get-docker/).

### 2. Jalankan Aplikasi
Dari root direktori project, jalankan:
```bash
docker compose up -d --build
```

Tunggu beberapa saat hingga kontainer selesai dibangun dan database siap. Sistem akan otomatis menjalankan `npx prisma migrate deploy` dan mengisi data awal (`seed.js`).

### 3. Akses Aplikasi
Buka browser dan kunjungi:
- **Frontend App (Next.js UI)**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔐 Akun Default untuk Pengujian (Seeding Data)

Setelah `docker compose up` dijalankan, 4 akun default telah disediakan siap pakai (masing-masing mewakili satu role):

| Role RBAC | Username | Password Default | Akses Modul Utama |
| :--- | :--- | :--- | :--- |
| **OWNER** | `owner` | `ChangeMe123!` | Semua halaman (Dashboard, POS, Produk, Inventori, Pembelian, Laporan, User) |
| **MANAGER** | `manager` | `ChangeMe123!` | Dashboard, Master Produk, Inventori & Stok, Laporan Finansial |
| **KASIR** | `kasir1` | `ChangeMe123!` | Terminal POS Kasir & Cetak Struk |
| **GUDANG** | `gudang1` | `ChangeMe123!` | Master Produk, Inventori & Koreksi Stok, Pembelian & OCR Nota |

> [!CAUTION]
> **Penting untuk Keamanan:** Segera ganti password default `ChangeMe123!` dan rahasia JWT di `.env` setelah Anda login pertama kali atau sebelum melakukan deployment ke server production!

---

## 📂 Struktur Repositori

```
├── docker-compose.yml     -> Orkestrasi 3 service (db, backend, frontend)
├── .env                   -> File konfigurasi environment root (DB secrets, JWT)
├── .gitignore             -> Pengaman file sensitif & build artifacts
├── backend/               -> Backend API Node.js / Express / Prisma
│   ├── prisma/            -> Skema database schema.prisma & seed.js (15 produk minimarket)
│   ├── src/
│   │   ├── routes/        -> Endpoint REST API (/auth, /sales, /products, /purchases, dll)
│   │   ├── services/      -> Core logic (WAC HPP, StockMutation atomic, AI OCR)
│   │   ├── middleware/    -> Auth JWT, RBAC authorize, express-validator, auditLog
│   │   └── jobs/          -> Scheduled pg_dump database backup crontab
│   └── Dockerfile         -> Multi-stage build image untuk backend Node.js
├── frontend/              -> Frontend Web Application Next.js 14 App Router
│   ├── src/
│   │   ├── app/           -> Halaman rute (/login, /dashboard, /kasir, /inventori, dll)
│   │   ├── components/    -> Komponen modular (Sidebar, Navbar, Thermal Receipt)
│   │   └── lib/           -> Client fetch API wrapper dengan auto-refresh token
│   └── Dockerfile         -> Multi-stage build image mode standalone Next.js
└── docs/
    ├── DEPLOYMENT.md      -> Panduan deployment server Nginx HTTPS & automated backup
    └── ARCHITECTURE.md    -> Spesifikasi rancangan arsitektur & ERD lengkap
```

---

## 🛠️ Menjalankan Tanpa Docker (Pengembangan Lokal / Manual)

Jika Anda ingin mengembangkan secara lokal tanpa Docker Compose:

1. **Siapkan PostgreSQL lokal**, buat database baru, dan set variabel `DATABASE_URL` di `backend/.env`.
2. **Jalankan Backend Node.js**:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   node prisma/seed.js
   npm run dev
   ```
   Backend akan berjalan pada port `4000`.

3. **Jalankan Frontend Next.js**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Buka `http://localhost:3000` di browser Anda.

---

## 📖 Dokumentasi Lanjut
- Lihat **[docs/DEPLOYMENT.md](file:///d:/MEEE/RANDOM/kasir/docs/DEPLOYMENT.md)** untuk panduan setup VPS, firewall UFW, Nginx Reverse Proxy SSL Let's Encrypt, dan cron backup otomatis.
- Lihat **[docs/ARCHITECTURE.md](file:///d:/MEEE/RANDOM/kasir/docs/ARCHITECTURE.md)** untuk diagram relasi entitas (ERD), rumus matematika HPP Weighted Average Cost, dan alur audit log.
