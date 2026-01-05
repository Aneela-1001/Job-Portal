# Candidate Comparison Feature

## Overview
This feature enables recruiters to compare up to 4 candidates simultaneously in a structured, side-by-side view to support informed hiring decisions.

## Features Implemented

### 1. Candidate Selection
- Recruiters can select up to 4 candidates from the applicant list
- Selection is done via checkboxes on each application card
- Selected candidates are visually highlighted
- "Select All" and "Clear" buttons for easy management

### 2. Comparison Dashboard
- Side-by-side table layout showing all candidates in columns
- Each candidate column displays:
  - **Core Skills**: Matched vs required skills with visual indicators
  - **Years of Experience**: Extracted from application data
  - **Education Level**: Determined from achievements (PhD, Master's, Bachelor's, etc.)
  - **Relevant Certifications**: Public certifications from achievements
  - **Compatibility Score**: Overall percentage rating

### 3. Compatibility Score Calculation
The compatibility score is calculated using a weighted algorithm:
- **Skill Match (50%)**: Percentage of required skills that match candidate skills
- **Experience Relevance (30%)**: How well candidate's experience matches job requirements
- **Past Role Similarity (20%)**: Based on skill overlap with job requirements

#### Code Implementation

**Location**: `backend/routes/jobs.js` (Lines 730-806)

**Helper Functions**:

1. **Skill Match Calculation** (Lines 730-751):
```javascript
const calculateSkillMatch = (candidateSkills, requiredSkills) => {
  if (!requiredSkills || requiredSkills.length === 0) return 100;
  if (!candidateSkills || candidateSkills.length === 0) return 0;
  
  const candidateSkillsLower = candidateSkills.map(s => s.toLowerCase().trim());
  const requiredSkillsLower = requiredSkills.map(s => s.toLowerCase().trim());
  
  const matchedSkills = requiredSkillsLower.filter(reqSkill => 
    candidateSkillsLower.some(candSkill => 
      candSkill.includes(reqSkill) || reqSkill.includes(candSkill)
    )
  );
  
  return Math.round((matchedSkills.length / requiredSkillsLower.length) * 100);
};
```

2. **Experience Extraction** (Lines 753-758):
```javascript
const extractYearsFromExperience = (experienceStr) => {
  if (!experienceStr) return 0;
  const match = experienceStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
};
```

3. **Job Experience Parsing** (Lines 760-777):
```javascript
const parseJobExperience = (experienceStr) => {
  if (!experienceStr) return { min: 0, max: Infinity };
  const match = experienceStr.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  const singleMatch = experienceStr.match(/(\d+)\+/);
  if (singleMatch) {
    return { min: parseInt(singleMatch[1]), max: Infinity };
  }
  const numMatch = experienceStr.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    return { min: num, max: num };
  }
  return { min: 0, max: Infinity };
};
```

4. **Experience Relevance Score** (Lines 779-793):
```javascript
const calculateExperienceRelevance = (candidateExp, jobExp) => {
  const candidateYears = extractYearsFromExperience(candidateExp);
  const jobReq = parseJobExperience(jobExp);
  
  if (candidateYears >= jobReq.min && candidateYears <= jobReq.max) {
    return 100;
  } else if (candidateYears < jobReq.min) {
    const deficit = jobReq.min - candidateYears;
    return Math.max(0, 100 - (deficit * 15)); // -15% per year deficit
  } else {
    // Overqualified - still good but slightly less
    return Math.max(80, 100 - ((candidateYears - jobReq.max) * 5)); // -5% per year over
  }
};
```

5. **Past Role Similarity** (Lines 795-799):
```javascript
const calculatePastRoleSimilarity = (candidateSkills, jobSkills) => {
  if (!jobSkills || jobSkills.length === 0) return 50; // Neutral if no job skills specified
  return calculateSkillMatch(candidateSkills, jobSkills);
};
```

6. **Overall Compatibility Score** (Lines 801-806):
```javascript
const calculateCompatibilityScore = (skillMatch, experienceRelevance, pastRoleSimilarity) => {
  // Weighted average: 50% skills, 30% experience, 20% past role similarity
  const weightedScore = (skillMatch * 0.5) + (experienceRelevance * 0.3) + (pastRoleSimilarity * 0.2);
  return Math.round(weightedScore);
};
```

