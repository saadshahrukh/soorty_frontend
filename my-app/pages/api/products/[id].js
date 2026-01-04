const { connectToDatabase } = require('../../../src/lib/mongodb');
const { requireAuth } = require('../../../src/lib/nextAuth');
const Product = require('../../../api/models/Product');

module.exports = async (req, res) => {
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;

  const id = req.query.id;
  try {
    if (req.method === 'PUT') {
      const body = { ...req.body };
      if (body.baseCost !== undefined) body.baseCost = Number(body.baseCost || 0);
      if (body.deliveryCharges !== undefined) body.deliveryCharges = Number(body.deliveryCharges || 0);
      if (body.stock !== undefined) body.stock = Number(body.stock || 0);
      if (body.priceTiers !== undefined) body.priceTiers = Array.isArray(body.priceTiers) ? body.priceTiers.map(pt => ({ label: pt.label, price: Number(pt.price || 0) })) : [];
      const updated = await Product.findByIdAndUpdate(id, body, { new: true });
      if (!updated) return res.status(404).json({ message: 'Product not found' });
      res._jsonBody = updated;
      return res.json(updated);
    }

    if (req.method === 'DELETE') {
      const deleted = await Product.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: 'Product not found' });
      const out = { message: 'Product deleted' };
      res._jsonBody = out;
      return res.json(out);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (e) {
    console.error('Product id handler error', e);
    return res.status(500).json({ message: e.message });
  }
};
