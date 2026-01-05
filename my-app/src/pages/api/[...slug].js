// Root-level API catch-all to consolidate all routes into a single Vercel function
module.exports = async (req, res) => {
  const slug = req.query.slug || [];
  
  if (slug.length === 0) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  const domain = slug[0]; // e.g., 'auth', 'orders', 'products'
  
  try {
    // Route to domain-specific implementation
    switch (domain) {
      case 'auth':
        return require('../../server/api_impl/auth/index.js')(req, res);
      case 'customers':
        return require('../../server/api_impl/customers/index.js')(req, res);
      case 'expenses':
        return require('../../server/api_impl/expenses/index.js')(req, res);
      case 'internal':
        return require('../../server/api_impl/internal/index.js')(req, res);
      case 'orders':
        return require('../../server/api_impl/orders/index.js')(req, res);
      case 'products':
        return require('../../server/api_impl/products/index.js')(req, res);
      case 'stock':
        return require('../../server/api_impl/stock/index.js')(req, res);
      case 'summary':
        return require('../../server/api_impl/summary/index.js')(req, res);
      case 'users':
        return require('../../server/api_impl/users/index.js')(req, res);
      case 'warehouses':
        return require('../../server/api_impl/warehouses/index.js')(req, res);
      default:
        return res.status(404).json({ message: 'Domain not found' });
    }
  } catch (e) {
    console.error('Root API error', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};
