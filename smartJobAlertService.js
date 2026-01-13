const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');

/**
 * Smart Job Alert Service
 * AI-powered matching engine for job alerts
 */

// Scoring weights (Improved for better matching)
const SCORING_WEIGHTS = {
  keyword: 0.30,    // 30% (reduced from 40%)
  skill: 0.35,      // 35% (increased from 25% - more important)
  location: 0.15,   // 15%
  jobType: 0.10,    // 10%
  recency: 0.10     // 10%
};

/**
 * Normalize keyword for matching
 */
function normalizeKeyword(keyword) {
  return keyword?.toString().trim().toLowerCase() || '';
}

/**
 * Escape regex special characters
 */
function escapeRegex(input = '') {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate keyword match score (IMPROVED)
 * Checks if alert keywords match job title, description, company, or skills
 * Enhanced with better weighting for title matches
 */
function calculateKeywordScore(alertKeywords, job) {
  if (!alertKeywords || alertKeywords.length === 0) {
    return 0;
  }

  // Weight different fields differently (title is most important)
  const titleText = (job.title || '').toLowerCase();
  const descriptionText = (job.description || '').toLowerCase();
  const companyText = (job.company || '').toLowerCase();
  const skillsText = ((job.skills || []).join(' ')).toLowerCase();
  
  let totalScore = 0;
  let matchedKeywords = 0;

  alertKeywords.forEach(keyword => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || normalized.length < 2) return;

    let keywordScore = 0;
    let found = false;

    // Check title (highest weight - 1.0)
    if (titleText.includes(normalized)) {
      keywordScore += 1.0;
      found = true;
    } else {
      // Check if individual words from keyword match in title
      const keywordWords = normalized.split(/\s+/).filter(w => w.length >= 2);
      const titleMatches = keywordWords.filter(word => titleText.includes(word)).length;
      if (titleMatches > 0) {
        keywordScore += (titleMatches / keywordWords.length) * 0.8;
        found = true;
      }
    }

    // Check description (medium weight - 0.6)
    if (descriptionText.includes(normalized)) {
      keywordScore += 0.6;
      found = true;
    } else {
      const keywordWords = normalized.split(/\s+/).filter(w => w.length >= 2);
      const descMatches = keywordWords.filter(word => descriptionText.includes(word)).length;
      if (descMatches > 0) {
        keywordScore += (descMatches / keywordWords.length) * 0.4;
        found = true;
      }
    }

    // Check skills (medium weight - 0.5)
    if (skillsText.includes(normalized)) {
      keywordScore += 0.5;
      found = true;
    }

    // Check company (lower weight - 0.3)
    if (companyText.includes(normalized)) {
      keywordScore += 0.3;
      found = true;
    }

    if (found) {
      matchedKeywords++;
      // Cap keyword score at 1.0 (best match)
      totalScore += Math.min(1.0, keywordScore);
    }
  });

  // Normalize to 0-1 range
  // Give bonus if most keywords matched
  const matchRatio = alertKeywords.length > 0 ? matchedKeywords / alertKeywords.length : 0;
  const baseScore = alertKeywords.length > 0 ? totalScore / alertKeywords.length : 0;
  
  // Bonus if 70%+ keywords matched
  if (matchRatio >= 0.7) {
    return Math.min(1.0, baseScore * 1.1);
  }
  
  return Math.min(1.0, baseScore);
}

/**
 * Calculate skill match score (IMPROVED - More lenient)
 * Checks overlap between user skills and job required skills
 * Enhanced matching with better scoring - more lenient to get more matches
 */
