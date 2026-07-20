const prisma = require('../config/prisma');

/**
 * Weighted Average Cost (WAC) — recalculated every time new stock comes in.
 *
 *   newHpp = ((currentStock * currentHpp) + (incomingQty * incomingUnitCost))
 *            / (currentStock + incomingQty)
 *
 * Every change is written to HppHistory — HPP must never change silently.
 * This function is only ever called from within a Prisma transaction
 * that also books the StockMutation, so cost and quantity stay consistent.
 */
async function applyWeightedAverageCost(tx, { productId, incomingQty, incomingUnitCost, reason, referenceId, userId }) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Produk ${productId} tidak ditemukan.`);

  const currentStock = product.currentStock;
  const currentHpp = Number(product.hpp);
  const qty = Number(incomingQty);
  const cost = Number(incomingUnitCost);

  const newStockTotal = currentStock + qty;
  const newHpp =
    newStockTotal > 0
      ? ((currentStock * currentHpp) + (qty * cost)) / newStockTotal
      : currentHpp;

  if (Math.abs(newHpp - currentHpp) > 0.0001) {
    await tx.hppHistory.create({
      data: {
        productId,
        oldHpp: currentHpp,
        newHpp,
        reason,
        referenceId,
        changedById: userId || null,
      },
    });
  }

  await tx.product.update({
    where: { id: productId },
    data: { hpp: newHpp },
  });

  return newHpp;
}

/**
 * Manual HPP correction (e.g. data entry error). Always requires a reason
 * and is always logged to HppHistory — there is no path to change HPP
 * without a history record (enforced by only exposing this function).
 */
async function manualHppAdjustment({ productId, newHpp, reason, userId }) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error('Produk tidak ditemukan.');

    await tx.hppHistory.create({
      data: {
        productId,
        oldHpp: product.hpp,
        newHpp,
        reason: reason || 'MANUAL_ADJUSTMENT',
        changedById: userId,
      },
    });

    return tx.product.update({ where: { id: productId }, data: { hpp: newHpp } });
  });
}

module.exports = { applyWeightedAverageCost, manualHppAdjustment };
