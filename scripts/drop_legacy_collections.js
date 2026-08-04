const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '../.env') });

const ONLINE_URI = process.env.MONGODB_URI_DEV || 
                   process.env.MONGODB_URI_PROD || 
                   process.env.MONGODB_URI || 
                   process.env.MONGO_URL;

// Load all official Mongoose models to get valid collection names
const models = [
  require('../models/Architect'),
  require('../models/Attendance'),
  require('../models/AttendanceConfig'),
  require('../models/AttendanceCorrectionRequest'),
  require('../models/Client'),
  require('../models/DeviceChangeRequest'),
  require('../models/Employee'),
  require('../models/HR'),
  require('../models/HeartbeatLog'),
  require('../models/LeaveBalance'),
  require('../models/LeaveBalanceAdjustment'),
  require('../models/LeaveRequest'),
  require('../models/LeaveType'),
  require('../models/Notification'),
  require('../models/OfferLetter'),
  require('../models/Payroll'),
  require('../models/Project'),
  require('../models/ProjectManager'),
  require('../models/RoleMaster'),
  require('../models/SiteEngineer'),
  require('../models/SiteLocation'),
  require('../models/SuperAdmin'),
  require('../models/UnauthorizedAttempt'),
  require('../models/User')
];

const validCollectionNames = new Set(models.map(m => m.collection.name));

async function cleanupDuplicateAndLegacyCollections() {
  console.log('🔌 Connecting to Online MongoDB Database...');
  if (!ONLINE_URI) {
    console.error('❌ MONGODB_URI_DEV / MONGODB_URI missing in .env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(ONLINE_URI);
    console.log(`✅ Connected to Host: ${conn.connection.host}`);
    console.log(`Valid model collections (${validCollectionNames.size}):`, Array.from(validCollectionNames).sort());

    const collections = await conn.connection.db.collections();
    console.log(`\nFound ${collections.length} total collections in database:`);

    for (const col of collections) {
      const colName = col.collectionName;

      if (colName.startsWith('system.')) {
        continue;
      }

      // Check if this is a legacy duplicate collection like 'rolemaster'
      if (!validCollectionNames.has(colName)) {
        console.log(`\n🔍 Found legacy/unsupported collection: "${colName}"`);

        // If legacy collection has documents, check if we should migrate them to valid collection
        const docCount = await col.countDocuments();
        console.log(`Collection "${colName}" has ${docCount} documents.`);

        if (colName === 'rolemaster' && docCount > 0) {
          const rolemastersCol = conn.connection.db.collection('rolemasters');
          const legacyDocs = await col.find({}).toArray();
          for (const doc of legacyDocs) {
            await rolemastersCol.updateOne(
              { _id: doc._id },
              { $setOnInsert: doc },
              { upsert: true }
            );
          }
          console.log(`📦 Migrated ${legacyDocs.length} documents from "rolemaster" to "rolemasters".`);
        }

        // Drop the legacy collection
        await col.drop();
        console.log(`🗑️ DROPPED Legacy Collection: "${colName}"`);
      } else {
        console.log(`✅ Valid Collection: "${colName}"`);
      }
    }

    console.log('\n🎉 Legacy collection cleanup completed successfully!');
    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during legacy collection drop:', error.message || error);
    process.exit(1);
  }
}

cleanupDuplicateAndLegacyCollections();
