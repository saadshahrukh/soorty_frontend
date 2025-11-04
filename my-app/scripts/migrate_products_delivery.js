/*
  One-time migration script: adjust Product.baseCost to remove deliveryCharges if they were previously folded into baseCost.
  Run this with: node scripts/migrate_products_delivery.js
  Make a backup before running.
*/

const mongoose = require('mongoose');
const Product = require('../api/models/Product');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/financial-dashboard';

(async function() {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to Mongo');
    const products = await Product.find({}).lean();
    for (const p of products) {
      const delivery = Number(p.deliveryCharges || 0);
      const base = Number(p.baseCost || 0);
      if (delivery > 0 && base >= delivery) {
        const newBase = base - delivery;
        console.log(`Updating ${p._id} (${p.name}): base ${base} -> ${newBase} (delivery ${delivery})`);
        await Product.findByIdAndUpdate(p._id, { baseCost: newBase });
      }
    }
    console.log('Done');
    process.exit(0);
  } catch (e) {
    console.error('Migration error', e);
    process.exit(1);
  }
})();