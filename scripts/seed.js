const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const RoleMaster = require('../models/RoleMaster');

// Load environment variables
dotenv.config();

const seed = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log('🌱 Starting database seeding...');

    const roles = ["Super Admin", "HR", "Project Manager", "Architect", "Site Engineer", "Site Manager", "Employee", "customer"];
    
    for (const roleName of roles) {
      await RoleMaster.updateOne(
        { name: roleName },
        { $setOnInsert: { name: roleName } },
        { upsert: true }
      );
    }

    console.log('✅ Predefined roles seeded successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message || error);
    process.exit(1);
  }
};

seed();
