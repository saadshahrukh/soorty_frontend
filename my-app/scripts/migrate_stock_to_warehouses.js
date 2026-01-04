/**
 * Migration script: create a default warehouse and move existing Product.stock
 * into StockAllocation records. Run manually: node scripts/migrate_stock_to_warehouses.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../api/models/Product');
const Warehouse = require('../api/models/Warehouse');
const StockAllocation = require('../api/models/StockAllocation');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_dashboard';

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to', MONGODB_URI);

  let defaultWh = await Warehouse.findOne({ name: 'Main Warehouse' });
  if (!defaultWh) {
    defaultWh = await Warehouse.create({ name: 'Main Warehouse', location: 'Default' });
    console.log('Created default warehouse', defaultWh._id);
  }

  const products = await Product.find({}).lean();
  console.log('Found', products.length, 'products');
  for (const p of products) {
    const qty = Number(p.stock || 0);
    if (qty > 0) {
      const existing = await StockAllocation.findOne({ productId: p._id, warehouseId: defaultWh._id });
      if (existing) {
        existing.quantity = existing.quantity + qty;
        await existing.save();
        console.log('Updated allocation for', p._id, '->', existing.quantity);
      } else {
        await StockAllocation.create({ productId: p._id, warehouseId: defaultWh._id, quantity: qty });
        console.log('Created allocation for', p._id, 'qty', qty);
      }
    }
  }

  console.log('Migration complete');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
