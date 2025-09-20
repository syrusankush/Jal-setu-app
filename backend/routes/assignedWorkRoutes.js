const express = require('express');
const router = express.Router();
const assignedWorkController = require('../controllers/assignedWorkController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.post('/assign', authMiddleware, assignedWorkController.assignWork);
router.get('/agency-works', authMiddleware, assignedWorkController.getAgencyWorks);
router.post('/:workId/complete', authMiddleware, upload.array('workPhotos', 5), assignedWorkController.completeWork);
router.get('/agencies', authMiddleware, assignedWorkController.getContractAgencies);

module.exports = router; 