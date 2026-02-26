const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDB } = require('../config/db');
const { Business } = require('../models');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== Geocoding Helper =====
// Resolve an address to coordinates using OpenStreetMap Nominatim.
const geocodeAddress = async (address) => {
  const url = 'https://nominatim.openstreetmap.org/search';
  try {
    const response = await axios.get(url, {
      params: {
        format: 'json',
        q: address,
        limit: 1,
        "accept-language": "en" // Prioritize English results for consistency
      },
      headers: {
        'User-Agent': 'BusinessLicensingApp/1.0 (Your-App-Contact@example.com)'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`\n[API Error] Status: ${error.response?.status}. Failed to geocode address: "${address}"`);
    // Continue processing next records even when a lookup fails.
    return [];
  }
};

// ===== Coordinate Backfill Runner =====
const backfillCoordinates = async () => {
  try {
    // Connect to database.
    await connectDB();
    console.log('🔌 Connected to database.');

    // Select records missing latitude/longitude.
    const businesses = await Business.findAll({
      where: {
        latitude: null
      }
    });

    console.log(`🔍 Found ${businesses.length} businesses missing coordinates.`);

    // Resolve and save coordinates record-by-record.
    for (let i = 0; i < businesses.length; i++) {
      const business = businesses[i];
      // Compose best available address string from existing fields.
      const addressToGeocode = business.address || business.businessArea || business.street;

      if (!addressToGeocode) {
        console.log(`[${i + 1}/${businesses.length}] ⚠️ Skipping "${business.businessName}" (No address info)`);
        continue;
      }

      try {
        process.stdout.write(`[${i + 1}/${businesses.length}] 🌍 Geocoding: "${business.businessName}" (${addressToGeocode})... `);
        
        const results = await geocodeAddress(addressToGeocode);

        if (results && results.length > 0) {
          const { lat, lon } = results[0];
          
          // Persist resolved coordinates.
          business.latitude = parseFloat(lat);
          business.longitude = parseFloat(lon);
          await business.save();
          
          console.log(`✅ Saved: ${lat}, ${lon}`);
        } else {
          console.log(`❌ No results found.`);
        }

      } catch (err) {
        console.log(`❌ Error: ${err.message}`);
      }

      // Rate limiting for public Nominatim usage.
      await delay(1200); 
    }

    console.log('🎉 Backfill complete.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

backfillCoordinates();
