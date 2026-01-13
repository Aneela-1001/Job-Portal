const axios = require('axios');
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');

const DEFAULT_NEWS_ENDPOINT = 'https://newsapi.org/v2/everything';
const DEFAULT_NEWS_QUERY = 'job market trends';

const FALLBACK_TRENDS = [
  {
    headline: 'AI and Machine Learning Jobs Surge in 2025',
    source: 'TechCrunch',
    summary: 'The demand for AI and ML engineers continues to grow exponentially as companies invest heavily in automation and intelligent systems.',
    url: '#',
    publishedAt: new Date().toISOString()
  },
  {
    headline: 'Remote Work Remains Top Priority for Job Seekers',
    source: 'Forbes',
    summary: 'Latest surveys show that 78% of job seekers prioritize remote or hybrid work options when considering new opportunities.',
    url: '#',
    publishedAt: new Date().toISOString()
  },
  {
    headline: 'Cybersecurity Skills in High Demand',
    source: 'CNN Business',
    summary: 'With increasing cyber threats, companies are actively seeking cybersecurity professionals with cloud security expertise.',
    url: '#',
    publishedAt: new Date().toISOString()
  },
  {
    headline: 'Web3 and Blockchain Development Opportunities Growing',
    source: 'Bloomberg',
    summary: 'The Web3 ecosystem expansion creates numerous opportunities for developers skilled in blockchain technologies.',
    url: '#',
    publishedAt: new Date().toISOString()
  },
  {
    headline: 'Full-Stack Developers Most Sought After',
    source: 'LinkedIn',
    summary: 'Companies prefer versatile developers who can handle both frontend and backend development efficiently.',
    url: '#',
    publishedAt: new Date().toISOString()
  }
];

function escapeRegex(input = '') {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeKeyword(keyword) {
  return keyword?.toString().trim().toLowerCase() || '';
}

function extractUserKeywords(userDoc, maxTotal = 20) {
  if (!userDoc) {
    console.log('[recommendations] No userDoc provided');
    return [];
  }

  const history = userDoc.searchHistory || [];
  const profile = userDoc.profileKeywords || [];
  const seen = new Set();
  const result = [];

  console.log('[recommendations] Extracting keywords from user:', {
    searchHistoryCount: history.length,
    profileKeywords: profile,
    profileKeywordsCount: profile.length
  });

  // PRIORITY 1: Profile keywords first (explicitly saved by user - most important)
  // If user has saved profile keywords, prioritize them heavily
  if (profile.length > 0) {
    console.log('[recommendations] User has saved profile keywords, prioritizing them');
    for (let k of profile) {
      const normalized = normalizeKeyword(k);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
      
      // Also split profile keywords if they're multi-word
      const words = normalized.split(/\s+/).filter(w => w.length > 2);
      words.forEach(word => {
        if (!seen.has(word)) {
          seen.add(word);
          result.push(word);
        }
      });
    }
    console.log('[recommendations] After profile keywords:', result.length, 'keywords');
  }

  // PRIORITY 2: Most recent search terms - only add if we have room or no profile keywords
  // If user has profile keywords, limit search history to avoid dilution
  const maxFromHistory = profile.length > 0 ? Math.min(5, maxTotal - result.length) : maxTotal;
  let addedFromHistory = 0;
  
  for (let i = history.length - 1; i >= 0 && addedFromHistory < maxFromHistory; i -= 1) {
    const entry = history[i];
    const normalized = normalizeKeyword(entry?.term);
    if (!normalized || seen.has(normalized)) continue;
    
    // Add the full term
    seen.add(normalized);
    result.push(normalized);
    addedFromHistory++;
    
    // Also split multi-word terms and add individual words (if meaningful, >2 chars)
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    words.forEach(word => {
      if (!seen.has(word) && addedFromHistory < maxFromHistory) {
        seen.add(word);
        result.push(word);
        addedFromHistory++;
      }
    });
    
    if (result.length >= maxTotal) break;
  }

  console.log('[recommendations] Final extracted keywords:', result);
  console.log('[recommendations] Keyword breakdown:', {
    total: result.length,
    fromProfileKeywords: profile.length,
    fromSearchHistory: addedFromHistory,
    profileKeywordsList: profile,
    extractedKeywordsList: result
  });
  
  return result;
}

async function fetchTrendInsights(keywords = []) {
  let query = DEFAULT_NEWS_QUERY;
  if (keywords.length) {
    query += ` (${keywords.slice(0, 4).join(' OR ')})`;
  }

  try {
    const { data } = await axios.get(`${DEFAULT_NEWS_ENDPOINT}?q=${encodeURIComponent(query)}&sortBy=publishedAt&apiKey=${process.env.NEWS_API_KEY || 'fallback-key-use-your-own'}`);
    if (!data?.articles?.length) {
      return FALLBACK_TRENDS;
    }
    return data.articles.slice(0, 5).map(article => ({
      headline: article.title,
      source: article.source?.name,
      summary: article.description || article.content || 'Trending hiring insight',
      url: article.url,
      publishedAt: article.publishedAt
    }));
  } catch (error) {
    console.error('Trend API error:', error.message);
    return FALLBACK_TRENDS;
  }
}

async function getAppliedJobIds(userId) {
  try {
    if (!userId) {
      console.log('[recommendations] No userId provided for applied job IDs');
      return [];
    }
    
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('[recommendations] Invalid userId for applied job IDs:', userId);
      return [];
    }
    
    const jobIds = await Application.find({ applicantId: userId }).distinct('jobId');
    console.log('[recommendations] Found', jobIds.length, 'applied job IDs for user:', userId);
    return jobIds || [];
  } catch (err) {
    console.error('[recommendations] Error getting applied job IDs:', err);
    console.error('[recommendations] Error stack:', err.stack);
    return [];
  }
}

