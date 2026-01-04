const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Warehouse = require('../../../../api/models/Warehouse');
const StockAllocation = require('../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const items = await Warehouse.find().sort({ name: 1 });
      res._jsonBody = items;
      return res.json(items);
    }

    if (req.method === 'POST') {
      const { name, location, meta } = req.body || {};
      const created = await Warehouse.create({ name, location, meta });
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Warehouses handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
