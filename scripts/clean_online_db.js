const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Configure Google Public DNS for MongoDB Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '../.env') });

const ONLINE_URI = process.env.MONGODB_URI_DEV || 
                   process.env.MONGODB_URI_PROD || 
                   process.env.MONGODB_URI || 
                   process.env.MONGO_URL;

const RoleMaster = require('../models/RoleMaster');

const DEFAULT_ROLES = [
  { roleName: 'Super Admin', roleCode: 'SUPER_ADMIN', description: 'System Administrator with full access' },
  { roleName: 'HR', roleCode: 'HR', description: 'Human Resource Manager' },
  { roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', description: 'Project Manager for team scoping' },
  { roleName: 'Architect', roleCode: 'ARCHITECT', description: 'Architect' },
  { roleName: 'Site Engineer', roleCode: 'SITE_ENGINEER', description: 'Site Engineer' },
  { roleName: 'Employee', roleCode: 'EMPLOYEE', description: 'Standard Staff Member' }
];

async function cleanOnlineDatabase() {
  console.log('🔌 Connecting to Online MongoDB Database...');
  console.log(`URI: ${ONLINE_URI}`);

  if (!ONLINE_URI) {
    console.error('❌ MONGODB_URI_DEV / MONGODB_URI is missing in .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(ONLINE_URI);
    console.log(`✅ Connected to MongoDB Host: ${conn.connection.host}`);

    const collections = await conn.connection.db.collections();
    console.log(`\nFound ${collections.length} collections in database.`);

    for (const col of collections) {
      const collectionName = col.collectionName;

      // DO NOT DELETE rolemasters or system collections
      if (collectionName === 'rolemasters' || collectionName.startsWith('system.')) {
        console.log(`🛡️ PRESERVED Collection: ${collectionName}`);
        continue;
      }

      const deleteResult = await col.deleteMany({});
      console.log(`🧹 WIPED Collection: ${collectionName} (${deleteResult.deletedCount} documents removed)`);
    }

    // Ensure default RoleMaster records are populated if missing
    for (const r of DEFAULT_ROLES) {
      await RoleMaster.findOneAndUpdate(
        { roleCode: r.roleCode },
        { $setOnInsert: r },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const roleCount = await RoleMaster.countDocuments();
    console.log(`\n✅ RoleMaster Collection preserved cleanly with ${roleCount} roles.`);
    console.log('🎉 Online database cleanup completed successfully. All data wiped EXCEPT RoleMaster!');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during database cleanup:', error.message || error);
    process.exit(1);
  }
}

cleanOnlineDatabase();
