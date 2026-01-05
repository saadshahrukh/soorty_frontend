const mongoose = require('mongoose');

const ProductItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  basePrice: { type: Number, required: true, min: 0 },
  baseCost: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  // per-line discount (absolute amount applied to this line)
  discount: { type: Number, default: 0, min: 0 }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  businessType: {
    type: String,
    required: true,
    enum: ['Travel', 'Dates', 'Belts']
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  orderType: {
    type: String,
    required: true,
    enum: ['Retail', 'Shopify', 'Preorder', 'Wholesale', 'Service']
  },
  // New multi-product support
  products: {
    type: [ProductItemSchema],
    default: []
  },
  // Backward compatibility for single-product
  productServiceName: String,
  quantity: Number,
  costPrice: Number,
  sellingPrice: Number,

  taxPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // One-time delivery charge (order-level)
  deliveryCharge: { type: Number, default: 0, min: 0 },
  // Whether the delivery amount is paid by the customer (true) or paid by us (false).
  // If true: delivery is added to the customer's bill (increases finalAmount and profit).
  // If false: delivery is borne by us and treated as additional cost (reduces profit), not added to finalAmount.
  deliveryPaidByCustomer: { type: Boolean, default: true },
  finalAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['Paid', 'Unpaid', 'Partial'],
    default: 'Unpaid'
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Cash', 'Bank', 'JazzCash', 'Online']
  },
  customerSupplierName: {
    type: String,
    required: true
  },
  // Reference to Customer for easy population
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  // Optional customer contact details (saved from order form)
  customerPhone: { type: String },
  customerAddress: { type: String },
  // Order-level discount (absolute amount subtracted from total bill before tax)
  orderDiscount: { type: Number, default: 0, min: 0 },
  remarks: { type: String, default: '' },
  // Store raw Shopify payload (optional)
  rawShopify: { type: mongoose.Schema.Types.Mixed },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profit: { type: Number, default: 0 },
  partialPaidAmount: { type: Number, default: 0, min: 0 },
  partialRemainingAmount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Pre-save hook to calculate totals
OrderSchema.pre('save', function(next) {
  const order = this;

  let totalSelling = 0;
  let totalCost = 0;
  let totalDiscount = 0;

  if (order.products && order.products.length > 0) {
    // Multi-product calculation
    order.products.forEach(p => {
      const qty = Number(p.quantity || 0);
      const lineSelling = Number(p.sellingPrice || p.basePrice || 0) * qty;
      const lineCost = Number(p.costPrice || p.baseCost || 0) * qty;
      const lineDiscount = Number(p.discount || 0);
      totalSelling += lineSelling;
      totalCost += lineCost;
      totalDiscount += lineDiscount;
    });
  } else if (order.sellingPrice && order.quantity) {
    // Single product fallback
    totalSelling = Number(order.sellingPrice || 0) * Number(order.quantity || 0);
    totalCost = Number(order.costPrice || 0);
    totalDiscount = Number(order.orderDiscount || 0);
  }
  // include order-level discount too
  totalDiscount = totalDiscount + Number(order.orderDiscount || 0);

  // deliveryCharge applies once per order (not per product)
  const delivery = Number(order.deliveryCharge || 0);
  const deliveryPaidByCustomer = order.deliveryPaidByCustomer !== false; // default true

  const taxMultiplier = 1 + ((order.taxPercent || 0) / 100);
  // net selling after discounts
  const netSelling = Math.max(0, totalSelling - totalDiscount);
  if (deliveryPaidByCustomer) {
    // Customer pays delivery: add delivery to customer's bill (finalAmount)
    // Discount reduces taxable base (netSelling)
    order.finalAmount = Math.round((netSelling * taxMultiplier + delivery) * 100) / 100;
    // Profit does NOT include delivery when customer pays (delivery is pass-through)
    order.profit = Math.round((netSelling * taxMultiplier - totalCost) * 100) / 100;
  } else {
    // We pay delivery: customer not charged delivery; we absorb delivery cost which reduces profit.
    order.finalAmount = Math.round((netSelling * taxMultiplier) * 100) / 100;
    order.profit = Math.round((netSelling * taxMultiplier - totalCost - delivery) * 100) / 100;
  }

  if (order.paymentStatus === 'Partial') {
    const remaining = Math.max(0, order.finalAmount - (order.partialPaidAmount || 0));
    order.partialRemainingAmount = Math.round(remaining * 100) / 100;
  } else {
    order.partialRemainingAmount = 0;
  }

  next();
});

module.exports = mongoose.model('Order', OrderSchema);
