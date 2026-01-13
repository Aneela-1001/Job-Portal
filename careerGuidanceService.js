const axios = require('axios');

/**
 * Career Guidance Service
 * Uses OpenAI API to analyze quiz responses and generate career recommendations
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate career recommendations using OpenAI API
 * @param {Array} quizAnswers - Array of question-answer pairs from the quiz
 * @returns {Promise<Array>} Array of career recommendations with titles and descriptions
 */
async function generateCareerRecommendations(quizAnswers) {
  try {
    if (!OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI API key not configured. Using fallback recommendations.');
      return getFallbackRecommendations(quizAnswers);
    }

    // Structure the prompt for OpenAI
    const prompt = buildCareerAnalysisPrompt(quizAnswers);

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a career guidance counselor. Analyze quiz responses and provide career recommendations in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    
    // Parse JSON response from OpenAI
    let recommendations;
    try {
      // Try to extract JSON from the response (in case it's wrapped in markdown)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        recommendations = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      return getFallbackRecommendations(quizAnswers);
    }

    // Validate and format recommendations
    if (!Array.isArray(recommendations)) {
      recommendations = [recommendations];
    }

    // Ensure each recommendation has required fields with backward compatibility
    return recommendations.slice(0, 5).map(rec => {
      const baseRec = {
        title: rec.title || rec.career || 'Career Path',
        description: rec.description || rec.explanation || 'This career path aligns with your interests and skills.',
        reason: rec.reason || rec.description || ''
      };
      
      // Add new fields if present, otherwise use defaults
      if (rec.explanation) {
        baseRec.explanation = rec.explanation;
      }
      
      if (rec.skills && Array.isArray(rec.skills)) {
        // Skills are now simple strings, no market alignment
        baseRec.skills = rec.skills.map(skill => {
          return typeof skill === 'string' ? skill : (skill.name || skill);
        });
      }
      
      if (rec.jobSuggestions && Array.isArray(rec.jobSuggestions)) {
        baseRec.jobSuggestions = rec.jobSuggestions.map(job => {
          // Ensure matchPercentage exists, generate if missing
          if (typeof job === 'object' && !job.matchPercentage) {
            job.matchPercentage = Math.floor(Math.random() * 30) + 60; // Default 60-90%
          }
          return job;
        });
      }
      
      return baseRec;
    });

  } catch (error) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    // Return fallback recommendations if API fails
    return getFallbackRecommendations(quizAnswers);
  }
}

/**
 * Build a structured prompt for OpenAI based on quiz answers
 * @param {Array} quizAnswers - Array of {questionId, answer} objects
 * @returns {string} Formatted prompt string
 */
function buildCareerAnalysisPrompt(quizAnswers) {
  const answersText = quizAnswers.map((qa, index) => {
    return `Question ${index + 1}: ${qa.question}\nAnswer: ${qa.answer}`;
  }).join('\n\n');

  return `Analyze the following career quiz responses and provide 3-5 career path recommendations in JSON format.

Quiz Responses:
${answersText}

Please provide your response as a JSON array of objects, where each object has:
- "title": The career path title (e.g., "Software Developer", "Data Analyst")
- "description": A brief explanation of why this career matches the user's profile (2-3 sentences)
- "reason": Additional context about the match (optional)
- "explanation": A clear, concise explanation (2-3 sentences) stating why this career matches the user's interests, skills, and preferences based on their quiz answers
- "skills": An array of 4-6 relevant skills for this career as simple strings (e.g., ["JavaScript", "Data Analysis", "Project Management"])
- "jobSuggestions": An optional array of 2-3 sample job titles with:
  - "title": Job title
  - "company": Example company name
  - "location": Example location
  - "matchPercentage": A number between 0-100 representing how well the user's quiz profile aligns with this specific job role

Example format:
[
  {
    "title": "Software Developer",
    "description": "Based on your technical interests and problem-solving preferences, software development offers opportunities to build innovative solutions and work in collaborative teams.",
    "reason": "Matches your interest in technology and creative problem-solving",
    "explanation": "Your quiz responses indicate strong technical aptitude and preference for problem-solving through code. This career aligns with your interest in building innovative solutions and working in dynamic, collaborative environments.",
    "skills": ["JavaScript", "React", "Node.js", "Git"],
    "jobSuggestions": [
      {"title": "Frontend Developer", "company": "Tech Corp", "location": "Remote", "matchPercentage": 85},
      {"title": "Full Stack Developer", "company": "StartupXYZ", "location": "San Francisco, CA", "matchPercentage": 78}
    ]
  }
]

Return only valid JSON, no additional text.`;
}

