const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Expense = require('../../../../api/models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const { startDate, endDate } = req.query || {};
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    const rows = await Expense.aggregate([
      { $match: match },
      { $group: { _id: '$businessType', total: { $sum: '$amount' } } }
    ]);
    const out = {};
    rows.forEach(r => { out[r._id] = r.total; });
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    console.error('Expense totals handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
