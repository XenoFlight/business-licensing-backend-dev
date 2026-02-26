const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ===== JWT Token Helper =====
// Generates the auth token returned by register/login responses.
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  });
};

// ===== Authentication Endpoints =====
// @desc    Register new user (inspector/manager/admin)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, role, phoneNumber } = req.body;

    // Reject duplicate accounts by email.
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים במערכת' });
    }

    // Create account; password hashing is handled by model hooks.
    const user = await User.create({
      fullName,
      email,
      password,
      role,
      phoneNumber
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        token: generateToken(user.id),
        message: 'המשתמש נרשם בהצלחה'
      });
    } else {
      res.status(400).json({ message: 'נתוני משתמש לא תקינים' });
    }
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Login and receive JWT token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Load account by email.
    const user = await User.findOne({ where: { email } });

    // Validate password against stored hash.
    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({ message: 'החשבון שלך הושבת. יש לפנות למנהל המערכת.' });
      }

      // Require explicit admin approval before granting access.
      if (!user.isApproved) {
        return res.status(403).json({ message: 'החשבון שלך ממתין לאישור מנהל המערכת.' });
      }

      res.json({
        token: generateToken(user.id),
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        message: 'התחברות בוצעה בהצלחה',
      });
    } else {
      res.status(401).json({ message: 'אימייל או סיסמה שגויים' });
    }
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};

// @desc    Get currently authenticated user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user is populated by auth middleware.
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'משתמש לא נמצא' });
    }
  } catch (error) {
    res.status(500).json({ message: 'שגיאת שרת', error: error.message });
  }
};