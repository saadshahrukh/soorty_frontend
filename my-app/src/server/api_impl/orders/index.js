const mongoose = require('mongoose');
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Order = require('../../models/Order');
const StockAllocation = require('../../models/StockAllocation');
const Product = require('../../models/Product');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { businessType, startDate, endDate, paymentStatus, customerId, customerPhone } = req.query || {};
      
      // Build query
      const query = {};
      if (businessType) query.businessType = businessType;
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      // CRITICAL: Filter by customer if provided
      if (customerId) {
        try {
          query.customerId = new mongoose.Types.ObjectId(customerId);
        } catch (e) {
          // Invalid ObjectId, filter won't match anything
          query.customerId = null;
        }
      }
      if (customerPhone) {
        query.customerPhone = customerPhone;
      }

      const items = await Order.find(query).sort({ createdAt: -1 }).limit(200).lean();
      res._jsonBody = items;
      return res.json(items);
    } catch (e) {
      console.error('Orders GET error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  if (req.method === 'POST') {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const orderData = req.body || {};
      
      // Create the order
      const created = await Order.create([orderData], { session });
      const order = created[0];

      // CRITICAL: Deduct inventory from warehouse if warehouseId and products are present
      if (orderData.warehouseId && orderData.products && Array.isArray(orderData.products)) {
        for (const product of orderData.products) {
          if (product.productId && product.quantity > 0) {
            const stock = await StockAllocation.findOne({
              productId: new mongoose.Types.ObjectId(product.productId),
              warehouseId: new mongoose.Types.ObjectId(orderData.warehouseId)
            }).session(session);

            if (stock) {
              // Deduct from batches using FIFO (oldest first)
              let remainingQty = product.quantity;
              for (let i = 0; i < stock.batches.length && remainingQty > 0; i++) {
                const batch = stock.batches[i];
                const deductQty = Math.min(batch.quantity, remainingQty);
                batch.quantity -= deductQty;
                remainingQty -= deductQty;
              }
              // Remove empty batches
              stock.batches = stock.batches.filter(b => b.quantity > 0);
              await stock.save({ session });

              // Update product stock count
              const totalQty = await StockAllocation.aggregate([
                { $match: { productId: new mongoose.Types.ObjectId(product.productId) } },
                { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
              ]).session(session);
              
              const newTotal = (totalQty[0] && totalQty[0].total) || 0;
              await Product.findByIdAndUpdate(
                product.productId,
                { stock: newTotal },
                { session }
              );
            }
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      res.status(201);
      res._jsonBody = order;
      return res.json(order);
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      console.error('Orders POST error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};

