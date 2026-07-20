const express = require('express');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { getLowStockProducts } = require('../services/stockService');

const router = express.Router();
router.use(authenticate, authorize('OWNER', 'MANAGER'));

// GET /api/dashboard/summary — single call powering the Owner dashboard.
router.get('/summary', async (req, res, next) => {
  try {
    const from = new Date(new Date().setHours(0, 0, 0, 0));
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);

    const [todaySales, lowStock, topProducts, recentPurchases] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: from, lt: to }, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
        _sum: { totalAmount: true, totalHpp: true },
        _count: true,
      }),
      getLowStockProducts(),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { createdAt: { gte: from, lt: to } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.purchase.findMany({
        where: { status: 'POSTED' },
        include: { supplier: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const productIds = topProducts.map((t) => t.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    res.json({
      totalPenjualanHariIni: Number(todaySales._sum.totalAmount || 0),
      totalLabaHariIni: Number(todaySales._sum.totalAmount || 0) - Number(todaySales._sum.totalHpp || 0),
      jumlahTransaksiHariIni: todaySales._count,
      produkHampirHabis: lowStock.slice(0, 10).map((p) => ({ id: p.id, name: p.name, sku: p.sku, currentStock: p.currentStock, minStock: p.minStock })),
      produkPalingLaris: topProducts.map((t) => ({ name: productMap.get(t.productId)?.name, totalTerjual: t._sum.quantity })),
      pembelianTerakhir: recentPurchases.map((p) => ({ purchaseNumber: p.purchaseNumber, supplier: p.supplier?.name || '-', totalAmount: Number(p.totalAmount), createdAt: p.createdAt })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
