const Inventory = require('../models/Inventory');
const mongoose = require('mongoose');

const inventoryController = {
  // Get all items
  async getItems(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      console.log('Getting inventory items for GP:', gramPanchayatId);
      
      // Convert string ID to ObjectId
      const gpObjectId = new mongoose.Types.ObjectId(gramPanchayatId);
      console.log('GP Object ID:', gpObjectId);
      
      // Add debug log for the query
      const query = { gramPanchayatId: gpObjectId };
      console.log('Query:', JSON.stringify(query));
      
      const items = await Inventory.find(query);
      console.log('Found items:', items);
      
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Error in getItems:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get stats
  async getStats(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      
      const stats = await Inventory.aggregate([
        { 
          $match: { 
            gramPanchayatId: new mongoose.Types.ObjectId(gramPanchayatId) 
          } 
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalValue: { $sum: '$cost' },
            activeItems: {
              $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
            },
            maintenanceItems: {
              $sum: { $cond: [{ $eq: ['$status', 'MAINTENANCE'] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: stats[0] || {
          totalItems: 0,
          totalValue: 0,
          activeItems: 0,
          maintenanceItems: 0
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get maintenance items
  async getMaintenanceItems(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      const items = await Inventory.find({
        gramPanchayatId,
        status: 'MAINTENANCE'
      });

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get low stock items
  async getLowStockItems(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      const items = await Inventory.find({
        gramPanchayatId,
        $expr: {
          $lte: ['$quantity', '$minimumStockLevel']
        }
      });

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get expiring chemicals
  async getExpiringChemicals(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      const items = await Inventory.find({
        gramPanchayatId,
        category: 'CHEMICALS',
        status: 'ACTIVE'
      });

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Get detailed stats
  async getDetailedStats(req, res) {
    try {
      const { gramPanchayatId } = req.params;
      console.log('Getting detailed stats for GP:', gramPanchayatId);
      
      const stats = await Inventory.aggregate([
        { 
          $match: { 
            gramPanchayatId: new mongoose.Types.ObjectId(gramPanchayatId) 
          } 
        },
        {
          $group: {
            _id: '$category',
            totalItems: { $sum: 1 },
            totalValue: { $sum: '$cost' },
            activeItems: {
              $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
            },
            maintenanceItems: {
              $sum: { $cond: [{ $eq: ['$status', 'MAINTENANCE'] }, 1, 0] }
            },
            lowStockItems: {
              $sum: {
                $cond: [
                  { $lte: ['$quantity', '$minimumStockLevel'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      console.log('Found stats:', stats);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getDetailedStats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Update item quantity
  async updateQuantity(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      const item = await Inventory.findById(id);
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }

      item.quantity = quantity;
      if (quantity <= item.minimumStockLevel) {
        item.status = 'OUT_OF_STOCK';
      } else {
        item.status = 'ACTIVE';
      }

      await item.save();

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
};

module.exports = inventoryController;