const UAParser = require('ua-parser-js');
const LoginActivity = require('../models/LoginActivity');
const { sendSuspiciousLoginAlert } = require('./emailService');

/**
 * Login Tracking Service
 * Integrates with IPinfo API to track login activities and detect suspicious patterns
 */

// Initialize IPinfo client (using fetch API)
// Get your free API token from: https://ipinfo.io/signup
const ipinfoToken = process.env.IPINFO_API_TOKEN || null;

/**
 * Get IP geolocation data from IPinfo API
 * @param {string} ipAddress - IP address to lookup
 * @returns {Promise<Object>} IP geolocation data
 */
async function getIPInfo(ipAddress) {
  try {
    // Skip if it's a local/private IP
    if (!ipAddress || ipAddress === '::1' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
      console.log('⚠️  Local IP detected, using default location');
      return {
        city: 'Local',
        region: 'Local',
        country: 'XX',
        countryName: 'Local Network',
        loc: '0,0',
        org: 'Local Network',
        postal: '00000',
        timezone: 'UTC'
      };
    }

    // Call IPinfo API using fetch
    if (!ipinfoToken) {
      console.log('⚠️  IPinfo API token not configured, using default data');
      return {
        city: 'Unknown',
        region: 'Unknown',
        country: 'XX',
        countryName: 'Unknown',
        loc: '0,0',
        org: 'Unknown ISP',
        postal: 'N/A',
        timezone: 'UTC'
      };
    }

    const url = `https://ipinfo.io/${ipAddress}?token=${ipinfoToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`IPinfo API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('✅ IPinfo API response:', {
      ip: ipAddress,
      city: data.city,
      country: data.country,
      org: data.org
    });
    
    // Map country codes to full names (common ones)
    const countryNames = {
      'BD': 'Bangladesh', 'US': 'United States', 'GB': 'United Kingdom',
      'IN': 'India', 'PK': 'Pakistan', 'CA': 'Canada', 'AU': 'Australia',
      'DE': 'Germany', 'FR': 'France', 'JP': 'Japan', 'CN': 'China',
      'BR': 'Brazil', 'RU': 'Russia', 'ZA': 'South Africa', 'KR': 'South Korea',
      'IT': 'Italy', 'ES': 'Spain', 'MX': 'Mexico', 'NL': 'Netherlands',
      'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
      'SG': 'Singapore', 'MY': 'Malaysia', 'TH': 'Thailand', 'ID': 'Indonesia',
      'PH': 'Philippines', 'VN': 'Vietnam', 'AE': 'United Arab Emirates',
      'SA': 'Saudi Arabia', 'TR': 'Turkey', 'EG': 'Egypt', 'NG': 'Nigeria'
    };
    
    const countryCode = data.country || 'XX';
    const countryName = countryNames[countryCode] || data.country || 'Unknown';
    
    return {
      city: data.city || 'Unknown',
      region: data.region || 'Unknown',
      country: countryCode,
      countryName: countryName,
      loc: data.loc || '0,0',
      org: data.org || 'Unknown ISP',
      postal: data.postal || 'N/A',
      timezone: data.timezone || 'UTC'
    };
  } catch (error) {
    console.error('❌ IPinfo API error:', error.message);
    // Return default data if API fails
    return {
      city: 'Unknown',
      region: 'Unknown',
      country: 'XX',
      countryName: 'Unknown',
      loc: '0,0',
      org: 'Unknown ISP',
      postal: 'N/A',
      timezone: 'UTC',
      apiError: true
    };
  }
}

/**
 * Parse User-Agent string to extract device information
 * @param {string} userAgent - User-Agent string from request headers
 * @returns {Object} Parsed device information
 */
function parseUserAgent(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || 'Unknown',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || 'Unknown',
    device: result.device.type || 'Desktop',
    deviceVendor: result.device.vendor || 'Unknown',
    deviceModel: result.device.model || 'Unknown'
  };
}

/**
 * Detect suspicious login patterns
 * @param {string} userId - User ID
 * @param {string} ipAddress - Current IP address
 * @param {Object} ipInfo - IP geolocation data
 * @param {Object} device - Parsed device information
 * @param {number} loginHour - Hour of login (0-23)
 * @param {boolean} isTestMode - Whether in test mode
 * @returns {Promise<Object>} Suspicious detection result
 */