/**
 * Fallback recommendations when OpenAI API is not available
 * @param {Array} quizAnswers - Quiz answers for basic matching
 * @returns {Array} Basic career recommendations
 */
function getFallbackRecommendations(quizAnswers) {
  // Simple keyword-based matching
  const answersText = quizAnswers.map(qa => qa.answer).join(' ').toLowerCase();
  
  const recommendations = [];

  if (answersText.includes('technical') || answersText.includes('coding') || answersText.includes('programming')) {
    recommendations.push({
      title: 'Software Developer',
      description: 'Based on your technical interests, software development offers opportunities to build innovative solutions and work with cutting-edge technologies.',
      reason: 'Matches your technical and problem-solving interests',
      explanation: 'Your quiz responses show strong technical aptitude and preference for problem-solving through code. This career path aligns with your interest in building innovative solutions and working in dynamic, collaborative environments.',
      skills: ['JavaScript', 'Python', 'React', 'Node.js', 'Git'],
      jobSuggestions: [
        { title: 'Frontend Developer', company: 'Tech Innovations Inc', location: 'Remote', matchPercentage: 85 },
        { title: 'Full Stack Developer', company: 'StartupHub', location: 'San Francisco, CA', matchPercentage: 78 },
        { title: 'Software Engineer', company: 'Digital Solutions', location: 'New York, NY', matchPercentage: 82 }
      ]
    });
  }

  if (answersText.includes('data') || answersText.includes('analysis') || answersText.includes('analytics')) {
    recommendations.push({
      title: 'Data Analyst',
      description: 'Your interest in analysis and data-driven decision making aligns well with a career in data analytics.',
      reason: 'Matches your analytical thinking and data interests',
      explanation: 'Your responses indicate strong analytical thinking and interest in data-driven insights. This career path matches your preference for research, analysis, and making informed decisions based on data.',
      skills: ['SQL', 'Python', 'Excel', 'Data Visualization', 'Statistics'],
      jobSuggestions: [
        { title: 'Business Data Analyst', company: 'Analytics Corp', location: 'Chicago, IL', matchPercentage: 88 },
        { title: 'Data Insights Specialist', company: 'DataTech Solutions', location: 'Remote', matchPercentage: 80 }
      ]
    });
  }

  if (answersText.includes('design') || answersText.includes('creative') || answersText.includes('visual')) {
    recommendations.push({
      title: 'UX/UI Designer',
      description: 'Your creative interests and focus on user experience make UX/UI design a great fit for your skills.',
      reason: 'Matches your creative and user-focused interests',
      explanation: 'Your quiz answers show strong creative thinking and focus on user experience. This career aligns with your interest in visual design, user-centered problem solving, and creating intuitive interfaces.',
      skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Adobe XD'],
      jobSuggestions: [
        { title: 'UX Designer', company: 'Creative Agency', location: 'Los Angeles, CA', matchPercentage: 82 },
        { title: 'UI/UX Designer', company: 'Product Studio', location: 'Remote', matchPercentage: 75 }
      ]
    });
  }

  if (answersText.includes('business') || answersText.includes('management') || answersText.includes('leadership')) {
    recommendations.push({
      title: 'Business Analyst',
      description: 'Your interest in business processes and problem-solving aligns with a career in business analysis.',
      reason: 'Matches your business and analytical interests',
      explanation: 'Your responses indicate strong business acumen and problem-solving skills. This career path matches your interest in improving business processes, strategic planning, and working with cross-functional teams.',
      skills: ['Business Analysis', 'Project Management', 'Requirements Gathering', 'Process Improvement', 'Stakeholder Management'],
      jobSuggestions: [
        { title: 'Business Analyst', company: 'Enterprise Solutions', location: 'Boston, MA', matchPercentage: 80 },
        { title: 'Senior Business Analyst', company: 'Consulting Group', location: 'Remote', matchPercentage: 85 }
      ]
    });
  }

  if (answersText.includes('marketing') || answersText.includes('communication') || answersText.includes('social')) {
    recommendations.push({
      title: 'Digital Marketing Specialist',
      description: 'Your communication skills and interest in marketing make digital marketing a suitable career path.',
      reason: 'Matches your communication and marketing interests',
      explanation: 'Your quiz responses show strong communication skills and interest in marketing strategies. This career aligns with your preference for creative campaigns, social media engagement, and data-driven marketing decisions.',
      skills: ['SEO/SEM', 'Social Media Marketing', 'Content Marketing', 'Google Analytics', 'Email Marketing'],
      jobSuggestions: [
        { title: 'Digital Marketing Manager', company: 'Marketing Agency', location: 'Austin, TX', matchPercentage: 85 },
        { title: 'Social Media Specialist', company: 'Brand Studio', location: 'Remote', matchPercentage: 88 }
      ]
    });
  }

  // Default recommendations if no matches
  if (recommendations.length === 0) {
    recommendations.push(
      {
        title: 'General Professional',
        description: 'Based on your responses, a general professional role that allows you to explore different interests would be a good starting point.',
        reason: 'Flexible career path to explore your interests',
        explanation: 'Your diverse interests and skills suggest a flexible career path would be ideal. This allows you to explore different areas and find your true passion while building valuable experience.',
        skills: ['Communication', 'Problem Solving', 'Adaptability', 'Teamwork'],
        jobSuggestions: [
          { title: 'Project Coordinator', company: 'Various Companies', location: 'Multiple Locations', matchPercentage: 75 }
        ]
      },
      {
        title: 'Project Coordinator',
        description: 'Your organizational and communication skills align well with project coordination roles.',
        reason: 'Matches your organizational skills',
        explanation: 'Your quiz responses indicate strong organizational and communication abilities. This career path matches your preference for structured work, team collaboration, and managing multiple tasks effectively.',
        skills: ['Project Management', 'Organization', 'Communication', 'Time Management'],
        jobSuggestions: [
          { title: 'Project Coordinator', company: 'Project Solutions Inc', location: 'Remote', matchPercentage: 85 },
          { title: 'Program Coordinator', company: 'Management Group', location: 'Washington, DC', matchPercentage: 88 }
        ]
      }
    );
  }

  return recommendations.slice(0, 5);
}

/**
 * Fetch job listings from a job search API (optional)
 * This is a placeholder - you can integrate Careerjet, RapidAPI, or another job listing API
 * @param {Array} careerTitles - Array of career path titles
 * @returns {Promise<Array>} Array of job listings
 */
async function fetchJobListings(careerTitles) {
  try {
    // Placeholder for job listing API integration
    // You can integrate Careerjet API, RapidAPI job listings, or another service here
    
    // Example structure for job listings:
    const jobListings = [];
    
    // For now, return empty array - implement actual API integration as needed
    // Example integration with RapidAPI or Careerjet would go here
    
    return jobListings;
  } catch (error) {
    console.error('Error fetching job listings:', error.message);
    return [];
  }
}

module.exports = {
  generateCareerRecommendations,
  fetchJobListings
};

