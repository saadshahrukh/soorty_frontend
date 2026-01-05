const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Customer = require('../../models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    if (req.method === 'GET') {
      const items = await Customer.find().sort({ name: 1 });
      res._jsonBody = items;
      return res.json(items);
    }
    if (req.method === 'POST') {
      const { name, phone, address } = req.body || {};
      const created = await Customer.create({ name, phone, address });
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
