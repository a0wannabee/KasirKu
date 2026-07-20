const { applyWeightedAverageCost } = require('../../src/services/hppService');

describe('HPP Service (Weighted Average Cost)', () => {
  let mockTx;

  beforeEach(() => {
    mockTx = {
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      hppHistory: {
        create: jest.fn(),
      },
    };
  });

  test('Calculates Weighted Average Cost correctly when incoming stock increases total', async () => {
    // Current stock: 10 units at Rp 10,000 HPP
    mockTx.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      currentStock: 10,
      hpp: 10000,
    });

    // Incoming: 10 units at Rp 12,000 unit cost
    // Expected WAC: ((10 * 10,000) + (10 * 12,000)) / (10 + 10) = 220,000 / 20 = Rp 11,000
    const newHpp = await applyWeightedAverageCost(mockTx, {
      productId: 'prod-1',
      incomingQty: 10,
      incomingUnitCost: 12000,
      reason: 'PURCHASE_RECEIPT',
      referenceId: 'purch-1',
      userId: 'user-1',
    });

    expect(newHpp).toBe(11000);
    expect(mockTx.hppHistory.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1',
        oldHpp: 10000,
        newHpp: 11000,
        reason: 'PURCHASE_RECEIPT',
        referenceId: 'purch-1',
        changedById: 'user-1',
      },
    });
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { hpp: 11000 },
    });
  });

  test('Does not create HppHistory when incoming cost exactly equals current HPP (no HPP change)', async () => {
    mockTx.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      currentStock: 20,
      hpp: 15000,
    });

    const newHpp = await applyWeightedAverageCost(mockTx, {
      productId: 'prod-1',
      incomingQty: 5,
      incomingUnitCost: 15000,
      reason: 'PURCHASE_RECEIPT',
    });

    expect(newHpp).toBe(15000);
    expect(mockTx.hppHistory.create).not.toHaveBeenCalled();
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { hpp: 15000 },
    });
  });
});
