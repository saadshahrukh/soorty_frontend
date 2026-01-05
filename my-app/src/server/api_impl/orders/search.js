const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  // Basic search fallback
  const q = req.query.q || '';
  const items = await Order.find({ $text: { $search: q } }).limit(100);
  res._jsonBody = items;
  return res.json(items);
};
