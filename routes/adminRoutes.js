const express = require('express');
const router = express.Router();
const { getPendingUsers, approveUser, denyUser, getAllUsers, deleteUser, setUserActiveState } = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// ===== Admin Routes (All require admin role) =====

router.get('/pending-users', protect, authorize('admin'), getPendingUsers);

router.put('/approve/:id', protect, authorize('admin'), approveUser);

router.delete('/deny/:id', protect, authorize('admin'), denyUser);

router.get('/users', protect, authorize('admin'), getAllUsers);

router.delete('/users/:id', protect, authorize('admin'), deleteUser);

router.patch('/users/:id/active', protect, authorize('admin'), setUserActiveState);

module.exports = router;