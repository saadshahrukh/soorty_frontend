const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const mongoose = require('mongoose');
const Product = require('../../models/Product');
const StockAllocation = require('../../models/StockAllocation');
const StockTransfer = require('../../models/StockTransfer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { productId, fromWarehouseId, toWarehouseId, qty, priceTierId, note } = req.body || {};

    if (!productId || !fromWarehouseId || !toWarehouseId || !qty || qty <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    // Get source warehouse stock
    const fromStock = await StockAllocation.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      warehouseId: new mongoose.Types.ObjectId(fromWarehouseId)
    }).session(session);

    if (!fromStock) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Source stock allocation not found' });
    }

    // Check if enough qty available
    const totalFromQty = fromStock.getTotalQuantity();
    if (totalFromQty < qty) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Insufficient stock. Available: ${totalFromQty}, Requested: ${qty}` });
    }

    // Transfer batches using FIFO (deduct from oldest batches first)
    let remainingQty = qty;
    const transferredBatches = [];

    for (let i = 0; i < fromStock.batches.length && remainingQty > 0; i++) {
      const batch = fromStock.batches[i];
      const deductQty = Math.min(batch.quantity, remainingQty);
      
      if (deductQty > 0) {
        transferredBatches.push({
          batchId: batch.batchId,
          quantity: deductQty,
          costPrice: batch.costPrice
        });
        
        batch.quantity -= deductQty;
        remainingQty -= deductQty;
      }
    }

    // Remove empty batches
    fromStock.batches = fromStock.batches.filter(b => b.quantity > 0);
    await fromStock.save({ session });

    // Get or create destination warehouse stock
    let toStock = await StockAllocation.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      warehouseId: new mongoose.Types.ObjectId(toWarehouseId)
    }).session(session);

    if (!toStock) {
      toStock = new StockAllocation({
        productId: new mongoose.Types.ObjectId(productId),
        warehouseId: new mongoose.Types.ObjectId(toWarehouseId),
        batches: []
      });
    }

    // Add transferred batches to destination
    transferredBatches.forEach(batch => {
      toStock.batches.push(batch);
    });

    await toStock.save({ session });

    // Record the transfer in StockTransfer log
    const transfer = new StockTransfer({
      productId: new mongoose.Types.ObjectId(productId),
      fromWarehouseId: new mongoose.Types.ObjectId(fromWarehouseId),
      toWarehouseId: new mongoose.Types.ObjectId(toWarehouseId),
      priceTierId: priceTierId ? new mongoose.Types.ObjectId(priceTierId) : undefined,
      qty: qty,
      performedBy: user._id,
      note: note || `Transfer of ${qty} units`
    });

    await transfer.save({ session });

    // Update product stock count (recalculate total across all warehouses)
    const toObjectId = (v) => {
      try {
        return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v;
      } catch (e) {
        return v;
      }
    };
    
    const totalAgg = await StockAllocation.aggregate([
      { $match: { productId: toObjectId(productId) } },
      { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
    ]).session(session);
    
    const newTotal = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: newTotal }, { session });

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: 'Transfer completed successfully',
      transfer: transfer,
      fromStock: fromStock,
      toStock: toStock,
      newTotalStock: newTotal
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    console.error('Stock transfer error:', e);
    return res.status(500).json({ message: e.message });
  }
};
