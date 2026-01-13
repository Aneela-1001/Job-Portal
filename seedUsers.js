/**
 * Seed script to create demo users (applicant and recruiter)
 * Usage: node scripts/seedUsers.js (from backend folder)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in .env');
  }
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');
}

async function seedUsers() {
  try {
    await connect();

    // Create demo applicant
    let applicant = await User.findOne({ email: 'applicant.demo@example.com' });
    if (!applicant) {
      applicant = new User({
        name: 'Demo Applicant',
        email: 'applicant.demo@example.com',
        password: 'password123',
        role: 'applicant',
        skills: ['JavaScript', 'React', 'Node.js'],
        bio: 'A passionate developer looking for opportunities'
      });
      await applicant.save();
      console.log('✅ Created demo applicant:', applicant.email);
    } else {
      console.log('ℹ️  Demo applicant already exists:', applicant.email);
    }

    // Create demo recruiter
    let recruiter = await User.findOne({ email: 'recruiter.demo@example.com' });
    if (!recruiter) {
      recruiter = new User({
        name: 'Demo Recruiter',
        email: 'recruiter.demo@example.com',
        password: 'password123',
        role: 'recruiter',
        companyName: 'Tech Innovations Inc.',
        companyLocation: 'San Francisco, CA',
        companyDescription: 'Leading technology company in AI and cloud solutions'
      });
      await recruiter.save();
      console.log('✅ Created demo recruiter:', recruiter.email);
    } else {
      console.log('ℹ️  Demo recruiter already exists:', recruiter.email);
    }

    console.log('\n📋 Demo Credentials:');
    console.log('------------------------');
    console.log('Applicant:');
    console.log('  Email: applicant.demo@example.com');
    console.log('  Password: password123');
    console.log('');
    console.log('Recruiter:');
    console.log('  Email: recruiter.demo@example.com');
    console.log('  Password: password123');
    console.log('------------------------\n');

    await mongoose.connection.close();
    console.log('✅ Database seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

seedUsers();
