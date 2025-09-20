const mongoose = require('mongoose');

const assignedWorkSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },
  contractAgencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['assigned', 'in-progress', 'completed'],
    default: 'assigned'
  },
  estimatedCost: {
    type: Number,
    required: true
  },
  deadline: {
    type: Date,
    required: true
  },
  assignedDate: {
    type: Date,
    default: Date.now
  },
  completionDetails: {
    completedDate: Date,
    expenditure: Number,
    remarks: String,
    workPhotos: [String]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AssignedWork', assignedWorkSchema); 