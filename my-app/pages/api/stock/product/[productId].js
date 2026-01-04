const { connectToDatabase } = require('../../../../src/lib/mongodb');
const { requireAuth } = require('../../../../src/lib/nextAuth');
const Product = require('../../../../api/models/Product');
const StockAllocation = require('../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { productId } = req.query || {};
  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const allocs = await StockAllocation.find({ productId }).populate('warehouseId', 'name');
    const total = allocs.reduce((s, a) => {
      const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
      return s + batchTotal;
    }, 0);
    const allocations = allocs.map(a => {
      const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
      const currentCostPrice = a.batches.length > 0 ? a.batches[0].costPrice : 0;
      return {
        warehouseId: a.warehouseId._id,
        warehouseName: a.warehouseId.name,
        quantity: batchTotal,
        currentCostPrice,
        batchCount: a.batches.length,
        batches: a.batches.map(b => ({ batchId: b.batchId, quantity: b.quantity, costPrice: b.costPrice, addedAt: b.addedAt })),
        priceTierId: a.priceTierId || null
      };
    });
    const out = { productId, total, currentCostPrice: product.baseCost || 0, allocations, priceTiers: product.priceTiers || [] };
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    console.error('Get product allocations error:', e);
    return res.status(500).json({ message: e.message });
  }
};
