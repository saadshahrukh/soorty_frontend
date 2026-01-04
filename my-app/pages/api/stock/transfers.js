const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const StockTransfer = require('../../../api/models/StockTransfer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const { productId, limit = 100 } = req.query || {};
    const filter = {};
    if (productId) filter.productId = productId;
    const items = await StockTransfer.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).populate('fromWarehouseId toWarehouseId performedBy', 'name');
    res._jsonBody = items;
    return res.json(items);
  } catch (e) {
    console.error('Get transfers error:', e);
    return res.status(500).json({ message: e.message });
  }
};