**Usage in Comparison Endpoint** (Lines 808-986):
The compatibility score is calculated for each candidate in the `POST /api/jobs/:id/compare-candidates` endpoint:
```javascript
// Calculate metrics
const skillMatch = calculateSkillMatch(allCandidateSkills, job.skills || []);
const experienceRelevance = calculateExperienceRelevance(application.experience, job.experience);
const pastRoleSimilarity = calculatePastRoleSimilarity(allCandidateSkills, job.skills || []);
const compatibilityScore = calculateCompatibilityScore(skillMatch, experienceRelevance, pastRoleSimilarity);
```

### 4. Comparison Features
- **Sort Options**: Sort by compatibility score, name, or experience
- **Best Match Highlighting**: Option to highlight the best-matched candidate
- **Remove Candidates**: Remove candidates from comparison (minimum 1 required)
- **Replace Candidates**: Navigate back to applications to replace a candidate

### 5. Additional Information Displayed
- Application status
- Applied date
- Contact information (phone, email)
- Bio (if available)
- Resume link
- Skill breakdown (matched, unmatched, all skills)

## Technical Implementation

### Backend

**Main Endpoint**: `POST /api/jobs/:id/compare-candidates`
- **Location**: `backend/routes/jobs.js` (Lines 808-986)
- **Features**:
  - Validates recruiter access to job (Lines 827-845)
  - Fetches application and applicant data (Lines 847-860)
  - Retrieves achievements (certifications and education) (Lines 862-873)
  - Calculates compatibility scores using helper functions (Lines 900-905)
  - Returns structured comparison data (Lines 970-980)

**Resume Serving Endpoint**: `GET /api/jobs/application/:applicationId/resume`
- **Location**: `backend/routes/jobs.js` (Lines 988-1087)
- **Features**:
  - Authenticates recruiter access
  - Serves resume files securely
  - Handles both `resumeId.fileUrl` and `application.resume` paths
  - Includes security checks to prevent path traversal

### Frontend Components

1. **CandidateComparison.js** (`frontend/src/components/CandidateComparison.js`)
   - Main comparison view component
   - Displays side-by-side comparison table
   - Handles sorting and filtering (Lines 70-79)
   - Renders compatibility scores with color coding (Lines 88-92, 250-265)
   - Uses authenticated resume route (Line 395)

2. **JobApplications.js** (`frontend/src/components/JobApplications.js`)
   - Updated with candidate selection UI
   - Checkbox selection for up to 4 candidates (Lines 113-127)
   - "Compare Selected" button (Lines 129-141)
   - Selection state management (Line 16)

3. **CandidateComparison.css** (`frontend/src/styles/CandidateComparison.css`)
   - Styling for comparison table
   - Responsive design for mobile devices
   - Color-coded score indicators

4. **Applications.css** (`frontend/src/styles/Applications.css`)
   - Updated with selection UI styles
   - Checkbox styling and selected state highlighting

### API Integration

**API Methods** (`frontend/src/api.js`):
- `compareCandidates(jobId, candidateIds)` - Line 92-93
- `getApplicationResume(applicationId)` - Line 94-95 (for resume serving)

**Routes** (`frontend/src/App.js`):
- `/job/:jobId/compare` - Line 297-303 (comparison view)
- `/job/:jobId/applications` - Line 290-296 (applications list with selection)

## Usage Flow

1. Recruiter navigates to job applications page
2. Selects up to 4 candidates using checkboxes
3. Clicks "Compare Selected" button
4. Views side-by-side comparison with all metrics
5. Can sort, highlight best match, remove, or replace candidates
6. Makes informed hiring decision based on comparison data

## Future Expansion Support

The design supports future enhancements:
- **AI-based insights**: The compatibility score calculation can be enhanced with ML models
- **Additional metrics**: Easy to add new comparison rows
- **Export functionality**: Comparison data structure supports export
- **Notes/Annotations**: Can be added per candidate
- **Interview scheduling**: Can integrate with scheduling features

## Data Sources

**Code Location**: `backend/routes/jobs.js` (Lines 875-920)

- **Skills**: Combined from User profile and Application (Lines 900-904)
  ```javascript
  const allCandidateSkills = [
    ...(applicant.skills || []),
    ...(application.skills || [])
  ].filter((skill, index, self) => 
    self.findIndex(s => s.toLowerCase().trim() === skill.toLowerCase().trim()) === index
  );
  ```

- **Experience**: Extracted from Application.experience field (Line 941)
  ```javascript
  yearsOfExperience: extractYearsFromExperience(application.experience),
  experienceString: application.experience || 'Not specified',
  ```

