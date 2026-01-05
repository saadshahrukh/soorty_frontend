const path = require('path');
module.exports = async (req, res) => {
  try {
    const impl = require('../../../server/api_impl/expenses/index.js');
    return impl(req, res);
  } catch (e) {
    console.error('Expenses catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
