const mongoose = require('mongoose');

const inventoryRequestSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['PIPES', 'MOTORS', 'TANKS', 'VALVES', 'METERS', 'CHEMICALS', 'FILTERS', 'OTHER']
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
  cost: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH'],
    default: 'NORMAL'
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  gramPanchayatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  panchayatSamitiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('InventoryRequest', inventoryRequestSchema);