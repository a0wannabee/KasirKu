const express = require('express');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate, authorize('OWNER', 'MANAGER'));

function startOfDay(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }

// GET /api/reports/omzet-harian?date=YYYY-MM-DD
router.get('/omzet-harian', async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const from = startOfDay(date);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

    const agg = await prisma.sale.aggregate({
      where: { createdAt: { gte: from, lt: to }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
      _sum: { totalAmount: true, totalHpp: true },
      _count: true,
    });

    res.json({
      date: from.toISOString().slice(0, 10),
      omzet: agg._sum.totalAmount || 0,
      totalHpp: agg._sum.totalHpp || 0,
      labaKotor: (Number(agg._sum.totalAmount || 0) - Number(agg._sum.totalHpp || 0)),
      jumlahTransaksi: agg._count,
    });
  } catch (err) { next(err); }
});

// GET /api/reports/omzet-bulanan?year=&month=
router.get('/omzet-bulanan', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
      select: { totalAmount: true, totalHpp: true, createdAt: true },
    });

    const byDay = {};
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { omzet: 0, laba: 0 };
      byDay[key].omzet += Number(s.totalAmount);
      byDay[key].laba += Number(s.totalAmount) - Number(s.totalHpp);
    }

    res.json({
      year, month,
      totalOmzet: sales.reduce((a, s) => a + Number(s.totalAmount), 0),
      totalLaba: sales.reduce((a, s) => a + (Number(s.totalAmount) - Number(s.totalHpp)), 0),
      perHari: Object.entries(byDay).map(([tanggal, v]) => ({ tanggal, ...v })).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/laba-rugi?from=&to=
router.get('/laba-rugi', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : startOfMonth();
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const [salesAgg, purchasesAgg] = await Promise.all([
      prisma.sale.aggregate({ where: { createdAt: { gte: from, lte: to }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } }, _sum: { totalAmount: true, totalHpp: true, discountAmount: true, taxAmount: true } }),
      prisma.purchase.aggregate({ where: { createdAt: { gte: from, lte: to }, status: 'POSTED' }, _sum: { totalAmount: true } }),
    ]);

    const pendapatan = Number(salesAgg._sum.totalAmount || 0);
    const hpp = Number(salesAgg._sum.totalHpp || 0);
    const labaKotor = pendapatan - hpp;

    res.json({
      periode: { from, to },
      pendapatan,
      hpp,
      labaKotor,
      totalPembelian: Number(purchasesAgg._sum.totalAmount || 0),
      totalDiskonDiberikan: Number(salesAgg._sum.discountAmount || 0),
      totalPajakDipungut: Number(salesAgg._sum.taxAmount || 0),
      marginPersen: pendapatan > 0 ? Number(((labaKotor / pendapatan) * 100).toFixed(2)) : 0,
    });
  } catch (err) { next(err); }
});

// GET /api/reports/produk-terlaris?from=&to=&limit=
router.get('/produk-terlaris', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : startOfMonth();
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const limit = parseInt(req.query.limit) || 10;

    const grouped = await prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { createdAt: { gte: from, lte: to }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    const products = await prisma.product.findMany({ where: { id: { in: grouped.map((g) => g.productId) } } });
    const map = new Map(products.map((p) => [p.id, p]));

    res.json(grouped.map((g) => ({
      productId: g.productId,
      name: map.get(g.productId)?.name,
      sku: map.get(g.productId)?.sku,
      totalTerjual: g._sum.quantity,
      totalOmzet: Number(g._sum.subtotal),
    })));
  } catch (err) { next(err); }
});

// GET /api/reports/margin-produk
router.get('/margin-produk', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    res.json(products.map((p) => {
      const hpp = Number(p.hpp);
      const harga = Number(p.sellPrice);
      const marginRp = harga - hpp;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        hpp,
        sellPrice: harga,
        marginRp,
        marginPersen: harga > 0 ? Number(((marginRp / harga) * 100).toFixed(2)) : 0,
      };
    }).sort((a, b) => b.marginPersen - a.marginPersen));
  } catch (err) { next(err); }
});

// GET /api/reports/grafik-penjualan?days=30
router.get('/grafik-penjualan', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sales = await prisma.sale.findMany({ where: { createdAt: { gte: from }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } }, select: { totalAmount: true, createdAt: true } });

    const byDay = {};
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      byDay[key] = (byDay[key] || 0) + Number(s.totalAmount);
    }
    res.json(Object.entries(byDay).map(([tanggal, omzet]) => ({ tanggal, omzet })).sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
  } catch (err) { next(err); }
});

// GET /api/reports/grafik-pembelian?days=30
router.get('/grafik-pembelian', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const purchases = await prisma.purchase.findMany({ where: { createdAt: { gte: from }, status: 'POSTED' }, select: { totalAmount: true, createdAt: true } });

    const byDay = {};
    for (const p of purchases) {
      const key = p.createdAt.toISOString().slice(0, 10);
      byDay[key] = (byDay[key] || 0) + Number(p.totalAmount);
    }
    res.json(Object.entries(byDay).map(([tanggal, pembelian]) => ({ tanggal, pembelian })).sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
  } catch (err) { next(err); }
});

module.exports = router;
