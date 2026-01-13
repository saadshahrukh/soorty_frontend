// Batch-level CRUD for stock allocations
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const StockAllocation = require('../../models/StockAllocation');
const Product = require('../../models/Product');
const mongoose = require('mongoose');

module.exports.edit = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await connectToDatabase();
    const user = await requireAuth(req, res);
    if (!user) return;

    const { allocationId, batchId } = req.query || {};
    const { quantity, costPrice } = req.body || {};

    if (!allocationId || !batchId) {
      return res.status(400).json({ message: 'allocationId and batchId required' });
    }

    session.startTransaction();

    const allocation = await StockAllocation.findById(allocationId).session(session);
    if (!allocation) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Stock allocation not found' });
    }

    const batchIndex = allocation.batches.findIndex(b => b.batchId === batchId);
    if (batchIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Update batch quantity and cost price
    if (quantity !== undefined && quantity >= 0) {
      allocation.batches[batchIndex].quantity = Number(quantity);
    }
    if (costPrice !== undefined && costPrice >= 0) {
      allocation.batches[batchIndex].costPrice = Number(costPrice);
    }

    await allocation.save({ session });

    // Recalculate product stock
    const productId = allocation.productId;
    const totalAgg = await StockAllocation.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
    ]).session(session);

    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: total }, { session });

    await session.commitTransaction();
    session.endSession();

    res._jsonBody = { message: 'Batch updated', allocation };
    return res.json({ message: 'Batch updated', allocation });
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {}
    console.error('Batch edit error:', e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports.delete = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await connectToDatabase();
    const user = await requireAuth(req, res);
    if (!user) return;

    const { allocationId, batchId } = req.query || {};

    if (!allocationId || !batchId) {
      return res.status(400).json({ message: 'allocationId and batchId required' });
    }

    session.startTransaction();

    const allocation = await StockAllocation.findById(allocationId).session(session);
    if (!allocation) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Stock allocation not found' });
    }

    const batchIndex = allocation.batches.findIndex(b => b.batchId === batchId);
    if (batchIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Batch not found' });
    }

    // Remove the batch
    allocation.batches.splice(batchIndex, 1);
    await allocation.save({ session });

    // Recalculate product stock
    const productId = allocation.productId;
    const totalAgg = await StockAllocation.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
    ]).session(session);

    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: total }, { session });

    await session.commitTransaction();
    session.endSession();

    res._jsonBody = { message: 'Batch deleted' };
    return res.json({ message: 'Batch deleted' });
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {}
    console.error('Batch delete error:', e);
    return res.status(500).json({ message: e.message });
  }
};
