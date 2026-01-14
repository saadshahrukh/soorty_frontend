// helper module for stock product endpoints (allocate/allocation/get)
const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Product = require('../../models/Product');
const StockAllocation = require('../../models/StockAllocation');
const Warehouse = require('../../models/Warehouse');
const mongoose = require('mongoose');

module.exports.get = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  const { productId } = req.query || {};
  const product = await Product.findById(productId).lean();
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const allocs = await StockAllocation.find({ productId }).populate('warehouseId', 'name');
  const total = allocs.reduce((s, a) => {
    const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
    return s + batchTotal;
  }, 0);
  const allocations = allocs.map(a => {
    const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
    const currentCostPrice = a.batches.length > 0 ? a.batches[0].costPrice : 0;
    return {
      _id: a._id,
      warehouseId: a.warehouseId._id,
      warehouseName: a.warehouseId.name,
      quantity: batchTotal,
      currentCostPrice,
      batchCount: a.batches.length,
      batches: a.batches.map(b => ({ batchId: b.batchId, quantity: b.quantity, costPrice: b.costPrice, addedAt: b.addedAt })),
      priceTierId: a.priceTierId || null
    };
  });
  const out = { productId, total, currentCostPrice: product.baseCost || 0, allocations, priceTiers: product.priceTiers || [] };
  res._jsonBody = out;
  return res.json(out);
};

module.exports.allocate = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId } = req.query || {};
    const { warehouseId, qty, costPrice, priceTierId } = req.body || {};
    if (!warehouseId) return res.status(400).json({ message: 'warehouseId required' });
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
      alloc = await StockAllocation.create([{
        productId,
        warehouseId,
        priceTierId: priceTierId || undefined,
        batches: [{ batchId, quantity: q, costPrice: cp, addedAt: new Date() }]
      }], { session });
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
    if (currentAlloc && currentAlloc.batches.length > 0) { product.baseCost = currentAlloc.batches[0].costPrice; }
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

module.exports.adjust = async (req, res) => {
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
      if (batch.quantity <= remainingToRemove) { remainingToRemove -= batch.quantity; newBatches.shift(); }
      else { batch.quantity -= remainingToRemove; remainingToRemove = 0; }
    }
    alloc.batches = newBatches;
    if (alloc.batches.length === 0) await StockAllocation.deleteOne(match).session(session);
    else await alloc.save({ session });
    const toObjectId = (v) => { try { return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v; } catch (e) { return v; } };
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: total }).session(session);
    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    if (currentAlloc && currentAlloc.batches.length > 0) product.baseCost = currentAlloc.batches[0].costPrice; else product.baseCost = 0;
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