async function getPersonalizedJobs(keywords, excludedIds) {
  try {
    if (!keywords || !keywords.length) {
      console.log('[recommendations] No keywords provided for personalized jobs');
      return [];
    }

    console.log('[recommendations] Searching for personalized jobs with keywords:', keywords);
    
    // Filter out invalid ObjectIds from excludedIds
    const mongoose = require('mongoose');
    const validExcludedIds = (excludedIds || []).filter(id => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch {
        return false;
      }
    });
    
    console.log('[recommendations] Excluding job IDs:', validExcludedIds);

    // Build OR conditions for each keyword
    // Each keyword should match in title, description, company, location, or skills array
    const orConditions = [];
    keywords.forEach(k => {
      if (!k || typeof k !== 'string') return;
      
      try {
        const regex = new RegExp(escapeRegex(k), 'i');
        // Match in any field
        orConditions.push({ title: regex });
        orConditions.push({ description: regex });
        orConditions.push({ company: regex });
        orConditions.push({ location: regex });
        // For skills array, MongoDB automatically matches regex against array elements
        orConditions.push({ skills: regex });
      } catch (regexErr) {
        console.error('[recommendations] Error creating regex for keyword:', k, regexErr);
      }
    });

    if (orConditions.length === 0) {
      console.log('[recommendations] No valid OR conditions created');
      return [];
    }

    const query = {
      isActive: true,
      $or: orConditions
    };

    // Only add $nin if we have valid excluded IDs
    if (validExcludedIds.length > 0) {
      query._id = { $nin: validExcludedIds };
    }

    console.log('[recommendations] Query:', JSON.stringify(query, null, 2));
    console.log('[recommendations] Searching with', orConditions.length, 'OR conditions from', keywords.length, 'keywords');

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(15) // Increased limit to get more results
      .populate('recruiterId', 'name company')
      .lean();

    console.log('[recommendations] Found', jobs.length, 'personalized jobs');
    
    // Log which keywords matched for each job (for debugging)
    if (jobs.length > 0) {
      console.log('[recommendations] Sample job matches:');
      jobs.slice(0, 3).forEach(job => {
        const matchedKeywords = keywords.filter(k => {
          const regex = new RegExp(escapeRegex(k), 'i');
          return regex.test(job.title) || 
                 regex.test(job.description || '') || 
                 regex.test(job.company || '') ||
                 (job.skills && job.skills.some(s => regex.test(s)));
        });
        console.log(`  - "${job.title}": matched keywords [${matchedKeywords.join(', ')}]`);
      });
    }
    
    if (jobs.length > 0) {
      console.log('[recommendations] Sample job titles:', jobs.slice(0, 3).map(j => j.title));
    }

    return jobs || [];
  } catch (err) {
    console.error('[recommendations] Error getting personalized jobs:', err);
    console.error('[recommendations] Error stack:', err.stack);
    return [];
  }
}

async function getCollaborativeJobs(userId, keywords, excludedIds) {
  try {
    if (!keywords.length) return [];

    // Find similar applicants with at least one overlapping keyword
    const similarUsers = await User.find({
      _id: { $ne: userId },
      role: 'applicant',
      profileKeywords: { $in: keywords }
    }).select('_id').lean();

    if (!similarUsers.length) return [];

    const similarIds = similarUsers.map(u => u._id);

    // Get distinct job IDs they've applied to (excluding user's applied)
    const collabJobIds = await Application.find({
      applicantId: { $in: similarIds },
      jobId: { $nin: excludedIds || [] }
    }).distinct('jobId');

    if (!collabJobIds.length) return [];

    return await Job.find({
      _id: { $in: collabJobIds },
      isActive: true
    }).sort({ createdAt: -1 }).limit(5).populate('recruiterId', 'name company').lean();
  } catch (err) {
    console.error('[recommendations] Error getting collaborative jobs:', err);
    return [];
  }
}

