/**
 * Quick test script to verify Brevo API connection
 */

require('dotenv').config();

async function testBrevoConnection() {
  console.log('🧪 Testing Brevo API Connection...\n');

  // Check if API key is set
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey || apiKey === 'your_brevo_api_key_here') {
    console.log('❌ BREVO_API_KEY not configured in .env');
    console.log('   Please add your Brevo API key to backend/.env');
    process.exit(1);
  }

  console.log('✅ BREVO_API_KEY found in .env');
  console.log(`   Key format: ${apiKey.substring(0, 20)}...`);
  console.log('');

  try {
    // Try to initialize Brevo API
    const SibApiV3Sdk = require('sib-api-v3-sdk');
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications['api-key'];
    apiKeyAuth.apiKey = apiKey;

    // Create API instance
    const apiInstance = new SibApiV3Sdk.AccountApi();

    // Test connection by getting account info
    console.log('📡 Testing API connection...');
    const accountInfo = await apiInstance.getAccount();

    console.log('✅ Brevo API connection successful!');
    console.log('\n📊 Account Information:');
    console.log(`   Email: ${accountInfo.email || 'N/A'}`);
    console.log(`   First Name: ${accountInfo.firstName || 'N/A'}`);
    console.log(`   Last Name: ${accountInfo.lastName || 'N/A'}`);
    console.log(`   Company: ${accountInfo.companyName || 'N/A'}`);
    console.log(`   Plan: ${accountInfo.plan ? accountInfo.plan[0].type : 'N/A'}`);
    
    // Check email credits
    if (accountInfo.plan && accountInfo.plan[0]) {
      const plan = accountInfo.plan[0];
      console.log(`\n📧 Email Credits:`);
      console.log(`   Plan Type: ${plan.type}`);
      if (plan.credits) {
        console.log(`   Credits: ${plan.credits}`);
      }
    }

    console.log('\n🎉 Brevo is ready to use for job alerts!');
    return true;

  } catch (error) {
    console.log('❌ Brevo API connection failed!');
    console.log(`   Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.body, null, 2)}`);
    }

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Possible issues:');
      console.log('   - API key is invalid or expired');
      console.log('   - API key doesn\'t have required permissions');
      console.log('   - Check your Brevo account settings');
    }

    return false;
  }
}

// Run the test
testBrevoConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

