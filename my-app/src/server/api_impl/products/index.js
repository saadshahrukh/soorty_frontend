const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Product = require('../../models/Product');
const StockAllocation = require('../../models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method === 'GET') {
    const items = await Product.find().sort({ name: 1 });
    res._jsonBody = items;
    return res.json(items);
  }
  if (req.method === 'POST') {
    const created = await Product.create(req.body || {});
    res.status(201);
    res._jsonBody = created;
    return res.json(created);
  }
  return res.status(405).json({ message: 'Method not allowed' });
};
