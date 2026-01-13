const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Customer = require('../../models/Customer');
const mongoose = require('mongoose');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    // Handle PUT for updating customer
    if (req.method === 'PUT') {
      const customerId = req.customerId;
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID required' });
      }
      
      const { name, phone, address, email, notes } = req.body || {};
      try {
        const updated = await Customer.findByIdAndUpdate(
          new mongoose.Types.ObjectId(customerId),
          { name, phone, address, email, notes },
          { new: true, runValidators: true }
        ).lean();
        
        if (!updated) return res.status(404).json({ message: 'Customer not found' });
        res._jsonBody = updated;
        return res.json(updated);
      } catch (e) {
        console.error('Customer update error:', e);
        return res.status(500).json({ message: e.message });
      }
    }
    
    // Handle DELETE for deleting customer
    if (req.method === 'DELETE') {
      const customerId = req.customerId;
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID required' });
      }
      
      try {
        const deleted = await Customer.findByIdAndDelete(
          new mongoose.Types.ObjectId(customerId)
        ).lean();
        
        if (!deleted) return res.status(404).json({ message: 'Customer not found' });
        res._jsonBody = { message: 'Customer deleted', id: customerId };
        return res.json({ message: 'Customer deleted', id: customerId });
      } catch (e) {
        console.error('Customer delete error:', e);
        return res.status(500).json({ message: e.message });
      }
    }
    
    if (req.method === 'GET') {
      const { phone, q } = req.query || {};
      
      // Build query
      const query = {};
      if (phone) {
        query.phone = phone;
      } else if (q) {
        query.$or = [
          { name: new RegExp(q, 'i') },
          { phone: new RegExp(q, 'i') }
        ];
      }
      
      const items = await Customer.find(query).sort({ name: 1 }).lean();
      res._jsonBody = items;
      return res.json(items);
    }
    if (req.method === 'POST') {
      const { name, phone, address, email, notes } = req.body || {};
      const created = await Customer.create({ name, phone, address, email, notes });
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Customers handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
