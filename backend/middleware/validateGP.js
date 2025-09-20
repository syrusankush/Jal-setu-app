const validateGramPanchayat = async (req, res, next) => {
  try {
    const { gramPanchayatId } = req.params;
    const user = req.user;

    // If user is ZP or PS, they can access any GP's inventory
    if (user.role === 'ZP' || user.role === 'Panchayat Pani Samiti') {
      return next();
    }

    // For GP users, check if they're accessing their own inventory
    if (user.role === 'Grampanchayat' && user._id.toString() === gramPanchayatId) {
      return next();
    }

    // For regular users, check if they belong to this GP
    if (user.role === 'User' && user.associatedTo?.userId?.toString() === gramPanchayatId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Not authorized to access this Gram Panchayat\'s inventory'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error validating Gram Panchayat access'
    });
  }
};

module.exports = validateGramPanchayat; 