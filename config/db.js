const { Sequelize } = require('sequelize');
const path = require('path');

// ===== Environment Loading =====
// Load environment variables from the repository root .env file.
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ===== Sequelize Instance Setup =====
let sequelize;

// Prefer a full DATABASE_URL for hosted/cloud PostgreSQL deployments.
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Common for managed providers using self-signed cert chains.
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    // Default timezone used when Sequelize serializes dates.
    timezone: '+02:00' 
  });
} else {
  // In production, DATABASE_URL is mandatory.
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Environment Variables Debug:', {
      NODE_ENV: process.env.NODE_ENV,
      HAS_DB_URL: !!process.env.DATABASE_URL,
      AVAILABLE_KEYS: Object.keys(process.env)
    });
    throw new Error('FATAL ERROR: DATABASE_URL environment variable is not set in production.');
  }

  // Fallback local TCP configuration for development environments.
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: 'postgres',
      port: process.env.DB_PORT || 5432,
      logging: console.log,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

// ===== Connection Test Helper =====
// Used during server bootstrap to fail fast on database connectivity issues.
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
