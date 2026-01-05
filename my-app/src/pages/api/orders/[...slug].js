module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    if (s.length === 0) return require('../../../server/api_impl/orders/index.js')(req, res);
    if (s[0] === 'search') return require('../../../server/api_impl/orders/search.js')(req, res);
    if (s[0] === 'bulk') return require('../../../server/api_impl/orders/bulk.js')(req, res);
    // treat first segment as id
    req.query.id = s[0];
    return require('../../../server/api_impl/orders/[id].js')(req, res);
  } catch (e) {
    console.error('Orders catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
