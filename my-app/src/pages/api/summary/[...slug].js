module.exports = async (req, res) => {
  const s = req.query.slug || [];
  try {
    if (s[0] === 'monthly') return require('../../../server/api_impl/summary/monthly.js')(req, res);
    if (s[0] === 'range') return require('../../../server/api_impl/summary/range.js')(req, res);
    return res.status(404).json({ message: 'Not found' });
  } catch (e) {
    console.error('Summary catch-all error', e);
    return res.status(500).json({ message: 'Server error' });
  }
};
