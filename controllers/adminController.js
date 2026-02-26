const User = require('../models/User');

// ===== Admin User Approval Flow =====
// @desc    Get users waiting for admin approval
// @route   GET /api/admin/pending-users
// @access  Private (Admin only)
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { isApproved: false },
      attributes: ['id', 'fullName', 'email', 'role', 'createdAt']
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Approve pending user account
// @route   PUT /api/admin/approve/:id
// @access  Private (Admin only)
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    user.isApproved = true;
    await user.save();

    res.json({ 
      message: 'המשתמש אושר בהצלחה', 
      user: { id: user.id, fullName: user.fullName, email: user.email, isApproved: true } 
    });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ message: 'שגיאה באישור המשתמש', error: error.message });
  }
};

// @desc    Deny user and remove account
// @route   DELETE /api/admin/deny/:id
// @access  Private (Admin only)
exports.denyUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }
    await user.destroy();
    res.json({ message: 'המשתמש נדחה ונמחק מהמערכת' });
  } catch (error) {
    res.status(500).json({ message: 'שגיאה בדחיית המשתמש', error: error.message });
  }
};