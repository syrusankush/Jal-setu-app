const AssignedWork = require('../models/AssignedWork');
const User = require('../models/User');
const Complaint = require('../models/complaintModel');

exports.assignWork = async (req, res) => {
  try {
    const { complaintId, contractAgencyId, estimatedCost, deadline } = req.body;

    // Validate required fields
    if (!complaintId || !contractAgencyId || !estimatedCost || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate if the user is ZP
    if (req.user.role !== 'ZP') {
      return res.status(403).json({
        success: false,
        message: 'Only ZP can assign work to contract agencies'
      });
    }

    // Check if complaint exists
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Check if agency exists
    const agency = await User.findById(contractAgencyId);
    if (!agency || agency.role !== 'Contract Agency') {
      return res.status(404).json({
        success: false,
        message: 'Contract agency not found'
      });
    }

    // Create new assigned work
    const assignedWork = new AssignedWork({
      complaintId,
      contractAgencyId,
      assignedBy: req.user._id,
      estimatedCost: parseFloat(estimatedCost),
      deadline: new Date(deadline)
    });

    await assignedWork.save();

    // Update complaint status to 'assigned'
    await Complaint.findByIdAndUpdate(complaintId, {
      status: 'assigned'
    });

    res.status(201).json({
      success: true,
      data: assignedWork
    });
  } catch (error) {
    console.error('Error assigning work:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign work'
    });
  }
};

exports.getAgencyWorks = async (req, res) => {
  try {
    const works = await AssignedWork.find({ contractAgencyId: req.user._id })
      .populate('complaintId')
      .populate('assignedBy', 'uniqueId role');

    res.status(200).json({
      success: true,
      data: works
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.completeWork = async (req, res) => {
  try {
    const { workId } = req.params;
    const { expenditure, remarks } = req.body;

    const workPhotos = req.files ? req.files.map(file => file.filename) : [];

    const work = await AssignedWork.findById(workId);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work not found'
      });
    }

    work.status = 'completed';
    work.completionDetails = {
      completedDate: new Date(),
      expenditure: parseFloat(expenditure),
      remarks,
      workPhotos
    };

    await work.save();

    // Update complaint status
    await Complaint.findByIdAndUpdate(work.complaintId, {
      status: 'resolved'
    });

    res.status(200).json({
      success: true,
      data: work
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getContractAgencies = async (req, res) => {
  try {
    // Only ZP can fetch contract agencies
    if (req.user.role !== 'ZP') {
      return res.status(403).json({
        success: false,
        message: 'Only ZP can view contract agencies'
      });
    }

    const agencies = await User.find({
      role: 'Contract Agency',
      'agencyDetails.status': 'Active'
    }).select('uniqueId agencyDetails');

    res.status(200).json({
      success: true,
      data: agencies
    });
  } catch (error) {
    console.error('Error fetching contract agencies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agencies'
    });
  }
}; 