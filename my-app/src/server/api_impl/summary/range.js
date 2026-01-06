const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { startDate, endDate } = req.query || {};

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query).lean();

    // Group by business type
    const summary = {
      Travel: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 },
      Dates: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 },
      Belts: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 }
    };

    orders.forEach(order => {
      const business = order.businessType || 'Travel';
      if (!summary[business]) summary[business] = { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 };

      const group = summary[business];
      group.sales += order.sellingPrice || 0;
      group.cost += order.costPrice || 0;
      group.profit += order.profit || ((order.sellingPrice || 0) - (order.costPrice || 0));
      group.orderCount += 1;

      // Calculate pending amount
      if (order.paymentStatus !== 'Paid') {
        if (order.paymentStatus === 'Partial') {
          group.pending += (order.partialRemainingAmount || (order.sellingPrice || 0) * 0.5);
        } else {
          group.pending += order.sellingPrice || 0;
        }
      }

      // Calculate loss
      const tax = (order.taxPercent || 0) / 100;
      const finalAmount = Math.round(((order.sellingPrice || 0) * (1 + tax)) * 100) / 100;
      const paidAmount = order.paymentStatus === 'Paid' ? finalAmount : 
                         (order.paymentStatus === 'Partial' ? (order.partialPaidAmount || 0) : 0);
      const orderLoss = Math.max(0, (order.costPrice || 0) - paidAmount);
      group.loss += orderLoss;
    });

    // Calculate totals
    const totals = {
      sales: Object.values(summary).reduce((sum, b) => sum + b.sales, 0),
      cost: Object.values(summary).reduce((sum, b) => sum + b.cost, 0),
      profit: Object.values(summary).reduce((sum, b) => sum + b.profit, 0),
      pending: Object.values(summary).reduce((sum, b) => sum + b.pending, 0),
      loss: Object.values(summary).reduce((sum, b) => sum + b.loss, 0)
    };

    res._jsonBody = { summary, totals };
    return res.json({ summary, totals });
  } catch (e) {
    console.error('Summary range error:', e);
    return res.status(500).json({ message: e.message });
  }
};

