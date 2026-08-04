const mongoose = require('mongoose');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { hashPassword } = require('../utils/password');

const localUri = 'mongodb://127.0.0.1:27017/nirman-architects';

async function seed() {
  await mongoose.connect(localUri);
  console.log('Connected to Local MongoDB.');

  let roleDoc = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
  if (!roleDoc) {
    roleDoc = await RoleMaster.create({
      roleName: 'Employee',
      roleCode: 'EMPLOYEE',
      description: 'Standard Employee'
    });
  }

  const hashedPassword = await hashPassword('Password123!');
  const deviceId = '9949FA95-568A-4FDB-81C5-60558DEC15B7';

  const dataUser = await User.findOneAndUpdate(
    { email: 'data@gmail.com' },
    {
      name: 'Data',
      email: 'data@gmail.com',
      password: hashedPassword,
      phone: '1234567890',
      roleId: roleDoc._id,
      department: 'Office Staff',
      designation: 'Employee',
      baseSalary: 20000,
      deviceId: deviceId,
      deviceStatus: 'APPROVED',
      isActive: true
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log('===========================================================');
  console.log('✅ Local User [data@gmail.com] created/updated successfully!');
  console.log('Email: data@gmail.com');
  console.log('Password: Password123!');
  console.log(`Device ID: ${dataUser.deviceId}`);
  console.log('===========================================================');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed Error:', err.message);
  process.exit(1);
});
