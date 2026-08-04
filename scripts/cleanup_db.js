const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const UnauthorizedAttempt = require('../models/UnauthorizedAttempt');
const SuperAdmin = require('../models/SuperAdmin');
const HR = require('../models/HR');
const ProjectManager = require('../models/ProjectManager');
const Architect = require('../models/Architect');
const SiteEngineer = require('../models/SiteEngineer');
const Employee = require('../models/Employee');
const Client = require('../models/Client');

const cleanupDatabase = async () => {
  console.log('🧹 Starting database cleanup...');
  await connectDB();

  try {
    // Target test email patterns
    const testPattern = /test|example\.com/i;

    // Find test users
    const testUsers = await User.find({ email: { $regex: testPattern } });
    const testUserIds = testUsers.map(u => u._id);

    console.log(`Found ${testUsers.length} test user record(s) to remove.`);

    if (testUserIds.length > 0) {
      // Clean up profiles
      await SuperAdmin.deleteMany({ user: { $in: testUserIds } });
      await HR.deleteMany({ user: { $in: testUserIds } });
      await ProjectManager.deleteMany({ user: { $in: testUserIds } });
      await Architect.deleteMany({ user: { $in: testUserIds } });
      await SiteEngineer.deleteMany({ user: { $in: testUserIds } });
      await Employee.deleteMany({ user: { $in: testUserIds } });
      await Client.deleteMany({ user: { $in: testUserIds } });

      // Clean up attendance, device requests, & audit attempts
      await Attendance.deleteMany({ user: { $in: testUserIds } });
      await DeviceChangeRequest.deleteMany({ user: { $in: testUserIds } });
      await UnauthorizedAttempt.deleteMany({ user: { $in: testUserIds } });

      // Delete test users
      await User.deleteMany({ _id: { $in: testUserIds } });
    }

    console.log('✅ Unwanted test database records cleaned up successfully.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    process.exit(1);
  }
};

cleanupDatabase();
