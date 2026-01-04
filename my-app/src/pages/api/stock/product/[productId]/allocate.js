const { connectToDatabase } = require('../../../../../lib/mongodb');
const { requireAuth } = require('../../../../../lib/nextAuth');
const mongoose = require('mongoose');
const Warehouse = require('../../../../../../api/models/Warehouse');
const Product = require('../../../../../../api/models/Product');
const StockAllocation = require('../../../../../../api/models/StockAllocation');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const session = await mongoose.startSession();
  try {
    const { productId } = req.query || {};
    const { warehouseId, qty, costPrice, priceTierId } = req.body || {};
    if (!warehouseId) return res.status(400).json({ message: 'warehouseId required' });
    if (costPrice === undefined || costPrice === null) return res.status(400).json({ message: 'costPrice required' });
    const q = Number(qty || 0);
    const cp = Number(costPrice || 0);
    if (!(q > 0)) return res.status(400).json({ message: 'qty must be > 0' });
    if (cp < 0) return res.status(400).json({ message: 'costPrice cannot be negative' });

    session.startTransaction();
    const wh = await Warehouse.findById(warehouseId).session(session);
    if (!wh) { await session.abortTransaction(); return res.status(404).json({ message: 'Warehouse not found' }); }
    const product = await Product.findById(productId).session(session);
    if (!product) { await session.abortTransaction(); return res.status(404).json({ message: 'Product not found' }); }

    const match = { productId, warehouseId };
    if (priceTierId) match.priceTierId = priceTierId;
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    let alloc = await StockAllocation.findOne(match).session(session);
    if (!alloc) {
      alloc = await StockAllocation.create([{ productId, warehouseId, priceTierId: priceTierId || undefined, batches: [{ batchId, quantity: q, costPrice: cp, addedAt: new Date() }] }], { session });
      alloc = alloc[0];
    } else {
      alloc.batches.push({ batchId, quantity: q, costPrice: cp, addedAt: new Date() });
      alloc.batches.sort((a, b) => a.addedAt - b.addedAt);
      await alloc.save({ session });
    }

    const toObjectId = (v) => { try { return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v; } catch (e) { return v; } };
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    product.stock = total;
    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    if (currentAlloc && currentAlloc.batches.length > 0) product.baseCost = currentAlloc.batches[0].costPrice;
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    const out = { allocation: alloc, total, batchId, currentCostPrice: alloc.batches[0].costPrice, message: `Stock added: ${q} units at cost ${cp} per unit` };
    res._jsonBody = out;
    return res.json(out);
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Allocate error:', e);
    return res.status(500).json({ message: e.message });
  }
};
