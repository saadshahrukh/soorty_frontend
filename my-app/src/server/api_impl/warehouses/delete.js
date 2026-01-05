const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Warehouse = require('../../models/Warehouse');

module.exports = async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  const warehouse = await Warehouse.findByIdAndDelete(id);
  if (!warehouse) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Deleted' });
};