- **Education**: From Achievement model (category: 'education') (Lines 862-869, 950-955)
  ```javascript
  const achievements = await Achievement.find({
    userId: { $in: applicantIds },
    category: { $in: ['certification', 'education'] },
    visibility: 'public'
  }).sort({ dateAchieved: -1 });
  ```

- **Certifications**: From Achievement model (category: 'certification', visibility: 'public') (Lines 944-949)
  ```javascript
  const certifications = applicantAchievements.filter(a => a.category === 'certification');
  ```

- **Education Level Determination** (Lines 907-920):
  ```javascript
  let educationLevel = 'Not specified';
  if (education.length > 0) {
    const educationTitles = education.map(e => e.title.toLowerCase());
    if (educationTitles.some(t => t.includes('phd') || t.includes('doctorate'))) {
      educationLevel = 'PhD/Doctorate';
    } else if (educationTitles.some(t => t.includes('master') || t.includes('ms') || t.includes('mba'))) {
      educationLevel = 'Master\'s';
    } else if (educationTitles.some(t => t.includes('bachelor') || t.includes('bs') || t.includes('ba'))) {
      educationLevel = 'Bachelor\'s';
    } else if (educationTitles.some(t => t.includes('associate') || t.includes('diploma'))) {
      educationLevel = 'Associate/Diploma';
    } else {
      educationLevel = 'Other';
    }
  }
  ```

## Security

**Access Control** (`backend/routes/jobs.js` Lines 827-845):
- Only recruiters with access to the job can view comparisons
- Access validation matches the same logic as viewing applications
- Supports company-based and recruiter-based access control

**Access Validation Code**:
```javascript
let hasAccess = false;
if (job.recruiterId.toString() === req.user.id) {
  hasAccess = true;
} else if (recruiter.companyId && job.companyId && recruiter.companyId.toString() === job.companyId.toString()) {
  hasAccess = true;
} else if (job.companyId) {
  const company = await Company.findById(job.companyId);
  if (company && company.recruiterId.toString() === req.user.id) {
    hasAccess = true;
  }
}
```

**Resume File Security** (`backend/routes/jobs.js` Lines 1038-1050):
- Path traversal protection
- File existence verification
- Secure file serving with proper error handling

## Code Structure Summary

### Backend Files Modified/Created:
1. **`backend/routes/jobs.js`**
   - Lines 730-806: Compatibility score calculation helper functions
   - Lines 808-986: Main comparison endpoint (`POST /api/jobs/:id/compare-candidates`)
   - Lines 988-1087: Resume serving endpoint (`GET /api/jobs/application/:applicationId/resume`)

### Frontend Files Modified/Created:
1. **`frontend/src/components/CandidateComparison.js`**: Main comparison component
2. **`frontend/src/components/JobApplications.js`**: Added selection UI
3. **`frontend/src/styles/CandidateComparison.css`**: Comparison table styles
4. **`frontend/src/styles/Applications.css`**: Selection UI styles
5. **`frontend/src/api.js`**: Added `compareCandidates` and `getApplicationResume` methods
6. **`frontend/src/App.js`**: Added comparison route

### Key Algorithm Details:

**Compatibility Score Formula**:
```
Compatibility Score = (SkillMatch × 0.5) + (ExperienceRelevance × 0.3) + (PastRoleSimilarity × 0.2)
```

**Experience Relevance Scoring**:
- Perfect match (within range): 100%
- Underqualified: 100% - (deficit years × 15%)
- Overqualified: max(80%, 100% - (excess years × 5%))

**Skill Matching**:
- Case-insensitive matching
- Partial string matching (includes check)
- Returns percentage of required skills matched

## Quick Reference: Code Locations with Line Numbers

