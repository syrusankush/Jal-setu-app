const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/auth/login', login);
router.get('/auth/me/test', getProfile);
router.get('/auth/me', authMiddleware, getProfile);

module.exports = router;
