const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const StockAllocation = require('../models/StockAllocation');
const auth = require('../middleware/auth');
const audit = require('../middleware/audit');

async function generateUniqueOrderId() {
  let id;
  let exists = true;
  while (exists) {
    id = String(Math.floor(10000 + Math.random() * 90000));
    // eslint-disable-next-line no-await-in-loop
    exists = await Order.exists({ orderId: id });
  }
  return id;
}

function computeDerived(data) {
  // Handle both multi-product and legacy single-product payloads
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

  // include order-level discount as well
  totalDiscount += Number(data.orderDiscount || 0);

  const taxMultiplier = 1 + ((data.taxPercent || 0) / 100);
  const delivery = Number(data.deliveryCharge || 0);
  const deliveryPaidByCustomer = data.deliveryPaidByCustomer !== false; // default true

  // account for discounts
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

// Create order
router.post('/', auth, audit('CREATE', 'Order'), async (req, res) => {
  try {
    const base = { ...req.body };
    if (!base.orderId) base.orderId = await generateUniqueOrderId();
    const { finalAmount, profit, partialRemainingAmount } = computeDerived(base);
    // If phone provided, find or create customer and attach reference
    if (base.customerPhone) {
      try {
        let cust = await Customer.findOne({ phone: base.customerPhone });
        if (!cust) {
          cust = await Customer.create({
            name: base.customerSupplierName || base.clientName || 'Unknown',
            phone: base.customerPhone,
            address: base.customerAddress || ''
          });
        } else {
          // update address/name if missing
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

    const order = new Order({
      ...base,
      userId: req.user._id,
      finalAmount,
      profit,
      partialRemainingAmount,
    });
    
    // FIFO Stock depletion for ordered products
    if (Array.isArray(base.products) && base.products.length > 0) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        
        // Validate all stock availability first
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

        // Deplete stock using FIFO batches for each product
        for (const p of base.products) {
          if (!p.productId) continue;
          const qty = Number(p.quantity || 0);
          if (qty <= 0) continue;

          const prod = await Product.findById(p.productId).session(session);
          if (!prod) continue;

          // Find stock allocation - prefer warehouse from formData, otherwise any warehouse
          const warehouseId = base.warehouseId ? new mongoose.Types.ObjectId(base.warehouseId) : null;
          const matchQuery = { productId: prod._id };
          if (warehouseId) matchQuery.warehouseId = warehouseId;

          let alloc = await StockAllocation.findOne(matchQuery).session(session);
          
          // If warehouse specified but not found, skip FIFO and just decrement legacy quantity
          if (!alloc && !warehouseId) {
            // No allocation found and no warehouse specified - just decrement product stock
            await Product.findByIdAndUpdate(prod._id, { $inc: { stock: -qty } }).session(session);
            continue;
          }

          if (alloc) {
            // FIFO depletion from batches
            const currentTotal = alloc.batches.reduce((sum, b) => sum + b.quantity, 0);
            if (qty > currentTotal) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({ message: `Insufficient batched stock for product ${prod.name}` });
            }

            // Remove from oldest batches first (FIFO)
            let remainingToRemove = qty;
            while (remainingToRemove > 0 && alloc.batches.length > 0) {
              const batch = alloc.batches[0];
              if (batch.quantity <= remainingToRemove) {
                remainingToRemove -= batch.quantity;
                alloc.batches.shift(); // Remove oldest batch completely
              } else {
                batch.quantity -= remainingToRemove;
                remainingToRemove = 0;
              }
            }

            // Update or delete allocation
            if (alloc.batches.length === 0) {
              await StockAllocation.deleteOne({ _id: alloc._id }).session(session);
            } else {
              await alloc.save({ session });
            }

            // Update Product.baseCost to current batch's cost price (FIFO)
            if (alloc.batches.length > 0) {
              prod.baseCost = alloc.batches[0].costPrice;
            } else {
              prod.baseCost = 0;
            }
            
            // Recalculate total stock across all warehouses for this product
            const totalAgg = await StockAllocation.aggregate([
              { $match: { productId: prod._id } },
              { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
            ]).session(session);
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

    // Return the created order populated with customer when possible
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
    res.json(out);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all orders with filters
router.get('/', auth, async (req, res) => {
  try {
  const { businessType, paymentStatus, startDate, endDate, minRemaining, maxRemaining, orderId, customerId, customerPhone } = req.query;
    const query = {};
    // support searching by orderId (Bill No) - partial case-insensitive match
    if (orderId) {
      // allow numeric or alphanumeric searches; match from start (prefix) and escape user input
      try {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = `^${escapeRegex(String(orderId))}`;
        query.orderId = { $regex: pattern, $options: 'i' };
      } catch (e) {
        query.orderId = orderId;
      }
    }
    if (businessType) query.businessType = businessType;
  // filter by customer id or phone when provided
  if (customerId) query.customerId = customerId;
  if (customerPhone) query.customerPhone = String(customerPhone);
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if ((minRemaining || maxRemaining) && (!paymentStatus || paymentStatus === 'Partial')) {
      query.paymentStatus = 'Partial';
      query.partialRemainingAmount = {};
      if (minRemaining) query.partialRemainingAmount.$gte = Number(minRemaining);
      if (maxRemaining) query.partialRemainingAmount.$lte = Number(maxRemaining);
    }
    // populate customerId when present, otherwise fallback to phone lookup for legacy orders
    const page = req.query.page ? Math.max(1, parseInt(req.query.page)) : null;
    const limit = req.query.limit ? Math.max(1, Math.min(500, parseInt(req.query.limit))) : null;

    if (page && limit) {
      const skip = (page - 1) * limit;
      const total = await Order.countDocuments(query);
      let docs = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customerId').lean();
      docs = await Promise.all(docs.map(async (o) => {
        if (o.customerId) {
          o.customer = o.customerId;
          delete o.customerId;
          return o;
        }
        if (o.customerPhone) {
          try {
            const cust = await Customer.findOne({ phone: o.customerPhone }).lean();
            if (cust) o.customer = cust;
          } catch (e) {}
        }
        return o;
      }));
      return res.json({ items: docs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    }

    let orders = await Order.find(query).sort({ createdAt: -1 }).populate('customerId').lean();
    orders = await Promise.all(orders.map(async (o) => {
      if (o.customerId) {
        o.customer = o.customerId;
        delete o.customerId;
        return o;
      }
      if (o.customerPhone) {
        try {
          const cust = await Customer.findOne({ phone: o.customerPhone }).lean();
          if (cust) o.customer = cust;
        } catch (e) {}
      }
      return o;
    }));
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Lightweight search endpoint for autocomplete/suggestions
router.get('/search', auth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || String(q).trim() === '') return res.json([]);
    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const pattern = `^${escapeRegex(String(q))}`;
    let docs = await Order.find({ orderId: { $regex: pattern, $options: 'i' } })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('orderId customerSupplierName customerPhone customerAddress customerId')
      .populate('customerId')
      .lean();

    docs = docs.map(o => {
      if (o.customerId) {
        o.customer = o.customerId;
        delete o.customerId;
      }
      return o;
    });

    res.json(docs);
  } catch (error) {
    console.error('Search orders error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    let order = await Order.findById(req.params.id).populate('customerId').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.customerId) {
      order.customer = order.customerId;
      delete order.customerId;
    } else if (order.customerPhone) {
      try {
        const cust = await Customer.findOne({ phone: order.customerPhone }).lean();
        if (cust) order.customer = cust;
      } catch (e) {}
    }
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update order
router.put('/:id', auth, audit('UPDATE', 'Order'), async (req, res) => {
  try {
    // capture before for audit
    res.locals.entityBefore = await Order.findById(req.params.id).lean();
    const base = { ...req.body };
    const { finalAmount, profit, partialRemainingAmount } = computeDerived(base);
    // If phone provided, find or create customer and attach reference
    if (base.customerPhone) {
      try {
        let cust = await Customer.findOne({ phone: base.customerPhone });
        if (!cust) {
          cust = await Customer.create({
            name: base.customerSupplierName || base.clientName || 'Unknown',
            phone: base.customerPhone,
            address: base.customerAddress || ''
          });
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

    let order = await Order.findByIdAndUpdate(
      req.params.id,
      { ...base, finalAmount, profit, partialRemainingAmount },
      { new: true }
    ).populate('customerId').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.customerId) {
      order.customer = order.customerId;
      delete order.customerId;
    } else if (order.customerPhone) {
      try {
        const cust = await Customer.findOne({ phone: order.customerPhone }).lean();
        if (cust) order.customer = cust;
      } catch (e) {}
    }
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Bulk delete by filters (must be BEFORE ':id' route to avoid routing conflicts)
router.delete('/bulk', auth, audit('DELETE', 'Order'), async (req, res) => {
  try {
    if (req.user.role === 'DataEntry') return res.status(403).json({ message: 'DataEntry is not allowed to delete orders' });
    const { businessType, startDate, endDate } = req.body || {};
    const query = {};
    if (businessType && businessType !== 'All') query.businessType = businessType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    // capture before count for audit context
    const toDelete = await Order.find(query).select('_id orderId productServiceName').lean();
    res.locals.entityBefore = { items: toDelete };
    const result = await Order.deleteMany(query);
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete order
router.delete('/:id', auth, audit('DELETE', 'Order'), async (req, res) => {
  try {
    if (req.user.role === 'DataEntry') return res.status(403).json({ message: 'DataEntry is not allowed to delete orders' });
    // capture before for audit
    res.locals.entityBefore = await Order.findById(req.params.id).lean();
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

