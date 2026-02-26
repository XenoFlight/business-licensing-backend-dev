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

// @desc    Get all system users
// @route   GET /api/admin/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'fullName', 'email', 'role', 'isApproved', 'isActive', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'שגיאה בקבלת רשימת המשתמשים', error: error.message });
  }
};

// @desc    Delete a user account
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (!targetUserId) {
      return res.status(400).json({ message: 'מזהה משתמש לא תקין' });
    }

    if (Number(req.user?.id) === targetUserId) {
      return res.status(400).json({ message: 'לא ניתן למחוק את המשתמש המחובר כעת' });
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    await user.destroy();
    res.json({ message: 'המשתמש נמחק בהצלחה' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'שגיאה במחיקת המשתמש', error: error.message });
  }
};

// @desc    Activate or deactivate a user account
// @route   PATCH /api/admin/users/:id/active
// @access  Private (Admin only)
exports.setUserActiveState = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { isActive } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'מזהה משתמש לא תקין' });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'יש להעביר ערך בוליאני עבור isActive' });
    }

    if (Number(req.user?.id) === targetUserId && isActive === false) {
      return res.status(400).json({ message: 'לא ניתן להשבית את המשתמש המחובר כעת' });
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: isActive ? 'המשתמש הופעל בהצלחה' : 'המשתמש הושבת בהצלחה',
      user: {
        id: user.id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Error updating user active state:', error);
    res.status(500).json({ message: 'שגיאה בעדכון סטטוס המשתמש', error: error.message });
  }
};