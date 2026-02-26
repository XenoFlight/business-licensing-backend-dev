const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ===== Authentication Guard =====
// Verifies Bearer token and attaches authenticated user to req.user.
exports.protect = async (req, res, next) => {
  let token;

  // Validate Authorization header format.
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Extract token value after "Bearer".
      token = req.headers.authorization.split(' ')[1];

      // Decode and verify JWT signature.
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Load user context and exclude password hash from request object.
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        return res.status(401).json({ message: 'המשתמש לא נמצא, ההרשאה נדחתה' });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: 'החשבון מושבת, אין הרשאה לפעולה זו' });
      }

      return next();
    } catch (error) {
      console.error('Auth Error:', error.message);
      return res.status(401).json({ message: 'לא מורשה, טוקן לא תקין' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'לא מורשה, לא התקבל טוקן' });
  }
};

// ===== Role-Based Authorization Guard =====
// Allows access only when req.user.role is one of the permitted roles.
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'לא מורשה, משתמש לא מזוהה' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `תפקיד המשתמש (${req.user.role}) אינו מורשה לבצע פעולה זו`
      });
    }
    next();
  };
};