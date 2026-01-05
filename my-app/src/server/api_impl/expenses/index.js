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
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Expenses handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
