const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');
const Expense = require('../../models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  // simplified monthly summary
  const items = await Order.find().limit(100);
  return res.json({ ordersCount: items.length });
};
