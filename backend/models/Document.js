const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  gramPanchayatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GramPanchayat',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  documentType: {
    type: String,
    enum: ['REPORT', 'PROPOSAL', 'NOTICE', 'OTHER'],
    default: 'OTHER'
  }
});

module.exports = mongoose.model('Document', documentSchema); 