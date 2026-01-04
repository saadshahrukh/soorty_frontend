const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  businessType: {
    type: String,
    required: true,
    enum: ['Travel', 'Dates', 'Belts']
  },
  name: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  baseCost: { type: Number, default: 0, min: 0 },
  deliveryCharges: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  priceTiers: [{ label: { type: String }, price: { type: Number, default: 0, min: 0 } }],
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);