function extractTrendKeywords(trends) {
  const stopWords = new Set(['the', 'and', 'to', 'of', 'in', 'a', 'for', 'on', 'with', 'as', 'is', 'at', 'by', 'from', 'or', 'an', 'that', 'this']);
  const allText = trends.map(t => `${t.headline} ${t.summary}`).join(' ').toLowerCase();
  const words = allText.split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
  const freqMap = words.reduce((acc, w) => {
    acc[w] = (acc[w] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a]).slice(0, 6);
}

async function getTrendBasedJobs(trendKeywords, excludedIds) {
  try {
    if (!trendKeywords.length) return [];

    const orConditions = [];
    trendKeywords.forEach(k => {
      const regex = new RegExp(escapeRegex(k), 'i');
      orConditions.push({ title: regex });
      orConditions.push({ description: regex });
      orConditions.push({ skills: regex });
    });

    const query = {
      isActive: true,
      _id: { $nin: excludedIds || [] },
      $or: orConditions
    };

    return await Job.find(query).sort({ createdAt: -1 }).limit(5).populate('recruiterId', 'name company').lean();
  } catch (err) {
    console.error('[recommendations] Error getting trend-based jobs:', err);
    return [];
  }
}

async function getRecommendationPayload(userId) {
  try {
    console.log('[recommendations] Getting recommendation payload for user:', userId);
    
    if (!userId) {
      console.error('[recommendations] No userId provided');
      return {
        keywords: [],
        personalized: [],
        collaborative: [],
        trends: [],
        trendJobs: []
      };
    }
    
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('[recommendations] Invalid userId:', userId);
      return {
        keywords: [],
        personalized: [],
        collaborative: [],
        trends: [],
        trendJobs: []
      };
    }
    
    // Fetch fresh user data to ensure profileKeywords are up to date
    // Use lean() for performance but ensure we get the latest data
    const user = await User.findById(userId).lean();
    if (!user) {
      console.error('[recommendations] User not found:', userId);
      return {
        keywords: [],
        personalized: [],
        collaborative: [],
        trends: [],
        trendJobs: []
      };
    }

    console.log('[recommendations] User found:', {
      id: user._id,
      name: user.name,
      searchHistoryLength: user.searchHistory?.length || 0,
      profileKeywords: user.profileKeywords || [],
      profileKeywordsLength: user.profileKeywords?.length || 0
    });

    const keywords = extractUserKeywords(user);
    console.log('[recommendations] Extracted keywords:', keywords);
    console.log('[recommendations] Keywords breakdown:', {
      fromSearchHistory: user.searchHistory?.slice(-5).map(s => s.term) || [],
      fromProfileKeywords: user.profileKeywords || [],
      extracted: keywords
    });
    
    const appliedIds = await getAppliedJobIds(userId);
    console.log('[recommendations] Applied job IDs:', appliedIds.length);

    // Use Promise.allSettled to handle partial failures gracefully
    const [personalizedResult, collaborativeResult, trendsResult] = await Promise.allSettled([
      getPersonalizedJobs(keywords, appliedIds),
      getCollaborativeJobs(userId, keywords, appliedIds),
      fetchTrendInsights(keywords)
    ]);

    const personalized = personalizedResult.status === 'fulfilled' ? personalizedResult.value : [];
    const collaborative = collaborativeResult.status === 'fulfilled' ? collaborativeResult.value : [];
    const trends = trendsResult.status === 'fulfilled' ? trendsResult.value : [];

    if (personalizedResult.status === 'rejected') {
      console.error('[recommendations] Error getting personalized jobs:', personalizedResult.reason);
    }
    if (collaborativeResult.status === 'rejected') {
      console.error('[recommendations] Error getting collaborative jobs:', collaborativeResult.reason);
    }
    if (trendsResult.status === 'rejected') {
      console.error('[recommendations] Error getting trends:', trendsResult.reason);
    }

    const trendKeywords = extractTrendKeywords(trends);
    console.log('[recommendations] Extracted trend keywords from news:', trendKeywords);
    
    // Get trend-based jobs
    const trendJobsResult = await Promise.allSettled([
      getTrendBasedJobs(trendKeywords, appliedIds)
    ]);
    const trendJobs = trendJobsResult[0]?.status === 'fulfilled' ? trendJobsResult[0].value : [];

    // IMPORTANT: Merge trend keywords into personalized keywords for better matching
    // This ensures personalized suggestions also include jobs matching trend keywords
    const combinedKeywords = [...keywords];
    trendKeywords.forEach(tk => {
      const normalized = normalizeKeyword(tk);
      if (normalized && !combinedKeywords.includes(normalized)) {
        combinedKeywords.push(normalized);
      }
    });
    
    console.log('[recommendations] Combined keywords (user + trends):', combinedKeywords);
    
    // Get additional personalized jobs using trend keywords (if not already included)
    let enhancedPersonalized = [...personalized];
    if (trendKeywords.length > 0) {
      const trendPersonalizedResult = await Promise.allSettled([
        getPersonalizedJobs(trendKeywords, appliedIds)
      ]);
      const trendPersonalized = trendPersonalizedResult[0]?.status === 'fulfilled' ? trendPersonalizedResult[0].value : [];
      
      // Merge trend-based personalized jobs (avoid duplicates)
      const personalizedIds = new Set(personalized.map(j => j._id.toString()));
      trendPersonalized.forEach(job => {
        if (!personalizedIds.has(job._id.toString())) {
          enhancedPersonalized.push(job);
        }
      });
      
      console.log('[recommendations] Enhanced personalized jobs (added trend matches):', enhancedPersonalized.length);
    }

    // Debug log with detailed breakdown
    console.log('[recommendations] ========== RECOMMENDATION SUMMARY ==========');
    console.log('[recommendations] User ID:', userId);
    console.log('[recommendations] User Keywords (from search history + profile):', keywords);
    console.log('[recommendations] Trend Keywords (extracted from news):', trendKeywords);
    console.log('[recommendations] Combined Keywords (user + trends):', combinedKeywords);
    console.log('[recommendations] Applied Job IDs:', appliedIds.length);
    console.log('[recommendations] Personalized Jobs:', enhancedPersonalized.length);
    console.log('[recommendations] Collaborative Jobs:', collaborative.length);
    console.log('[recommendations] Trend News Articles:', trends.length);
    console.log('[recommendations] Trend-Based Jobs:', trendJobs.length);
    console.log('[recommendations] ============================================');

    return {
      keywords: combinedKeywords, // Return combined keywords including trends
      personalized: enhancedPersonalized || [],
      collaborative: collaborative || [],
      trends: trends || [],
      trendJobs: trendJobs || []
    };
  } catch (err) {
    console.error('[recommendations] Error in getRecommendationPayload:', err);
    // Return empty payload instead of throwing
    return {
      keywords: [],
      personalized: [],
      collaborative: [],
      trends: [],
      trendJobs: []
    };
  }
}

