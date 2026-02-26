const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ===== Inspection Report Model =====
// Stores the result of a business inspection visit.
const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  businessId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Related business identifier (foreign key)'
  },
  inspectorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Inspector user identifier (foreign key)'
  },
  visitDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: 'Inspection visit timestamp'
  },
  findings: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Inspector findings and defect notes'
  },
  status: {
    type: DataTypes.ENUM('pass', 'fail', 'conditional_pass'),
    defaultValue: 'fail',
  },
  aiRiskAssessment: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Optional AI-generated risk assessment'
  },
  pdfPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Public path to generated PDF report file'
  }
}, {
  tableName: 'reports',
  timestamps: true
});

module.exports = Report;