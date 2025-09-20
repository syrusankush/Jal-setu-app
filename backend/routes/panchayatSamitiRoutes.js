// routes/panchayatSamitiRoutes.js

const express = require('express');
const router = express.Router();
const { panchayatSamitiDashboard, viewGrampanchayatReports, sendComplaint } = require('../controllers/panchayatSamitiController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect routes using authMiddleware
router.use(authMiddleware);

// Panchayat Samiti Routes
router.get('/dashboard', panchayatSamitiDashboard);  // Dashboard
router.get('/grampanchayat/reports', viewGrampanchayatReports); // View reports from Grampanchayat
router.post('/complaints', sendComplaint);           // Send complaint to District Admin

module.exports = router;
