# REST API Documentation - KasirKu

## Overview

Folder ini berisi dokumentasi lengkap untuk REST API KasirKu.

## API Specification

**Base URL:** `http://localhost:8000/api/v1`

### Authentication
- Method: Token-based (Laravel Sanctum)
- Header: `Authorization: Bearer {token}`

### Response Format
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

### Status Codes
- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `422 Unprocessable Entity`
- `500 Internal Server Error`

## Endpoint Categories

1. **Authentication** - Login, logout, refresh token
2. **Products** - CRUD operasi untuk produk
3. **Categories** - CRUD operasi untuk kategori
4. **Units** - CRUD operasi untuk satuan
5. **Product Units** - Konfigurasi dynamic unit conversion
6. **Members** - CRUD operasi untuk member
7. **Transactions** - Transaksi penjualan
8. **Dashboard** - Summary data bisnis

## Contents

*Dokumentasi detail endpoint akan ditambahkan di fase development*

---

**Last Updated:** 2024
