# Architecture Documentation - KasirKu

## Overview

Folder ini berisi dokumentasi lengkap mengenai arsitektur KasirKu, termasuk:

- **Backend Architecture** - Penjelasan struktur Laravel 12
- **Frontend Architecture** - Penjelasan struktur Flutter
- **Dynamic Unit Conversion** - Arsitektur fitur unggulan
- **Database Design** - Schema dan relationship
- **API Design** - REST API patterns
- **Authentication Flow** - Cara kerja sistem login
- **Storage Strategy** - Integrasi dengan Supabase Storage

## Contents

*Dokumentasi detail akan ditambahkan di fase development*

## Key Concepts

### Clean Architecture
KasirKu mengimplementasikan Clean Architecture dengan separation of concerns:
- **Presentation Layer** - UI dan routing
- **Domain Layer** - Business rules
- **Data Layer** - Repository dan data sources

### Feature-First Structure
Frontend terorganisir berdasarkan fitur, bukan berdasarkan tipe file.

### Repository Pattern
Data access abstracted melalui repository untuk maintainability.

---

**Last Updated:** 2024
