const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Warehouse = require('../../../../api/models/Warehouse');
const StockAllocation = require('../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const id = req.query.id;
  try {
    if (req.method === 'PUT') {
      const updated = await Warehouse.findByIdAndUpdate(id, req.body, { new: true });
      if (!updated) return res.status(404).json({ message: 'Warehouse not found' });
      res._jsonBody = updated;
      return res.json(updated);
    }

    if (req.method === 'DELETE') {
      const allocCount = await StockAllocation.countDocuments({ warehouseId: id });
      if (allocCount > 0) return res.status(400).json({ message: 'Warehouse has stock allocations; cannot delete' });
      const deleted = await Warehouse.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: 'Warehouse not found' });
      const out = { message: 'Warehouse deleted' };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Warehouse id handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
