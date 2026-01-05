const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const StockTransfer = require('../../models/StockTransfer');
const Product = require('../../models/Product');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  const items = await StockTransfer.find().sort({ createdAt: -1 }).limit(200);
  res._jsonBody = items;
  return res.json(items);
};
