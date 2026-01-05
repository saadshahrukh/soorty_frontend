// Root-level API catch-all to consolidate all routes into a single Vercel function
module.exports = async (req, res) => {
  const slug = req.query.slug || [];
  
  if (slug.length === 0) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  const domain = slug[0]; // e.g., 'auth', 'orders', 'products'
  const endpoint = slug[1] || 'index'; // e.g., 'login', 'me', or 'index'
  
  try {
    // Dynamic routing based on domain and endpoint
    // Import implementations directly - static imports for Turbopack compatibility
    
    if (domain === 'auth') {
      if (endpoint === 'login') return require('../../server/api_impl/auth/login.js')(req, res);
      if (endpoint === 'register') return require('../../server/api_impl/auth/register.js')(req, res);
      if (endpoint === 'me') return require('../../server/api_impl/auth/me.js')(req, res);
    }
    
    if (domain === 'customers') {
      if (endpoint === 'index') return require('../../server/api_impl/customers/index.js')(req, res);
    }
    
    if (domain === 'expenses') {
      if (endpoint === 'index') return require('../../server/api_impl/expenses/index.js')(req, res);
    }
    
    if (domain === 'internal') {
      if (endpoint === 'logs') return require('../../server/api_impl/internal/logs.js')(req, res);
      if (endpoint === 'import-shopify-latest') return require('../../server/api_impl/internal/import-shopify-latest.js')(req, res);
    }
    
    if (domain === 'orders') {
      if (endpoint === 'index') return require('../../server/api_impl/orders/index.js')(req, res);
      if (endpoint === '[id]' || slug[2]) {
        req.query.id = slug[2] || req.query.id;
        return require('../../server/api_impl/orders/[id].js')(req, res);
      }
      if (endpoint === 'search') return require('../../server/api_impl/orders/search.js')(req, res);
      if (endpoint === 'bulk') return require('../../server/api_impl/orders/bulk.js')(req, res);
    }
    
    if (domain === 'products') {
      if (endpoint === 'index') return require('../../server/api_impl/products/index.js')(req, res);
      if (endpoint === '[id]' || slug[2]) {
        req.query.id = slug[2] || req.query.id;
        return require('../../server/api_impl/products/[id].js')(req, res);
      }
    }
    
    if (domain === 'stock') {
      if (endpoint === 'transfers') return require('../../server/api_impl/stock/transfers.js')(req, res);
      if (endpoint === 'transfer') return require('../../server/api_impl/stock/transfer.js')(req, res);
      if (endpoint === 'product') return require('../../server/api_impl/stock/product.js')(req, res);
    }
    
    if (domain === 'summary') {
      if (endpoint === 'monthly') return require('../../server/api_impl/summary/monthly.js')(req, res);
      if (endpoint === 'range') return require('../../server/api_impl/summary/range.js')(req, res);
    }
    
    if (domain === 'users') {
      if (endpoint === 'index') return require('../../server/api_impl/users/index.js')(req, res);
      if (endpoint === 'me') return require('../../server/api_impl/users/me.js')(req, res);
      if (endpoint === 'audit-logs') return require('../../server/api_impl/users/audit-logs.js')(req, res);
      if (endpoint === 'password') return require('../../server/api_impl/users/password.js')(req, res);
      if (endpoint === 'update') return require('../../server/api_impl/users/update.js')(req, res);
    }
    
    if (domain === 'warehouses') {
      if (endpoint === 'index') return require('../../server/api_impl/warehouses/index.js')(req, res);
      if (endpoint === '[id]' || slug[2]) {
        req.query.id = slug[2] || req.query.id;
        return require('../../server/api_impl/warehouses/[id].js')(req, res);
      }
      if (endpoint === 'create') return require('../../server/api_impl/warehouses/create.js')(req, res);
      if (endpoint === 'update') return require('../../server/api_impl/warehouses/update.js')(req, res);
      if (endpoint === 'delete') return require('../../server/api_impl/warehouses/delete.js')(req, res);
    }
    
    return res.status(404).json({ message: `Endpoint /${domain}/${endpoint} not found` });
  } catch (e) {
    console.error('Root API error', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};
