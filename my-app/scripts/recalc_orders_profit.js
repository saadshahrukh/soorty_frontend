// One-off script to recompute finalAmount and profit for all orders by triggering Mongoose pre-save hook
// Usage: from project root `node my-app/scripts/recalc_orders_profit.js` (ensure MONGODB_URI is set in env or .env)

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_dashboard';

(async function main(){
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const Order = require('../my-app/api/models/Order');

    const orders = await Order.find({}).lean();
    console.log(`Found ${orders.length} orders. Recomputing and saving one-by-one...`);

    let count = 0;
    for (const o of orders) {
      try {
        // load fresh doc
        const doc = await Order.findById(o._id);
        if (!doc) continue;
        // calling save will trigger pre('save') and update finalAmount & profit
        await doc.save();
        count++;
        if (count % 100 === 0) console.log(`Saved ${count}/${orders.length}`);
      } catch (e) {
        console.error('Failed to save order', o._id, e.message);
      }
    }

    console.log(`Done. Updated ${count} orders.`);
    process.exit(0);
  } catch (err) {
    console.error('Script error:', err);
    process.exit(1);
  }
})();
