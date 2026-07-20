# Arsitektur Sistem — Inventory & POS

## 1. Gambaran Umum

```
┌─────────────────┐        HTTPS (TLS via reverse proxy)        ┌──────────────────────┐
│  Frontend (SPA)  │ ───────────────────────────────────────────▶│  Reverse Proxy         │
│  React/Next.js   │◀─────────────────────────────────────────── │  (nginx / Caddy)       │
│  - Kasir (POS)    │                                              │  - Terminasi TLS       │
│  - Dashboard      │                                              │  - Rate limit layer 7  │
│  - Inventori      │                                              └──────────┬────────────┘
│  - Laporan        │                                                         │ HTTP (internal)
└──────────────────┘                                                          ▼
                                                              ┌───────────────────────────┐
                                                              │  Backend API (Node/Express)│
                                                              │  - Auth (JWT + Argon2id)   │
                                                              │  - RBAC middleware         │
                                                              │  - Audit log middleware    │
                                                              │  - Modul: Produk, Pembelian,│
                                                              │    Inventori, Kasir, Laporan│
                                                              └──────────┬─────────────────┘
                                                                         │ Prisma (parametrized)
                                                                         ▼
                                                              ┌───────────────────────────┐
                                                              │  PostgreSQL                │
                                                              │  + pg_dump cron backup     │
                                                              └───────────────────────────┘
                                                                         ▲
                                                              ┌──────────┴─────────────────┐
                                                              │ Vision LLM (OCR nota)       │
                                                              │ dipanggil dari backend saja │
                                                              │ (API key tidak pernah       │
                                                              │  diekspos ke frontend)      │
                                                              └────────────────────────────┘
```

Frontend dan backend sepenuhnya terpisah dan hanya berkomunikasi lewat REST API (`/api/*`)
berformat JSON, sehingga frontend bisa diganti (web, mobile, kios kasir) tanpa mengubah backend.

## 2. Entity Relationship (ringkas)

- **User** (role: OWNER/MANAGER/KASIR/GUDANG) → membuat **Purchase**, **Sale**, **StockMutation**, **AuditLog**
- **Product** → milik satu **Category**, punya banyak **ProductSupplier** (relasi n:n ke **Supplier**)
- **Product** → punya riwayat **HppHistory** (setiap perubahan HPP tercatat)
- **Purchase** (nota supplier) → punya banyak **PurchaseItem**; item bisa mengarah ke **Product**
  yang sudah ada atau `null` (menunggu verifikasi)
- **StockMutation** adalah *ledger* tunggal dan satu-satunya sumber kebenaran jumlah stok —
  setiap pembelian, penjualan, retur, dan penyesuaian membuat baris baru di sini, tidak pernah diubah/dihapus
- **Sale** → punya banyak **SaleItem** (snapshot harga & HPP saat transaksi) dan bisa memiliki **SaleReturn**
- **AuditLog** mencatat setiap mutasi sensitif secara generik (before/after JSON) lintas seluruh modul

Skema lengkap: `backend/prisma/schema.prisma`.

## 3. Alur Perhitungan Kunci

**Weighted Average Cost (HPP):**
```
HPP_baru = ((stok_lama × HPP_lama) + (qty_masuk × harga_beli_satuan)) / (stok_lama + qty_masuk)
```
Dihitung ulang setiap kali pembelian diposting (`services/hppService.js`), selalu dalam satu
transaksi database bersama pencatatan `StockMutation` agar stok dan biaya selalu konsisten.

**Laba:** `laba = harga_jual − HPP` dihitung per baris transaksi penjualan (snapshot `unitHpp`
disimpan di `SaleItem` saat transaksi terjadi), sehingga laporan laba-rugi tetap akurat meskipun
HPP produk berubah di kemudian hari.

**Alert stok menipis:** `currentStock <= minStock`, dihitung real-time dari cache `Product.currentStock`
yang selalu disinkronkan dengan ledger `StockMutation` dalam transaksi database yang sama.

**Prediksi restock:** rata-rata penjualan harian (trailing 30 hari, dapat dikonfigurasi) dikalikan
target hari cadangan (default 14 hari) dikurangi stok saat ini — model transparan berbasis moving
average, bisa diganti algoritma yang lebih canggih tanpa mengubah kontrak API (`services/stockService.js`).

## 4. Role-Based Access Control

| Modul | OWNER | MANAGER | KASIR | GUDANG |
|---|---|---|---|---|
| Master produk (create/edit) | ✅ | ❌ (read-only) | ❌ | ✅ create only |
| Perubahan HPP manual | ✅ | ❌ | ❌ | ❌ |
| Pembelian (upload nota, verifikasi, posting) | ✅ | ❌ (read-only) | ❌ | ✅ |
| Inventori (stok masuk/keluar/penyesuaian) | ✅ | 👁 read-only | ❌ | ✅ |
| Kasir (transaksi penjualan) | ✅ | ❌ | ✅ | ❌ |
| Void / retur transaksi | ✅ | ❌ | retur ✅ / void ❌ | ❌ |
| Laporan & Dashboard | ✅ | ✅ | ❌ | ❌ |
| Manajemen user & role | ✅ | ❌ | ❌ | ❌ |

Ditegakkan di server lewat `middleware/rbac.js` pada setiap route — bukan hanya disembunyikan
di UI frontend.

## 5. Kesiapan menjadi ERP skala kecil

Desain modular ini disiapkan untuk ekstensi tanpa merombak fondasi:

- **Multi-cabang:** model `StockMutation` sudah memiliki tipe `TRANSFER` yang belum dipakai;
  tinggal menambahkan model `Branch` dan kolom `branchId` di `Product`/`Sale`/`Purchase`.
- **Loyalty program:** tinggal menambah model `Customer` + `LoyaltyPoint`, dan mengaitkan
  `Sale.customerId` (opsional) tanpa mengubah alur checkout yang ada.
- **Marketplace:** modul `Purchase`/`Sale` sudah terpisah dari channel asalnya; menambahkan
  `channel` (enum: POS, ONLINE) dan integrasi webhook marketplace bisa dilakukan sebagai modul baru
  yang memanggil `stockService`/`hppService` yang sama, tanpa duplikasi logika.
- Backend dan frontend terpisah total serta setiap modul punya router/service sendiri, sehingga
  penambahan modul baru tidak menyentuh kode modul lain.