async function detectSuspiciousActivity(userId, ipAddress, ipInfo, device, loginHour, isTestMode = false) {
  const suspiciousReasons = [];
  let isSuspicious = false;
  
  try {
    // Get the count of previous successful logins to establish baseline
    const previousLoginCount = await LoginActivity.countDocuments({
      userId,
      status: 'success'
    });
    
    console.log(`📊 User has ${previousLoginCount} previous successful logins`);
    
    // Only flag as suspicious if user has established a login pattern (3+ previous logins)
    // This prevents false positives on first-time or new users
    const hasEstablishedPattern = previousLoginCount >= 3;
    
    // 1. Check if IP address is new
    const isNewIP = await LoginActivity.isNewIP(userId, ipAddress);
    if (isNewIP && hasEstablishedPattern) {
      suspiciousReasons.push('new_ip');
      isSuspicious = true;
      console.log('🚨 Suspicious: New IP address detected');
    } else if (isNewIP) {
      console.log('ℹ️  New IP detected but user has < 3 logins, not flagging as suspicious');
    }
    
    // 2. Check if country is new (only if we have valid country data and user has history)
    if (ipInfo.country && ipInfo.country !== 'XX') {
      const isNewCountry = await LoginActivity.isNewCountry(userId, ipInfo.country);
      if (isNewCountry && hasEstablishedPattern) {
        suspiciousReasons.push('new_country');
        isSuspicious = true;
        console.log('🚨 Suspicious: New country detected:', ipInfo.countryName);
      } else if (isNewCountry) {
        console.log('ℹ️  New country detected but user has < 3 logins, not flagging as suspicious');
      }
    }
    
    // 3. Check if browser/OS combination is new
    const isNewDevice = await LoginActivity.isNewDevice(userId, device.browser, device.os);
    if (isNewDevice && hasEstablishedPattern) {
      suspiciousReasons.push('new_device');
      isSuspicious = true;
      console.log('🚨 Suspicious: New device detected:', `${device.browser} on ${device.os}`);
    } else if (isNewDevice) {
      console.log('ℹ️  New device detected but user has < 3 logins, not flagging as suspicious');
    }
    
    // 4. Check for unusual login time
    const typicalHours = await LoginActivity.getUserTypicalLoginHours(userId);
    if (typicalHours && loginHour !== null && loginHour !== undefined) {
      const deviation = Math.abs(loginHour - typicalHours.average);
      // Flag if login is more than 2 standard deviations from average
      if (deviation > (2 * typicalHours.stdDeviation + 3)) {
        suspiciousReasons.push('unusual_time');
        isSuspicious = true;
        console.log('🚨 Suspicious: Unusual login time detected');
      }
    }
    
    // 5. Check for recent failed login attempts (last 15 minutes)
    const recentFailedAttempts = await LoginActivity.getRecentFailedAttempts(userId, 15);
    if (recentFailedAttempts >= 3) {
      suspiciousReasons.push('multiple_failed_attempts');
      isSuspicious = true;
      console.log('🚨 Suspicious: Multiple failed attempts detected:', recentFailedAttempts);
    }
    
    // Mark test mode simulations
    if (isTestMode) {
      suspiciousReasons.push('test_mode_simulation');
      console.log('🧪 Test mode: Simulated suspicious activity');
    }
    
    return {
      isSuspicious,
      suspiciousReasons,
      details: {
        isNewIP,
        isNewCountry: ipInfo.country !== 'XX' ? await LoginActivity.isNewCountry(userId, ipInfo.country) : false,
        isNewDevice,
        recentFailedAttempts,
        loginHour,
        typicalHours: typicalHours ? typicalHours.average : null
      }
    };
  } catch (error) {
    console.error('❌ Error detecting suspicious activity:', error);
    return {
      isSuspicious: false,
      suspiciousReasons: [],
      error: error.message
    };
  }
}

/**
 * Track successful login
 * @param {string} userId - User ID
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User-Agent string
 * @param {Object} options - Additional options (testMode, simulatedData, etc.)
 * @returns {Promise<Object>} Login activity record
 */
