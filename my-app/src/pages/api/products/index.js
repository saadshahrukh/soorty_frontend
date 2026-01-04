const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Product = require('../../../../api/models/Product');
const StockAllocation = require('../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { businessType, q, warehouseId } = req.query || {};
      const filter = {};
      if (businessType) filter.businessType = businessType;
      if (q) filter.name = { $regex: String(q), $options: 'i' };
      const items = await Product.find(filter).sort({ createdAt: -1 }).lean();

      if (warehouseId && items.length > 0) {
        await Promise.all(items.map(async (it) => {
          try {
            const alloc = await StockAllocation.findOne({ productId: it._id, warehouseId });
            if (alloc && alloc.batches && alloc.batches.length > 0) {
              it.stock = alloc.batches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
            } else if (alloc && alloc.quantity) {
              it.stock = Number(alloc.quantity);
            } else {
              it.stock = 0;
            }
          } catch (e) {
            it.stock = 0;
          }
        }));
      }

      res._jsonBody = items;
      return res.json(items);
    }

    if (req.method === 'POST') {
      const { businessType, name, basePrice, deliveryCharges, priceTiers } = req.body || {};
      const created = await Product.create({
        businessType,
        name,
        basePrice: Number(basePrice || 0),
        baseCost: 0,
        deliveryCharges: Number(deliveryCharges || 0),
        stock: 0,
        priceTiers: Array.isArray(priceTiers) ? priceTiers.map(pt => ({ label: pt.label, price: Number(pt.price || 0) })) : []
      });
      res._jsonBody = created;
      return res.json(created);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Products handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
