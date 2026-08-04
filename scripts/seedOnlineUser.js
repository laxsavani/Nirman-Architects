require('dotenv').config();
const dns = require('dns');
// Use Google & Cloudflare Public DNS for MongoDB Atlas SRV resolution
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { hashPassword } = require('../utils/password');

async function run() {
  const onlineUri = process.env.MONGODB_URI_DEV || 'mongodb+srv://laxsavani:laxsavani@cluster0.ykxfhke.mongodb.net/nirman-architects';
  console.log('Connecting to ONLINE MongoDB Atlas...');

  await mongoose.connect(onlineUri);
  console.log('Connected to ONLINE MongoDB Atlas successfully.');

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
    console.log(`✅ Created user [${email}] on ONLINE MongoDB with password [${passwordStr}]`);
  } else {
    user.password = hashedPassword;
    user.isActive = true;
    user.deviceStatus = 'APPROVED';
    await user.save();
    console.log(`✅ Password updated for user [${email}] on ONLINE MongoDB to [${passwordStr}]`);
  }

  console.log(`===========================================================`);
  console.log(`🌐 Online DB Host: cluster0.ykxfhke.mongodb.net`);
  console.log(`👤 User Email:    ${user.email}`);
  console.log(`🔑 User Password: ${passwordStr}`);
  console.log(`===========================================================`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error connecting to online DB:', err.message);
  process.exit(1);
});
