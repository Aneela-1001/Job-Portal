/**
 * Manually trigger job alert processing and email sending
 * Use this to test immediately without waiting for cron
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { processAllActiveAlerts } = require('../services/smartJobAlertService');
const { sendJobAlertEmail } = require('../services/emailService');
const JobAlert = require('../models/JobAlert');

async function triggerAlerts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🚀 MANUALLY TRIGGERING JOB ALERTS...\n');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Process all active alerts (test mode = true to get all matches)
    const results = await processAllActiveAlerts(true);
    
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const result of results) {
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
        continue;
      }

      if (!result.matches || result.matches.length === 0) {
        console.log(`⚠️  No matches for alert "${result.alertName}"`);
        continue;
      }

      try {
        console.log(`\n📧 Sending email for alert "${result.alertName}" to ${result.userEmail}...`);
        console.log(`   Matches: ${result.matches.length}`);
        
        const unsubscribeLink = `${frontendUrl}/job-alerts/${result.alertId}/unsubscribe`;
        
        const emailSent = await sendJobAlertEmail(
          result.userEmail,
          result.userName,
          result.alertName,
          result.matches,
          unsubscribeLink
        );

        if (emailSent) {
          await JobAlert.findByIdAndUpdate(result.alertId, {
            lastSent: new Date(),
            $inc: {
              matchesFound: result.matches.length,
              notificationCount: 1
            }
          });

          emailsSent++;
          console.log(`✅ Email sent successfully!`);
        } else {
          emailsFailed++;
          console.log(`❌ Email failed to send`);
        }
      } catch (error) {
        emailsFailed++;
        console.error(`❌ Error: ${error.message}`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`   Emails Sent: ${emailsSent}`);
    console.log(`   Emails Failed: ${emailsFailed}`);
    console.log(`   Total Alerts: ${results.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerAlerts();

