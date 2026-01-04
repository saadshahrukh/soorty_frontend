const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const StockAllocation = require('../models/StockAllocation');
const auth = require('../middleware/auth');

// List warehouses
router.get('/', auth, async (req, res) => {
  try {
    const items = await Warehouse.find().sort({ name: 1 });
    res.json(items);
  } catch (e) {
    console.error('List warehouses error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Create warehouse
router.post('/', auth, async (req, res) => {
  try {
    const { name, location, meta } = req.body;
    const created = await Warehouse.create({ name, location, meta });
    res.status(201).json(created);
  } catch (e) {
    console.error('Create warehouse error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const updated = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Warehouse not found' });
    res.json(updated);
  } catch (e) {
    console.error('Update warehouse error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Delete (only allowed if no allocations exist)
router.delete('/:id', auth, async (req, res) => {
  try {
    const allocCount = await StockAllocation.countDocuments({ warehouseId: req.params.id });
    if (allocCount > 0) return res.status(400).json({ message: 'Warehouse has stock allocations; cannot delete' });
    const deleted = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Warehouse not found' });
    res.json({ message: 'Warehouse deleted' });
  } catch (e) {
    console.error('Delete warehouse error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
