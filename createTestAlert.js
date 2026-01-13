/**
 * Create a test job alert for the user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const JobAlert = require('../models/JobAlert');
const User = require('../models/User');

async function createTestAlert() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the user
    const user = await User.findOne({ email: 'cse471project10@gmail.com' });
    
    if (!user) {
      console.log('❌ User not found: cse471project10@gmail.com');
      console.log('   Please make sure you have registered with this email.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   Skills: ${(user.skills || []).join(', ') || 'None'}`);
    console.log(`   Profile Keywords: ${(user.profileKeywords || []).join(', ') || 'None'}`);
    console.log(`   Search History: ${(user.searchHistory || []).length} searches\n`);

    // Check if alert already exists
    const existingAlert = await JobAlert.findOne({
      userId: user._id,
      name: 'My Job Matches - Auto Created'
    });

    if (existingAlert) {
      if (existingAlert.isActive) {
        console.log('✅ Job alert already exists and is active!');
        console.log(`   Alert ID: ${existingAlert._id}`);
        console.log(`   Name: ${existingAlert.name}`);
        console.log(`   Keywords: ${(existingAlert.keywords || []).join(', ') || 'Auto (from profile)'}`);
        console.log(`   Locations: ${(existingAlert.locations || []).join(', ') || 'Any'}`);
        console.log(`   Job Types: ${(existingAlert.jobTypes || []).join(', ') || 'Any'}\n`);
        console.log('💡 This alert will automatically use:');
        console.log('   - Your profile skills');
        console.log('   - Your profile keywords');
        console.log('   - Your search history');
        console.log('   - Your successful applications\n');
        await mongoose.connection.close();
        return;
      } else {
        // Reactivate it
        existingAlert.isActive = true;
        await existingAlert.save();
        console.log('✅ Reactivated existing job alert!\n');
        await mongoose.connection.close();
        return;
      }
    }

    // Create new alert
    const jobAlert = new JobAlert({
      userId: user._id,
      name: 'My Job Matches - Auto Created',
      keywords: [], // Empty - will use profile data automatically
      locations: [], // Empty - will match any location
      jobTypes: [], // Empty - will match any job type
      frequency: 'weekly',
      isActive: true
    });

    await jobAlert.save();

    console.log('✅ Job alert created successfully!');
    console.log(`   Alert ID: ${jobAlert._id}`);
    console.log(`   Name: ${jobAlert.name}\n`);
    console.log('💡 This alert will automatically use:');
    console.log('   - Your profile skills:', (user.skills || []).join(', ') || 'None');
    console.log('   - Your profile keywords:', (user.profileKeywords || []).join(', ') || 'None');
    console.log('   - Your search history (last 10 searches)');
    console.log('   - Your successful applications (Accepted/Reviewed)\n');
    console.log('📧 Emails will be sent to:', user.email);
    console.log('   - Via Brevo API (primary)');
    console.log('   - Every 10 minutes (test cron)');
    console.log('   - Or weekly/daily based on schedule\n');

    await mongoose.connection.close();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAlert();

