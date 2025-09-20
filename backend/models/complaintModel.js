const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  image: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['resolved', 'pending', 'escalated', 'assigned'], 
    default: 'pending' 
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gramPanchayatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  escalatedAt: {
    type: Date,
    default: null
  },
  resolutionDetails: {
    expenditure: {
      type: Number,
      default: 0
    },
    inventoryUsed: [{
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InventoryItem'
      },
      quantity: Number,
      unit: String
    }],
    resolvedAt: Date,
    remarks: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema); 