const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Order = require('../../../../api/models/Order');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method !== 'DELETE') return res.status(405).json({ message: 'Method not allowed' });
    if (user.role === 'DataEntry') return res.status(403).json({ message: 'DataEntry is not allowed to delete orders' });
    const { businessType, startDate, endDate } = req.body || {};
    const query = {};
    if (businessType && businessType !== 'All') query.businessType = businessType;
    if (startDate || endDate) { query.createdAt = {}; if (startDate) query.createdAt.$gte = new Date(startDate); if (endDate) query.createdAt.$lte = new Date(endDate); }
    const toDelete = await Order.find(query).select('_id orderId productServiceName').lean();
    res.locals = res.locals || {}; res.locals.entityBefore = { items: toDelete };
    const result = await Order.deleteMany(query);
    const out = { deletedCount: result.deletedCount };
    res._jsonBody = out;
    return res.json(out);
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ message: error.message });
  }
};
