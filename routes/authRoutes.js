const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// ===== Authentication Routes =====

// @route   POST /api/auth/register
// @desc    Register a new user account
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Login and receive JWT token
router.post('/login', login);

// @route   GET /api/auth/me
// @desc    Get current authenticated user profile
router.get('/me', protect, getMe);

module.exports = router;