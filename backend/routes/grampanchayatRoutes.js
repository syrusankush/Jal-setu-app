// routes/grampanchayatRoutes.js

const express = require('express');
const router = express.Router();
const { grampanchayatDashboard, addOrEditAsset, viewFinanceReports } = require('../controllers/grampanchayatController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect routes using authMiddleware
router.use(authMiddleware);

// Grampanchayat Routes
router.get('/dashboard', grampanchayatDashboard);       // Dashboard
router.post('/assets', addOrEditAsset);                 // Add or edit asset
router.get('/finance-reports', viewFinanceReports);     // View finance reports

module.exports = router;
