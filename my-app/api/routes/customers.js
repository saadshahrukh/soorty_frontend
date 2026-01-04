const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

// Lookup by phone (exact) or q (search by name/phone)
router.get('/', auth, async (req, res) => {
  try {
    const { phone, q } = req.query;
    if (phone) {
      const c = await Customer.findOne({ phone: String(phone) }).lean();
      if (!c) return res.status(404).json(null);
      return res.json(c);
    }
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: String(q), $options: 'i' } },
        { phone: { $regex: String(q), $options: 'i' } }
      ];
    }
    // support pagination for large customer lists
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(200, parseInt(req.query.limit || '50'));
    const skip = (page - 1) * limit;
    const total = await Customer.countDocuments(filter);
    const items = await Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) {
    console.error('Customers lookup error', e);
    res.status(500).json({ message: e.message });
  }
});

// Optionally create a customer (used elsewhere if needed)
router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, address, email, notes } = req.body;
    const created = await Customer.create({ name, phone, address, email, notes });
    res.json(created);
  } catch (e) {
    console.error('Create customer error', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
