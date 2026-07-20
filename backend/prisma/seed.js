require('dotenv').config();
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const defaultPassword = process.env.SEED_OWNER_PASSWORD || 'ChangeMe123!';
  const hash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

  // ── Users (one per role) ──────────────────────────────────────────────
  const users = [
    { username: 'owner',   email: 'owner@toko.com',   fullName: 'Pemilik Toko',    role: 'OWNER' },
    { username: 'manager', email: 'manager@toko.com', fullName: 'Manajer Toko',    role: 'MANAGER' },
    { username: 'kasir1',  email: 'kasir1@toko.com',  fullName: 'Kasir Satu',      role: 'KASIR' },
    { username: 'gudang1', email: 'gudang1@toko.com', fullName: 'Staff Gudang',    role: 'GUDANG' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { ...u, passwordHash: hash },
    });
  }

  // ── Categories ────────────────────────────────────────────────────────
  const categoryNames = [
    'Makanan Instan',
    'Minuman',
    'Snack & Cemilan',
    'Kebutuhan Rumah Tangga',
    'Perawatan Tubuh',
    'ATK & Lainnya',
  ];

  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── Suppliers ─────────────────────────────────────────────────────────
  const supplierData = [
    { name: 'PT Indofood Sukses Makmur', phone: '021-5555001' },
    { name: 'PT Unilever Indonesia',     phone: '021-5555002' },
    { name: 'Distributor ABC',           phone: '0812-3456-7890' },
  ];

  for (const s of supplierData) {
    const exists = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.supplier.create({ data: s });
  }

  // ── Products ──────────────────────────────────────────────────────────
  const productData = [
    { name: 'Indomie Goreng',          cat: 'Makanan Instan',          pUnit: 'Karton', sUnit: 'Pcs', cpp: 40, hpp: 2800,  sell: 3500,  min: 50,  stock: 200 },
    { name: 'Indomie Soto Ayam',       cat: 'Makanan Instan',          pUnit: 'Karton', sUnit: 'Pcs', cpp: 40, hpp: 2800,  sell: 3500,  min: 50,  stock: 180 },
    { name: 'Mie Sedaap Goreng',       cat: 'Makanan Instan',          pUnit: 'Karton', sUnit: 'Pcs', cpp: 40, hpp: 2700,  sell: 3500,  min: 30,  stock: 150 },
    { name: 'Aqua 600ml',              cat: 'Minuman',                  pUnit: 'Karton', sUnit: 'Botol',cpp: 24, hpp: 3000,  sell: 4000,  min: 48,  stock: 240 },
    { name: 'Teh Pucuk Harum 350ml',   cat: 'Minuman',                  pUnit: 'Karton', sUnit: 'Botol',cpp: 24, hpp: 3500,  sell: 5000,  min: 24,  stock: 120 },
    { name: 'Pocari Sweat 500ml',      cat: 'Minuman',                  pUnit: 'Karton', sUnit: 'Botol',cpp: 24, hpp: 5500,  sell: 7500,  min: 12,  stock: 60 },
    { name: 'Kopi ABC Susu Sachet',    cat: 'Minuman',                  pUnit: 'Renceng',sUnit: 'Sachet',cpp:10,hpp: 1500,  sell: 2000,  min: 50,  stock: 300 },
    { name: 'Chitato Sapi Panggang',   cat: 'Snack & Cemilan',          pUnit: 'Karton', sUnit: 'Pcs', cpp: 20, hpp: 7000,  sell: 10000, min: 10,  stock: 40 },
    { name: 'Taro Net BBQ',            cat: 'Snack & Cemilan',          pUnit: 'Karton', sUnit: 'Pcs', cpp: 20, hpp: 2000,  sell: 3000,  min: 20,  stock: 80 },
    { name: 'Sabun Lifebuoy 100g',     cat: 'Perawatan Tubuh',          pUnit: 'Lusin',  sUnit: 'Pcs', cpp: 12, hpp: 3500,  sell: 5000,  min: 12,  stock: 48 },
    { name: 'Shampo Pantene Sachet',   cat: 'Perawatan Tubuh',          pUnit: 'Renceng',sUnit: 'Sachet',cpp:12,hpp: 1000,  sell: 1500,  min: 24,  stock: 120 },
    { name: 'Minyak Goreng Sania 2L',  cat: 'Kebutuhan Rumah Tangga',   pUnit: 'Karton', sUnit: 'Botol',cpp: 6, hpp: 28000, sell: 35000, min: 6,   stock: 24 },
    { name: 'Gula Pasir 1kg',          cat: 'Kebutuhan Rumah Tangga',   pUnit: 'Karung', sUnit: 'Kg',  cpp: 50, hpp: 14000, sell: 17000, min: 10,  stock: 50 },
    { name: 'Beras Premium 5kg',       cat: 'Kebutuhan Rumah Tangga',   pUnit: 'Karung', sUnit: 'Pack',cpp: 10, hpp: 62000, sell: 75000, min: 5,   stock: 20 },
    { name: 'Pulpen Standard AE7',     cat: 'ATK & Lainnya',            pUnit: 'Gross',  sUnit: 'Pcs', cpp: 144,hpp: 1500,  sell: 3000,  min: 20,  stock: 3 },
  ];

  let skuCounter = await prisma.product.count();
  for (const p of productData) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } });
    if (exists) continue;

    skuCounter++;
    await prisma.product.create({
      data: {
        sku: `PRD-${String(skuCounter).padStart(6, '0')}`,
        name: p.name,
        categoryId: categories[p.cat].id,
        purchaseUnit: p.pUnit,
        saleUnit: p.sUnit,
        contentPerPack: p.cpp,
        hpp: p.hpp,
        sellPrice: p.sell,
        minStock: p.min,
        currentStock: p.stock,
      },
    });
  }

  console.log('──────────────────────────────────────────────');
  console.log('Seed selesai!');
  console.log(`Login: username="owner" (atau manager/kasir1/gudang1)`);
  console.log(`Password semua akun: "${defaultPassword}"`);
  console.log('PENTING: segera ganti password setelah login pertama kali.');
  console.log('──────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
