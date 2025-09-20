const mongoose = require('mongoose');

const solvedComplaintSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },
  resolvedBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['Grampanchayat', 'Panchayat Pani Samiti', 'ZP'],
      required: true
    }
  },
  expenditure: {
    type: Number,
    required: true
  },
  inventoryUsed: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true
    },
    itemName: String,
    quantity: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    },
    costPerUnit: Number
  }],
  totalInventoryCost: {
    type: Number,
    required: true
  },
  remarks: {
    type: String,
    required: true
  },
  resolvedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SolvedComplaint', solvedComplaintSchema); 