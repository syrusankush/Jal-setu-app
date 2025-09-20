// routes/districtAdminRoutes.js

const express = require('express');
const router = express.Router();
const { districtAdminDashboard, getComplaints, getReports } = require('../controllers/districtAdminController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect routes using authMiddleware to ensure the user is logged in
router.use(authMiddleware);

// District Admin Routes
router.get('/dashboard', districtAdminDashboard);   // Dashboard
router.get('/complaints', getComplaints);           // View complaints
router.get('/reports', getReports);                 // View reports from Panchayat Samiti

module.exports = router;