async function trackSuccessfulLogin(userId, ipAddress, userAgent, options = {}) {
  try {
    const { testMode = false, simulatedCountry, simulatedIP, simulatedDevice } = options;
    
    console.log('📝 Tracking successful login:', { userId, ipAddress, testMode });
    
    // Apply simulated IP BEFORE calling API (if in test mode)
    let actualIP = ipAddress;
    if (testMode && simulatedIP) {
      actualIP = simulatedIP;
      console.log('🧪 Test mode: Simulating IP -', simulatedIP);
    }
    
    // Get IP information from IPinfo API (using actual or simulated IP)
    let ipInfo = await getIPInfo(actualIP);
    
    // Override IP address for storage
    if (testMode && simulatedIP) {
      ipAddress = simulatedIP;
    }
    
    // Apply test mode country simulation if provided (override API result)
    if (testMode && simulatedCountry) {
      ipInfo.country = simulatedCountry;
      ipInfo.countryName = simulatedCountry;
      console.log('🧪 Test mode: Simulating country -', simulatedCountry);
    }
    
    // Parse User-Agent
    let device = parseUserAgent(userAgent);
    
    // Apply test mode device simulation if provided
    if (testMode && simulatedDevice) {
      const [browser, os] = simulatedDevice.split(' on ');
      if (browser) device.browser = browser;
      if (os) device.os = os;
      console.log('🧪 Test mode: Simulating device -', simulatedDevice);
    }
    
    // Get login hour for time pattern analysis
    const now = new Date();
    const loginHour = now.getHours();
    
    // Detect suspicious activity
    const suspiciousCheck = await detectSuspiciousActivity(
      userId, 
      ipAddress, 
      ipInfo, 
      device, 
      loginHour,
      testMode
    );
    
    // Create login activity record
    const loginActivity = new LoginActivity({
      userId,
      status: 'success',
      isSuspicious: suspiciousCheck.isSuspicious,
      suspiciousReasons: suspiciousCheck.suspiciousReasons,
      ipAddress,
      ipInfo,
      userAgent,
      device,
      loginTime: now,
      loginHour,
      failedAttempts: 0,
      isTestMode: testMode,
      testModeData: testMode ? {
        simulatedCountry,
        simulatedIP,
        simulatedDevice,
        notes: 'Test mode simulation for demonstration'
      } : undefined
    });
    
    await loginActivity.save();
    
    console.log('✅ Login tracked successfully:', {
      isSuspicious: suspiciousCheck.isSuspicious,
      reasons: suspiciousCheck.suspiciousReasons
    });
    
    // Send alert if suspicious
    if (suspiciousCheck.isSuspicious) {
      await handleSuspiciousLogin(loginActivity);
    }
    
    return {
      success: true,
      loginActivity,
      suspiciousCheck
    };
  } catch (error) {
    console.error('❌ Error tracking login:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Track failed login attempt
 * @param {string} userId - User ID (if known)
 * @param {string} email - Email used for login attempt
 * @param {string} ipAddress - IP address
 * @param {string} userAgent - User-Agent string
 * @returns {Promise<Object>} Failed login record
 */
async function trackFailedLogin(userId, email, ipAddress, userAgent) {
  try {
    if (!userId) {
      console.log('⚠️  Failed login for unknown user:', email);
      return { success: false };
    }
    
    console.log('📝 Tracking failed login:', { userId, email, ipAddress });
    
    const ipInfo = await getIPInfo(ipAddress);
    const device = parseUserAgent(userAgent);
    const now = new Date();
    
    const loginActivity = new LoginActivity({
      userId,
      status: 'failed',
      isSuspicious: false,
      ipAddress,
      ipInfo,
      userAgent,
      device,
      loginTime: now,
      loginHour: now.getHours(),
      failedAttempts: 1
    });
    
    await loginActivity.save();
    
    console.log('✅ Failed login tracked');
    
    return {
      success: true,
      loginActivity
    };
  } catch (error) {
    console.error('❌ Error tracking failed login:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle suspicious login detection
 * @param {Object} loginActivity - Login activity document
 */
async function handleSuspiciousLogin(loginActivity) {
  try {
    console.log('🚨 SUSPICIOUS LOGIN DETECTED!');
    console.log('User ID:', loginActivity.userId);
    console.log('Reasons:', loginActivity.suspiciousReasons);
    console.log('IP:', loginActivity.ipAddress);
    console.log('Location:', `${loginActivity.ipInfo.city}, ${loginActivity.ipInfo.countryName}`);
    console.log('Device:', `${loginActivity.device.browser} on ${loginActivity.device.os}`);
    
    // Create in-app notification
    try {
      const { createUnusualLoginNotification } = require('./notificationService');
      await createUnusualLoginNotification(loginActivity.userId.toString(), loginActivity);
      console.log('✅ Unusual login in-app notification created');
    } catch (notifError) {
      console.error('❌ Error creating unusual login notification:', notifError.message);
    }
    
    // Try to send email alert
    try {
      const User = require('../models/User');
      const user = await User.findById(loginActivity.userId);
      
      if (user && user.email) {
        const emailSent = await sendSuspiciousLoginAlert(
          user.email,
          user.name,
          loginActivity
        );
        
        if (emailSent) {
          loginActivity.alertSent = true;
          loginActivity.alertSentAt = new Date();
          await loginActivity.save();
          console.log('✅ Suspicious login alert email sent to:', user.email);
        }
      }
    } catch (emailError) {
      console.error('❌ Error sending suspicious login alert:', emailError.message);
    }
  } catch (error) {
    console.error('❌ Error handling suspicious login:', error);
  }
}

/**
 * Get user's login history
 * @param {string} userId - User ID
 * @param {number} limit - Number of records to retrieve
 * @returns {Promise<Array>} Login history
 */
async function getUserLoginHistory(userId, limit = 50) {
  try {
    return await LoginActivity.getUserLoginHistory(userId, limit);
  } catch (error) {
    console.error('❌ Error fetching login history:', error);
    return [];
  }
}

/**
 * Get suspicious logins for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Suspicious logins
 */
async function getSuspiciousLogins(userId) {
  try {
    return await LoginActivity.getSuspiciousLogins(userId);
  } catch (error) {
    console.error('❌ Error fetching suspicious logins:', error);
    return [];
  }
}

module.exports = {
  trackSuccessfulLogin,
  trackFailedLogin,
  getUserLoginHistory,
  getSuspiciousLogins,
  getIPInfo,
  parseUserAgent,
  detectSuspiciousActivity
};

