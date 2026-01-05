module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    if (s[0] === 'product') {
      const productId = s[1];
      req.query.productId = productId;
      const productModule = require('../../../server/api_impl/stock/product.js');
      if (!s[2]) return productModule.get(req, res);
      if (s[2] === 'allocate') return productModule.allocate(req, res);
      if (s[2] === 'allocation') return productModule.adjust(req, res);
    }
    if (s[0] === 'transfer') return require('../../../server/api_impl/stock/transfer.js')(req, res);
    if (s[0] === 'transfers') return require('../../../server/api_impl/stock/transfers.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Stock catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
