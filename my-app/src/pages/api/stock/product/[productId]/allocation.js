const { connectToDatabase } = require('../../../../../src/lib/mongodb');
const { requireAuth } = require('../../../../../src/lib/nextAuth');
const mongoose = require('mongoose');
const Warehouse = require('../../../../../api/models/Warehouse');
const Product = require('../../../../../api/models/Product');
const StockAllocation = require('../../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const session = await mongoose.startSession();
  try {
    const { productId } = req.query || {};
    const { warehouseId, qty, priceTierId } = req.body || {};
    if (!warehouseId) return res.status(400).json({ message: 'warehouseId required' });
    const q = Number(qty || 0);
    if (q < 0) return res.status(400).json({ message: 'qty must be >= 0' });

    session.startTransaction();
    const wh = await Warehouse.findById(warehouseId).session(session);
    if (!wh) { await session.abortTransaction(); return res.status(404).json({ message: 'Warehouse not found' }); }
    const product = await Product.findById(productId).session(session);
    if (!product) { await session.abortTransaction(); return res.status(404).json({ message: 'Product not found' }); }

    const match = { productId, warehouseId };
    if (priceTierId) match.priceTierId = priceTierId;
    let alloc = await StockAllocation.findOne(match).session(session);
    if (!alloc) { await session.abortTransaction(); return res.status(404).json({ message: 'No stock allocation found' }); }

    const currentTotal = alloc.batches.reduce((sum, b) => sum + b.quantity, 0);
    if (q > currentTotal) { await session.abortTransaction(); return res.status(409).json({ message: `Cannot reduce to ${q}. Current total is ${currentTotal}` }); }

    let remainingToRemove = currentTotal - q;
    const newBatches = [...alloc.batches];
    while (remainingToRemove > 0 && newBatches.length > 0) {
      const batch = newBatches[0];
      if (batch.quantity <= remainingToRemove) {
        remainingToRemove -= batch.quantity;
        newBatches.shift();
      } else {
        batch.quantity -= remainingToRemove;
        remainingToRemove = 0;
      }
    }

    alloc.batches = newBatches;
    if (alloc.batches.length === 0) {
      await StockAllocation.deleteOne(match).session(session);
    } else {
      await alloc.save({ session });
    }

    const toObjectId = (v) => { try { return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v; } catch (e) { return v; } };
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: total }).session(session);

    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    if (currentAlloc && currentAlloc.batches.length > 0) {
      product.baseCost = currentAlloc.batches[0].costPrice;
    } else {
      product.baseCost = 0;
    }
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    const out = { message: 'Stock adjusted', total, currentCostPrice: alloc.batches.length > 0 ? alloc.batches[0].costPrice : 0 };
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Update allocation error:', e);
    return res.status(500).json({ message: e.message });
  }
};
