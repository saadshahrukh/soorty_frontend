const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Warehouse = require('../../models/Warehouse');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { name, location } = req.body;
  if (!name || !location) return res.status(400).json({ message: 'Name and location required' });

  const warehouse = new Warehouse({ name, location });
  await warehouse.save();
  res.status(201).json(warehouse);
};
