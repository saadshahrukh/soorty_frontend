const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Product = require('../../models/Product');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const { q, businessType, page, limit } = req.query || {};
      
      // Build query
      const query = {};
      if (q) {
        query.$or = [
          { name: new RegExp(q, 'i') },
          { sku: new RegExp(q, 'i') }
        ];
      }
      if (businessType) query.businessType = businessType;

      const pageNum = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 50;
      const skip = (pageNum - 1) * pageSize;

      const items = await Product.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean();
      
      res._jsonBody = items;
      return res.json(items);
    } catch (e) {
      console.error('Products GET error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const created = await Product.create(req.body || {});
      res.status(201);
      res._jsonBody = created;
      return res.json(created);
    } catch (e) {
      console.error('Products POST error:', e);
      return res.status(500).json({ message: e.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};

