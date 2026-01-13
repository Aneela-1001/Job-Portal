const Notification = require('../models/Notification');

/**
 * Notification Service
 * Creates and manages in-app notifications for users
 * Works alongside email notifications (does not replace them)
 */

/**
 * Create a notification for a user
 * @param {Object} notificationData - Notification details
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (notificationData) => {
  try {
    // Ensure userId is properly formatted (Mongoose will convert string to ObjectId automatically)
    const notification = new Notification(notificationData);
    await notification.save();
    console.log('✅ Notification created:', {
      id: notification._id,
      type: notification.type,
      userId: notification.userId,
      title: notification.title,
      message: notification.message?.substring(0, 50) + '...'
    });
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error.message);
    console.error('   Notification data:', JSON.stringify(notificationData, null, 2));
    throw error;
  }
};

/**
 * Create application status notification (for applicants)
 * @param {string} applicantId - Applicant user ID
 * @param {string} status - Application status (Accepted, Rejected, Reviewed)
 * @param {Object} jobDetails - Job details {title, company}
 * @param {string} applicationId - Application ID
 * @returns {Promise<Object>} Created notification
 */
const createApplicationStatusNotification = async (applicantId, status, jobDetails, applicationId) => {
  const statusConfig = {
    'Accepted': {
      type: 'application_accepted',
      title: '🎉 Application Accepted!',
      message: `Congratulations! Your application for ${jobDetails.title} at ${jobDetails.company} has been accepted.`,
      priority: 'high'
    },
    'Rejected': {
      type: 'application_rejected',
      title: 'Application Update',
      message: `Your application for ${jobDetails.title} at ${jobDetails.company} was not successful this time. Keep applying!`,
      priority: 'medium'
    },
    'Reviewed': {
      type: 'application_reviewed',
      title: '👀 Application Under Review',
      message: `Your application for ${jobDetails.title} at ${jobDetails.company} is now being reviewed by the recruiter.`,
      priority: 'medium'
    }
  };

  const config = statusConfig[status];
  if (!config) {
    console.warn('⚠️  Unknown application status:', status);
    return null;
  }

  return createNotification({
    userId: applicantId,
    type: config.type,
    title: config.title,
    message: config.message,
    link: `/applicant/applications`,
    relatedEntity: {
      entityType: 'application',
      entityId: applicationId
    },
    priority: config.priority
  });
};

/**
 * Create locked application update notification (for applicants)
 * Used when status is Accepted/Rejected but feedback is required to view
 * @param {string} applicantId - Applicant user ID
 * @param {Object} jobDetails - Job details {title, company}
 * @param {string} applicationId - Application ID
 * @returns {Promise<Object>} Created notification
 */
const createLockedApplicationNotification = async (applicantId, jobDetails, applicationId) => {
  return createNotification({
    userId: applicantId,
    type: 'application_update_locked',
    title: `Update from ${jobDetails.company}`,
    message: `You have an update regarding your application for ${jobDetails.title} at ${jobDetails.company}. Submit feedback to view the decision and recruiter review.`,
    link: `/my-applications`,
    relatedEntity: {
      entityType: 'application',
      entityId: applicationId
    },
    priority: 'high',
    metadata: {
      isLocked: true,
      requiresFeedback: true
    }
  });
};

/**
 * Create unusual login activity notification
 * @param {string} userId - User ID
 * @param {Object} loginActivity - Login activity details
 * @returns {Promise<Object>} Created notification
 */
const createUnusualLoginNotification = async (userId, loginActivity) => {
  const reasonsText = loginActivity.suspiciousReasons.map(reason => {
    switch(reason) {
      case 'new_ip': return 'new IP address';
      case 'new_country': return 'new country';
      case 'new_device': return 'new device';
      case 'new_os': return 'new operating system';
      case 'unusual_time': return 'unusual time';
      case 'multiple_failed_attempts': return 'multiple failed attempts';
      default: return reason;
    }
  }).join(', ');

  const location = `${loginActivity.ipInfo.city}, ${loginActivity.ipInfo.countryName}`;
  const device = `${loginActivity.device.browser} on ${loginActivity.device.os}`;

  return createNotification({
    userId,
    type: 'unusual_login',
    title: '🔐 Unusual Login Activity Detected',
    message: `We detected a login from an unusual location or device. Location: ${location}, Device: ${device}. Reasons: ${reasonsText}. If this wasn't you, please secure your account immediately.`,
    link: '/profile',
    relatedEntity: {
      entityType: 'login',
      entityId: loginActivity._id
    },
    priority: 'high',
    metadata: {
      ipAddress: loginActivity.ipAddress,
      location: location,
      device: device,
      suspiciousReasons: loginActivity.suspiciousReasons,
      loginTime: loginActivity.loginTime
    }
  });
};

