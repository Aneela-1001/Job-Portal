/* Simple seed script to create a demo recruiter and sample jobs.
 *
 * Usage (from backend folder, with .env configured):
 *   node scripts/seedJobs.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Job = require('../models/Job');
const User = require('../models/User');

async function connect() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in .env');
  }
  await mongoose.connect(process.env.MONGO_URI);
}

async function getOrCreateDemoRecruiter() {
  let recruiter = await User.findOne({ email: 'recruiter.demo@example.com' });
  if (recruiter) return recruiter;

  recruiter = new User({
    name: 'Demo Recruiter',
    email: 'recruiter.demo@example.com',
    password: 'password123', // will be hashed by pre-save hook
    role: 'recruiter'
  });
  await recruiter.save();
  return recruiter;
}

async function seedJobs() {
  await connect();
  console.log('✅ Connected to MongoDB');

  const recruiter = await getOrCreateDemoRecruiter();
  console.log('Using recruiter:', recruiter.email, recruiter._id.toString());

  const jobs = [
    {
      title: 'React Frontend Developer',
      description: 'Build modern SPA frontends using React, hooks, and REST APIs.',
      company: 'TechCorp',
      location: 'Remote',
      salary: '$70k - $90k',
      jobType: 'Full-time',
      experience: '2-4 years',
      skills: ['react', 'javascript', 'frontend'],
      recruiterId: recruiter._id
    },
    {
      title: 'Python Data Analyst',
      description: 'Analyze business data using Python, Pandas, and SQL.',
      company: 'DataWorks',
      location: 'New York, NY',
      salary: '$75k - $95k',
      jobType: 'Full-time',
      experience: '1-3 years',
      skills: ['python', 'pandas', 'sql'],
      recruiterId: recruiter._id
    },
    {
      title: 'Cybersecurity Engineer',
      description: 'Help secure cloud infrastructure and application workloads.',
      company: 'SecureOps',
      location: 'Remote',
      salary: '$90k - $120k',
      jobType: 'Full-time',
      experience: '3-5 years',
      skills: ['security', 'networking', 'linux'],
      recruiterId: recruiter._id
    },
    {
      title: 'Machine Learning Intern',
      description: 'Support ML experiments and model training with Python.',
      company: 'AI Labs',
      location: 'San Francisco, CA',
      salary: '$25/hr',
      jobType: 'Internship',
      experience: '0-1 years',
      skills: ['python', 'machine learning', 'pytorch'],
      recruiterId: recruiter._id
    },
    {
      title: 'Node.js Backend Developer',
      description: 'Design and build REST APIs and microservices with Node.js and Express.',
      company: 'CloudScale',
      location: 'Remote',
      salary: '$85k - $110k',
      jobType: 'Full-time',
      experience: '3-5 years',
      skills: ['node.js', 'express', 'mongodb', 'api'],
      recruiterId: recruiter._id
    },
    {
      title: 'DevOps Engineer',
      description: 'Own CI/CD pipelines, container orchestration, and cloud infrastructure automation.',
      company: 'InfraFlow',
      location: 'Austin, TX',
      salary: '$95k - $130k',
      jobType: 'Full-time',
      experience: '3-6 years',
      skills: ['devops', 'docker', 'kubernetes', 'aws'],
      recruiterId: recruiter._id
    },
    {
      title: 'QA Automation Engineer',
      description: 'Build automation suites for web applications using Selenium or Cypress.',
      company: 'QualityFirst',
      location: 'Remote',
      salary: '$70k - $95k',
      jobType: 'Full-time',
      experience: '2-4 years',
      skills: ['testing', 'automation', 'selenium', 'cypress'],
      recruiterId: recruiter._id
    },
    {
      title: 'Product Manager',
      description: 'Lead cross-functional teams to ship customer-centric features.',
      company: 'Productive',
      location: 'Seattle, WA',
      salary: '$100k - $135k',
      jobType: 'Full-time',
      experience: '4-7 years',
      skills: ['product management', 'roadmaps', 'analytics'],
      recruiterId: recruiter._id
    },
    {
      title: 'Digital Marketing Specialist',
      description: 'Run growth experiments across paid channels, SEO, and email.',
      company: 'GrowthLoop',
      location: 'Remote',
      salary: '$60k - $80k',
      jobType: 'Full-time',
      experience: '2-4 years',
      skills: ['marketing', 'seo', 'google ads', 'social media'],
      recruiterId: recruiter._id
    }
  ];

  let inserted = 0;
  for (const job of jobs) {
    const result = await Job.updateOne(
      { title: job.title, company: job.company },
      { $setOnInsert: job },
      { upsert: true }
    );
    if (result.upsertedCount === 1 || (Array.isArray(result.upsertedIds) && result.upsertedIds.length)) {
      inserted += 1;
    }
  }

  console.log(`✅ Upserted demo jobs. Newly inserted: ${inserted}, total defined: ${jobs.length}.`);
}

seedJobs()
  .then(() => {
    console.log('🌱 Seeding complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  });


