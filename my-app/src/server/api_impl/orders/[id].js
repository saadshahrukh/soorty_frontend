const mongoose = require('mongoose');
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');
const Customer = require('../../models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  const id = req.query.id;
  if (req.method === 'GET') {
    const order = await Order.findById(id).populate('customerId').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res._jsonBody = order;
    return res.json(order);
  }
  if (req.method === 'PUT') {
    const updated = await Order.findByIdAndUpdate(id, req.body || {}, { new: true });
    res._jsonBody = updated;
    return res.json(updated);
  }
  if (req.method === 'DELETE') {
    await Order.findByIdAndDelete(id);
    return res.json({ message: 'Deleted' });
  }
  return res.status(405).json({ message: 'Method not allowed' });
};
