const { sequelize } = require('../config/db');
const User = require('./User');
const Business = require('./Business');
const LicensingItem = require('./LicensingItem');
const Report = require('./Report');
const InspectionDefect = require('./InspectionDefect');

// ===== Model Associations =====

// Licensing item to businesses association (1:N).
// LicensingItem.hasMany(Business, { foreignKey: 'licensingItemId' });
// Business.belongsTo(LicensingItem, { foreignKey: 'licensingItemId' });

// Business to reports association (1:N).
Business.hasMany(Report, { foreignKey: 'businessId' });
Report.belongsTo(Business, { foreignKey: 'businessId' });

// Inspector (user) to reports association (1:N).
User.hasMany(Report, { foreignKey: 'inspectorId' });
Report.belongsTo(User, { foreignKey: 'inspectorId', as: 'inspector' });

module.exports = {
  sequelize,
  User,
  Business,
  LicensingItem,
  Report,
  InspectionDefect
};