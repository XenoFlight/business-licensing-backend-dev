const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// ===== Inspection Defect Model =====
// Static catalog of inspection defects used by inspectors during reporting.
const InspectionDefect = sequelize.define('InspectionDefect', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Defect category (for example, fire safety or sanitation)'
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Defect subject/title'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Full defect description and legal context'
  }
}, {
  tableName: 'inspection_defects',
  timestamps: false
});

module.exports = InspectionDefect;
