const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
// Configure CORS with a whitelist from CORS_ORIGINS (comma-separated). If not set,
// fall back to permissive mode (allow all) to avoid breaking existing deployments.
const rawOrigins = process.env.CORS_ORIGINS || '';
const allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn('CORS_ORIGINS is not set in production — defaulting to permissive CORS. For security, set CORS_ORIGINS to your frontend origin(s).');
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // If no whitelist configured, allow any origin (fallback)
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: This origin is not allowed - ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Handle preflight across the board
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_dashboard';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import Routes with guards (handle default exports/mis-exports)
const loadRouter = (path, name) => {
  const mod = require(path);
  const candidate = typeof mod === 'function'
    ? mod
    : (mod && typeof mod.default === 'function' ? mod.default : null);
  if (!candidate) {
    console.error(`Invalid router export for ${name}. typeof export=`, typeof mod, 'keys=', mod && Object.keys(mod));
    throw new TypeError(`${name} router must export a function (Express router).`);
  }
  return candidate;
};

const authRoutes = loadRouter('./api/routes/auth', 'auth');
const orderRoutes = loadRouter('./api/routes/orders', 'orders');
const summaryRoutes = loadRouter('./api/routes/summary', 'summary');
const userRoutes = loadRouter('./api/routes/users', 'users');
const productRoutes = loadRouter('./api/routes/products', 'products');
const warehouseRoutes = loadRouter('./api/routes/warehouses', 'warehouses');
const customerRoutes = loadRouter('./api/routes/customers', 'customers');
const internalRoutes = loadRouter('./api/routes/internal', 'internal');
const expensesRoutes = loadRouter('./api/routes/expenses', 'expenses');
const stockRoutes = loadRouter('./api/routes/stock', 'stock');

// Routes
app.get('/test', (req, res)=>{
  return res.send({message: 'Hello World'});
});
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/customers', customerRoutes);
app.use('/internal', internalRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/stock', stockRoutes);

const PORT = process.env.PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
