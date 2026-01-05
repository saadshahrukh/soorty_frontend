const path = require('path');
module.exports = async (req, res) => {
  try {
    const s = req.query.slug || [];
    const name = s[0] || 'logs';
    if (name === 'logs') return require('../../../server/api_impl/internal/logs.js')(req, res);
    if (name === 'import-shopify-latest') return require('../../../server/api_impl/internal/import-shopify-latest.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Internal catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
