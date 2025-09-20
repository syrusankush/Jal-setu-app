const express = require('express');
const router = express.Router();
const tenderController = require('../controllers/tenderController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/active', authMiddleware, tenderController.getActiveTenders);
router.post('/apply', authMiddleware, tenderController.applyForTender);
router.get('/applications', authMiddleware, tenderController.getMyApplications);

module.exports = router; 