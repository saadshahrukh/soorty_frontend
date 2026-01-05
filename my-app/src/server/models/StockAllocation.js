const mongoose = require('mongoose');

const StockBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true }, // Unique batch identifier (e.g., "BATCH_2026_01_03_001")
  quantity: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 }, // Cost per unit for this batch
  addedAt: { type: Date, default: Date.now }, // When this batch was added (for FIFO tracking)
}, { _id: false });

const StockAllocationSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  priceTierId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
  
  // Legacy field for backward compatibility - will be deprecated
  quantity: { type: Number, default: 0, min: 0 },
  
  // New: Array of batches with individual cost tracking (FIFO)
  batches: [StockBatchSchema],
}, { timestamps: true });

// Helper to get total quantity from all batches
StockAllocationSchema.methods.getTotalQuantity = function() {
  return this.batches.reduce((sum, batch) => sum + batch.quantity, 0);
};

// Helper to get current cost price (from first batch in FIFO order)
StockAllocationSchema.methods.getCurrentCostPrice = function() {
  if (this.batches.length === 0) return 0;
  // Batches are ordered by addedAt (oldest first for FIFO)
  return this.batches[0].costPrice;
};

// Helper to add a new batch
StockAllocationSchema.methods.addBatch = function(batchId, quantity, costPrice) {
  this.batches.push({
    batchId,
    quantity,
    costPrice,
    addedAt: new Date()
  });
  // Keep batches sorted by addedAt (oldest first for FIFO)
  this.batches.sort((a, b) => a.addedAt - b.addedAt);
};

// Unique per product + warehouse + price tier (priceTierId may be null for legacy rows)
StockAllocationSchema.index({ productId: 1, warehouseId: 1, priceTierId: 1 }, { unique: true, partialFilterExpression: { priceTierId: { $exists: true } } });
// Also keep uniqueness for legacy rows without priceTierId
StockAllocationSchema.index({ productId: 1, warehouseId: 1 }, { unique: true, partialFilterExpression: { priceTierId: { $exists: false } } });

module.exports = mongoose.model('StockAllocation', StockAllocationSchema);
