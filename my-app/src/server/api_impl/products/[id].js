const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const Product = require('../../models/Product');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  const id = req.query.id;
  if (req.method === 'GET') {
    const item = await Product.findById(id);
    if (!item) return res.status(404).json({ message: 'Product not found' });
    res._jsonBody = item;
    return res.json(item);
  }
  if (req.method === 'PUT') {
    const updated = await Product.findByIdAndUpdate(id, req.body || {}, { new: true });
    res._jsonBody = updated;
    return res.json(updated);
  }
  if (req.method === 'DELETE') {
    await Product.findByIdAndDelete(id);
    return res.json({ message: 'Deleted' });
  }
  return res.status(405).json({ message: 'Method not allowed' });
};
