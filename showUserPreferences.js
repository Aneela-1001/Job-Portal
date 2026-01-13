/**
 * Show what user preferences are currently being used for job matching
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');
const Application = require('../models/Application');

async function showPreferences() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: 'cse471project10@gmail.com' });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    const alert = await JobAlert.findOne({ userId: user._id, isActive: true });

    console.log('📊 CURRENT USER PREFERENCES FOR JOB MATCHING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Profile Skills
    console.log('1️⃣  PROFILE SKILLS (Used for skill matching - 25% weight)');
    const skills = user.skills || [];
    if (skills.length > 0) {
      skills.forEach((skill, i) => console.log(`   ${i + 1}. ${skill}`));
    } else {
      console.log('   ⚠️  No skills in profile');
    }
    console.log('');

    // 2. Profile Keywords
    console.log('2️⃣  PROFILE KEYWORDS (Used for keyword matching - 40% weight)');
    const profileKeywords = user.profileKeywords || [];
    if (profileKeywords.length > 0) {
      profileKeywords.forEach((keyword, i) => console.log(`   ${i + 1}. ${keyword}`));
    } else {
      console.log('   ⚠️  No profile keywords saved');
      console.log('   💡 Add keywords in your profile to improve matching');
    }
    console.log('');

    // 3. Search History
    console.log('3️⃣  SEARCH HISTORY (Last 10 searches - Used for keyword matching)');
    const searchHistory = user.searchHistory || [];
    const recentSearches = searchHistory.slice(-10);
    if (recentSearches.length > 0) {
      recentSearches.forEach((search, i) => {
        const date = new Date(search.searchedAt).toLocaleString();
        console.log(`   ${i + 1}. "${search.term}" (${date})`);
      });
    } else {
      console.log('   ⚠️  No search history');
    }
    console.log('');

    // 4. Job Alert Manual Keywords
    console.log('4️⃣  JOB ALERT KEYWORDS (Manually set in alert - Optional)');
    const alertKeywords = alert?.keywords || [];
    if (alertKeywords.length > 0) {
      alertKeywords.forEach((keyword, i) => console.log(`   ${i + 1}. ${keyword}`));
    } else {
      console.log('   ✅ Using automatic sources (profile + search history)');
    }
    console.log('');

    // 5. Job Alert Locations
    console.log('5️⃣  LOCATION PREFERENCES (Used for location matching - 15% weight)');
    const locations = alert?.locations || [];
    if (locations.length > 0) {
      locations.forEach((location, i) => console.log(`   ${i + 1}. ${location}`));
    } else {
      console.log('   ✅ Any location (no preference)');
    }
    console.log('');

    // 6. Job Alert Job Types
    console.log('6️⃣  JOB TYPE PREFERENCES (Used for job type matching - 10% weight)');
    const jobTypes = alert?.jobTypes || [];
    if (jobTypes.length > 0) {
      jobTypes.forEach((type, i) => console.log(`   ${i + 1}. ${type}`));
    } else {
      console.log('   ✅ Any job type (no preference)');
    }
    console.log('');

    // 7. Successful Applications
    console.log('7️⃣  SUCCESSFUL APPLICATIONS (Learned from Accepted/Reviewed - Auto)');
    const successfulApps = await Application.find({
      applicantId: user._id,
      status: { $in: ['Accepted', 'Reviewed'] }
    }).populate('jobId', 'title skills').limit(10).lean();

    if (successfulApps.length > 0) {
      console.log(`   ✅ Found ${successfulApps.length} successful application(s):`);
      successfulApps.forEach((app, i) => {
        const job = app.jobId;
        if (job) {
          console.log(`   ${i + 1}. "${job.title}"`);
          if (job.skills && job.skills.length > 0) {
            console.log(`      Skills learned: ${job.skills.join(', ')}`);
          }
        }
      });
      console.log('   💡 System learns keywords and skills from these jobs');
    } else {
      console.log('   ⚠️  No successful applications yet');
      console.log('   💡 When you get Accepted/Reviewed, system will learn from those jobs');
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MATCHING SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const totalKeywords = [
      ...alertKeywords,
      ...profileKeywords,
      ...recentSearches.map(s => s.term),
      ...successfulApps.map(app => app.jobId?.title?.split(' ') || []).flat()
    ].filter(Boolean).length;

    console.log(`Total Keywords Being Used: ${totalKeywords}`);
    console.log(`Total Skills Being Used: ${skills.length + successfulApps.reduce((sum, app) => sum + (app.jobId?.skills?.length || 0), 0)}`);
    console.log(`Location Filter: ${locations.length > 0 ? locations.join(', ') : 'Any'}`);
    console.log(`Job Type Filter: ${jobTypes.length > 0 ? jobTypes.join(', ') : 'Any'}`);
    console.log('');

    console.log('🎯 SCORING WEIGHTS:');
    console.log('   - Keyword Match: 40%');
    console.log('   - Skill Match: 25%');
    console.log('   - Location Match: 15%');
    console.log('   - Job Type Match: 10%');
    console.log('   - Recency (how new the job is): 10%');
    console.log('');

    console.log('💡 TIPS TO IMPROVE MATCHING:');
    if (skills.length === 0) {
      console.log('   ⚠️  Add skills to your profile');
    }
    if (profileKeywords.length === 0) {
      console.log('   ⚠️  Add profile keywords (job titles, technologies you like)');
    }
    if (recentSearches.length === 0) {
      console.log('   ⚠️  Search for jobs to build search history');
    }
    if (successfulApps.length === 0) {
      console.log('   ⚠️  Apply to jobs - system learns from Accepted/Reviewed applications');
    }
    if (skills.length > 0 && profileKeywords.length > 0 && recentSearches.length > 0) {
      console.log('   ✅ Your profile is well-configured for matching!');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

showPreferences();

