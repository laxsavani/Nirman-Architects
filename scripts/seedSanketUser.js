require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { hashPassword } = require('../utils/password');

async function run() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/nirman_architects';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const email = 'sanket@gmail.com';
  const passwordStr = 'Password@123';

  let roleDoc = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
  if (!roleDoc) {
    roleDoc = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE' });
  }

  const hashedPassword = await hashPassword(passwordStr);

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name: 'Sanket Employee',
      email: email,
      password: hashedPassword,
      roleId: roleDoc._id,
      department: 'General',
      designation: 'Architect',
      deviceStatus: 'APPROVED',
      isActive: true
    });
    await user.save();
    console.log(`✅ Created user [${email}] with password [${passwordStr}]`);
  } else {
    user.password = hashedPassword;
    user.isActive = true;
    user.deviceStatus = 'APPROVED';
    await user.save();
    console.log(`✅ Password updated for user [${email}] to [${passwordStr}]`);
  }

  console.log(`===========================================================`);
  console.log(`👤 User Email:    ${user.email}`);
  console.log(`🔑 User Password: ${passwordStr}`);
  console.log(`===========================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
