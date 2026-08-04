const mongoose = require('mongoose');

const connectDB = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUri = process.env.MONGODB_URI || 
                process.env.MONGODB_URI_PROD || 
                process.env.MONGODB_URI_DEV || 
                process.env.MONGO_URL || 
                process.env.DATABASE_URL ||
                (nodeEnv === 'development' ? 'mongodb://127.0.0.1:27017/nirman_hrm' : null);

  const dbType = nodeEnv === 'production' ? 'Production (Online)' : 'Development (Local)';

  console.log(`🔌 Attempting to connect to ${dbType} MongoDB...`);
  
  if (!dbUri) {
    console.error(`❌ MongoDB Connection Error: No connection URI defined in environment variables (MONGODB_URI / MONGODB_URI_PROD).`);
    console.error(`👉 Please set MONGODB_URI in your environment settings (e.g. Render environment variables).`);
    return null;
  }

  try {
    const conn = await mongoose.connect(dbUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (${dbType})`);

    // Clean up legacy database indexes and synchronize model indexes
    await cleanupLegacyIndexes();

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (${dbType}): ${error.message}`);
    return null;
  }
};

async function cleanupLegacyIndexes() {
  try {
    const LeaveBalance = require('../models/LeaveBalance');

    // Drop legacy MongoDB index on leavebalances collection that uses old field names (user, leaveType)
    const leaveBalanceCol = mongoose.connection.collection('leavebalances');
    if (leaveBalanceCol) {
      const indexes = await leaveBalanceCol.indexes().catch(() => []);
      for (const idx of indexes) {
        if (
          idx.name === 'user_1_leaveType_1_year_1' || 
          (idx.key && (idx.key.user !== undefined || idx.key.leaveType !== undefined))
        ) {
          console.log(`🗑️ Dropping legacy index on leavebalances: ${idx.name}`);
          await leaveBalanceCol.dropIndex(idx.name).catch(e => console.warn(`Failed to drop index ${idx.name}:`, e.message));
        }
      }
    }

    // 3. Ensure current schema indexes are built and synchronized
    await LeaveBalance.syncIndexes().catch(e => console.warn('Sync indexes warning:', e.message));
    console.log('✅ LeaveBalance indexes cleaned and synchronized successfully.');
  } catch (err) {
    console.warn('⚠️ Legacy index cleanup skipped/warned:', err.message);
  }
}

module.exports = connectDB;