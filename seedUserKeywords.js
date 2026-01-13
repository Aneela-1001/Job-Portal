/* Seed basic profileKeywords for all users that don't have any.
 *
 * Usage (from backend folder, with .env configured):
 *   node scripts/seedUserKeywords.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in .env');
  }
  await mongoose.connect(process.env.MONGO_URI);
}

function defaultKeywordsForUser(user) {
  if (user.role === 'applicant') {
    return [
      'developer',
      'software',
      'remote',
      'full-time',
      'react',
      'python',
      'sql',
      'internship'
    ];
  }

  // Recruiter / other roles
  return [
    'hiring',
    'recruitment',
    'full-time',
    'remote',
    'engineering',
    'marketing'
  ];
}

async function seedUserKeywords() {
  await connect();
  console.log('✅ Connected to MongoDB');

  const users = await User.find({});
  console.log(`Found ${users.length} users`);

  let updated = 0;

  for (const user of users) {
    if (Array.isArray(user.profileKeywords) && user.profileKeywords.length > 0) {
      continue;
    }

    const keywords = defaultKeywordsForUser(user);
    await User.updateOne(
      { _id: user._id },
      { $set: { profileKeywords: keywords } }
    );
    updated += 1;
  }

  console.log(`✅ Updated profileKeywords for ${updated} users.`);
}

seedUserKeywords()
  .then(() => {
    console.log('🌱 User keyword seeding complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed user keywords error:', err);
    process.exit(1);
  });


