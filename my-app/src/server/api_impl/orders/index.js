const mongoose = require('mongoose');
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');
const Product = require('../../models/Product');
const StockAllocation = require('../../models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  // For simplicity delegate to original behavior based on method
  if (req.method === 'GET') {
    const items = await Order.find().sort({ createdAt: -1 }).limit(200);
    res._jsonBody = items;
    return res.json(items);
  }
  if (req.method === 'POST') {
    const created = await Order.create(req.body || {});
    res.status(201);
    res._jsonBody = created;
    return res.json(created);
  }
  return res.status(405).json({ message: 'Method not allowed' });
};
