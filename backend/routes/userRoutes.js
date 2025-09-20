// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const { 
  userDashboard, 
  viewBills, 
  registerComplaint,
  initiatePayment,
  getTransactions 
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// Protect routes using authMiddleware
router.use(authMiddleware);

// User Routes
router.get('/dashboard', userDashboard);             // Dashboard
router.get('/bills', viewBills);                     // View bills
router.post('/complaints', registerComplaint);       // Register complaint
router.post('/payment/initiate', initiatePayment);    // Initiate payment
router.get('/transactions', getTransactions);         // Get transactions
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('uniqueId role -_id');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Found user:', user);
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user data',
      error: error.message
    });
  }
});

module.exports = router;
