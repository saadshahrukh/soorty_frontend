const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  businessType: {
    type: String,
    required: true,
    enum: ['Travel', 'Dates', 'Belts']
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'PKR' },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meta: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
