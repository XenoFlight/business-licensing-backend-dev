const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

// ===== User Model =====
// Application user entity used for authentication and role-based authorization.
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'User full name'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    },
    comment: 'Login email address'
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Hashed user password'
  },
  role: {
    type: DataTypes.ENUM('inspector', 'manager', 'admin'),
    defaultValue: 'inspector',
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Contact phone number'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether the account is active'
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the account was approved by an admin'
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    }
  ]
});

// ===== Password Hashing Hooks =====
// Hash password before initial insert.
User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Hash password during updates only when password has changed.
User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Compare plain text input with stored hash during login.
User.prototype.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;