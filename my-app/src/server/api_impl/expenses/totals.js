const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Expense = require('../../models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { startDate, endDate } = req.query || {};
    
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(query).lean();
    
    // Calculate totals by business type
    const totals = {
      Travel: 0,
      Dates: 0,
      Belts: 0,
      Other: 0,
      total: 0
    };

    expenses.forEach(expense => {
      const amount = expense.amount || 0;
      const businessType = expense.businessType || 'Other';
      
      if (totals[businessType] !== undefined) {
        totals[businessType] += amount;
      } else {
        totals.Other += amount;
      }
      totals.total += amount;
    });

    res._jsonBody = totals;
    return res.json(totals);
  } catch (e) {
    console.error('Expenses totals error:', e);
    return res.status(500).json({ message: e.message });
  }
};