function calculateSkillScore(userSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) {
    return 0.5; // Higher neutral score if job doesn't specify skills (more lenient)
  }

  if (!userSkills || userSkills.length === 0) {
    return 0.2; // Give some score even if user has no skills (job might still match on keywords)
  }

  const userSkillsNormalized = userSkills.map(s => normalizeKeyword(s));
  const jobSkillsNormalized = jobSkills.map(s => normalizeKeyword(s));

  let exactMatches = 0;
  let partialMatches = 0;
  
  userSkillsNormalized.forEach(userSkill => {
    // Check for exact match first
    if (jobSkillsNormalized.includes(userSkill)) {
      exactMatches++;
    } else {
      // Check for partial match (one contains the other) - more lenient
      const hasPartialMatch = jobSkillsNormalized.some(jobSkill => {
        // Exact word match
        if (jobSkill === userSkill) return true;
        // One contains the other (e.g., "javascript" matches "javascript developer")
        if (jobSkill.includes(userSkill) || userSkill.includes(jobSkill)) {
          // More lenient: allow matches even for shorter terms
          if (userSkill.length >= 2 && jobSkill.length >= 2) {
            return true;
          }
        }
        // Check for word boundaries (e.g., "react" matches "react.js" or "reactjs")
        const userWords = userSkill.split(/[\s\-_\.]+/);
        const jobWords = jobSkill.split(/[\s\-_\.]+/);
        return userWords.some(uw => jobWords.some(jw => uw === jw && uw.length >= 2));
      });
      
      if (hasPartialMatch) {
        partialMatches++;
      }
    }
  });

  // Calculate score: exact matches get full weight, partial matches get 0.8 weight (more lenient)
  const totalMatches = exactMatches + (partialMatches * 0.8);
  const maxPossibleMatches = Math.max(userSkillsNormalized.length, jobSkillsNormalized.length);
  
  // Score based on overlap percentage - more lenient calculation
  let baseScore = 0;
  if (maxPossibleMatches > 0) {
    baseScore = Math.min(1.0, totalMatches / maxPossibleMatches);
  }
  
  // More lenient: if user has ANY matching skill, give minimum 0.3 score
  if (exactMatches > 0 || partialMatches > 0) {
    baseScore = Math.max(0.3, baseScore);
  }
  
  // Bonus if user has most/all required skills
  const matchRatio = userSkillsNormalized.length > 0 
    ? (exactMatches + partialMatches) / userSkillsNormalized.length 
    : 0;
  
  // If user has 50%+ matching skills, give bonus (lowered from 80%)
  if (matchRatio >= 0.5) {
    return Math.min(1.0, baseScore * 1.15);
  }
  
  return baseScore;
}

/**
 * Calculate location match score
 * Checks if job location matches alert location preferences
 */
function calculateLocationScore(alertLocations, jobLocation) {
  if (!alertLocations || alertLocations.length === 0) {
    return 0.5; // Neutral score if no location preference
  }

  if (!jobLocation) {
    return 0;
  }

  const jobLocationLower = normalizeKeyword(jobLocation);
  
  // Check for exact or partial match
  for (const alertLocation of alertLocations) {
    const alertLocationLower = normalizeKeyword(alertLocation);
    
    // Exact match
    if (jobLocationLower === alertLocationLower) {
      return 1.0;
    }
    
    // Partial match (e.g., "New York" matches "New York City")
    if (jobLocationLower.includes(alertLocationLower) || alertLocationLower.includes(jobLocationLower)) {
      return 0.7;
    }
  }

  return 0;
}

/**
 * Calculate job type match score
 */
function calculateJobTypeScore(alertJobTypes, jobType) {
  if (!alertJobTypes || alertJobTypes.length === 0) {
    return 0.5; // Neutral score if no preference
  }

  return alertJobTypes.includes(jobType) ? 1.0 : 0;
}

/**
 * Calculate recency score
 * Newer jobs get higher scores
 */
function calculateRecencyScore(jobCreatedAt) {
  if (!jobCreatedAt) {
    return 0.5;
  }

  const now = new Date();
  const jobDate = new Date(jobCreatedAt);
  const daysSinceCreation = (now - jobDate) / (1000 * 60 * 60 * 24);

  // Jobs created in last 7 days get full score
  if (daysSinceCreation <= 7) {
    return 1.0;
  }
  // Jobs created in last 30 days get 0.7
  if (daysSinceCreation <= 30) {
    return 0.7;
  }
  // Jobs created in last 90 days get 0.4
  if (daysSinceCreation <= 90) {
    return 0.4;
  }
  // Older jobs get 0.1
  return 0.1;
}

/**
 * Learn from successful applications
 * Returns enhanced keywords and skills based on accepted/reviewed applications
 */
async function learnFromSuccessfulApplications(userId) {
  try {
    const successfulApplications = await Application.find({
      applicantId: userId,
      status: { $in: ['Accepted', 'Reviewed'] }
    }).populate('jobId').lean();

    if (!successfulApplications || successfulApplications.length === 0) {
      return { enhancedKeywords: [], enhancedSkills: [] };
    }

    const enhancedKeywords = new Set();
    const enhancedSkills = new Set();

    successfulApplications.forEach(app => {
      const job = app.jobId;
      if (!job) return;

      // Extract keywords from successful job titles
      const titleWords = job.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      titleWords.forEach(word => enhancedKeywords.add(word));

      // Add job skills
      if (job.skills && Array.isArray(job.skills)) {
        job.skills.forEach(skill => enhancedSkills.add(normalizeKeyword(skill)));
      }
    });

    return {
      enhancedKeywords: Array.from(enhancedKeywords),
      enhancedSkills: Array.from(enhancedSkills)
    };
  } catch (error) {
    console.error('[smartJobAlert] Error learning from applications:', error);
    return { enhancedKeywords: [], enhancedSkills: [] };
  }
}

/**
 * Generate match reasons for a job
 */
