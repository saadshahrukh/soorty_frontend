const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { ids } = req.body || {};
  const r = await Order.deleteMany({ _id: { $in: ids || [] } });
  res._jsonBody = r;
  return res.json(r);
};
