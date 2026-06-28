# WarungPOS (KasirKu)

Sistem manajemen toko terintegrasi untuk UMKM dengan fitur POS, inventory management, dan business intelligence.

## 📋 Deskripsi Proyek

WarungPOS adalah aplikasi enterprise-grade untuk mengelola toko kecil hingga menengah seperti toko kelontong, minimarket, warung, grosir, dan UMKM lainnya. Aplikasi ini menyediakan fitur kasir, manajemen inventory, member management, dan analitik bisnis dalam satu platform.

## 🎯 Target Pengguna

- Toko Kelontong
- Minimarket
- Warung
- Grosir
- Toko Bangunan Kecil
- UMKM

## 🖥️ Platform Target

- Android
- Windows
- Web (single Flutter codebase)

## 📚 Tech Stack

### Backend
- **Framework**: Laravel 12
- **API**: REST API
- **Authentication**: Laravel Sanctum
- **Database**: PostgreSQL
- **Architecture**: Clean Architecture, Repository Pattern, Service Layer

### Frontend
- **Framework**: Flutter (stable)
- **State Management**: Riverpod
- **Routing**: GoRouter
- **UI Design**: Material 3
- **Architecture**: Clean Architecture, Feature-first

### Infrastructure
- **Storage**: Supabase Storage
- **Version Control**: Git
- **Database**: PostgreSQL

## 📁 Struktur Proyek

```
warung-pos/
├── backend/          # Laravel 12 REST API
│   ├── app/
│   ├── config/
│   ├── database/
│   ├── routes/
│   ├── tests/
│   ├── .env.example
│   ├── composer.json
│   └── ...
├── frontend/         # Flutter Application
│   ├── lib/
│   ├── test/
│   ├── pubspec.yaml
│   └── ...
├── docs/             # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DATABASE.md
│   └── ...
├── database/         # Database migrations & seeds
│   └── ...
├── .gitignore
├── README.md
└── DEVELOPMENT.md
```

## 🚀 Quick Start

### Backend Setup
```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
```

### Frontend Setup
```bash
cd frontend
flutter pub get
flutter run
```

## 📖 Dokumentasi

- [Architecture](./docs/ARCHITECTURE.md) - Penjelasan arsitektur aplikasi
- [Development Guide](./DEVELOPMENT.md) - Panduan development
- [API Documentation](./docs/API.md) - REST API endpoints
- [Database Schema](./docs/DATABASE.md) - Database design

## 🎨 Design System

**Palet Warna:**
- Primary: `#10B981` (Emerald)
- Background: `#111827` (Dark)
- Surface: `#1F2937` (Dark Gray)
- Text: `#F9FAFB` (White)
- Success: `#22C55E` (Green)
- Warning: `#F59E0B` (Amber)
- Danger: `#EF4444` (Red)

**Typography:**
- Heading: Poppins
- Body: Inter

## 📋 Development Roadmap

### Phase 1: Foundation & Authentication
- [ ] Project Setup
- [ ] Database Design
- [ ] Authentication System
- [ ] API Foundation

### Phase 2: Core Features
- [ ] Dashboard
- [ ] Master Barang (Products)
- [ ] Multi Unit & Conversion
- [ ] Member Management

### Phase 3: POS & Transactions
- [ ] POS/Kasir System
- [ ] Barcode Scanning
- [ ] Transaction History

### Phase 4: Inventory & Analytics
- [ ] Inventory Management
- [ ] Stock History
- [ ] Reports & Analytics

### Phase 5: Enhancement
- [ ] Receipt Printing
- [ ] Multi-user Support
- [ ] Advanced Features

## 👨‍💻 Kontribusi

Proyek ini mengikuti:
- **SOLID Principles**
- **Clean Code Practices**
- **DRY Principle**
- **Separation of Concerns**

## 📝 License

Proprietary - WarungPOS

## 📧 Kontak

Untuk pertanyaan dan diskusi, gunakan Issues dan Discussions di repository ini.

---

**Status**: 🟡 In Development (Phase 1 - Project Setup)
**Last Updated**: 2024
