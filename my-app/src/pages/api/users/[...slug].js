module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    const name = s[0] || 'index';
    if (name === 'index') return require('../../../server/api_impl/users/index.js')(req, res);
    if (name === 'me') return require('../../../server/api_impl/users/me.js')(req, res);
    if (name === 'update') return require('../../../server/api_impl/users/update.js')(req, res);
    if (name === 'password') return require('../../../server/api_impl/users/password.js')(req, res);
    if (name === 'audit-logs') return require('../../../server/api_impl/users/audit-logs.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Users catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
