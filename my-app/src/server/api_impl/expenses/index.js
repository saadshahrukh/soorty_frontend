const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Expense = require('../../models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    if (req.method === 'GET') {
      const items = await Expense.find().sort({ createdAt: -1 }).limit(200);
      res._jsonBody = items;
      return res.json(items);
    }
    if (req.method === 'POST') {
      const created = await Expense.create(req.body || {});
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    }
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'ID required' });
      const updated = await Expense.findByIdAndUpdate(id, req.body || {}, { new: true });
      if (!updated) return res.status(404).json({ message: 'Expense not found' });
      res._jsonBody = updated;
      return res.json(updated);
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ message: 'ID required' });
      await Expense.findByIdAndDelete(id);
      return res.json({ message: 'Deleted' });
    }
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Expenses handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
