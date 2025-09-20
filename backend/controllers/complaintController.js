const Complaint = require('../models/complaintModel');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const SolvedComplaint = require('../models/SolvedComplaint');
const Transaction = require('../models/Transaction');

// Create a new complaint
exports.createComplaint = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    // Get the user's associated Gram Panchayat
    const user = await User.findById(req.user._id).populate('associatedTo');
    if (!user || !user.associatedTo || !user.associatedTo.userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User is not associated with any Gram Panchayat' 
      });
    }

    const complaintData = {
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      coordinates: {
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude)
      },
      image: req.file.filename.replace(/^uploads[\/\\]/, ''),
      userId: req.user._id,
      gramPanchayatId: user.associatedTo.userId
    };

    const complaint = new Complaint(complaintData);
    await complaint.save();

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get all complaints
exports.getComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find();
    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update a complaint status
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(id, { status }, { new: true });
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete a complaint
exports.deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Complaint.findByIdAndDelete(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.status(200).json({ success: true, message: 'Complaint deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Add this new function to complaintController.js
exports.getComplaintStats = async (req, res) => {
  try {
    const resolved = await Complaint.countDocuments({ status: 'resolved' });
    const pending = await Complaint.countDocuments({ status: 'pending' });
    
    res.status(200).json({
      success: true,
      stats: {
        resolved,
        pending
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Escalate complaint
exports.escalateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { panchayatSamitiId } = req.body;

    if (!panchayatSamitiId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Panchayat Samiti ID is required' 
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id, 
      { 
        status: 'escalated',
        escalatedTo: panchayatSamitiId,
        escalatedAt: new Date()
      },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: complaint 
    });
  } catch (error) {
    console.error('Error escalating complaint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Resolve complaint with inventory and expenditure details
exports.resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { expenditure, inventoryUsed, remarks } = req.body;

    // Validate required fields
    if (!expenditure || !Array.isArray(inventoryUsed)) {
      return res.status(400).json({
        success: false,
        message: 'Expenditure and inventory details are required'
      });
    }

    // Calculate total inventory cost
    let totalInventoryCost = 0;
    const inventoryDetails = [];

    // Get inventory details and calculate costs
    for (const item of inventoryUsed) {
      const inventoryItem = await Inventory.findById(item.itemId);
      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: `Inventory item ${item.itemId} not found`
        });
      }
      
      const itemCost = inventoryItem.cost * parseFloat(item.quantity);
      totalInventoryCost += itemCost;
      
      inventoryDetails.push({
        itemId: item.itemId,
        itemName: inventoryItem.itemName,
        quantity: parseFloat(item.quantity),
        unit: item.unit || inventoryItem.unit,
        cost: itemCost
      });
    }

    // Update complaint status
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      {
        status: 'resolved',
        resolutionDetails: {
          expenditure: parseFloat(expenditure),
          inventoryUsed,
          resolvedAt: new Date(),
          remarks
        }
      },
      { new: true }
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Create solved complaint record
    const solvedComplaint = new SolvedComplaint({
      complaintId: complaint._id,
      resolvedBy: {
        userId: req.user._id,
        role: req.user.role
      },
      expenditure: parseFloat(expenditure),
      inventoryUsed: inventoryDetails,
      totalInventoryCost,
      remarks
    });

    await solvedComplaint.save();

    // Add this code after await solvedComplaint.save();
    const inventoryTransaction = new Transaction({
        userId: req.user._id,
        generatedBy: {
            userId: req.user._id,
            uniqueId: req.user.uniqueId,
            role: 'Grampanchayat'
        },
        merchantTransactionId: `INV-${Date.now()}`,
        amount: parseFloat(expenditure) * 100,
        status: 'SUCCESS',
        purpose: 'Inventory Usage',
        billNumber: `INV-BILL-${Date.now()}`,
        billType: 'Other',
        transactionType: 'DEBIT',
        dueDate: new Date(),
        inventoryExpense: {
            isInventoryUsed: true,
            complaintId: complaint._id,
            items: inventoryDetails,
            totalCost: totalInventoryCost * 100
        }
    });

    await inventoryTransaction.save();

    // Update inventory quantities
    for (const item of inventoryUsed) {
      await Inventory.findByIdAndUpdate(
        item.itemId,
        { $inc: { quantity: -parseInt(item.quantity) } }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        complaint,
        solvedDetails: solvedComplaint
      }
    });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get escalated complaints
exports.getEscalatedComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({
      status: 'escalated',
      escalatedTo: req.user._id
    }).populate('gramPanchayatId', 'uniqueId');

    res.status(200).json({
      success: true,
      data: complaints
    });
  } catch (error) {
    console.error('Error fetching escalated complaints:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Add this new function to get resolution details
exports.getResolutionDetails = async (req, res) => {
  try {
    const { complaintId } = req.params;
    
    const solvedComplaint = await SolvedComplaint.findOne({ complaintId })
      .populate('complaintId')
      .populate('resolvedBy.userId', 'uniqueId role')
      .populate('inventoryUsed.itemId', 'itemName category');
    
    if (!solvedComplaint) {
      return res.status(404).json({
        success: false,
        message: 'Resolution details not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: solvedComplaint
    });
  } catch (error) {
    console.error('Error fetching resolution details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get total expenditure from solved complaints
exports.getSolvedExpenditure = async (req, res) => {
  try {
    // Get the user's ID from the auth token
    const userId = req.user._id;
    
    // Find solved complaints where resolvedBy.userId matches the current user's ID
    const solvedComplaints = await SolvedComplaint.find({
      'resolvedBy.userId': userId
    });
    
    const totalExpenditure = solvedComplaints.reduce((total, complaint) => {
      return total + (complaint.expenditure || 0);
    }, 0);
    
    res.status(200).json({
      success: true,
      totalExpenditure
    });
  } catch (error) {
    console.error('Error fetching solved expenditure:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}; 