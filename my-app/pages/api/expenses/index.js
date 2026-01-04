const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Expense = require('../../../api/models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'POST') {
      const { businessType, amount, currency, description, date, meta } = req.body || {};
      const exp = await Expense.create({ businessType, amount: Number(amount || 0), currency: currency || 'PKR', description: description || '', date: date ? new Date(date) : new Date(), createdBy: user._id, meta });
      res._jsonBody = exp;
      return res.json(exp);
    }

    if (req.method === 'GET') {
      const { businessType, startDate, endDate, page = '1', limit = '50' } = req.query || {};
      const filter = {};
      if (businessType) filter.businessType = businessType;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) filter.date.$lte = new Date(endDate);
      }
      const p = Math.max(1, parseInt(page));
      const l = Math.min(500, parseInt(limit));
      const total = await Expense.countDocuments(filter);
      const items = await Expense.find(filter).sort({ date: -1 }).skip((p - 1) * l).limit(l).lean();
      const out = { items, total, page: p, pages: Math.max(1, Math.ceil(total / l)) };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Expenses handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
