const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ===== Business Model =====
// Represents a business entity applying for or holding a license.
const Business = sequelize.define('Business', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Business name'
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Business address'
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Business owner full name'
  },
  ownerId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Owner government/company identifier'
  },
  contactPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Primary contact phone number'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    },
    comment: 'Contact email address'
  },
  licenseNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Issued business license number'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'application_submitted', // placeholder; existing records use Hebrew values
    comment: 'Business lifecycle status value'
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'License issue date'
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'License expiration date'
  },
  licensingItemId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Related licensing item identifier'
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'businesses',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['licenseNumber']
    }
  ]
});

module.exports = Business;