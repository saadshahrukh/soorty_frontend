const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const StockAllocation = require('../models/StockAllocation');

// Create product
router.post('/', auth, async (req, res) => {
  try {
  const { businessType, name, basePrice, deliveryCharges, priceTiers } = req.body;
  // NOTE: baseCost is NOT set here - it will be set when stock is added with cost price tracking
  // baseCost defaults to 0 and is updated via the /allocate endpoint when stock is added with a cost price
  const created = await Product.create({
    businessType,
    name,
    basePrice: Number(basePrice || 0),
    baseCost: 0, // Will be updated when stock is added
    deliveryCharges: Number(deliveryCharges || 0),
    stock: 0, // Will be updated when stock is added
    priceTiers: Array.isArray(priceTiers) ? priceTiers.map(pt => ({ label: pt.label, price: Number(pt.price || 0) })) : []
  });
    res.json(created);
  } catch (e) {
    console.error('Create product error:', e);
    res.status(500).json({ message: e.message });
  }
});

// List products (optional filters: businessType, q)
router.get('/', auth, async (req, res) => {
  try {
    const { businessType, q } = req.query;
    const filter = {};
    if (businessType) filter.businessType = businessType;
    if (q) filter.name = { $regex: String(q), $options: 'i' };
    // If a warehouseId is provided, return product stock as allocation for that warehouse
    const warehouseId = req.query.warehouseId;
    const items = await Product.find(filter).sort({ createdAt: -1 }).lean();

    if (warehouseId && items.length > 0) {
      // Attach stock for the requested warehouse (non-blocking small set)
      // Calculate total quantity from batches array (FIFO batch tracking)
      try {
        await Promise.all(items.map(async (it) => {
          try {
            // Query for StockAllocation with this productId and warehouseId
            const alloc = await StockAllocation.findOne({ productId: it._id, warehouseId });
            if (alloc && alloc.batches && alloc.batches.length > 0) {
              // Calculate total from batches array
              it.stock = alloc.batches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
            } else if (alloc && alloc.quantity) {
              // fallback for legacy data
              it.stock = Number(alloc.quantity);
            } else {
              it.stock = 0;
            }
          } catch (e) {
            it.stock = 0;
          }
        }));
      } catch (mapErr) {
        console.error('Promise.all error:', mapErr);
        // If parallel lookup fails, just return without stock
      }
    } else if (!items.length) {
      // No items, no need to lookup stock
    }

    res.json(items);
  } catch (e) {
    console.error('List products error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
  // Do not fold deliveryCharges into baseCost on update; keep separate fields
  const body = { ...req.body };
  if (body.baseCost !== undefined) body.baseCost = Number(body.baseCost || 0);
  if (body.deliveryCharges !== undefined) body.deliveryCharges = Number(body.deliveryCharges || 0);
  if (body.stock !== undefined) body.stock = Number(body.stock || 0);
  if (body.priceTiers !== undefined) body.priceTiers = Array.isArray(body.priceTiers) ? body.priceTiers.map(pt => ({ label: pt.label, price: Number(pt.price || 0) })) : [];
  const updated = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    res.json(updated);
  } catch (e) {
    console.error('Update product error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (e) {
    console.error('Delete product error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;


