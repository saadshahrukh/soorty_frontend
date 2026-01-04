const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Order = require('../../../../api/models/Order');
const Expense = require('../../../../api/models/Expense');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { year, month } = req.query || {};
    let startDate, endDate;
    if (year && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const orders = await Order.find({ createdAt: { $gte: startDate, $lte: endDate } });
    const businessTypes = ['Travel', 'Dates', 'Belts'];
    const summary = {};
    let totalSales = 0, totalCost = 0, totalProfit = 0, pendingPayments = 0, totalLoss = 0;

    businessTypes.forEach(business => {
      const businessOrders = orders.filter(o => o.businessType === business);
      const sales = businessOrders.reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);
      const cost = businessOrders.reduce((sum, o) => sum + Number(o.costPrice || 0) + (o.deliveryPaidByCustomer === false ? Number(o.deliveryCharge || 0) : 0), 0);
      const profit = businessOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0);
      const pending = businessOrders.filter(o => o.paymentStatus !== 'Paid').reduce((sum, o) => sum + (o.paymentStatus === 'Partial' ? Number(o.partialRemainingAmount || 0) : Number(o.finalAmount || 0)), 0);
      const loss = businessOrders.reduce((sum, o) => {
        const finalAmount = Number(o.finalAmount || 0);
        const paidAmount = o.paymentStatus === 'Paid' ? finalAmount : (o.paymentStatus === 'Partial' ? Number(o.partialPaidAmount || 0) : 0);
        const orderLoss = Math.max(0, (Number(o.costPrice || 0) + (o.deliveryPaidByCustomer === false ? Number(o.deliveryCharge || 0) : 0)) - paidAmount);
        return sum + orderLoss;
      }, 0);
      summary[business] = { sales, cost, profit, pending, loss, orderCount: businessOrders.length };
      totalSales += sales; totalCost += cost; totalProfit += profit; pendingPayments += pending; totalLoss += loss;
    });

    const expenseRows = await Expense.aggregate([{ $match: { date: { $gte: startDate, $lte: endDate } } }, { $group: { _id: '$businessType', total: { $sum: '$amount' } } }]);
    const expenseMap = {};
    expenseRows.forEach(r => { expenseMap[r._id] = r.total; });
    Object.keys(summary).forEach(b => {
      const exp = Number(expenseMap[b] || 0);
      summary[b].expenses = exp;
      summary[b].profitAfterExpenses = Number(summary[b].profit || 0) - exp;
      totalProfit -= exp;
      totalCost += exp;
    });

    let displayProfit = totalProfit;
    if (user.role === 'Investor') displayProfit = totalProfit * 0.4;

    const out = {
      summary,
      totals: { sales: totalSales, cost: totalCost, profit: displayProfit, pending: pendingPayments, loss: totalLoss },
      period: { start: startDate, end: endDate }
    };
    res._jsonBody = out;
    return res.json(out);
  } catch (error) {
    console.error('Summary monthly error:', error);
    return res.status(500).json({ message: error.message });
  }
};
