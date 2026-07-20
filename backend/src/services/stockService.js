const prisma = require('../config/prisma');

/**
 * Books a stock movement into the immutable StockMutation ledger and keeps
 * Product.currentStock as a denormalized cache in sync.
 *
 * IMPORTANT: StockMutation rows are NEVER deleted or updated by app code —
 * mistakes are corrected with a compensating entry (e.g. a StockAdjustment),
 * never by editing history. This preserves a complete, auditable trail.
 *
 * Must be called inside a Prisma transaction (`tx`) so the mutation and the
 * stock cache update are atomic.
 */
async function bookStockMutation(tx, { productId, type, quantity, referenceType, referenceId, note, userId }) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Produk ${productId} tidak ditemukan.`);

  const newBalance = product.currentStock + quantity;
  if (newBalance < 0) {
    throw new Error(`Stok tidak mencukupi untuk produk ${product.name} (sisa ${product.currentStock}).`);
  }

  await tx.stockMutation.create({
    data: {
      productId,
      type,
      quantity,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      note,
      userId,
    },
  });

  await tx.product.update({ where: { id: productId }, data: { currentStock: newBalance } });

  return newBalance;
}

/**
 * Returns products whose currentStock is at or below minStock —
 * powers the low-stock alert on Dashboard/Inventory.
 */
async function getLowStockProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
  });
  return products.filter((p) => p.currentStock <= p.minStock);
}

/**
 * Simple restock prediction: average daily sales over the trailing window,
 * projected forward against days-of-cover target, minus current stock.
 * This is intentionally a transparent moving-average model (not a black box)
 * so owners can trust and audit the number; can be swapped for a more
 * sophisticated forecasting service later without changing the API contract.
 */
async function predictRestockNeeds({ windowDays = 30, targetDaysOfCover = 14 } = {}) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const sales = await prisma.stockMutation.groupBy({
    by: ['productId'],
    where: { type: 'SALE_OUT', createdAt: { gte: since } },
    _sum: { quantity: true },
  });

  const products = await prisma.product.findMany({ where: { isActive: true } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return sales
    .map((s) => {
      const product = productMap.get(s.productId);
      if (!product) return null;
      const totalSold = Math.abs(s._sum.quantity || 0);
      const avgDailySales = totalSold / windowDays;
      const projectedNeed = Math.ceil(avgDailySales * targetDaysOfCover);
      const suggestedOrderQty = Math.max(projectedNeed - product.currentStock, 0);
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        currentStock: product.currentStock,
        avgDailySales: Number(avgDailySales.toFixed(2)),
        suggestedOrderQty,
      };
    })
    .filter((r) => r && r.suggestedOrderQty > 0)
    .sort((a, b) => b.suggestedOrderQty - a.suggestedOrderQty);
}

module.exports = { bookStockMutation, getLowStockProducts, predictRestockNeeds };
