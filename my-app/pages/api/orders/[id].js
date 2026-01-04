const mongoose = require('mongoose');
const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Order = require('../../../api/models/Order');
const Customer = require('../../../api/models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const id = req.query.id;
  try {
    if (req.method === 'GET') {
      let order = await Order.findById(id).populate('customerId').lean();
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.customerId) { order.customer = order.customerId; delete order.customerId; }
      else if (order.customerPhone) { try { const cust = await Customer.findOne({ phone: order.customerPhone }).lean(); if (cust) order.customer = cust; } catch (e) {} }
      res._jsonBody = order;
      return res.json(order);
    }

    if (req.method === 'PUT') {
      res.locals = res.locals || {};
      res.locals.entityBefore = await Order.findById(id).lean();
      const base = { ...req.body };
      // compute derived similar to create
      const computeDerived = (data) => {
        let totalSelling = 0, totalCost = 0, totalDiscount = 0;
        if (Array.isArray(data.products) && data.products.length > 0) {
          data.products.forEach(p => { const qty = Number(p.quantity || 0); const sp = Number(p.sellingPrice || p.basePrice || 0); const cp = Number(p.costPrice || p.baseCost || 0); const pd = Number(p.discount || 0); totalSelling += sp * qty; totalCost += cp * qty; totalDiscount += pd; });
        } else {
          totalSelling = Number(data.sellingPrice || 0) * (Number(data.quantity || 1)); totalCost = Number(data.costPrice || 0); totalDiscount += Number(data.orderDiscount || 0);
        }
        totalDiscount += Number(data.orderDiscount || 0);
        const taxMultiplier = 1 + ((data.taxPercent || 0) / 100);
        const delivery = Number(data.deliveryCharge || 0);
        const deliveryPaidByCustomer = data.deliveryPaidByCustomer !== false;
        const netSelling = Math.max(0, totalSelling - totalDiscount);
        let finalAmount, profit;
        if (deliveryPaidByCustomer) { finalAmount = Math.round((netSelling * taxMultiplier + delivery) * 100) / 100; profit = Math.round((netSelling * taxMultiplier - totalCost) * 100) / 100; }
        else { finalAmount = Math.round((netSelling * taxMultiplier) * 100) / 100; profit = Math.round((netSelling * taxMultiplier - totalCost - delivery) * 100) / 100; }
        const partialPaid = Number(data.partialPaidAmount || 0);
        const partialRemainingAmount = data.paymentStatus === 'Partial' ? Math.max(0, finalAmount - partialPaid) : 0;
        return { finalAmount, profit, partialRemainingAmount };
      };

      const { finalAmount, profit, partialRemainingAmount } = computeDerived(base);
      if (base.customerPhone) {
        try {
          let cust = await Customer.findOne({ phone: base.customerPhone });
          if (!cust) {
            cust = await Customer.create({ name: base.customerSupplierName || base.clientName || 'Unknown', phone: base.customerPhone, address: base.customerAddress || '' });
          } else {
            const shouldUpdate = (!cust.address && base.customerAddress) || (!cust.name && base.customerSupplierName);
            if (shouldUpdate) { cust.name = cust.name || base.customerSupplierName || base.clientName || cust.name; cust.address = cust.address || base.customerAddress || cust.address; await cust.save(); }
          }
          if (cust) base.customerId = cust._id;
        } catch (e) { console.error('Customer lookup/create failed:', e); }
      }

      const updated = await Order.findByIdAndUpdate(id, { ...base, finalAmount, profit, partialRemainingAmount }, { new: true }).populate('customerId').lean();
      if (!updated) return res.status(404).json({ message: 'Order not found' });
      if (updated.customerId) { updated.customer = updated.customerId; delete updated.customerId; }
      else if (updated.customerPhone) { try { const cust = await Customer.findOne({ phone: updated.customerPhone }).lean(); if (cust) updated.customer = cust; } catch (e) {} }
      res._jsonBody = updated;
      return res.json(updated);
    }

    if (req.method === 'DELETE') {
      if (user.role === 'DataEntry') return res.status(403).json({ message: 'DataEntry is not allowed to delete orders' });
      res.locals = res.locals || {};
      res.locals.entityBefore = await Order.findById(id).lean();
      const order = await Order.findByIdAndDelete(id);
      if (!order) return res.status(404).json({ message: 'Order not found' });
      const out = { message: 'Order deleted' };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Order id handler error:', error);
    return res.status(500).json({ message: error.message });
  }
};
