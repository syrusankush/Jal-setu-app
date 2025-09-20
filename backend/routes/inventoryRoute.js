const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/auth');
const validateGramPanchayat = require('../middleware/validateGP');
const Inventory = require('../models/Inventory');
const InventoryRequest = require('../models/InventoryRequest');

// Add logging middleware


// Get all inventory items for a GP
router.get('/:gramPanchayatId/items', inventoryController.getItems);

// Get inventory statistics
router.get('/:gramPanchayatId/stats', inventoryController.getStats);

// Get items needing maintenance
router.get('/:gramPanchayatId/maintenance', inventoryController.getMaintenanceItems);

// Get low stock items
router.get('/:gramPanchayatId/low-stock', inventoryController.getLowStockItems);

// Get expiring chemicals
router.get('/:gramPanchayatId/expiring-chemicals', inventoryController.getExpiringChemicals);

// Get detailed stats
router.get('/:gramPanchayatId/detailed-stats', inventoryController.getDetailedStats);

// Update item quantity
router.patch('/:gramPanchayatId/items/:id/quantity', inventoryController.updateQuantity);

// Get all inventory requests for a Panchayat Samiti
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const requests = await InventoryRequest.find({
      panchayatSamitiId: req.user._id
    }).populate('gramPanchayatId', 'uniqueId name');

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching inventory requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory requests'
    });
  }
});

// Create new inventory request (for Gram Panchayat)
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const {
      itemName,
      category,
      quantity,
      unit,
      cost,
      description,
      urgency
    } = req.body;

    // Get associated Panchayat Samiti ID from the GP's user object
    const panchayatSamitiId = req.user.associatedTo?.userId;
    if (!panchayatSamitiId) {
      return res.status(400).json({
        success: false,
        error: 'No associated Panchayat Samiti found'
      });
    }

    const request = new InventoryRequest({
      itemName,
      category,
      quantity,
      unit,
      cost,
      description,
      urgency,
      gramPanchayatId: req.user._id,
      panchayatSamitiId
    });

    await request.save();

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error creating inventory request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create inventory request'
    });
  }
});

// Approve inventory request
router.post('/requests/:requestId/approved', authMiddleware, async (req, res) => {
  try {
    const request = await InventoryRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    // Verify the PS is authorized to approve this request
    if (request.panchayatSamitiId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to approve this request'
      });
    }

    request.status = 'APPROVED';
    await request.save();

    // Create new inventory item
    const inventory = new Inventory({
      itemName: request.itemName,
      category: request.category,
      quantity: request.quantity,
      unit: request.unit,
      cost: request.cost,
      condition: 'GOOD',
      location: 'Main Store',
      gramPanchayatId: request.gramPanchayatId,
      status: 'ACTIVE',
      purchaseDate: new Date()
    });

    await inventory.save();

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error approving inventory request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve inventory request'
    });
  }
});

// Reject inventory request
router.post('/requests/:requestId/rejected', authMiddleware, async (req, res) => {
  try {
    const request = await InventoryRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    // Verify the PS is authorized to reject this request
    if (request.panchayatSamitiId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to reject this request'
      });
    }

    request.status = 'REJECTED';
    await request.save();

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    console.error('Error rejecting inventory request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject inventory request'
    });
  }
});

module.exports = router;