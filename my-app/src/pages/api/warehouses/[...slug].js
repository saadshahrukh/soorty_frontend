module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    const name = s[0] || 'index';
    if (name === 'index') return require('../../../server/api_impl/warehouses/index.js')(req, res);
    if (name === 'create') return require('../../../server/api_impl/warehouses/create.js')(req, res);
    if (name === 'update') return require('../../../server/api_impl/warehouses/update.js')(req, res);
    if (name === 'delete') return require('../../../server/api_impl/warehouses/delete.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Warehouses catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
