/**
 * Test Script for Smart Job Alert System
 * 
 * Usage:
 *   node scripts/testJobAlerts.js
 * 
 * This script helps test the job alert system by:
 * 1. Testing the matching engine
 * 2. Testing email sending
 * 3. Manually triggering the cron job function
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { processJobAlert, processAllActiveAlerts } = require('../services/smartJobAlertService');
const { sendJobAlertEmail } = require('../services/emailService');
const JobAlert = require('../models/JobAlert');
const User = require('../models/User');
const Job = require('../models/Job');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('✅ Connected to MongoDB', 'green');
  } catch (error) {
    log(`❌ MongoDB connection error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function testMatchingEngine() {
  log('\n📊 Testing Matching Engine...', 'cyan');
  
  try {
    // Find an active job alert
    const alert = await JobAlert.findOne({ isActive: true }).populate('userId').lean();
    
    if (!alert) {
      log('⚠️  No active job alerts found. Create one first.', 'yellow');
      return;
    }

    log(`Testing alert: "${alert.name}"`, 'blue');
    log(`User: ${alert.userId?.name || alert.userId?.email}`, 'blue');
    log(`Keywords: ${alert.keywords.join(', ')}`, 'blue');
    log(`Locations: ${alert.locations.join(', ')}`, 'blue');
    log(`Job Types: ${alert.jobTypes.join(', ')}`, 'blue');

    // Test matching (onlyNew = false to get all matches)
    const result = await processJobAlert(alert._id.toString(), false);

    if (result.error) {
      log(`❌ Error: ${result.error}`, 'red');
      return;
    }

    log(`\n✅ Found ${result.matches.length} matches`, 'green');
    
    if (result.matches.length > 0) {
      log('\nTop Matches:', 'cyan');
      result.matches.slice(0, 5).forEach((match, index) => {
        log(`\n${index + 1}. ${match.job.title}`, 'blue');
        log(`   Company: ${match.job.company}`, 'reset');
        log(`   Location: ${match.job.location}`, 'reset');
        log(`   Match Score: ${match.score}%`, 'green');
        log(`   Reasons: ${match.reasons.join(', ')}`, 'reset');
      });
    } else {
      log('⚠️  No matches found. Check if jobs exist in database.', 'yellow');
    }

  } catch (error) {
    log(`❌ Error testing matching engine: ${error.message}`, 'red');
    console.error(error);
  }
}

async function testEmailSending() {
  log('\n📧 Testing Email Sending...', 'cyan');

  try {
    // Find an active alert with matches
    const alert = await JobAlert.findOne({ isActive: true }).populate('userId').lean();
    
    if (!alert) {
      log('⚠️  No active job alerts found.', 'yellow');
      return;
    }

    // Get matches
    const result = await processJobAlert(alert._id.toString(), false);

    if (result.error || !result.matches || result.matches.length === 0) {
      log('⚠️  No matches found. Cannot test email sending.', 'yellow');
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const unsubscribeLink = `${frontendUrl}/job-alerts/${alert._id}/unsubscribe`;

    log(`Sending test email to: ${result.userEmail}`, 'blue');
    log(`Alert: ${result.alertName}`, 'blue');
    log(`Matches: ${result.matches.length}`, 'blue');

    const emailSent = await sendJobAlertEmail(
      result.userEmail,
      result.userName,
      result.alertName,
      result.matches,
      unsubscribeLink
    );

    if (emailSent) {
      log('✅ Email sent successfully!', 'green');
      log('📬 Check your email inbox.', 'cyan');
    } else {
      log('❌ Failed to send email. Check console for errors.', 'red');
    }

  } catch (error) {
    log(`❌ Error testing email: ${error.message}`, 'red');
    console.error(error);
  }
}

async function testCronJob() {
  log('\n⏰ Testing Cron Job Function...', 'cyan');

  try {
    log('Processing all active alerts (TEST MODE - fresh matches)...', 'blue');
    
    // Use test mode to get fresh matches (ignores lastSent, re-evaluates based on current profile)
    const results = await processAllActiveAlerts(true);

    log(`\n✅ Processed ${results.length} alerts`, 'green');

    const summary = {
      total: results.length,
      withMatches: results.filter(r => r.matches && r.matches.length > 0).length,
      withErrors: results.filter(r => r.error).length,
      totalMatches: results.reduce((sum, r) => sum + (r.matches?.length || 0), 0)
    };

    log('\n📊 Summary:', 'cyan');
    log(`   Total Alerts: ${summary.total}`, 'blue');
    log(`   Alerts with Matches: ${summary.withMatches}`, 'green');
    log(`   Alerts with Errors: ${summary.withErrors}`, summary.withErrors > 0 ? 'red' : 'green');
    log(`   Total Matches Found: ${summary.totalMatches}`, 'blue');

    if (summary.withErrors > 0) {
      log('\n⚠️  Errors:', 'yellow');
      results.filter(r => r.error).forEach(r => {
        log(`   Alert ${r.alertId}: ${r.error}`, 'red');
      });
    }

    // Now send emails for alerts with matches
    if (summary.withMatches > 0) {
      log('\n📧 Sending emails...', 'cyan');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      let emailsSent = 0;
      let emailsFailed = 0;

      for (const result of results) {
        if (result.error || !result.matches || result.matches.length === 0) {
          continue;
        }

        try {
          const unsubscribeLink = `${frontendUrl}/job-alerts/${result.alertId}/unsubscribe`;
          
          const emailSent = await sendJobAlertEmail(
            result.userEmail,
            result.userName,
            result.alertName,
            result.matches,
            unsubscribeLink
          );

          if (emailSent) {
            // Update job alert
            await JobAlert.findByIdAndUpdate(result.alertId, {
              lastSent: new Date(),
              $inc: {
                matchesFound: result.matches.length,
                notificationCount: 1
              }
            });

            emailsSent++;
            log(`✅ Email sent: ${result.alertName} → ${result.userEmail} (${result.matches.length} matches)`, 'green');
          } else {
            emailsFailed++;
            log(`❌ Failed to send: ${result.alertName} → ${result.userEmail}`, 'red');
          }
        } catch (error) {
          emailsFailed++;
          log(`❌ Error sending email for ${result.alertId}: ${error.message}`, 'red');
        }
      }

      log(`\n📊 Email Summary:`, 'cyan');
      log(`   Sent: ${emailsSent}`, 'green');
      log(`   Failed: ${emailsFailed}`, emailsFailed > 0 ? 'red' : 'green');
    }

  } catch (error) {
    log(`❌ Error testing cron job: ${error.message}`, 'red');
    console.error(error);
  }
}

async function showStatistics() {
  log('\n📈 Job Alert Statistics...', 'cyan');

  try {
    const totalAlerts = await JobAlert.countDocuments();
    const activeAlerts = await JobAlert.countDocuments({ isActive: true });
    const totalMatches = await JobAlert.aggregate([
      { $group: { _id: null, total: { $sum: '$matchesFound' } } }
    ]);
    const totalNotifications = await JobAlert.aggregate([
      { $group: { _id: null, total: { $sum: '$notificationCount' } } }
    ]);

    log(`Total Job Alerts: ${totalAlerts}`, 'blue');
    log(`Active Alerts: ${activeAlerts}`, 'green');
    log(`Total Matches Found: ${totalMatches[0]?.total || 0}`, 'blue');
    log(`Total Notifications Sent: ${totalNotifications[0]?.total || 0}`, 'blue');

    // Show recent alerts
    const recentAlerts = await JobAlert.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (recentAlerts.length > 0) {
      log('\n📋 Recent Alerts:', 'cyan');
      recentAlerts.forEach(alert => {
        log(`   - ${alert.name} (${alert.isActive ? 'Active' : 'Inactive'})`, 'blue');
        log(`     User: ${alert.userId?.name || alert.userId?.email}`, 'reset');
        log(`     Matches: ${alert.matchesFound}, Notifications: ${alert.notificationCount}`, 'reset');
        if (alert.lastSent) {
          log(`     Last Sent: ${new Date(alert.lastSent).toLocaleString()}`, 'reset');
        }
      });
    }

  } catch (error) {
    log(`❌ Error getting statistics: ${error.message}`, 'red');
  }
}

async function main() {
  log('🧪 Smart Job Alert System - Test Script', 'cyan');
  log('==========================================\n', 'cyan');

  await connectDB();

  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  try {
    switch (command) {
      case 'match':
        await testMatchingEngine();
        break;
      case 'email':
        await testEmailSending();
        break;
      case 'cron':
        await testCronJob();
        break;
      case 'stats':
        await showStatistics();
        break;
      case 'all':
      default:
        await showStatistics();
        await testMatchingEngine();
        await testEmailSending();
        await testCronJob();
        break;
    }

    log('\n✅ Testing complete!', 'green');
  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('\n👋 Disconnected from MongoDB', 'cyan');
    process.exit(0);
  }
}

// Run the script
main();

