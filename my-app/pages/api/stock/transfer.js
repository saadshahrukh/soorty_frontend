const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const mongoose = require('mongoose');
const Product = require('../../../api/models/Product');
const StockAllocation = require('../../../api/models/StockAllocation');
const StockTransfer = require('../../../api/models/StockTransfer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const session = await mongoose.startSession();
  try {
    const { productId, fromWarehouseId, toWarehouseId, qty, note, priceTierId } = req.body || {};
    const q = Number(qty || 0);
    if (!(q > 0)) return res.status(400).json({ message: 'qty must be > 0' });
    if (!productId || !fromWarehouseId || !toWarehouseId) return res.status(400).json({ message: 'productId, fromWarehouseId and toWarehouseId required' });
    if (fromWarehouseId === toWarehouseId) return res.status(400).json({ message: 'from and to warehouses must differ' });

    session.startTransaction();
    const product = await Product.findById(productId).session(session);
    if (!product) { await session.abortTransaction(); return res.status(404).json({ message: 'Product not found' }); }

    const srcMatch = { productId, warehouseId: fromWarehouseId };
    if (priceTierId) srcMatch.priceTierId = priceTierId;
    const src = await StockAllocation.findOne(srcMatch).session(session);
    const srcTotal = src ? src.batches.reduce((sum, b) => sum + b.quantity, 0) : 0;
    if (!src || srcTotal < q) { await session.abortTransaction(); return res.status(409).json({ message: 'Insufficient stock in source warehouse for the selected price tier' }); }

    let remainingToTransfer = q;
    const srcBatches = [...src.batches];
    const transferredBatches = [];
    while (remainingToTransfer > 0 && srcBatches.length > 0) {
      const batch = srcBatches[0];
      if (batch.quantity <= remainingToTransfer) {
        transferredBatches.push({...batch});
        remainingToTransfer -= batch.quantity;
        srcBatches.shift();
      } else {
        transferredBatches.push({ batchId: batch.batchId, quantity: remainingToTransfer, costPrice: batch.costPrice, addedAt: batch.addedAt });
        batch.quantity -= remainingToTransfer;
        remainingToTransfer = 0;
      }
    }

    src.batches = srcBatches;
    if (src.batches.length === 0) {
      await StockAllocation.deleteOne(srcMatch).session(session);
    } else {
      await src.save({ session });
    }

    const destMatch = { productId, warehouseId: toWarehouseId };
    if (priceTierId) destMatch.priceTierId = priceTierId;
    let dest = await StockAllocation.findOne(destMatch).session(session);
    if (!dest) {
      dest = await StockAllocation.create([{ productId, warehouseId: toWarehouseId, priceTierId: priceTierId || undefined, batches: transferredBatches }], { session });
      dest = dest[0];
    } else {
      dest.batches.push(...transferredBatches);
      dest.batches.sort((a, b) => a.addedAt - b.addedAt);
      await dest.save({ session });
    }

    const transfer = await StockTransfer.create([{ productId, fromWarehouseId, toWarehouseId, qty: q, note, performedBy: user && user._id, priceTierId: priceTierId || undefined }], { session });

    const toObjectId = (v) => { try { return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v; } catch (e) { return v; } };
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;

    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    product.stock = total;
    if (currentAlloc && currentAlloc.batches.length > 0) product.baseCost = currentAlloc.batches[0].costPrice;
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    const out = { transfer: transfer[0], total, allocationDest: dest, currentCostPrice: dest.batches.length > 0 ? dest.batches[0].costPrice : 0, message: `Transferred ${q} units.` };
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Transfer error:', e && e.stack ? e.stack : e);
    return res.status(500).json({ message: e.message, stack: e && e.stack ? e.stack : undefined });
  }
};
