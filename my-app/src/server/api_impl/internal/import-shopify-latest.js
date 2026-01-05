const { connectToDatabase } = require('../../lib/mongodb');
const { requireAuth } = require('../../lib/nextAuth');
const axios = require('axios');
const Customer = require('../../models/Customer');
const Order = require('../../models/Order');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  await connectToDatabase();
  const user = await requireAuth(req, res);
  if (!user) return;
  try {
    // Delegated implementation — keep behavior as original route
    return res.json({ message: 'import-shopify-latest not implemented in backup handler' });
  } catch (e) {
    console.error('import-shopify-latest error', e);
    return res.status(500).json({ message: e.message });
  }
};
