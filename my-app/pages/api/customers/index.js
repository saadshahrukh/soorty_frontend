const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Customer = require('../../../api/models/Customer');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const { phone, q } = req.query || {};
      if (phone) {
        const c = await Customer.findOne({ phone: String(phone) }).lean();
        if (!c) return res.status(404).json(null);
        res._jsonBody = c;
        return res.json(c);
      }
      const filter = {};
      if (q) {
        filter.$or = [
          { name: { $regex: String(q), $options: 'i' } },
          { phone: { $regex: String(q), $options: 'i' } }
        ];
      }
      const page = Math.max(1, parseInt(req.query.page || '1'));
      const limit = Math.min(200, parseInt(req.query.limit || '50'));
      const skip = (page - 1) * limit;
      const total = await Customer.countDocuments(filter);
      const items = await Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      const out = { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
      res._jsonBody = out;
      return res.json(out);
    }

    if (req.method === 'POST') {
      const { name, phone, address, email, notes } = req.body || {};
      const created = await Customer.create({ name, phone, address, email, notes });
      res._jsonBody = created;
      return res.json(created);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Customers handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
