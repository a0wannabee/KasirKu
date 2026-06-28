# Database Design - KasirKu

## Overview

Folder ini berisi dokumentasi lengkap untuk database design KasirKu.

## Database System

**Type:** PostgreSQL 14+

### Key Design Principles

1. **Normalization (3NF)** - Data integrity dan consistency
2. **Dynamic Unit Conversion** - Support unlimited satuan per produk
3. **Audit Trail** - Tracking semua perubahan stok
4. **Soft Delete** - Data preservation dan compliance
5. **Performance Optimization** - Strategic indexes untuk query speed

## Core Tables

### Master Data
- `users` - User/operator
- `categories` - Kategori produk
- `units` - Satuan dasar
- `products` - Data produk
- `product_units` - Dynamic unit conversion mapping
- `members` - Data member

### Transaction Data
- `transactions` - Header transaksi penjualan
- `transaction_items` - Detail item dalam transaksi
- `stock_histories` - Audit trail perubahan stok

### Future Tables
- `suppliers` - Data supplier
- `purchases` - Pesanan pembelian
- `expenses` - Pengeluaran operasional
- `promotions` - Aturan diskon dan promo

## Dynamic Unit Conversion

Sistem yang memungkinkan setiap produk memiliki satuan dan konversi unik:

**Contoh:** Beras dapat dijual dalam satuan:
- Gram (base unit)
- 100g
- 250g
- 500g
- 1kg
- 5kg
- 25kg

## Contents

*Dokumentasi detail schema dan relationship akan ditambahkan di fase development*

---

**Last Updated:** 2024