function generateMatchReasons(score, keywordScore, skillScore, locationScore, jobTypeScore, recencyScore) {
  const reasons = [];

  if (keywordScore > 0.5) {
    reasons.push('Matches your keyword preferences');
  }
  if (skillScore > 0.5) {
    reasons.push('Aligns with your skills');
  }
  if (locationScore > 0.5) {
    reasons.push('Matches your location preference');
  }
  if (jobTypeScore === 1.0) {
    reasons.push('Matches your preferred job type');
  }
  if (recencyScore > 0.7) {
    reasons.push('Recently posted');
  }

  if (reasons.length === 0) {
    reasons.push('General match based on your profile');
  }

  return reasons;
}

/**
 * Find matching jobs for a job alert
 * @param {Object} jobAlert - JobAlert document
 * @param {Object} user - User document
 * @param {Date} sinceDate - Only return jobs created after this date (for new jobs)
 * @returns {Array} Array of matched jobs with scores and reasons
 */
async function findMatchingJobs(jobAlert, user, sinceDate = null) {
  try {
    // Build base query
    const query = {
      isActive: true
    };

    // If sinceDate is provided, only get jobs created after that date
    if (sinceDate) {
      query.createdAt = { $gte: sinceDate };
    }

    // Get all active jobs (we'll filter and score them)
    // Note: companyId populate is optional (some jobs may not have a company)
    let jobs = await Job.find(query)
      .populate('recruiterId', 'name email')
      .lean();
    
    // Try to populate companyId if Company model is available
    try {
      const Company = require('../models/Company');
      if (Company && mongoose.models.Company) {
        await Job.populate(jobs, { path: 'companyId', select: 'name logoUrl' });
      }
    } catch (error) {
      // Company model not available or populate failed - continue without it
      console.log('[smartJobAlert] Company model not available, continuing without company data');
    }

    // Learn from successful applications
    const learning = await learnFromSuccessfulApplications(user._id);
    
    // Build enhanced keywords from multiple sources (prioritized):
    // 1. Profile keywords (HIGHEST PRIORITY - user explicitly saved)
    // 2. Job alert keywords (user-specified in alert)
    // 3. Successful applications (learned from Accepted/Reviewed jobs)
    // 4. Search history (LOWER PRIORITY - only last 5 searches, reduced weight)
    const alertKeywords = jobAlert.keywords || [];
    const profileKeywords = (user.profileKeywords || []).map(k => normalizeKeyword(k));
    
    // Extract keywords from search history (last 20 entries to capture all search fields)
    // Extract both regular terms and field-specific terms (title:, location:, skills:)
    const recentSearches = (user.searchHistory || []).slice(-20); // Get last 20 searches
    const searchHistoryKeywords = [];
    
    recentSearches.forEach(entry => {
      const term = normalizeKeyword(entry.term);
      if (!term) return;
      
      // If it's a field-specific term (e.g., "title:developer"), extract the keyword part
      if (term.includes(':')) {
        const parts = term.split(':');
        if (parts.length === 2 && parts[1]) {
          searchHistoryKeywords.push(parts[1]); // Extract "developer" from "title:developer"
          // Also add the full term for context
          searchHistoryKeywords.push(term);
        }
      } else {
        // Regular search term
        searchHistoryKeywords.push(term);
      }
    });
    
    // Remove duplicates and filter
    const uniqueSearchKeywords = [...new Set(searchHistoryKeywords.filter(Boolean))];
    
    // Prioritize: Profile keywords first, then alert keywords, then learned, then search history
    const enhancedKeywords = [
      ...profileKeywords,        // Highest priority (user explicitly saved)
      ...alertKeywords,          // Second priority (user set in alert)
      ...learning.enhancedKeywords, // Third priority (learned from success)
      ...uniqueSearchKeywords   // Lower priority (recent searches - all fields)
    ];
    
    // Remove duplicates while preserving order (first occurrence wins)
    const seen = new Set();
    const uniqueKeywords = enhancedKeywords.filter(k => {
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    
    // Build enhanced skills from:
    // 1. User profile skills
    // 2. Skills from successful applications
    const enhancedSkills = [...(user.skills || []), ...learning.enhancedSkills];
    
    // Log what data sources are being used (for debugging)
    if (uniqueKeywords.length > 0 || enhancedSkills.length > 0) {
      console.log(`[smartJobAlert] Using data sources for user ${user._id}:`, {
        profileKeywords: profileKeywords.length,      // Highest priority
        alertKeywords: alertKeywords.length,
        learnedFromApplications: learning.enhancedKeywords.length,
        searchHistoryKeywords: uniqueSearchKeywords.length, // All search fields (title, location, skills)
        totalKeywords: uniqueKeywords.length,
        userSkills: (user.skills || []).length,       // Increased weight (35%)
        learnedSkills: learning.enhancedSkills.length,
        totalSkills: enhancedSkills.length
      });
    }

    // Score each job
    const scoredJobs = jobs.map(job => {
      const keywordScore = calculateKeywordScore(uniqueKeywords, job);
      const skillScore = calculateSkillScore(enhancedSkills, job.skills);
      const locationScore = calculateLocationScore(jobAlert.locations, job.location);
      const jobTypeScore = calculateJobTypeScore(jobAlert.jobTypes, job.jobType);
      const recencyScore = calculateRecencyScore(job.createdAt);

      // Calculate weighted total score
      const totalScore = (
        keywordScore * SCORING_WEIGHTS.keyword +
        skillScore * SCORING_WEIGHTS.skill +
        locationScore * SCORING_WEIGHTS.location +
        jobTypeScore * SCORING_WEIGHTS.jobType +
        recencyScore * SCORING_WEIGHTS.recency
      );

      return {
        job,
        score: Math.round(totalScore * 100), // Convert to percentage
        keywordScore,
        skillScore,
        locationScore,
        jobTypeScore,
        recencyScore,
        reasons: generateMatchReasons(totalScore, keywordScore, skillScore, locationScore, jobTypeScore, recencyScore)
      };
    });

    // Filter out jobs with very low scores (< 10% - lowered threshold to get more matches)
    // This ensures we get matches even with partial skill/keyword overlap
    const filteredJobs = scoredJobs.filter(item => item.score >= 10);

    // Sort by score (descending) and return top 10
    const topMatches = filteredJobs
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return topMatches;
  } catch (error) {
    console.error('[smartJobAlert] Error finding matching jobs:', error);
    return [];
  }
}

/**
 * Process job alert and find matches
 * @param {string} alertId - JobAlert ID
 * @param {boolean} onlyNew - Only return jobs created since lastSent
 * @returns {Object} Matches and statistics
 */
async function processJobAlert(alertId, onlyNew = true) {
  try {
    const jobAlert = await JobAlert.findById(alertId).populate('userId').lean();
    if (!jobAlert || !jobAlert.isActive) {
      return { matches: [], error: 'Job alert not found or inactive' };
    }

    // Always fetch fresh user data to get latest skills, keywords, search history
    const user = await User.findById(jobAlert.userId._id || jobAlert.userId).lean();
    if (!user) {
      return { matches: [], error: 'User not found' };
    }

    // NO DATE FILTERING - Always get all matches
    // This ensures all jobs are re-evaluated based on current user profile
    // User profile changes (skills, keywords, search history) will be reflected immediately
    const sinceDate = null; // Always null to get all jobs

    // Find matching jobs (always gets all jobs, no date filtering)
    const matches = await findMatchingJobs(jobAlert, user, sinceDate);

    // Log user data being used for debugging
    console.log(`[smartJobAlert] Processing alert "${jobAlert.name}" for user ${user.email}:`);
    console.log(`   Skills: ${(user.skills || []).length} (${(user.skills || []).slice(0, 3).join(', ')}${(user.skills || []).length > 3 ? '...' : ''})`);
    console.log(`   Profile Keywords: ${(user.profileKeywords || []).length} (${(user.profileKeywords || []).join(', ') || 'none'})`);
    console.log(`   Search History: ${(user.searchHistory || []).length} searches`);
    console.log(`   Matches Found: ${matches.length}`);

    return {
      matches,
      alertId: jobAlert._id,
      alertName: jobAlert.name,
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      userSkills: (user.skills || []).length,
      userKeywords: (user.profileKeywords || []).length,
      userSearches: (user.searchHistory || []).length
    };
  } catch (error) {
    console.error('[smartJobAlert] Error processing job alert:', error);
    return { matches: [], error: error.message };
  }
}

/**
 * Process all active job alerts
 * @param {boolean} testMode - If true, always get fresh matches (for test cron)
 * @returns {Array} Results for each alert
 */
async function processAllActiveAlerts(testMode = false) {
  try {
    const activeAlerts = await JobAlert.find({ isActive: true })
      .populate('userId')
      .lean();

    const results = [];

    for (const alert of activeAlerts) {
      if (!alert.userId) continue;

      try {
        // Always get all matches (no date filtering)
        // This allows re-evaluation when user profile changes (new skills, searches, keywords)
        const onlyNew = false; // Always false to get all matches
        const result = await processJobAlert(alert._id.toString(), onlyNew);
        
        // NO DUPLICATE PREVENTION - Send all matches every time
        // This ensures user always sees all current matches based on their updated profile
        
        results.push(result);
      } catch (error) {
        console.error(`[smartJobAlert] Error processing alert ${alert._id}:`, error);
        results.push({
          alertId: alert._id,
          matches: [],
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    console.error('[smartJobAlert] Error processing all alerts:', error);
    return [];
  }
}

module.exports = {
  findMatchingJobs,
  processJobAlert,
  processAllActiveAlerts,
  learnFromSuccessfulApplications
};

