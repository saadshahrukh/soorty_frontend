const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StockAllocation = require('../models/StockAllocation');
const StockTransfer = require('../models/StockTransfer');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const auth = require('../middleware/auth');

// Helper to safely convert to ObjectId
const toObjectId = (v) => {
  try {
    return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : v;
  } catch (e) {
    return v;
  }
};

// Get allocations for a product (with batch details)
router.get('/product/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const allocs = await StockAllocation.find({ productId }).populate('warehouseId', 'name');
    
    // Calculate total from all batches
    const total = allocs.reduce((s, a) => {
      const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
      return s + batchTotal;
    }, 0);
    
    // Map allocations with batch details
    const allocations = allocs.map(a => {
      const batchTotal = a.batches.reduce((sum, b) => sum + b.quantity, 0);
      const currentCostPrice = a.batches.length > 0 ? a.batches[0].costPrice : 0;
      
      return {
        warehouseId: a.warehouseId._id,
        warehouseName: a.warehouseId.name,
        quantity: batchTotal, // Total quantity from all batches
        currentCostPrice, // Cost price of current batch (FIFO)
        batchCount: a.batches.length,
        batches: a.batches.map(b => ({
          batchId: b.batchId,
          quantity: b.quantity,
          costPrice: b.costPrice,
          addedAt: b.addedAt
        })),
        priceTierId: a.priceTierId || null,
        priceTierLabel: a.priceTierId ? ((product.priceTiers || []).find(pt => String(pt._id) === String(a.priceTierId))?.label || null) : null,
      };
    });
    
    res.json({ 
      productId, 
      total, 
      currentCostPrice: product.baseCost || 0,
      allocations, 
      priceTiers: product.priceTiers || [] 
    });
  } catch (e) {
    console.error('Get product allocations error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Allocate (add new stock batch) for a product in a warehouse
router.post('/product/:productId/allocate', auth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId } = req.params;
    const { warehouseId, qty, costPrice, priceTierId } = req.body;
    if (!warehouseId) return res.status(400).json({ message: 'warehouseId required' });
    if (costPrice === undefined || costPrice === null) return res.status(400).json({ message: 'costPrice required - enter the cost per unit for this stock' });
    
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
    
    // Generate unique batch ID
    const batchId = `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    let alloc = await StockAllocation.findOne(match).session(session);
    if (!alloc) {
      // Create new allocation with first batch
      alloc = await StockAllocation.create([{
        productId,
        warehouseId,
        priceTierId: priceTierId || undefined,
        batches: [{
          batchId,
          quantity: q,
          costPrice: cp,
          addedAt: new Date()
        }]
      }], { session });
      alloc = alloc[0];
    } else {
      // Add new batch to existing allocation
      alloc.batches.push({
        batchId,
        quantity: q,
        costPrice: cp,
        addedAt: new Date()
      });
      // Sort batches by addedAt (oldest first for FIFO)
      alloc.batches.sort((a, b) => a.addedAt - b.addedAt);
      await alloc.save({ session });
    }

    // Recompute total stock and update Product.stock for compatibility
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    product.stock = total;
    
    // Update baseCost with current batch's cost price
    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    if (currentAlloc && currentAlloc.batches.length > 0) {
      product.baseCost = currentAlloc.batches[0].costPrice;
    }
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ 
      allocation: alloc, 
      total,
      batchId,
      currentCostPrice: alloc.batches[0].costPrice,
      message: `Stock added: ${q} units at cost ${cp} per unit`
    });
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Allocate error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Reduce allocation (manually reduce quantity - uses FIFO for batch depletion)
router.put('/product/:productId/allocation', auth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId } = req.params;
    const { warehouseId, qty, priceTierId } = req.body;
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

    // FIFO depletion: remove from oldest batches first
    let remainingToRemove = currentTotal - q;
    const newBatches = [...alloc.batches];
    
    while (remainingToRemove > 0 && newBatches.length > 0) {
      const batch = newBatches[0];
      if (batch.quantity <= remainingToRemove) {
        remainingToRemove -= batch.quantity;
        newBatches.shift(); // Remove oldest batch
      } else {
        batch.quantity -= remainingToRemove;
        remainingToRemove = 0;
      }
    }
    
    alloc.batches = newBatches;

    // If no batches left, remove allocation to keep collection clean
    if (alloc.batches.length === 0) {
      await StockAllocation.deleteOne(match).session(session);
    } else {
      await alloc.save({ session });
    }

    // Recompute total stock and update Product.stock for compatibility
    const totalAgg = await StockAllocation.aggregate([{ $match: { productId: toObjectId(productId) } }, { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    await Product.findByIdAndUpdate(productId, { stock: total }).session(session);

    // Update baseCost with current batch's cost price (for profit calculations)
    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    if (currentAlloc && currentAlloc.batches.length > 0) {
      product.baseCost = currentAlloc.batches[0].costPrice;
    } else {
      product.baseCost = 0;
    }
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ 
      message: 'Stock adjusted', 
      total,
      currentCostPrice: alloc.batches.length > 0 ? alloc.batches[0].costPrice : 0
    });
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Update allocation error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Transfer between warehouses (with FIFO cost tracking)
router.post('/transfer', auth, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { productId, fromWarehouseId, toWarehouseId, qty, note, priceTierId } = req.body;
    const q = Number(qty || 0);
    if (!(q > 0)) return res.status(400).json({ message: 'qty must be > 0' });
    if (!productId || !fromWarehouseId || !toWarehouseId) return res.status(400).json({ message: 'productId, fromWarehouseId and toWarehouseId required' });
    if (fromWarehouseId === toWarehouseId) return res.status(400).json({ message: 'from and to warehouses must differ' });

    session.startTransaction();
    const product = await Product.findById(productId).session(session);
    if (!product) { await session.abortTransaction(); return res.status(404).json({ message: 'Product not found' }); }

    // Ensure source allocation exists and has enough quantity
    const srcMatch = { productId, warehouseId: fromWarehouseId };
    if (priceTierId) srcMatch.priceTierId = priceTierId;
    const src = await StockAllocation.findOne(srcMatch).session(session);
    const srcTotal = src ? src.batches.reduce((sum, b) => sum + b.quantity, 0) : 0;
    if (!src || srcTotal < q) { 
      await session.abortTransaction(); 
      return res.status(409).json({ message: 'Insufficient stock in source warehouse for the selected price tier' }); 
    }

    // FIFO depletion from source
    let remainingToTransfer = q;
    const srcBatches = [...src.batches];
    const transferredBatches = [];
    
    while (remainingToTransfer > 0 && srcBatches.length > 0) {
      const batch = srcBatches[0];
      if (batch.quantity <= remainingToTransfer) {
        // Transfer entire batch
        transferredBatches.push({...batch});
        remainingToTransfer -= batch.quantity;
        srcBatches.shift();
      } else {
        // Transfer part of batch
        transferredBatches.push({
          batchId: batch.batchId,
          quantity: remainingToTransfer,
          costPrice: batch.costPrice,
          addedAt: batch.addedAt
        });
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

    // Add transferred batches to destination
    const destMatch = { productId, warehouseId: toWarehouseId };
    if (priceTierId) destMatch.priceTierId = priceTierId;
    
    let dest = await StockAllocation.findOne(destMatch).session(session);
    if (!dest) {
      dest = await StockAllocation.create([{
        productId,
        warehouseId: toWarehouseId,
        priceTierId: priceTierId || undefined,
        batches: transferredBatches
      }], { session });
      dest = dest[0];
    } else {
      dest.batches.push(...transferredBatches);
      dest.batches.sort((a, b) => a.addedAt - b.addedAt);
      await dest.save({ session });
    }

    // Create transfer record
    const transfer = await StockTransfer.create([{ 
      productId, 
      fromWarehouseId, 
      toWarehouseId, 
      qty: q, 
      note, 
      performedBy: req.user && req.user._id, 
      priceTierId: priceTierId || undefined 
    }], { session });

    // Recompute and update Product.stock
    const totalAgg = await StockAllocation.aggregate([
      { $match: { productId: toObjectId(productId) } }, 
      { $group: { _id: null, total: { $sum: { $sum: '$batches.quantity' } } } }
    ]).session(session);
    const total = (totalAgg[0] && totalAgg[0].total) || 0;
    
    // Update baseCost with current batch's cost price (for profit calculations)
    const currentAlloc = await StockAllocation.findOne({ productId }).session(session);
    product.stock = total;
    if (currentAlloc && currentAlloc.batches.length > 0) {
      product.baseCost = currentAlloc.batches[0].costPrice;
    }
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ 
      transfer: transfer[0], 
      total, 
      allocationDest: dest,
      currentCostPrice: dest.batches.length > 0 ? dest.batches[0].costPrice : 0,
      message: `Transferred ${q} units. Current cost price: ${dest.batches.length > 0 ? dest.batches[0].costPrice : 0}`
    });
  } catch (e) {
    try { await session.abortTransaction(); session.endSession(); } catch {};
    console.error('Transfer error:', e && e.stack ? e.stack : e);
    res.status(500).json({ message: e.message, stack: e && e.stack ? e.stack : undefined });
  }
});

// Get transfer history for a product
router.get('/transfers', auth, async (req, res) => {
  try {
    const { productId, limit = 100 } = req.query;
    const filter = {};
    if (productId) filter.productId = productId;
    const items = await StockTransfer.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).populate('fromWarehouseId toWarehouseId performedBy', 'name');
    res.json(items);
  } catch (e) {
    console.error('Get transfers error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
