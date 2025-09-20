const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const login = async (req, res) => {
    const { uniqueId, password } = req.body;
    console.log('Request body:', req.body);  // Log request body for debugging

    try {
        // Ensure uniqueId is being passed correctly
        const user = await User.findOne({ uniqueId });
        console.log('User found:', user);  // Log the user object from the database

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Log user password and the password entered to debug comparison
        console.log('User stored password:', user.password);
        console.log('Password entered:', password);

        const isMatch = await bcrypt.compare(password, user.password);  // Compare hashed password
        console.log('Password match result:', isMatch);  // Log the result of password comparison

        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Log before generating token
        console.log('Generating JWT token for user ID:', user._id);
        const token = jwt.sign({ id: user._id, role: user.role }, 'yourSecretKey', { expiresIn: '1h' });
        console.log('JWT token generated:', token);  // Log the generated token

        // Send response with token
        res.json({
            success: true,
            token,
            role: user.role,
            id: user._id,
            gramPanchayatId: user._id
        });  // Make sure role is returned along with the token
    } catch (err) {
        console.error(err);  // Log the full error if something goes wrong
        res.status(500).json({ msg: 'Server error' });
    }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'associatedTo.userId',
        select: '_id uniqueId role'
      });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('User found:', {
      _id: user._id,
      uniqueId: user.uniqueId,
      role: user.role,
      associatedTo: user.associatedTo
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        role: user.role,
        associatedTo: user.associatedTo
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user profile' 
    });
  }
};

module.exports = {
  login,
  getProfile
};
