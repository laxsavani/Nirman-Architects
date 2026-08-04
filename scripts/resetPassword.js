require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { hashPassword } = require('../utils/password');

const email = process.argv[2] || 'leave.emp@nirman.com';
const newPassword = process.argv[3] || 'Password123!';

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

  const hashed = await hashPassword(newPassword);
  await User.updateOne({ _id: user._id }, { $set: { password: hashed } });

  console.log(`===========================================================`);
  console.log(`✅ Password for [${user.email}] successfully updated!`);
  console.log(`🔑 New Password: ${newPassword}`);
  console.log(`===========================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
