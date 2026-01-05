module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    if (s.length === 0) return require('../../../server/api_impl/products/index.js')(req, res);
    req.query.id = s[0];
    return require('../../../server/api_impl/products/[id].js')(req, res);
  } catch (e) {
    console.error('Products catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
