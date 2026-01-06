// Root-level API catch-all to consolidate all routes into a single Vercel function
module.exports = async (req, res) => {
  const slug = req.query.slug || [];
  
  if (slug.length === 0) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  const domain = slug[0]; // e.g., 'auth', 'orders', 'products'
  const endpoint = slug[1] || 'index'; // e.g., 'login', 'me', or 'index'
  const resourceId = slug[2]; // e.g., product ID for /stock/product/ID
  const action = slug[3]; // e.g., 'allocate' for /stock/product/ID/allocate
  
  try {
    // Dynamic routing based on domain and endpoint
    
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
      if (endpoint === 'totals') return require('../../server/api_impl/expenses/totals.js')(req, res);
    }
    
    if (domain === 'internal') {
      if (endpoint === 'logs') return require('../../server/api_impl/internal/logs.js')(req, res);
      if (endpoint === 'import-shopify-latest') return require('../../server/api_impl/internal/import-shopify-latest.js')(req, res);
    }
    
    if (domain === 'orders') {
      // GET /orders or POST /orders handled by index.js
      if (endpoint === 'index') return require('../../server/api_impl/orders/index.js')(req, res);
      if (req.method === 'GET' && !resourceId) return require('../../server/api_impl/orders/index.js')(req, res);
      if (req.method === 'POST' && !resourceId) return require('../../server/api_impl/orders/index.js')(req, res);
      // GET /orders/search, POST /orders/search
      if (endpoint === 'search') return require('../../server/api_impl/orders/search.js')(req, res);
      // POST /orders/bulk
      if (endpoint === 'bulk') return require('../../server/api_impl/orders/bulk.js')(req, res);
      // Handle /orders/ID routes (GET, PUT, DELETE)
      if (resourceId && !action) {
        req.query.id = resourceId;
        return require('../../server/api_impl/orders/[id].js')(req, res);
      }
    }
    
    if (domain === 'products') {
      // GET /products or POST /products handled by index.js
      if (endpoint === 'index') return require('../../server/api_impl/products/index.js')(req, res);
      if (req.method === 'GET' && !resourceId) return require('../../server/api_impl/products/index.js')(req, res);
      if (req.method === 'POST' && !resourceId) return require('../../server/api_impl/products/index.js')(req, res);
      // Handle /products/ID routes (GET, PUT, DELETE)
      if (resourceId && !action) {
        req.query.id = resourceId;
        return require('../../server/api_impl/products/[id].js')(req, res);
      }
    }
    
    if (domain === 'stock') {
      if (endpoint === 'transfers') return require('../../server/api_impl/stock/transfers.js')(req, res);
      if (endpoint === 'transfer') return require('../../server/api_impl/stock/transfer.js')(req, res);
      // Handle /stock/product/ID or /stock/product/ID/allocate or /stock/product/ID/allocation
      if (endpoint === 'product') {
        req.query.productId = resourceId;
        // Route based on action or HTTP method
        const stockProductHandler = require('../../server/api_impl/stock/product.js');
        
        // Check the action parameter or HTTP method
        if (action === 'allocate' && req.method === 'POST') {
          // POST /stock/product/ID/allocate
          return stockProductHandler.allocate(req, res);
        } else if (action === 'allocation' && req.method === 'PUT') {
          // PUT /stock/product/ID/allocation - calls adjust function
          return stockProductHandler.adjust(req, res);
        } else if (req.method === 'GET' && !action) {
          // GET /stock/product/ID
          return stockProductHandler.get(req, res);
        } else {
          return res.status(405).json({ message: 'Method not allowed for this endpoint' });
        }
      }
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
      // POST /warehouses - handled by index.js
      if (req.method === 'POST') return require('../../server/api_impl/warehouses/index.js')(req, res);
      // GET /warehouses - handled by index.js
      if (endpoint === 'index') return require('../../server/api_impl/warehouses/index.js')(req, res);
      // DELETE /warehouses/{id} - needs route checking
      if (req.method === 'DELETE' && resourceId && !action) {
        req.query.id = resourceId;
        return require('../../server/api_impl/warehouses/delete.js')(req, res);
      }
      // GET /warehouses/{id} - handled by [id].js
      if (req.method === 'GET' && resourceId && !action) {
        req.query.id = resourceId;
        return require('../../server/api_impl/warehouses/[id].js')(req, res);
      }
      // PUT /warehouses/{id} - handled by update.js
      if (req.method === 'PUT' && resourceId && !action) {
        req.query.id = resourceId;
        return require('../../server/api_impl/warehouses/update.js')(req, res);
      }
      // Default: try index
      if (endpoint === 'index') return require('../../server/api_impl/warehouses/index.js')(req, res);
    }
    
    return res.status(404).json({ message: `Endpoint /${domain}/${endpoint} not found` });
  } catch (e) {
    console.error('Root API error', e);
    return res.status(500).json({ message: 'Server error', error: e.message });
  }
};
