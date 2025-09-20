const mongoose = require('mongoose');

const tenderSchema = new mongoose.Schema({
  tenderId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  village: {
    type: String,
    required: true
  },
  estimatedCost: {
    type: Number,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'awarded'],
    default: 'active'
  },
  type: {
    type: String,
    enum: ['Well Construction', 'Pipeline Repair', 'Water Tank Installation'],
    required: true
  },
  applications: [{
    contractorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    bidAmount: Number,
    proposedDuration: Number,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Tender', tenderSchema); 