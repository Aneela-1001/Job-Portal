/**
 * Diagnostic script to check why job alert emails are not being sent
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');
const Job = require('../models/Job');
const { processJobAlert, processAllActiveAlerts } = require('../services/smartJobAlertService');
const { sendJobAlertEmail } = require('../services/emailService');

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 DIAGNOSTIC REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. Check environment variables
    console.log('1️⃣  ENVIRONMENT VARIABLES:');
    console.log(`   ENABLE_TEST_CRON: ${process.env.ENABLE_TEST_CRON || 'NOT SET'}`);
    console.log(`   BREVO_API_KEY: ${process.env.BREVO_API_KEY ? 'SET' : 'NOT SET'}`);
    console.log(`   BREVO_SENDER_EMAIL: ${process.env.BREVO_SENDER_EMAIL || 'NOT SET'}`);
    console.log(`   PREFERRED_EMAIL_SERVICE: ${process.env.PREFERRED_EMAIL_SERVICE || 'NOT SET'}`);
    console.log('');

    // 2. Check user account
    const userEmail = 'cse471project10@gmail.com';
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ USER NOT FOUND:', userEmail);
      process.exit(1);
    }

    console.log('2️⃣  USER ACCOUNT:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Skills: ${(user.skills || []).length} skills`);
    console.log(`   Profile Keywords: ${(user.profileKeywords || []).length} keywords`);
    console.log(`   Search History: ${(user.searchHistory || []).length} searches`);
    console.log('');

    if (user.skills && user.skills.length > 0) {
      console.log(`   Skills List: ${user.skills.join(', ')}`);
    }
    if (user.profileKeywords && user.profileKeywords.length > 0) {
      console.log(`   Keywords List: ${user.profileKeywords.join(', ')}`);
    }
    if (user.searchHistory && user.searchHistory.length > 0) {
      const recentSearches = user.searchHistory.slice(-5);
      console.log(`   Recent Searches: ${recentSearches.map(s => s.term).join(', ')}`);
    }
    console.log('');

    // 3. Check job alerts
    const alerts = await JobAlert.find({ userId: user._id });
    console.log('3️⃣  JOB ALERTS:');
    console.log(`   Total Alerts: ${alerts.length}`);
    
    const activeAlerts = alerts.filter(a => a.isActive);
    console.log(`   Active Alerts: ${activeAlerts.length}`);
    
    if (activeAlerts.length === 0) {
      console.log('   ⚠️  NO ACTIVE ALERTS FOUND!');
      console.log('   💡 Creating a test alert...');
      
      const testAlert = new JobAlert({
        userId: user._id,
        name: 'My Job Matches - Auto Created',
        keywords: [],
        locations: [],
        jobTypes: ['Full-time'],
        frequency: 'weekly',
        isActive: true
      });
      await testAlert.save();
      console.log('   ✅ Test alert created!');
      activeAlerts.push(testAlert);
    } else {
      activeAlerts.forEach((alert, i) => {
        console.log(`   Alert ${i + 1}: ${alert.name} (Active: ${alert.isActive})`);
        console.log(`      Last Sent: ${alert.lastSent || 'Never'}`);
        console.log(`      Matches Found: ${alert.matchesFound || 0}`);
        console.log(`      Notifications Sent: ${alert.notificationCount || 0}`);
      });
    }
    console.log('');

    // 4. Check available jobs
    const totalJobs = await Job.countDocuments({ isActive: true });
    console.log('4️⃣  AVAILABLE JOBS:');
    console.log(`   Total Active Jobs: ${totalJobs}`);
    
    if (totalJobs === 0) {
      console.log('   ⚠️  NO JOBS IN DATABASE!');
    } else {
      const sampleJobs = await Job.find({ isActive: true }).limit(3).lean();
      console.log('   Sample Jobs:');
      sampleJobs.forEach((job, i) => {
        console.log(`      ${i + 1}. ${job.title} - ${job.company} - ${job.location}`);
        console.log(`         Skills: ${(job.skills || []).join(', ') || 'None'}`);
      });
    }
    console.log('');

    // 5. Test matching
    if (activeAlerts.length > 0) {
      console.log('5️⃣  TESTING MATCHING:');
      const alert = activeAlerts[0];
      console.log(`   Testing Alert: ${alert.name}`);
      
      const result = await processJobAlert(alert._id.toString(), false);
      
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   Matches Found: ${result.matches.length}`);
        
        if (result.matches.length > 0) {
          console.log('   Top 3 Matches:');
          result.matches.slice(0, 3).forEach((match, i) => {
            console.log(`      ${i + 1}. ${match.job.title} - ${match.score}% match`);
            console.log(`         Reasons: ${match.reasons.join(', ')}`);
          });
        } else {
          console.log('   ⚠️  NO MATCHES FOUND!');
          console.log('   💡 This could be because:');
          console.log('      - No jobs match your skills/keywords');
          console.log('      - Match threshold is too high (35%)');
          console.log('      - Jobs don\'t have matching skills/keywords');
        }
      }
      console.log('');
    }

    // 6. Test email sending
    console.log('6️⃣  TESTING EMAIL SERVICE:');
    let result = null;
    if (activeAlerts.length > 0) {
      result = await processJobAlert(activeAlerts[0]._id.toString(), false);
    }
    
    if (result && result.matches && result.matches.length > 0) {
      console.log('   Attempting to send test email...');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const unsubscribeLink = `${frontendUrl}/job-alerts/${result.alertId}/unsubscribe`;
      
      const emailSent = await sendJobAlertEmail(
        result.userEmail,
        result.userName,
        result.alertName,
        result.matches.slice(0, 3), // Send only top 3 for testing
        unsubscribeLink
      );
      
      if (emailSent) {
        console.log('   ✅ Email sent successfully!');
      } else {
        console.log('   ❌ Email failed to send!');
        console.log('   💡 Check:');
        console.log('      - Brevo API key is correct');
        console.log('      - Brevo sender email is verified');
        console.log('      - Email service configuration');
      }
    } else {
      console.log('   ⚠️  Skipping email test (no matches found)');
    }
    console.log('');

    // 7. Check cron job status
    console.log('7️⃣  CRON JOB STATUS:');
    console.log(`   ENABLE_TEST_CRON: ${process.env.ENABLE_TEST_CRON || 'false'}`);
    if (process.env.ENABLE_TEST_CRON === 'true') {
      console.log('   ✅ Test cron is ENABLED (runs every 10 minutes)');
    } else {
      console.log('   ⚠️  Test cron is DISABLED');
      console.log('   💡 Set ENABLE_TEST_CRON=true in .env to enable');
    }
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY:');
    console.log(`   User: ${user.email}`);
    console.log(`   Active Alerts: ${activeAlerts.length}`);
    console.log(`   Available Jobs: ${totalJobs}`);
    if (activeAlerts.length > 0 && result) {
      console.log(`   Matches Found: ${result.matches ? result.matches.length : 0}`);
    }
    console.log('');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

diagnose();

