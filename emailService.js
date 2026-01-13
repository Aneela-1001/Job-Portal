const nodemailer = require('nodemailer');

/**
 * Email Service for sending emails
 * Supports both development (console logging) and production (actual email sending)
 */

// Create reusable transporter
let transporter = null;

const initializeTransporter = () => {
  if (transporter) return transporter;

  // Check if email configuration is provided
  const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  };

  // If no email credentials are configured, use a test account
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    console.log('⚠️  Email credentials not configured. Emails will be logged to console only.');
    console.log('💡 To enable email sending, set EMAIL_USER and EMAIL_PASSWORD in .env file');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    console.log('✅ Email service initialized');
    return transporter;
  } catch (error) {
    console.error('❌ Failed to initialize email service:', error.message);
    return null;
  }
};

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetToken - 6-character reset code
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendPasswordResetEmail = async (to, resetToken) => {
  const transporter = initializeTransporter();

  const mailOptions = {
    from: `"Job Portal" <${process.env.EMAIL_USER || 'noreply@jobportal.com'}>`,
    to: to,
    subject: 'Password Reset Code - Job Portal',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 10px;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #667eea;
            margin-top: 0;
            font-size: 24px;
          }
          .code-container {
            background: #f8f9fa;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
          }
          .reset-code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #667eea;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1>🔐 Password Reset Request</h1>
            <p>Hello,</p>
            <p>You recently requested to reset your password for your Job Portal account. Use the code below to reset your password:</p>
            
            <div class="code-container">
              <div style="color: #666; font-size: 14px; margin-bottom: 10px;">Your Reset Code</div>
              <div class="reset-code">${resetToken}</div>
            </div>

            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password" class="button">
                Reset Password
              </a>
            </p>

            <div class="warning">
              <strong>⚠️ Important:</strong> This code will expire in <strong>15 minutes</strong> for security reasons.
            </div>

            <p><strong>Didn't request this?</strong> You can safely ignore this email. Your password will remain unchanged.</p>

            <div class="footer">
              <p>This is an automated email from Job Portal. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Job Portal. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Password Reset Request - Job Portal

You recently requested to reset your password for your Job Portal account.

Your Reset Code: ${resetToken}

This code will expire in 15 minutes.

Visit ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password to reset your password.

If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} Job Portal. All rights reserved.
    `
  };

  // If transporter is not initialized (no credentials), log to console
  if (!transporter) {
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (Console Mode - Email not sent)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Reset Code: ${resetToken}`);
    console.log('='.repeat(60) + '\n');
    return false;
  }

  // Send actual email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    console.log('📧 To:', to);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    // Still log to console as fallback
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL (Fallback - Email sending failed)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Reset Code: ${resetToken}`);
    console.log('='.repeat(60) + '\n');
    return false;
  }
};

/**
 * Send welcome email (optional - can be used for new registrations)
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @returns {Promise<boolean>}
 */
const sendWelcomeEmail = async (to, name) => {
  const transporter = initializeTransporter();
  
  if (!transporter) {
    console.log(`📧 Welcome email would be sent to: ${to} (${name})`);
    return false;
  }

  const mailOptions = {
    from: `"Job Portal" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Welcome to Job Portal! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 10px;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 8px;
          }
          h1 {
            color: #667eea;
            margin-top: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1>Welcome to Job Portal, ${name}! 🎉</h1>
            <p>Thank you for joining our community. We're excited to have you on board!</p>
            <p>Start exploring job opportunities or post your first job listing today.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent to:', to);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return false;
  }
};

/**
 * Send suspicious login alert email
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @param {Object} loginActivity - Login activity details
 * @returns {Promise<boolean>}
 */
