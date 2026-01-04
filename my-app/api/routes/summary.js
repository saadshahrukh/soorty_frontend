const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

// Get monthly summary
router.get('/monthly', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let startDate, endDate;
    if (year && month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      // Current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const businessTypes = ['Travel', 'Dates', 'Belts'];
    const summary = {};
    
    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let pendingPayments = 0;
    let totalLoss = 0;
    
    businessTypes.forEach(business => {
      const businessOrders = orders.filter(o => o.businessType === business);

      // Sales should reflect the amount billed to customer (finalAmount already includes tax and delivery when charged to customer)
      const sales = businessOrders.reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

      // Cost is business cost (product cost + delivery we paid). If deliveryPaidByCustomer is false, deliveryCharge is our cost.
      const cost = businessOrders.reduce((sum, o) => {
        const baseCost = Number(o.costPrice || 0);
        const deliveryCost = o.deliveryPaidByCustomer === false ? Number(o.deliveryCharge || 0) : 0;
        return sum + baseCost + deliveryCost;
      }, 0);

      // Profit should be taken from the order.profit computed on save (already accounts for delivery rules)
      const profit = businessOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0);

      // Pending payments should consider finalAmount (what customer owes)
      const pending = businessOrders
        .filter(o => o.paymentStatus !== 'Paid')
        .reduce((sum, o) => sum + (o.paymentStatus === 'Partial' ? Number(o.partialRemainingAmount || 0) : Number(o.finalAmount || 0)), 0);

      // loss based on paid amount vs cost (use finalAmount and partialPaidAmount)
      const loss = businessOrders.reduce((sum, o) => {
        const finalAmount = Number(o.finalAmount || 0);
        const paidAmount = o.paymentStatus === 'Paid' ? finalAmount : (o.paymentStatus === 'Partial' ? Number(o.partialPaidAmount || 0) : 0);
        const orderLoss = Math.max(0, (Number(o.costPrice || 0) + (o.deliveryPaidByCustomer === false ? Number(o.deliveryCharge || 0) : 0)) - paidAmount);
        return sum + orderLoss;
      }, 0);

      summary[business] = { sales, cost, profit, pending, loss, orderCount: businessOrders.length };

      totalSales += sales;
      totalCost += cost;
      totalProfit += profit;
      pendingPayments += pending;
      totalLoss += loss;
    });

    // Subtract expenses per business for the period
    const expenseRows = await Expense.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$businessType', total: { $sum: '$amount' } } }
    ]);
    const expenseMap = {};
    expenseRows.forEach(r => { expenseMap[r._id] = r.total; });
    // apply to summary and totals
    Object.keys(summary).forEach(b => {
      const exp = Number(expenseMap[b] || 0);
      summary[b].expenses = exp;
      summary[b].profitAfterExpenses = Number(summary[b].profit || 0) - exp;
      totalProfit -= exp;
      totalCost += exp; // expenses are part of cost
    });
    
    // Investor view - show only 40% of actual profit
    let displayProfit = totalProfit;
    if (req.user.role === 'Investor') {
      displayProfit = totalProfit * 0.4;
    }
    
    res.json({
      summary,
      totals: { sales: totalSales, cost: totalCost, profit: displayProfit, pending: pendingPayments, loss: totalLoss },
      period: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get date range summary
router.get('/range', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }
    
    const orders = await Order.find({
      createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });
    
    const totals = orders.reduce((acc, order) => {
      acc.sales += Number(order.finalAmount || 0);
      acc.cost += Number(order.costPrice || 0) + (order.deliveryPaidByCustomer === false ? Number(order.deliveryCharge || 0) : 0);
      acc.profit += Number(order.profit || 0);
      if (order.paymentStatus !== 'Paid') {
        acc.pending += order.paymentStatus === 'Partial' 
          ? Number(order.partialRemainingAmount || 0)
          : Number(order.finalAmount || 0);
      }
      return acc;
    }, { sales: 0, cost: 0, profit: 0, pending: 0 });
    
    // Investor view
    if (req.user.role === 'Investor') {
      totals.profit = totals.profit * 0.4;
    }
    
    res.json({
      ...totals,
      orderCount: orders.length,
      period: { start: startDate, end: endDate }
    });
  } catch (error) {
    console.error('Range summary error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

