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
  localStaffCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of local staff working at business site'
  },
  localStaffNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Operational notes about local staffing'
  },
  localManagerName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Local on-site manager full name'
  },
  localManagerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Local manager contact phone'
  },
  localContactName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Additional local contact person'
  },
  localContactPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Additional local contact phone'
  },
  emergencyContactName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Emergency contact person for the business'
  },
  emergencyContactPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Emergency contact phone number'
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
  licensingItemIds: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'List of related licensing item identifiers for this business'
  },
  regulatorApprovals: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Regulator approvals data keyed by regulator and licensing item id'
  },
  hasTrashCans: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Whether business has trash cans'
  },
  trashCanCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of trash cans in business area'
  },
  trashCanType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Trash can type/description'
  },
  wastePickupSchedule: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Waste pickup schedule/frequency'
  },
  trashCareOwner: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'unknown',
    validate: {
      isIn: [['municipality', 'business', 'shared', 'unknown']]
    },
    comment: 'Who is responsible for trash can maintenance'
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