### Backend Code (`backend/routes/jobs.js`)

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| **Skill Match Calculation** | 730-751 | `calculateSkillMatch()` function |
| **Experience Extraction** | 753-758 | `extractYearsFromExperience()` function |
| **Job Experience Parsing** | 760-777 | `parseJobExperience()` function |
| **Experience Relevance** | 779-793 | `calculateExperienceRelevance()` function |
| **Past Role Similarity** | 795-799 | `calculatePastRoleSimilarity()` function |
| **Compatibility Score** | 801-806 | `calculateCompatibilityScore()` function |
| **Comparison Endpoint** | 808-986 | `POST /api/jobs/:id/compare-candidates` route handler |
| - Access Validation | 827-845 | Recruiter access check |
| - Fetch Applications | 847-860 | Query applications and populate data |
| - Fetch Achievements | 862-873 | Get certifications and education |
| - Build Comparison Data | 875-965 | Calculate scores and build response |
| - Skill Combination | 900-904 | Merge user and application skills |
| - Education Level Logic | 907-920 | Determine education level from achievements |
| - Score Calculation | 922-925 | Calculate all metrics for each candidate |
| - Return Response | 970-980 | Send comparison data to frontend |
| **Resume Serving Endpoint** | 988-1087 | `GET /api/jobs/application/:applicationId/resume` route |
| - Access Validation | 1006-1024 | Verify recruiter access |
| - Path Resolution | 1026-1032 | Get resume path from resumeId or application |
| - Security Checks | 1038-1050 | Path traversal protection and file validation |
| - File Serving | 1052-1062 | Send file with error handling |

### Frontend Code

#### `frontend/src/components/CandidateComparison.js`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| State Management | 12-18 | Component state (candidates, job, loading, etc.) |
| Fetch Comparison Data | 30-42 | API call to get comparison data |
| Remove Candidate | 52-59 | Handle removing candidate from comparison |
| Replace Candidate | 61-68 | Navigate to replace a candidate |
| Sort Candidates | 70-79 | Sorting logic (compatibility, name, experience) |
| Best Match Detection | 82-86 | Find candidate with highest compatibility score |
| File URL Helper | 88-92 | Construct resume file URL |
| Score Color Helper | 94-98 | Get color based on compatibility score |
| Resume Link | 392-403 | Render resume link with authenticated route |

#### `frontend/src/components/JobApplications.js`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| Selection State | 16 | `selectedCandidates` state (Set) |
| Toggle Selection | 113-127 | Handle checkbox selection |
| Compare Selected | 129-141 | Navigate to comparison view |
| Select All | 143-149 | Select up to 4 candidates |
| Clear Selection | 151-153 | Clear all selections |
| Selection Checkbox | 250-252 | Checkbox input in application card |
| Resume Link | 198-210 | Resume link using authenticated route |

#### `frontend/src/api.js`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| Compare Candidates API | 92-93 | `compareCandidates(jobId, candidateIds)` method |
| Get Application Resume | 94-95 | `getApplicationResume(applicationId)` method |

#### `frontend/src/App.js`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| Comparison Route | 297-303 | Route definition for `/job/:jobId/compare` |
| Applications Route | 290-296 | Route definition for `/job/:jobId/applications` |

### Styles

#### `frontend/src/styles/CandidateComparison.css`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| Container Styles | 1-4 | Main container styling |
| Table Styles | 100-150 | Comparison table layout |
| Score Circle | 200-210 | Compatibility score display |
| Skills Tags | 220-240 | Skill tag styling (matched/unmatched) |
| Responsive Design | 400-420 | Mobile breakpoints |

#### `frontend/src/styles/Applications.css`

| Component | Line Numbers | Description |
|-----------|-------------|-------------|
| Selection Controls | 120-180 | Comparison controls bar styling |
| Checkbox Styling | 200-220 | Candidate selection checkbox |
| Selected State | 130-135 | Highlighted selected cards |

### Models Referenced

| Model | File Location | Usage |
|-------|--------------|-------|
| **Application** | `backend/models/Application.js` | Stores application data, skills, experience, resume |
| **User** | `backend/models/User.js` | Stores applicant profile, skills, bio |
| **Job** | `backend/models/Job.js` | Stores job requirements (skills, experience) |
| **Achievement** | `backend/models/Achievement.js` | Stores certifications and education |
| **Resume** | `backend/models/Resume.js` | Stores uploaded resume file references |

## File Structure

```
CSE471JOBPortal_M3/
├── backend/
│   ├── routes/
│   │   └── jobs.js                    # Main comparison logic (Lines 730-1087)
│   └── models/
│       ├── Application.js             # Application schema
│       ├── User.js                    # User/Applicant schema
│       ├── Job.js                     # Job schema
│       ├── Achievement.js             # Achievement schema
│       └── Resume.js                  # Resume schema
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── CandidateComparison.js # Comparison view (All lines)
    │   │   └── JobApplications.js      # Applications list with selection
    │   ├── styles/
    │   │   ├── CandidateComparison.css # Comparison styles
    │   │   └── Applications.css        # Selection UI styles
    │   ├── api.js                      # API methods (Lines 92-95)
    │   └── App.js                      # Routes (Lines 290-303)
    └── ...
```

