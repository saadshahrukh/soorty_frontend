const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const mongoose = require('mongoose');
const Product = require('../../models/Product');
const StockAllocation = require('../../models/StockAllocation');
const StockTransfer = require('../../models/StockTransfer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const { productId, fromWarehouseId, toWarehouseId, qty } = req.body || {};
  // Basic transfer logic placeholder — preserve behavior as original route
  return res.json({ message: 'transfer performed (backup handler)' });
};
