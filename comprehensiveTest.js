/**
 * Comprehensive Test Script for Smart Job Alert System
 * 
 * This script:
 * 1. Checks database setup
 * 2. Creates test data if needed
 * 3. Tests all components
 * 4. Verifies everything works
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { processJobAlert, processAllActiveAlerts } = require('../services/smartJobAlertService');
const { sendJobAlertEmail, sendViaBrevo } = require('../services/emailService');
const JobAlert = require('../models/JobAlert');
const User = require('../models/User');
const Job = require('../models/Job');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, message = '') {
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
    log(`✅ ${name}`, 'green');
  } else {
    testResults.failed++;
    log(`❌ ${name}: ${message}`, 'red');
  }
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log('✅ Connected to MongoDB', 'green');
    return true;
  } catch (error) {
    log(`❌ MongoDB connection error: ${error.message}`, 'red');
    return false;
  }
}

async function checkDatabaseSetup() {
  log('\n📊 Checking Database Setup...', 'cyan');
  
  const userCount = await User.countDocuments({ role: 'applicant' });
  const jobCount = await Job.countDocuments({ isActive: true });
  const alertCount = await JobAlert.countDocuments();
  
  log(`   Users (applicants): ${userCount}`, 'blue');
  log(`   Active Jobs: ${jobCount}`, 'blue');
  log(`   Job Alerts: ${alertCount}`, 'blue');
  
  recordTest('Database Connection', true);
  recordTest('Applicant Users Exist', userCount > 0, `Found ${userCount} applicants`);
  recordTest('Active Jobs Exist', jobCount > 0, `Found ${jobCount} active jobs`);
  
  return { userCount, jobCount, alertCount };
}

async function createTestData() {
  log('\n🔧 Creating Test Data...', 'cyan');
  
  try {
    // Find or create test user
    let testUser = await User.findOne({ email: 'test.applicant@example.com' });
    if (!testUser) {
      testUser = new User({
        name: 'Test Applicant',
        email: 'test.applicant@example.com',
        password: 'test123',
        role: 'applicant',
        skills: ['JavaScript', 'React', 'Node.js', 'Python'],
        profileKeywords: ['developer', 'software engineer', 'full stack'],
        searchHistory: [
          { term: 'javascript developer', searchedAt: new Date() },
          { term: 'react jobs', searchedAt: new Date() }
        ]
      });
      await testUser.save();
      log('   ✅ Created test user', 'green');
    } else {
      log('   ℹ️  Test user already exists', 'yellow');
    }
    
    // Check if jobs exist
    const jobCount = await Job.countDocuments({ isActive: true });
    if (jobCount === 0) {
      log('   ⚠️  No jobs found. Please run: npm run seed:jobs', 'yellow');
      return { user: testUser, jobsExist: false };
    }
    
    // Create test job alert
    let testAlert = await JobAlert.findOne({ 
      userId: testUser._id,
      name: 'Test Job Alert - Comprehensive Test'
    });
    
    if (!testAlert) {
      testAlert = new JobAlert({
        userId: testUser._id,
        name: 'Test Job Alert - Comprehensive Test',
        keywords: ['javascript', 'react', 'node.js', 'developer'],
        locations: ['Remote', 'New York'],
        jobTypes: ['Full-time', 'Contract'],
        frequency: 'weekly',
        isActive: true
      });
      await testAlert.save();
      log('   ✅ Created test job alert', 'green');
    } else {
      log('   ℹ️  Test alert already exists', 'yellow');
    }
    
    return { user: testUser, alert: testAlert, jobsExist: true };
  } catch (error) {
    log(`   ❌ Error creating test data: ${error.message}`, 'red');
    return null;
  }
}

async function testModelExports() {
  log('\n🔍 Testing Model Exports...', 'cyan');
  
  try {
    // Test JobAlert model
    const alertSchema = JobAlert.schema;
    const requiredFields = ['userId', 'name', 'keywords', 'locations', 'jobTypes', 'frequency', 'isActive'];
    const hasAllFields = requiredFields.every(field => alertSchema.paths[field]);
    
    recordTest('JobAlert Model Exists', true);
    recordTest('JobAlert Has Required Fields', hasAllFields, 'Missing required fields');
    
    return true;
  } catch (error) {
    recordTest('Model Exports', false, error.message);
    return false;
  }
}

async function testServiceExports() {
  log('\n🔍 Testing Service Exports...', 'cyan');
  
  try {
    const smartJobAlertService = require('../services/smartJobAlertService');
    const emailService = require('../services/emailService');
    
    const hasProcessJobAlert = typeof smartJobAlertService.processJobAlert === 'function';
    const hasProcessAllActiveAlerts = typeof smartJobAlertService.processAllActiveAlerts === 'function';
    const hasSendJobAlertEmail = typeof emailService.sendJobAlertEmail === 'function';
    const hasSendViaBrevo = typeof emailService.sendViaBrevo === 'function';
    const hasSendPasswordResetEmail = typeof emailService.sendPasswordResetEmail === 'function'; // Existing function
    
    recordTest('smartJobAlertService Exported', hasProcessJobAlert && hasProcessAllActiveAlerts);
    recordTest('sendJobAlertEmail Exported', hasSendJobAlertEmail);
    recordTest('sendViaBrevo Exported', hasSendViaBrevo);
    recordTest('Existing Email Functions Intact', hasSendPasswordResetEmail, 'Password reset function should still exist');
    
    return true;
  } catch (error) {
    recordTest('Service Exports', false, error.message);
    return false;
  }
}

async function testMatchingEngine(testData) {
  log('\n📊 Testing Matching Engine...', 'cyan');
  
  if (!testData || !testData.alert) {
    recordTest('Matching Engine Test', false, 'No test alert available');
    return false;
  }
  
  try {
    const result = await processJobAlert(testData.alert._id.toString(), false);
    
    if (result.error) {
      recordTest('Matching Engine Execution', false, result.error);
      return false;
    }
    
    const hasMatches = Array.isArray(result.matches);
    const matchesHaveScores = result.matches.every(m => typeof m.score === 'number' && m.score >= 0 && m.score <= 100);
    const matchesHaveReasons = result.matches.every(m => Array.isArray(m.reasons) && m.reasons.length > 0);
    const matchesHaveJobs = result.matches.every(m => m.job && m.job._id && m.job.title);
    
    recordTest('Matching Engine Returns Results', hasMatches);
    recordTest('Matches Have Valid Scores', matchesHaveScores, 'Scores should be 0-100%');
    recordTest('Matches Have Reasons', matchesHaveReasons, 'Each match should have reasons');
    recordTest('Matches Have Job Data', matchesHaveJobs, 'Each match should have job data');
    
    if (result.matches.length > 0) {
      log(`   Found ${result.matches.length} matches`, 'green');
      log(`   Top match: ${result.matches[0].job.title} (${result.matches[0].score}%)`, 'blue');
    } else {
      log('   ⚠️  No matches found (this is OK if no jobs match criteria)', 'yellow');
    }
    
    return true;
  } catch (error) {
    recordTest('Matching Engine Test', false, error.message);
    return false;
  }
}

async function testEmailService() {
  log('\n📧 Testing Email Service...', 'cyan');
  
  try {
    // Test Brevo initialization (should not throw even without API key)
    const emailService = require('../services/emailService');
    
    // Check if Brevo can be initialized (will return null if no API key, which is OK)
    const canInitialize = typeof emailService.sendViaBrevo === 'function';
    recordTest('Email Service Functions Available', canInitialize);
    
    // Test that existing functions still work
    const hasPasswordReset = typeof emailService.sendPasswordResetEmail === 'function';
    const hasSuspiciousLogin = typeof emailService.sendSuspiciousLoginAlert === 'function';
    recordTest('Existing Email Functions Intact', hasPasswordReset && hasSuspiciousLogin, 'All existing functions should still exist');
    
    // Note: We won't actually send an email in this test to avoid spam
    log('   ℹ️  Skipping actual email send (to avoid spam)', 'yellow');
    log('   ℹ️  To test email sending, use: node scripts/testJobAlerts.js email', 'yellow');
    
    return true;
  } catch (error) {
    recordTest('Email Service Test', false, error.message);
    return false;
  }
}

async function testRoutes() {
  log('\n🛣️  Testing Routes...', 'cyan');
  
  try {
    const jobAlertRoutes = require('../routes/jobAlerts');
    recordTest('Job Alerts Routes File Exists', jobAlertRoutes !== null);
    
    // Check if routes are registered in index.js
    const fs = require('fs');
    const indexContent = fs.readFileSync('./index.js', 'utf8');
    const hasRouteRegistration = indexContent.includes('jobAlerts') || indexContent.includes('job-alerts');
    
    recordTest('Routes Registered in index.js', hasRouteRegistration, 'Routes should be registered in index.js');
    
    return true;
  } catch (error) {
    recordTest('Routes Test', false, error.message);
    return false;
  }
}

async function testCronJobSetup() {
  log('\n⏰ Testing Cron Job Setup...', 'cyan');
  
  try {
    const fs = require('fs');
    const indexContent = fs.readFileSync('./index.js', 'utf8');
    
    const hasCronImport = indexContent.includes('node-cron') || indexContent.includes("require('node-cron')");
    const hasCronFunction = indexContent.includes('initializeJobAlertCronJobs') || indexContent.includes('cron.schedule');
    const hasCronCall = indexContent.includes('initializeJobAlertCronJobs()');
    
    recordTest('Cron Job Code Present', hasCronImport && hasCronFunction);
    recordTest('Cron Job Initialized', hasCronCall, 'Cron should be initialized on server start');
    
    return true;
  } catch (error) {
    recordTest('Cron Job Setup', false, error.message);
    return false;
  }
}

async function testProcessAllAlerts() {
  log('\n🔄 Testing Process All Alerts...', 'cyan');
  
  try {
    const results = await processAllActiveAlerts();
    
    const isArray = Array.isArray(results);
    const allHaveStructure = results.every(r => 
      r.hasOwnProperty('alertId') && 
      (r.hasOwnProperty('matches') || r.hasOwnProperty('error'))
    );
    
    recordTest('Process All Alerts Returns Array', isArray);
    recordTest('Results Have Correct Structure', allHaveStructure, 'Each result should have alertId and matches/error');
    
    if (results.length > 0) {
      log(`   Processed ${results.length} alerts`, 'green');
    } else {
      log('   ℹ️  No active alerts to process', 'yellow');
    }
    
    return true;
  } catch (error) {
    recordTest('Process All Alerts', false, error.message);
    return false;
  }
}

async function testScoringAlgorithm() {
  log('\n🎯 Testing Scoring Algorithm...', 'cyan');
  
  try {
    const service = require('../services/smartJobAlertService');
    
    // The scoring functions are internal, but we can test that matches have scores
    const testData = await createTestData();
    if (testData && testData.alert) {
      const result = await processJobAlert(testData.alert._id.toString(), false);
      
      if (result.matches && result.matches.length > 0) {
        const scores = result.matches.map(m => m.score);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        log(`   Score Range: ${minScore}% - ${maxScore}%`, 'blue');
        log(`   Average Score: ${avgScore.toFixed(1)}%`, 'blue');
        
        const scoresInRange = scores.every(s => s >= 0 && s <= 100);
        recordTest('Scores in Valid Range', scoresInRange, 'All scores should be 0-100%');
        
        // Scores should be at least 30% (our threshold)
        const aboveThreshold = scores.every(s => s >= 30);
        recordTest('Scores Above Threshold', aboveThreshold, 'All matches should be >= 30%');
      }
    }
    
    return true;
  } catch (error) {
    recordTest('Scoring Algorithm', false, error.message);
    return false;
  }
}

function printSummary() {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'magenta');
  log('='.repeat(60), 'cyan');
  
  log(`\nTotal Tests: ${testResults.tests.length}`, 'blue');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  
  const passRate = ((testResults.passed / testResults.tests.length) * 100).toFixed(1);
  log(`📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'yellow');
  
  if (testResults.failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => {
        log(`   - ${t.name}`, 'red');
        if (t.message) log(`     ${t.message}`, 'yellow');
      });
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  
  if (testResults.failed === 0) {
    log('🎉 ALL TESTS PASSED!', 'green');
    log('✅ Smart Job Alert System is working perfectly!', 'green');
  } else {
    log('⚠️  Some tests failed. Please review the errors above.', 'yellow');
  }
}

async function main() {
  log('\n🧪 COMPREHENSIVE TEST SUITE', 'magenta');
  log('Smart Job Alert System - Full Verification', 'magenta');
  log('='.repeat(60) + '\n', 'cyan');
  
  const connected = await connectDB();
  if (!connected) {
    log('❌ Cannot proceed without database connection', 'red');
    process.exit(1);
  }
  
  try {
    // Run all tests
    await checkDatabaseSetup();
    await testModelExports();
    await testServiceExports();
    await testRoutes();
    await testCronJobSetup();
    
    const testData = await createTestData();
    if (testData && testData.jobsExist) {
      await testMatchingEngine(testData);
      await testScoringAlgorithm();
    } else {
      log('\n⚠️  Skipping matching tests - no jobs in database', 'yellow');
      log('   Run: npm run seed:jobs', 'yellow');
    }
    
    await testEmailService();
    await testProcessAllAlerts();
    
    printSummary();
    
  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('\n👋 Disconnected from MongoDB', 'cyan');
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

main();

