const express = require('express');
const router = express.Router();
const { getPendingUsers, approveUser, denyUser } = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ===== Admin Routes (All require admin role) =====

router.get('/pending-users', protect, authorize('admin'), getPendingUsers);

router.put('/approve/:id', protect, authorize('admin'), approveUser);

router.delete('/deny/:id', protect, authorize('admin'), denyUser);

module.exports = router;