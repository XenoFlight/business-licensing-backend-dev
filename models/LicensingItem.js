const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ===== Licensing Item Model =====
// Catalog of licensing items defined by business licensing regulations.
const LicensingItem = sequelize.define('LicensingItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  itemNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Licensing item number (for example, 4.2a)'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Licensing item name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Business activity description'
  },
  licensingTrack: {
    type: DataTypes.ENUM('regular', 'expedited_a', 'expedited_b', 'affidavit'),
    defaultValue: 'regular',
  },
  // Required approval bodies.
  needsPoliceApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Whether police approval is required'
  },
  needsFireDeptApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Whether fire department approval is required'
  },
  needsHealthMinistryApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Whether health ministry approval is required'
  },
  needsEnvironmentalProtectionApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Whether environmental protection approval is required'
  },
  needsAgricultureMinistryApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Whether agriculture ministry approval is required'
  },
  needsLaborMinistryApproval: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Whether labor ministry approval is required'
  },
  validityYears: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'License validity period in years'
  }
}, {
  tableName: 'licensing_items',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['itemNumber']
    }
  ]
});

module.exports = LicensingItem;