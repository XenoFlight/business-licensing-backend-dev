const fs = require('fs');
const path = require('path');

// ===== Script Startup =====
console.log('🚀 Script started...');

// Path configuration.
const tempDir = path.join(__dirname, '../temp');
const outputDir = path.join(__dirname, '../data');
const outputFile = path.join(outputDir, 'businesses.json');

console.log(`📂 Looking for temp files in: ${tempDir}`);

// Ensure output directory exists.
if (!fs.existsSync(outputDir)){
    console.log(`📂 Creating output directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
}

// ===== Source Key Mapping =====
// Maps source Hebrew keys to normalized English keys across both source formats.
const keyMap = {
    "מס' תיק": "fileNumber",
    "פריט עיסוק": "occupationItem",
    "מהות העסק": "businessDescription",
    "שם העסק": "businessName",
    "בעל העסק": "businessOwner",
    "גוש": "block",
    "חלקה": "plot",
    "סטטוס התיק": "status",
    "אזור העסק": "businessArea",
    "נייח בעסק": "phone",
    "נייד בעסק": "mobile",
    "שטח עסק כולל": "totalArea",
    "רחוב העסק": "street",
    "מספר בית": "houseNumber",
    "תאריך ניפוק": "issueDate",
    "תאריך פקיעה": "expirationDate",
    "מספר רשיון": "licenseNumber",
    "תאריך הגשה אחרון": "lastSubmissionDate",
    "תאריך פתיחה": "openingDate",
    "מזהה": "businessId",
    "תצהיר כבאות": "fireAffidavit",
    "שטח עסק מבונה": "builtArea",
    "מסלול מקוצר לבקשה": "shortTrackPath",
    "פריט מתאים למסלול מקוצר": "suitableForShortTrack",
    "סיבת הגשה": "submissionReason",
    "חברה": "isCompany",
    "מפקח התיק": "inspector",

    // --- Aliases from the second file ---
    "מספר תיק": "fileNumber",
    "תאריך פתיחת התיק": "openingDate",
    "סיבת הגשה אחרונה": "lastSubmissionReason",
    "תאריך ביקורת אחרונה": "lastInspectionDate",
    "סטטוס תכנון ובנייה": "planningStatus",
    "סטטוס איכות הסביבה": "environmentStatus",
    "סטטוס בריאות": "healthStatus",
    "סטטוס משטרה": "policeStatus",
    "סטטוס כבאות": "fireDeptStatus",
    "סטטוס חקלאות": "agricultureStatus",
    "סטטוס כלכלה": "economyStatus",
    "סטטוס נגישות": "accessibilityStatus"
};

// ===== Build Process =====
const processFiles = () => {
    try {
        if (!fs.existsSync(tempDir)) {
            console.error(`❌ Temp directory not found at: ${tempDir}`);
            return;
        }

        // Find all source JSON files.
        const files = fs.readdirSync(tempDir).filter(file => file.toLowerCase().endsWith('.json'));
        
        if (files.length === 0) {
            console.log('❌ No JSON files found in temp directory.');
            return;
        }

        console.log(`Found ${files.length} files in temp folder. Processing...`);

        let allBusinesses = [];

        // Read and combine rows from all files.
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            console.log(`   Reading: ${file}`);
            const rawData = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(rawData);

            if (Array.isArray(jsonData)) {
                allBusinesses = allBusinesses.concat(jsonData);
            }
        });

        // Normalize keys to the mapped schema.
        const mappedBusinesses = allBusinesses.map(item => {
            const newItem = {};
            for (const key in item) {
                const newKey = keyMap[key] || key;
                newItem[newKey] = item[key];
            }
            return newItem;
        });

        // Write normalized dataset.
        fs.writeFileSync(outputFile, JSON.stringify(mappedBusinesses, null, 2), 'utf8');
        console.log(`✅ Successfully created database at: ${outputFile}`);
        console.log(`✅ Total records: ${mappedBusinesses.length}`);
        console.log('🚀 You can now safely remove the "temp" folder.');

    } catch (error) {
        console.error('❌ Error processing files:', error);
    }
};

processFiles();