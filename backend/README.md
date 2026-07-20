# Backend — Inventory & POS API

REST API untuk sistem Inventory & Point of Sale. Node.js + Express + PostgreSQL (Prisma ORM).

## Menjalankan secara lokal

```bash
cp .env.example .env
# isi DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ANTHROPIC_API_KEY dengan nilai asli

npm install
npx prisma migrate dev --name init
SEED_OWNER_PASSWORD="PasswordKuat123!" node prisma/seed.js
npm run dev
```

Server berjalan di `http://localhost:4000`. Semua endpoint berada di bawah `/api/*`.

## Struktur

```
src/
  config/       -> koneksi Prisma
  middleware/   -> auth (JWT), rbac, audit log, validasi input, rate limiter
  routes/       -> satu file per modul (auth, products, purchases, inventory, sales, reports, dashboard, users)
  services/     -> logika bisnis murni: authService, hppService (weighted avg), stockService, ocrService
  jobs/         -> backup database harian (node-cron)
  utils/        -> generator SKU / nomor PO / nomor invoice
prisma/
  schema.prisma -> seluruh model data
  seed.js       -> membuat akun OWNER pertama
```

## Keamanan yang sudah diimplementasikan

| Persyaratan | Implementasi |
|---|---|
| Autentikasi wajib di semua endpoint | `middleware/auth.js` dipasang di setiap router kecuali `/auth/login`, `/auth/refresh`, `/health` |
| RBAC | `middleware/rbac.js` — `authorize('OWNER', 'MANAGER', ...)` di setiap route |
| Password modern hashing | Argon2id (`services/authService.js`) — tidak pernah plain text |
| Validasi input | `express-validator` pada setiap route yang menerima body/query |
| Audit log | `middleware/auditLog.js` — dipanggil di setiap mutasi sensitif (produk, HPP, stok, transaksi, user) |
| Rate limiting login | `middleware/rateLimiter.js` (IP-based) + lockout per-akun di `authService.js` |
| HTTPS | Diterminasi di reverse proxy (nginx/Caddy) di depan Node process — lihat `docs/ARCHITECTURE.md` |
| Backup otomatis | `jobs/scheduleBackup.js` (cron harian) memanggil `pg_dump`, dicatat di tabel `BackupLog` |
| Tidak ada raw SQL dari input user | Semua query lewat Prisma parametrized query builder |
| Tidak ada hapus transaksi tanpa audit | `Sale` tidak pernah di-`delete()` — hanya diubah status jadi `VOID` via endpoint yang wajib audit log + alasan |
| Tidak ada hapus histori stok | `StockMutation` bersifat append-only (tidak ada `update`/`delete` di codebase) |
| Perubahan HPP selalu tercatat | HPP hanya bisa berubah lewat `hppService.js`, yang selalu menulis ke `HppHistory` |
| Tidak ada kredensial hardcoded | Semua secret dibaca dari `.env` (lihat `.env.example`) |

## Modul OCR/AI Nota Supplier

`POST /api/purchases/upload-receipt` menerima foto nota (multipart/form-data field `receipt`),
mengirimkannya ke model vision (Claude) untuk OCR + ekstraksi terstruktur (`services/ocrService.js`),
lalu mencocokkan tiap baris item ke master produk (fuzzy match nama). Item yang tidak cocok
ditandai `needsVerification = true` dan pembelian berstatus `NEEDS_VERIFICATION` sampai staf
gudang/owner menghubungkannya ke produk yang benar (atau membuat produk baru) lewat
`PUT /api/purchases/:id/items/:itemId`. Setelah semua item terverifikasi, `POST /api/purchases/:id/post`
akan menambah stok dan menghitung ulang HPP dengan metode **weighted average cost** secara atomic.