const sendSuspiciousLoginAlert = async (to, name, loginActivity) => {
  const transporter = initializeTransporter();

  const reasonsText = loginActivity.suspiciousReasons.map(reason => {
    switch(reason) {
      case 'new_ip': return 'New IP address';
      case 'new_country': return 'Login from a new country';
      case 'new_device': return 'New browser or device';
      case 'new_os': return 'New operating system';
      case 'unusual_time': return 'Login at an unusual time';
      case 'multiple_failed_attempts': return 'Multiple failed login attempts detected';
      default: return reason;
    }
  }).join(', ');

  const mailOptions = {
    from: `"Job Portal Security" <${process.env.EMAIL_USER || 'security@jobportal.com'}>`,
    to: to,
    subject: '🔐 Security Alert: Suspicious Login Detected',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            padding: 30px;
            border-radius: 10px;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #dc2626;
            margin-top: 0;
            font-size: 24px;
          }
          .alert-box {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .details-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .detail-item {
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #666;
            display: inline-block;
            width: 120px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1>🚨 Suspicious Login Detected</h1>
            <p>Hello ${name},</p>
            <p>We detected a login to your Job Portal account that appears suspicious based on unusual patterns.</p>
            
            <div class="alert-box">
              <strong>⚠️ Suspicious Indicators:</strong><br>
              ${reasonsText}
            </div>

            <div class="details-box">
              <h3 style="margin-top: 0;">Login Details:</h3>
              <div class="detail-item">
                <span class="detail-label">Time:</span>
                <span>${new Date(loginActivity.loginTime).toLocaleString()}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">IP Address:</span>
                <span>${loginActivity.ipAddress}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span>${loginActivity.ipInfo.city}, ${loginActivity.ipInfo.countryName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Device:</span>
                <span>${loginActivity.device.browser} on ${loginActivity.device.os}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">ISP:</span>
                <span>${loginActivity.ipInfo.org}</span>
              </div>
            </div>

            <p><strong>Was this you?</strong></p>
            <p>If you recognize this activity, you can safely ignore this email. Your account is secure.</p>

            <p><strong>Didn't recognize this login?</strong></p>
            <p>If this wasn't you, your account may have been compromised. Please take immediate action:</p>
            <ol>
              <li>Change your password immediately</li>
              <li>Review your recent account activity</li>
              <li>Enable two-factor authentication if available</li>
            </ol>

            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
                Secure My Account
              </a>
            </p>

            <div class="footer">
              <p>This is an automated security alert from Job Portal.</p>
              <p>&copy; ${new Date().getFullYear()} Job Portal. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Security Alert: Suspicious Login Detected - Job Portal

Hello ${name},

We detected a suspicious login to your Job Portal account.

Suspicious Indicators: ${reasonsText}

Login Details:
- Time: ${new Date(loginActivity.loginTime).toLocaleString()}
- IP Address: ${loginActivity.ipAddress}
- Location: ${loginActivity.ipInfo.city}, ${loginActivity.ipInfo.countryName}
- Device: ${loginActivity.device.browser} on ${loginActivity.device.os}
- ISP: ${loginActivity.ipInfo.org}

Was this you?
If you recognize this activity, you can safely ignore this email.

Didn't recognize this login?
If this wasn't you, please:
1. Change your password immediately
2. Review your recent account activity
3. Enable two-factor authentication if available

Visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login

© ${new Date().getFullYear()} Job Portal. All rights reserved.
    `
  };

  // If transporter is not initialized, log to console
  if (!transporter) {
    console.log('\n' + '='.repeat(60));
    console.log('🚨 SUSPICIOUS LOGIN ALERT (Console Mode)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`User: ${name}`);
    console.log(`Reasons: ${reasonsText}`);
    console.log(`Location: ${loginActivity.ipInfo.city}, ${loginActivity.ipInfo.countryName}`);
    console.log('='.repeat(60) + '\n');
    return false;
  }

  // Send actual email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Suspicious login alert sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send suspicious login alert:', error.message);
    return false;
  }
};

/**
 * ============================================
 * BREVO (SENDINBLUE) INTEGRATION - NEW FEATURE
 * ============================================
 * These functions are for the Smart Job Alert system.
 * They do NOT modify existing Nodemailer functionality.
 */

let brevoApi = null;

/**
 * Initialize Brevo API client
 */
const initializeBrevoApi = () => {
  if (brevoApi) return brevoApi;

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.log('⚠️  Brevo API key not configured. Job alerts will use Nodemailer fallback.');
    return null;
  }

  try {
    const SibApiV3Sdk = require('sib-api-v3-sdk');
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = BREVO_API_KEY;
    brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();
    console.log('✅ Brevo API initialized');
    return brevoApi;
  } catch (error) {
    console.error('❌ Failed to initialize Brevo API:', error.message);
    return null;
  }
};

/**
 * Send email via Brevo API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content
 * @param {string} textContent - Plain text content (optional)
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendViaBrevo = async (to, subject, htmlContent, textContent = null) => {
  const apiInstance = initializeBrevoApi();
  
  if (!apiInstance) {
    return false;
  }

  const sendSmtpEmail = new (require('sib-api-v3-sdk').SendSmtpEmail)();
  
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  if (textContent) {
    sendSmtpEmail.textContent = textContent;
  }
  sendSmtpEmail.sender = {
    name: process.env.BREVO_SENDER_NAME || 'Job Portal',
    email: process.env.BREVO_SENDER_EMAIL || 'cse471project10@gmail.com'
  };
  sendSmtpEmail.to = [{ email: to }];

  try {
    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Brevo email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email via Brevo:', error.message);
    return false;
  }
};

/**
 * Send job alert email with hybrid system (Brevo primary, Nodemailer fallback)
 * @param {string} to - Recipient email address
 * @param {string} userName - User's name
 * @param {string} alertName - Name of the job alert
 * @param {Array} matches - Array of matched jobs with scores and reasons
 * @param {string} unsubscribeLink - Unsubscribe link for the alert
 * @returns {Promise<boolean>} - True if email sent successfully
 */
const sendJobAlertEmail = async (to, userName, alertName, matches, unsubscribeLink) => {
  if (!matches || matches.length === 0) {
    console.log('⚠️  No matches to send in job alert email');
    return false;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const jobCount = matches.length;

  // Generate HTML content for job cards
  const jobCardsHtml = matches.map((match, index) => {
    const job = match.job;
    const score = match.score;
    const reasons = match.reasons || [];
    
    const jobUrl = `${frontendUrl}/jobs/${job._id}`;
    const reasonsHtml = reasons.map(reason => `<li>${reason}</li>`).join('');

    return `
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <h3 style="margin: 0; color: #1f2937; font-size: 18px; font-weight: 600;">
            <a href="${jobUrl}" style="color: #667eea; text-decoration: none;">${job.title}</a>
          </h3>
          <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            ${score}% Match
          </span>
        </div>
        <p style="margin: 8px 0; color: #6b7280; font-size: 14px;">
          <strong>${job.company}</strong> • ${job.location} • ${job.jobType}
        </p>
        ${job.salary ? `<p style="margin: 8px 0; color: #059669; font-size: 14px; font-weight: 600;">💰 ${job.salary}</p>` : ''}
        <p style="margin: 12px 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
          ${job.description.substring(0, 200)}${job.description.length > 200 ? '...' : ''}
        </p>
        ${reasons.length > 0 ? `
          <div style="margin-top: 12px; padding: 12px; background: #f3f4f6; border-radius: 6px;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #374151;">Why this matches:</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #6b7280;">
              ${reasonsHtml}
            </ul>
          </div>
        ` : ''}
        <a href="${jobUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
          View Job Details →
        </a>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">
            🎯 New Job Matches for You!
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #1f2937; margin: 0 0 20px 0;">
            Hello ${userName},
          </p>
          <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
            We found <strong>${jobCount} new job${jobCount > 1 ? 's' : ''}</strong> matching your "${alertName}" alert preferences!
          </p>

          <!-- Job Cards -->
          ${jobCardsHtml}

          <!-- CTA Section -->
          <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #6b7280;">
              Want to see more jobs?
            </p>
            <a href="${frontendUrl}/jobs" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Browse All Jobs
            </a>
          </div>

          <!-- Footer -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0 0 10px 0;">
              You're receiving this email because you have an active job alert.
            </p>
            <a href="${unsubscribeLink}" style="font-size: 12px; color: #667eea; text-decoration: none;">
              Manage or Unsubscribe from Job Alerts
            </a>
            <p style="font-size: 11px; color: #9ca3af; margin: 15px 0 0 0;">
              &copy; ${new Date().getFullYear()} Job Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
New Job Matches for You!

Hello ${userName},

We found ${jobCount} new job${jobCount > 1 ? 's' : ''} matching your "${alertName}" alert preferences!

${matches.map((match, index) => {
  const job = match.job;
  return `
${index + 1}. ${job.title} (${match.score}% Match)
   Company: ${job.company}
   Location: ${job.location}
   Type: ${job.jobType}
   ${job.salary ? `Salary: ${job.salary}` : ''}
   ${match.reasons && match.reasons.length > 0 ? `Why it matches: ${match.reasons.join(', ')}` : ''}
   View: ${frontendUrl}/jobs/${job._id}
`;
}).join('\n')}

Browse all jobs: ${frontendUrl}/jobs

Manage or unsubscribe from job alerts: ${unsubscribeLink}

© ${new Date().getFullYear()} Job Portal. All rights reserved.
  `;

  // Try Brevo first (if enabled)
  const preferredService = process.env.PREFERRED_EMAIL_SERVICE || 'brevo';
  const enableFallback = process.env.ENABLE_EMAIL_FALLBACK !== 'false';

  if (preferredService === 'brevo') {
    const brevoSuccess = await sendViaBrevo(to, `🎯 ${jobCount} New Job${jobCount > 1 ? 's' : ''} Matching Your Alert`, htmlContent, textContent);
    
    if (brevoSuccess) {
      return true;
    }

    // Fallback to Nodemailer if Brevo fails and fallback is enabled
    if (enableFallback) {
      console.log('⚠️  Brevo failed, falling back to Nodemailer');
    } else {
      return false;
    }
  }

  // Fallback to Nodemailer
  const transporter = initializeTransporter();
  if (!transporter) {
    console.log('\n' + '='.repeat(60));
    console.log('📧 JOB ALERT EMAIL (Console Mode - Email not sent)');
    console.log('='.repeat(60));
    console.log(`To: ${to}`);
    console.log(`Subject: 🎯 ${jobCount} New Job${jobCount > 1 ? 's' : ''} Matching Your Alert`);
    console.log(`Alert: ${alertName}`);
    console.log(`Matches: ${jobCount}`);
    console.log('='.repeat(60) + '\n');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Job Portal" <${process.env.EMAIL_USER || 'noreply@jobportal.com'}>`,
      to: to,
      subject: `🎯 ${jobCount} New Job${jobCount > 1 ? 's' : ''} Matching Your Alert`,
      html: htmlContent,
      text: textContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Job alert email sent via Nodemailer:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send job alert email:', error.message);
    return false;
  }
};

module.exports = {
  // Existing Nodemailer functions (unchanged)
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSuspiciousLoginAlert,
  // New Brevo functions for Job Alerts
  sendViaBrevo,
  sendJobAlertEmail
};

