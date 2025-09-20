const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['PIPES', 'MOTORS', 'TANKS', 'VALVES', 'METERS', 'CHEMICALS', 'FILTERS', 'OTHER'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['PIECES', 'METERS', 'LITERS', 'KG']
  },
  condition: {
    type: String,
    required: true,
    enum: ['GOOD', 'NEEDS_REPAIR', 'DAMAGED']
  },
  lastMaintenance: {
    type: Date
  },
  location: {
    type: String,
    required: true
  },
  gramPanchayatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GramPanchayat',
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  minimumStockLevel: {
    type: Number,
    required: true,
    default: 0
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  supplier: {
    name: String,
    contact: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'MAINTENANCE', 'OUT_OF_STOCK'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

// Add index for better query performance
inventorySchema.index({ gramPanchayatId: 1, category: 1 });
inventorySchema.index({ status: 1 });

module.exports = mongoose.model('Inventory', inventorySchema); 