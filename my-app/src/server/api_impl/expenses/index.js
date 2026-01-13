const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Expense = require('../../models/Expense');
const mongoose = require('mongoose');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    if (req.method === 'GET') {
      const { businessType, startDate, endDate, page = 1, limit = 50 } = req.query || {};
      
      // Build query
      const query = {};
      if (businessType) query.businessType = businessType;
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      const pageNum = Math.max(1, Number(page || 1));
      const limitNum = Math.min(200, Number(limit || 50));
      const skip = (pageNum - 1) * limitNum;

      // Get total count
      const total = await Expense.countDocuments(query);
      const pages = Math.ceil(total / limitNum);

      // Get paginated items
      const items = await Expense.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      res._jsonBody = { items, total, page: pageNum, pages, limit: limitNum };
      return res.json({ items, total, page: pageNum, pages, limit: limitNum });
    }
    
    if (req.method === 'POST') {
      const { businessType, amount, description, date } = req.body || {};
      const created = await Expense.create({
        businessType: businessType || 'Dates',
        amount: Number(amount || 0),
        description: description || '',
        date: date ? new Date(date) : new Date(),
        createdBy: user._id
      });
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    }
    
    if (req.method === 'PUT') {
      const expenseId = req.query.expenseId || req.body?.id;
      if (!expenseId) return res.status(400).json({ message: 'Expense ID required' });
      
      const { businessType, amount, description, date } = req.body || {};
      const updated = await Expense.findByIdAndUpdate(
        new mongoose.Types.ObjectId(expenseId),
        {
          businessType: businessType || undefined,
          amount: amount !== undefined ? Number(amount) : undefined,
          description: description !== undefined ? description : undefined,
          date: date ? new Date(date) : undefined
        },
        { new: true, runValidators: true }
      ).lean();
      
      if (!updated) return res.status(404).json({ message: 'Expense not found' });
      res._jsonBody = updated;
      return res.json(updated);
    }
    
    if (req.method === 'DELETE') {
      const expenseId = req.query.expenseId;
      if (!expenseId) return res.status(400).json({ message: 'Expense ID required' });
      
      const deleted = await Expense.findByIdAndDelete(new mongoose.Types.ObjectId(expenseId));
      if (!deleted) return res.status(404).json({ message: 'Expense not found' });
      
      res._jsonBody = { message: 'Expense deleted', id: expenseId };
      return res.json({ message: 'Expense deleted', id: expenseId });
    }
    
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Expenses handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
