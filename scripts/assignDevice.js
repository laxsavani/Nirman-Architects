require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];
const deviceId = process.argv[3] || '9949FA95-568A-4FDB-81C5-60558DEC15B7';

if (!email) {
  console.log('Usage: node scripts/assignDevice.js <user_email> [device_id]');
  process.exit(1);
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI not found in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const targetEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.error(`User not found with email: ${targetEmail}`);
    process.exit(1);
  }

  const cleanDeviceId = deviceId.trim().toUpperCase();
  await User.updateOne({ _id: user._id }, { $set: { deviceId: cleanDeviceId, deviceStatus: 'APPROVED' } });

  console.log(`===========================================================`);
  console.log(`✅ Successfully assigned Device ID [${cleanDeviceId}] to user [${user.email}].`);
  console.log(`===========================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
