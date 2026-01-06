const mongoose = require('mongoose');
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { businessType, startDate, endDate, paymentStatus } = req.query || {};
      
      // Build query
      const query = {};
      if (businessType) query.businessType = businessType;
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const items = await Order.find(query).sort({ createdAt: -1 }).limit(200).lean();
      res._jsonBody = items;
      return res.json(items);
    } catch (e) {
      console.error('Orders GET error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const created = await Order.create(req.body || {});
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    } catch (e) {
      console.error('Orders POST error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};

