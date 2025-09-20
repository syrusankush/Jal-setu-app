const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header:', authHeader);
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    if (!authHeader) {
      return res.status(401).json({ msg: 'No authorization header found' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token:', token);
    if (!token) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, 'yourSecretKey');
    console.log('Decoded token:', decoded);
    
    const user = await User.findById(decoded.id);
    console.log('Found user:', user);
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    req.user = user;
    next();
    
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

module.exports = authMiddleware; 