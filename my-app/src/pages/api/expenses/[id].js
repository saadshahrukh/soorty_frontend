const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Expense = require('../../../api/models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const id = req.query.id;
  try {
    if (req.method === 'PUT') {
      const upd = req.body || {};
      if (upd.date) upd.date = new Date(upd.date);
      const exp = await Expense.findByIdAndUpdate(id, upd, { new: true });
      if (!exp) return res.status(404).json({ message: 'Expense not found' });
      res._jsonBody = exp;
      return res.json(exp);
    }

    if (req.method === 'DELETE') {
      const exp = await Expense.findByIdAndDelete(id);
      if (!exp) return res.status(404).json({ message: 'Expense not found' });
      const out = { ok: true };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Expense id handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
