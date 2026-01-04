const mongoose = require('mongoose');

const StockTransferSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  fromWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  toWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  priceTierId: { type: mongoose.Schema.Types.ObjectId, required: false },
  qty: { type: Number, required: true, min: 1 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('StockTransfer', StockTransferSchema);
