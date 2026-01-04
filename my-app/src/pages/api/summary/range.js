const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Order = require('../../../../api/models/Order');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
    const { startDate, endDate } = req.query || {};
    if (!startDate || !endDate) return res.status(400).json({ message: 'startDate and endDate are required' });
    const orders = await Order.find({ createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } });
    const totals = orders.reduce((acc, order) => {
      acc.sales += Number(order.finalAmount || 0);
      acc.cost += Number(order.costPrice || 0) + (order.deliveryPaidByCustomer === false ? Number(order.deliveryCharge || 0) : 0);
      acc.profit += Number(order.profit || 0);
      if (order.paymentStatus !== 'Paid') {
        acc.pending += order.paymentStatus === 'Partial' ? Number(order.partialRemainingAmount || 0) : Number(order.finalAmount || 0);
      }
      return acc;
    }, { sales: 0, cost: 0, profit: 0, pending: 0 });
    if (user.role === 'Investor') totals.profit = totals.profit * 0.4;
    const out = { ...totals, orderCount: orders.length, period: { start: startDate, end: endDate } };
    res._jsonBody = out;
    return res.json(out);
  } catch (error) {
    console.error('Summary range error:', error);
    return res.status(500).json({ message: error.message });
  }
};
