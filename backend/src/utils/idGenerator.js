const prisma = require('../config/prisma');

function pad(num, size) {
  return String(num).padStart(size, '0');
}

/** SKU auto: PRD-000001, PRD-000002, ... */
async function generateSku() {
  const count = await prisma.product.count();
  return `PRD-${pad(count + 1, 6)}`;
}

/** Purchase number: PO-YYYYMMDD-0001 (daily reset) */
async function generatePurchaseNumber() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1, 2)}${pad(today.getDate(), 2)}`;
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const count = await prisma.purchase.count({ where: { createdAt: { gte: startOfDay } } });
  return `PO-${dateStr}-${pad(count + 1, 4)}`;
}

/** Invoice number: INV-YYYYMMDD-0001 (daily reset) */
async function generateInvoiceNumber() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1, 2)}${pad(today.getDate(), 2)}`;
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const count = await prisma.sale.count({ where: { createdAt: { gte: startOfDay } } });
  return `INV-${dateStr}-${pad(count + 1, 4)}`;
}

module.exports = { generateSku, generatePurchaseNumber, generateInvoiceNumber };
