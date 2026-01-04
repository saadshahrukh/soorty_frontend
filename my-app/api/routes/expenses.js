const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');

// Create expense
router.post('/', auth, async (req, res) => {
  try {
    const { businessType, amount, currency, description, date, meta } = req.body;
    const exp = await Expense.create({ businessType, amount: Number(amount || 0), currency: currency || 'PKR', description: description || '', date: date ? new Date(date) : new Date(), createdBy: req.user._id, meta });
    res.json(exp);
  } catch (e) {
    console.error('Create expense error', e);
    res.status(500).json({ message: e.message });
  }
});

// Update expense
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const upd = req.body;
    if (upd.date) upd.date = new Date(upd.date);
    const exp = await Expense.findByIdAndUpdate(id, upd, { new: true });
    if (!exp) return res.status(404).json({ message: 'Expense not found' });
    res.json(exp);
  } catch (e) {
    console.error('Update expense error', e);
    res.status(500).json({ message: e.message });
  }
});

// Delete expense
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const exp = await Expense.findByIdAndDelete(id);
    if (!exp) return res.status(404).json({ message: 'Expense not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete expense error', e);
    res.status(500).json({ message: e.message });
  }
});

// List expenses with optional filters and pagination
router.get('/', auth, async (req, res) => {
  try {
    const { businessType, startDate, endDate, page = '1', limit = '50' } = req.query;
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
    res.json({ items, total, page: p, pages: Math.max(1, Math.ceil(total / l)) });
  } catch (e) {
    console.error('List expenses error', e);
    res.status(500).json({ message: e.message });
  }
});

// Get total expenses per business for a period (used by summary)
router.get('/totals', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
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
    const out = {}
    rows.forEach(r => { out[r._id] = r.total; });
    res.json(out);
  } catch (e) {
    console.error('Expense totals error', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
