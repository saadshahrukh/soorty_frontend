const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Order = require('../../../api/models/Order');
const Customer = require('../../../api/models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const { q, limit = 10 } = req.query || {};
    if (!q || String(q).trim() === '') return res.json([]);
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `^${escapeRegex(String(q))}`;
    let docs = await Order.find({ orderId: { $regex: pattern, $options: 'i' } }).sort({ createdAt: -1 }).limit(Number(limit)).select('orderId customerSupplierName customerPhone customerAddress customerId').populate('customerId').lean();
    docs = docs.map(o => {
      if (o.customerId) { o.customer = o.customerId; delete o.customerId; }
      return o;
    });
    res._jsonBody = docs;
    return res.json(docs);
  } catch (error) {
    console.error('Search orders error:', error);
    return res.status(500).json({ message: error.message });
  }
};
