const path = require('path');
const slug = (req) => req.query.slug || [];
module.exports = async (req, res) => {
  const s = slug(req);
  // map to implementation files
  if (s.length === 0) {
    // /api/auth -> not used
    return res.status(404).json({ message: 'Not found' });
  }
  const name = s[0];
  try {
    if (name === 'login') return require('../../../server/api_impl/auth/login.js')(req, res);
    if (name === 'register') return require('../../../server/api_impl/auth/register.js')(req, res);
    if (name === 'me') return require('../../../server/api_impl/auth/me.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Auth catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
