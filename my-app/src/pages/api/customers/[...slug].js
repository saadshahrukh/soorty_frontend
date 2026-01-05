const path = require('path');
const slug = (req) => req.query.slug || [];
module.exports = async (req, res) => {
  const s = slug(req);
  try {
    const impl = require('../../../server/api_impl/customers/index.js');
    return impl(req, res);
  } catch (e) {
    console.error('Customers catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
