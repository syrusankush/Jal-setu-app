const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const upload = require('../middleware/upload');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/create', authMiddleware, upload.single('image'), complaintController.createComplaint);
router.get('/stats',  complaintController.getComplaintStats);
router.get('/solved-expenditure', authMiddleware, complaintController.getSolvedExpenditure);
router.get('/',  complaintController.getComplaints);
router.put('/:id', authMiddleware, complaintController.updateComplaintStatus);
router.delete('/:id', authMiddleware, complaintController.deleteComplaint);
router.post('/:id/escalate', authMiddleware, complaintController.escalateComplaint);
router.post('/:id/resolve', authMiddleware, complaintController.resolveComplaint);
router.get('/escalated', authMiddleware, complaintController.getEscalatedComplaints);
router.get('/:complaintId/resolution', authMiddleware, complaintController.getResolutionDetails);

module.exports = router; 