/**
 * Create password changed notification
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {Object} ipInfo - IP and device info (optional)
 * @returns {Promise<Object>} Created notification
 */
const createPasswordChangedNotification = async (userId, userEmail, ipInfo = null) => {
  let message = 'Your password was recently changed.';
  
  if (ipInfo && ipInfo.location) {
    message += ` Location: ${ipInfo.location}.`;
  }
  
  message += ' If you did not make this change, please contact support immediately.';

  return createNotification({
    userId,
    type: 'password_changed',
    title: '🔑 Password Changed',
    message,
    link: '/profile',
    priority: 'high',
    metadata: ipInfo || {}
  });
};

/**
 * Create generic info notification
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created notification
 */
const createInfoNotification = async (userId, title, message, options = {}) => {
  return createNotification({
    userId,
    type: 'info',
    title,
    message,
    link: options.link || null,
    priority: options.priority || 'low',
    metadata: options.metadata || {}
  });
};

/**
 * Create success notification
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created notification
 */
const createSuccessNotification = async (userId, title, message, options = {}) => {
  return createNotification({
    userId,
    type: 'success',
    title,
    message,
    link: options.link || null,
    priority: options.priority || 'low',
    metadata: options.metadata || {}
  });
};

/**
 * Create warning notification
 * @param {string} userId - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Created notification
 */
const createWarningNotification = async (userId, title, message, options = {}) => {
  return createNotification({
    userId,
    type: 'warning',
    title,
    message,
    link: options.link || null,
    priority: options.priority || 'medium',
    metadata: options.metadata || {}
  });
};

/**
 * Create feedback submitted notification (for recruiters)
 * Notifies recruiter when an applicant submits feedback
 * @param {string} recruiterId - Recruiter user ID
 * @param {Object} jobDetails - Job details {title, company}
 * @param {string} applicationId - Application ID
 * @returns {Promise<Object>} Created notification
 */
const createFeedbackSubmittedNotification = async (recruiterId, jobDetails, applicationId) => {
  return createNotification({
    userId: recruiterId,
    type: 'feedback_submitted',
    title: '📝 Feedback Received',
    message: `An applicant has submitted feedback for the position ${jobDetails.title} at ${jobDetails.company}. Click to view the feedback.`,
    link: `/recruiter/feedbacks`,
    relatedEntity: {
      entityType: 'application',
      entityId: applicationId
    },
    priority: 'medium',
    metadata: {
      jobTitle: jobDetails.title,
      companyName: jobDetails.company,
      applicationId: applicationId.toString()
    }
  });
};

/**
 * Get user notifications with pagination
 * @param {string} userId - User ID
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Paginated notifications
 */
const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId }),
      Notification.getUnreadCount(userId)
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  } catch (error) {
    console.error('❌ Error fetching user notifications:', error.message);
    throw error;
  }
};

/**
 * Get unread notifications count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadCount = async (userId) => {
  try {
    return await Notification.getUnreadCount(userId);
  } catch (error) {
    console.error('❌ Error fetching unread count:', error.message);
    return 0;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated notification
 */
const markAsRead = async (notificationId, userId) => {
  try {
    return await Notification.markAsRead(notificationId, userId);
  } catch (error) {
    console.error('❌ Error marking notification as read:', error.message);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
const markAllAsRead = async (userId) => {
  try {
    const result = await Notification.markAllAsRead(userId);
    console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error.message);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Delete result
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await Notification.findOneAndDelete({ _id: notificationId, userId });
    if (result) {
      console.log('✅ Notification deleted:', notificationId);
    }
    return result;
  } catch (error) {
    console.error('❌ Error deleting notification:', error.message);
    throw error;
  }
};

/**
 * Delete all read notifications older than specified days
 * @param {string} userId - User ID
 * @param {number} daysOld - Number of days
 * @returns {Promise<Object>} Delete result
 */
const deleteOldNotifications = async (userId, daysOld = 30) => {
  try {
    const result = await Notification.deleteOldNotifications(userId, daysOld);
    console.log(`✅ Deleted ${result.deletedCount} old notifications for user ${userId}`);
    return result;
  } catch (error) {
    console.error('❌ Error deleting old notifications:', error.message);
    throw error;
  }
};

module.exports = {
  createNotification,
  createApplicationStatusNotification,
  createLockedApplicationNotification,
  createUnusualLoginNotification,
  createPasswordChangedNotification,
  createInfoNotification,
  createSuccessNotification,
  createWarningNotification,
  createFeedbackSubmittedNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteOldNotifications
};