/**
 * Track search term(s) - Enhanced to track multiple fields
 * @param {string} userId - User ID
 * @param {string|Object} searchData - Single term string or object with {term, title, location, skills}
 */
async function trackSearchTerm(userId, searchData) {
  if (!userId) {
    console.log('[recommendations] Not tracking search term - missing userId');
    return;
  }

  let termsToTrack = [];

  // Handle both old format (string) and new format (object)
  if (typeof searchData === 'string') {
    const normalized = normalizeKeyword(searchData);
    if (normalized) {
      termsToTrack.push(normalized);
    }
  } else if (typeof searchData === 'object' && searchData !== null) {
    // New format: track all search fields separately
    if (searchData.term) {
      const normalized = normalizeKeyword(searchData.term);
      if (normalized) termsToTrack.push(normalized);
    }
    if (searchData.title) {
      const normalized = normalizeKeyword(searchData.title);
      if (normalized) termsToTrack.push(`title:${normalized}`);
    }
    if (searchData.location) {
      const normalized = normalizeKeyword(searchData.location);
      if (normalized) termsToTrack.push(`location:${normalized}`);
    }
    if (searchData.skills) {
      const normalized = normalizeKeyword(searchData.skills);
      if (normalized) termsToTrack.push(`skills:${normalized}`);
    }
  }

  if (termsToTrack.length === 0) {
    console.log('[recommendations] Not tracking - no valid search terms');
    return;
  }

  console.log('[recommendations] Tracking search terms:', termsToTrack, 'for user:', userId);
  
  try {
    // Add all terms to search history
    const searchEntries = termsToTrack.map(term => ({
      term: term,
      searchedAt: new Date()
    }));

    const result = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          searchHistory: {
            $each: searchEntries,
            $slice: -50 // Keep last 50 searches (increased to accommodate multiple fields)
          }
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log('[recommendations] Search terms tracked successfully. Total search history:', result.searchHistory?.length || 0);
    } else {
      console.error('[recommendations] Failed to track search terms - user not found');
    }
  } catch (err) {
    console.error('[recommendations] Error tracking search terms:', err);
  }
}

module.exports = {
  getRecommendationPayload,
  trackSearchTerm,
  fetchTrendInsights
};