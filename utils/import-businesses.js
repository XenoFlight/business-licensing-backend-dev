const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB, sequelize } = require('../config/db');

// ===== Model Loading =====
// Ensure model registration before reading sequelize.models.Business.
require('../models'); 

// ===== Import Pipeline =====
const importBusinesses = async () => {
  try {
    // Connect to database.
    await connectDB();
    console.log('🔌 Connected to database for seeding.');

    // Recreate schema for a clean import.
    await sequelize.sync({ force: true });
    console.log('✅ Database tables recreated (force sync).');

    // Read source JSON data.
    const dataPath = path.join(__dirname, '../data/businesses.json');
    
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Data file not found:', dataPath);
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const businesses = JSON.parse(rawData);

    if (!businesses.length) {
      console.log('⚠️ No businesses found in JSON file to import.');
      process.exit(0);
    }

    console.log(`📄 Found ${businesses.length} records. Preparing to insert...`);

    // Transform source values (dates/booleans) into DB-ready format.
    const processedRecords = businesses.map(b => ({
      ...b,
      // Convert legacy date strings to Date objects.
      openingDate: parseDate(b.openingDate),
      lastSubmissionDate: parseDate(b.lastSubmissionDate),
      lastInspectionDate: parseDate(b.lastInspectionDate),
      issueDate: parseDate(b.issueDate),
      expirationDate: parseDate(b.expirationDate),
      // Parse booleans from mixed string/number values.
      isCompany: parseBoolean(b.isCompany),
      suitableForShortTrack: parseBoolean(b.suitableForShortTrack),
      fireAffidavit: parseBoolean(b.fireAffidavit),
      // Add audit timestamps for bulk insert.
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Deduplicate records by file number, preferring non-closed status when duplicates exist.
    const uniqueRecordsMap = new Map();

    processedRecords.forEach(record => {
      const key = record.fileNumber;
      if (!key) return; // Skip records without a file number

      if (uniqueRecordsMap.has(key)) {
        const existing = uniqueRecordsMap.get(key);
        // Prefer active record over closed record for the same file number.
        if (existing.status === 'סגור' && record.status !== 'סגור') {
          uniqueRecordsMap.set(key, record);
        }
      } else {
        uniqueRecordsMap.set(key, record);
      }
    });

    const records = Array.from(uniqueRecordsMap.values());
    console.log(`✨ Deduplicated: Reduced from ${processedRecords.length} to ${records.length} unique records.`);

    // Insert processed records through model validation layer.
    const Business = sequelize.models.Business;
    
    if (!Business) {
      throw new Error('Business model not found. Please ensure models are defined correctly.');
    }

    // Use bulk insert for throughput.
    await Business.bulkCreate(records);

    console.log(`✅ Successfully imported ${records.length} businesses!`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
};

// Parse legacy M/D/YY date format.
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  
  if (year < 100) year += 2000; // Handle 2-digit years
  
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

// Parse mixed boolean representations into true/false/null.
function parseBoolean(val) {
  if (val === '1' || val === 1 || val === true || val === 'true') return true;
  if (val === '0' || val === 0 || val === false || val === 'false') return false;
  return null; // Treat empty string or other values as null
}

importBusinesses();