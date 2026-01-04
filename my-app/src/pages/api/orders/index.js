const mongoose = require('mongoose');
const { connectToDatabase } = require('../../../lib/mongodb');
const { requireAuth } = require('../../../lib/nextAuth');
const Order = require('../../../../api/models/Order');
const Customer = require('../../../../api/models/Customer');
const Product = require('../../../../api/models/Product');
const StockAllocation = require('../../../../api/models/StockAllocation');

async function generateUniqueOrderId() {
  let id;
  let exists = true;
  while (exists) {
    id = String(Math.floor(10000 + Math.random() * 90000));
    exists = await Order.exists({ orderId: id });
  }
  return id;
}

function computeDerived(data) {
  let totalSelling = 0;
  let totalCost = 0;
  let totalDiscount = 0;

  if (Array.isArray(data.products) && data.products.length > 0) {
    data.products.forEach(p => {
      const qty = Number(p.quantity || 0);
      const sp = Number(p.sellingPrice || p.basePrice || 0);
      const cp = Number(p.costPrice || p.baseCost || 0);
      const pd = Number(p.discount || 0);
      totalSelling += sp * qty;
      totalCost += cp * qty;
      totalDiscount += pd;
    });
  } else {
    totalSelling = Number(data.sellingPrice || 0) * (Number(data.quantity || 1));
    totalCost = Number(data.costPrice || 0);
    totalDiscount += Number(data.orderDiscount || 0);
  }

  totalDiscount += Number(data.orderDiscount || 0);

  const taxMultiplier = 1 + ((data.taxPercent || 0) / 100);
  const delivery = Number(data.deliveryCharge || 0);
  const deliveryPaidByCustomer = data.deliveryPaidByCustomer !== false;

  const netSelling = Math.max(0, totalSelling - totalDiscount);

  let finalAmount;
  let profit;
  if (deliveryPaidByCustomer) {
    finalAmount = Math.round((netSelling * taxMultiplier + delivery) * 100) / 100;
    profit = Math.round((netSelling * taxMultiplier - totalCost) * 100) / 100;
  } else {
    finalAmount = Math.round((netSelling * taxMultiplier) * 100) / 100;
    profit = Math.round((netSelling * taxMultiplier - totalCost - delivery) * 100) / 100;
  }

  const partialPaid = Number(data.partialPaidAmount || 0);
  const partialRemainingAmount = data.paymentStatus === 'Partial' ? Math.max(0, finalAmount - partialPaid) : 0;
  return { finalAmount, profit, partialRemainingAmount };
}

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'POST') {
      const base = { ...req.body };
      if (!base.orderId) base.orderId = await generateUniqueOrderId();
      const { finalAmount, profit, partialRemainingAmount } = computeDerived(base);

      if (base.customerPhone) {
        try {
          let cust = await Customer.findOne({ phone: base.customerPhone });
          if (!cust) {
            cust = await Customer.create({ name: base.customerSupplierName || base.clientName || 'Unknown', phone: base.customerPhone, address: base.customerAddress || '' });
          } else {
            const shouldUpdate = (!cust.address && base.customerAddress) || (!cust.name && base.customerSupplierName);
            if (shouldUpdate) {
              cust.name = cust.name || base.customerSupplierName || base.clientName || cust.name;
              cust.address = cust.address || base.customerAddress || cust.address;
              await cust.save();
            }
          }
          if (cust) base.customerId = cust._id;
        } catch (e) {
          console.error('Customer lookup/create failed:', e);
        }
      }

      const order = new Order({ ...base, userId: user._id, finalAmount, profit, partialRemainingAmount });

      if (Array.isArray(base.products) && base.products.length > 0) {
        const session = await mongoose.startSession();
        try {
          session.startTransaction();
          for (const p of base.products) {
            if (!p.productId) continue;
            const prod = await Product.findById(p.productId).session(session);
            if (!prod) continue;
            const qty = Number(p.quantity || 0);
            if (qty <= 0) continue;
            if ((prod.stock || 0) < qty) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({ message: `Insufficient stock for product ${prod.name}` });
            }
          }

          for (const p of base.products) {
            if (!p.productId) continue;
            const qty = Number(p.quantity || 0);
            if (qty <= 0) continue;

            const prod = await Product.findById(p.productId).session(session);
            if (!prod) continue;

            const warehouseId = base.warehouseId ? new mongoose.Types.ObjectId(base.warehouseId) : null;
            const matchQuery = { productId: prod._id };
            if (warehouseId) matchQuery.warehouseId = warehouseId;

            let alloc = await StockAllocation.findOne(matchQuery).session(session);

            if (!alloc && !warehouseId) {
              await Product.findByIdAndUpdate(prod._id, { $inc: { stock: -qty } }).session(session);
              continue;
            }

            if (alloc) {
              const currentTotal = alloc.batches.reduce((sum, b) => sum + b.quantity, 0);
              if (qty > currentTotal) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: `Insufficient batched stock for product ${prod.name}` });
              }

              let remainingToRemove = qty;
              while (remainingToRemove > 0 && alloc.batches.length > 0) {
                const batch = alloc.batches[0];
                if (batch.quantity <= remainingToRemove) {
                  remainingToRemove -= batch.quantity;
                  alloc.batches.shift();
                } else {
                  batch.quantity -= remainingToRemove;
                  remainingToRemove = 0;
                }
              }

              if (alloc.batches.length === 0) {
                await StockAllocation.deleteOne({ _id: alloc._id }).session(session);
              } else {
                await alloc.save({ session });
              }

              if (alloc.batches.length > 0) {
                prod.baseCost = alloc.batches[0].costPrice;
              } else {
                prod.baseCost = 0;
              }

              const totalAgg = await StockAllocation.aggregate([{ $match: { productId: prod._id } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
              prod.stock = (totalAgg[0] && totalAgg[0].total) || 0;

              await prod.save({ session });
            }
          }

          await session.commitTransaction();
          session.endSession();
        } catch (e) {
          try { await session.abortTransaction(); session.endSession(); } catch {}
          console.error('Stock depletion error:', e);
          return res.status(500).json({ message: 'Stock depletion failed: ' + e.message });
        }
      }

      await order.save();
      let out = await Order.findById(order._id).populate('customerId').lean();
      if (out) {
        if (out.customerId) {
          out.customer = out.customerId;
          delete out.customerId;
        } else if (out.customerPhone) {
          try {
            const cust = await Customer.findOne({ phone: out.customerPhone }).lean();
            if (cust) out.customer = cust;
          } catch (e) {}
        }
      }
      res._jsonBody = out;
      return res.json(out);
    }

    // GET list w/ filters & pagination
    if (req.method === 'GET') {
      const { businessType, paymentStatus, startDate, endDate, minRemaining, maxRemaining, orderId, customerId, customerPhone } = req.query;
      const query = {};
      if (orderId) {
        try {
          const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = `^${escapeRegex(String(orderId))}`;
          query.orderId = { $regex: pattern, $options: 'i' };
        } catch (e) { query.orderId = orderId; }
      }
      if (businessType) query.businessType = businessType;
      if (customerId) query.customerId = customerId;
      if (customerPhone) query.customerPhone = String(customerPhone);
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (startDate || endDate) { query.createdAt = {}; if (startDate) query.createdAt.$gte = new Date(startDate); if (endDate) query.createdAt.$lte = new Date(endDate); }
      if ((minRemaining || maxRemaining) && (!paymentStatus || paymentStatus === 'Partial')) {
        query.paymentStatus = 'Partial';
        query.partialRemainingAmount = {};
        if (minRemaining) query.partialRemainingAmount.$gte = Number(minRemaining);
        if (maxRemaining) query.partialRemainingAmount.$lte = Number(maxRemaining);
      }

      const page = req.query.page ? Math.max(1, parseInt(req.query.page)) : null;
      const limit = req.query.limit ? Math.max(1, Math.min(500, parseInt(req.query.limit))) : null;

      if (page && limit) {
        const skip = (page - 1) * limit;
        const total = await Order.countDocuments(query);
        let docs = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customerId').lean();
        docs = await Promise.all(docs.map(async (o) => {
          if (o.customerId) { o.customer = o.customerId; delete o.customerId; return o; }
          if (o.customerPhone) { try { const cust = await Customer.findOne({ phone: o.customerPhone }).lean(); if (cust) o.customer = cust; } catch (e) {} }
          return o;
        }));
        const out = { items: docs, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
        res._jsonBody = out;
        return res.json(out);
      }

      let orders = await Order.find(query).sort({ createdAt: -1 }).populate('customerId').lean();
      orders = await Promise.all(orders.map(async (o) => {
        if (o.customerId) { o.customer = o.customerId; delete o.customerId; return o; }
        if (o.customerPhone) { try { const cust = await Customer.findOne({ phone: o.customerPhone }).lean(); if (cust) o.customer = cust; } catch (e) {} }
        return o;
      }));
      res._jsonBody = orders;
      return res.json(orders);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    console.error('Orders handler error:', error);
    return res.status(500).json({ message: error.message });
  }
};
