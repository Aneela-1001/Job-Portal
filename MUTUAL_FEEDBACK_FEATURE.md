# Mutual Anonymous Feedback Feature

## Overview
This feature implements a mutual anonymous feedback system where recruiters and applicants must both provide feedback before application decisions (Accepted/Rejected) and reviews become visible. This ensures transparency and accountability in the recruitment process.

## Feature Requirements

### 1. Recruiter-Initiated Review (Mandatory)
- When a recruiter changes application status to **Accepted** or **Rejected**, they must submit anonymous feedback first
- The feedback form is shown as a modal before status change is finalized
- Application result remains locked for the applicant until both parties submit feedback

### 2. Locked Notification for Applicant
- After recruiter submits feedback, applicant receives notification
- Application decision and recruiter review remain hidden (locked)
- Applicant sees a "Status Locked" message with option to submit feedback

### 3. Applicant Feedback to Unlock Status
- Applicant must submit anonymous feedback to unlock the application status
- After submission, applicant can view:
  - Application decision (Accepted / Rejected)
  - Recruiter's anonymous review

### 4. Feedback Visibility
- Recruiters receive notification when applicant feedback is submitted
- Both parties can view each other's feedback anonymously
- No personal identities are revealed

## Technical Implementation

### Backend

#### Models

**Feedback Model** (`backend/models/Feedback.js`):
```javascript
{
  applicationId: ObjectId (ref: Application),
  feedbackType: 'recruiter' | 'applicant',
  ratings: {
    // Recruiter ratings
    communicationSkills: Number (1-5),
    technicalCompetency: Number (1-5),
    interviewPreparedness: Number (1-5),
    professionalBehavior: Number (1-5),
    overallSuitability: Number (1-5),
    
    // Applicant ratings
    jobInfoClarity: Number (1-5),
    recruiterCommunication: Number (1-5),
    interviewOrganization: Number (1-5),
    processProfessionalism: Number (1-5),
    overallExperience: Number (1-5)
  },
  strengths: String, // Recruiter: applicant strengths
  improvements: String, // Recruiter: areas to improve
  whatWorkedWell: String, // Applicant: process strengths
  whatCouldImprove: String, // Applicant: process improvements
  isAnonymous: Boolean (always true),
  submittedAt: Date
}
```

**Application Model Updates** (`backend/models/Application.js`):
- Added `recruiterFeedbackSubmitted: Boolean`
- Added `applicantFeedbackSubmitted: Boolean`
- Added `isStatusLocked: Boolean`

#### API Endpoints

**Location**: `backend/routes/jobs.js`

1. **POST `/api/jobs/application/:id/recruiter-feedback`** (Lines 1115-1205)
   - Requires recruiter authentication
   - Validates all rating fields (1-5 scale)
   - Creates or updates recruiter feedback
   - Marks `recruiterFeedbackSubmitted` as true

2. **POST `/api/jobs/application/:id/applicant-feedback`** (Lines 1207-1320)
   - Requires applicant authentication
   - Validates applicant owns the application
   - Only works for Accepted/Rejected status
   - Creates or updates applicant feedback
   - Unlocks application status (`isStatusLocked = false`)
   - Sends notification to recruiter

3. **GET `/api/jobs/application/:id/feedback`** (Lines 1322-1410)
   - Returns feedback only if status is unlocked
   - Returns anonymous feedback (no personal identifiers)
   - Accessible by both recruiter and applicant

4. **GET `/api/jobs/application/:id/feedback-status`** (Lines 1412-1460)
   - Returns feedback submission status
   - Shows if status is locked
   - Indicates if feedback can be viewed

5. **PUT `/api/jobs/application/:id/status`** (Modified, Lines 586-651)
   - For Accepted/Rejected status, requires feedback to be submitted first
   - Returns error if feedback not submitted
   - Locks status if applicant feedback not submitted

### Frontend

#### Components

1. **RecruiterFeedbackForm.js** (`frontend/src/components/RecruiterFeedbackForm.js`)
   - Modal form for recruiters to submit feedback
   - Star rating system (1-5) for all required fields
   - Optional text fields for strengths and improvements
   - Validates all ratings before submission

2. **ApplicantFeedbackForm.js** (`frontend/src/components/ApplicantFeedbackForm.js`)
   - Modal form for applicants to submit feedback
   - Star rating system (1-5) for recruitment process
   - Optional text fields for what worked well and improvements
   - Shows unlock message

3. **JobApplications.js** (Updated)
   - Integrated feedback form modal
   - Shows feedback form when changing status to Accepted/Rejected
   - Handles feedback submission flow

4. **MyApplications.js** (Updated)
   - Shows locked status indicator for Accepted/Rejected applications
   - Displays feedback form button when status is locked
   - Shows recruiter feedback when unlocked
   - Fetches and displays feedback status

#### API Methods

**Location**: `frontend/src/api.js` (Lines 97-101)

- `submitRecruiterFeedback(applicationId, feedbackData)`
- `submitApplicantFeedback(applicationId, feedbackData)`
- `getApplicationFeedback(applicationId)`
- `getFeedbackStatus(applicationId)`

#### Styles

**FeedbackForm.css** (`frontend/src/styles/FeedbackForm.css`)
- Modal overlay and form styling
- Star rating component styles
- Locked status indicator styles
- Feedback display styles

## Code Locations

### Backend

| Component | File | Line Numbers |
|-----------|------|--------------|
| Feedback Model | `backend/models/Feedback.js` | All lines |
| Application Model Updates | `backend/models/Application.js` | Lines 12-15 |
| Recruiter Feedback Endpoint | `backend/routes/jobs.js` | 1115-1205 |
| Applicant Feedback Endpoint | `backend/routes/jobs.js` | 1207-1320 |
| Get Feedback Endpoint | `backend/routes/jobs.js` | 1322-1410 |
| Feedback Status Endpoint | `backend/routes/jobs.js` | 1412-1460 |
| Status Update (Modified) | `backend/routes/jobs.js` | 586-651 |
| Notification Model Update | `backend/models/Notification.js` | Lines 19-20 |

### Frontend

| Component | File | Line Numbers |
|-----------|------|--------------|
| Recruiter Feedback Form | `frontend/src/components/RecruiterFeedbackForm.js` | All lines |
| Applicant Feedback Form | `frontend/src/components/ApplicantFeedbackForm.js` | All lines |
| JobApplications Updates | `frontend/src/components/JobApplications.js` | Lines 4, 18-20, 71-95, 470-479 |
| MyApplications Updates | `frontend/src/components/MyApplications.js` | Lines 4-5, 11-13, 16-75, 219-320, 245-250 |
| API Methods | `frontend/src/api.js` | Lines 97-101 |
| Feedback Styles | `frontend/src/styles/FeedbackForm.css` | All lines |

## Workflow

### Recruiter Workflow

1. Recruiter views applications for a job
2. Recruiter selects "Accept" or "Reject" from status dropdown
3. **Feedback form modal appears** (required)
4. Recruiter fills in:
   - All 5 ratings (1-5 stars each)
   - Optional: Strengths and improvements text
5. Recruiter submits feedback
6. Status is updated to Accepted/Rejected
7. Application status is **locked** for applicant
8. Applicant receives notification

### Applicant Workflow

1. Applicant receives notification about application update
2. Applicant views "My Applications"
3. Sees **"Status Locked"** indicator for Accepted/Rejected applications
4. Clicks "Submit Feedback" button
5. **Feedback form modal appears**
6. Applicant fills in:
   - All 5 ratings (1-5 stars each) about recruitment process
   - Optional: What worked well and improvements text
7. Applicant submits feedback
8. Application status is **unlocked**
9. Applicant can now view:
   - Application decision (Accepted/Rejected)
   - Recruiter's anonymous review with ratings and comments
10. Recruiter receives notification about applicant feedback

## Feedback Questions

### Recruiter Feedback (About Applicant)

**Required Ratings (1-5 scale)**:
- Communication Skills
- Technical/Role-Related Competency
- Interview Preparedness
- Professional Behavior
- Overall Suitability for the Role

**Optional Text**:
- What were the applicant's strengths?
- What areas could the applicant improve?

### Applicant Feedback (About Recruitment Process)

**Required Ratings (1-5 scale)**:
- Clarity of Job Information
- Communication from Recruiter/Company
- Interview Organization and Scheduling
- Professionalism of Recruitment Process
- Overall Recruitment Experience

**Optional Text**:
- What aspects of the recruitment process worked well?
- What could be improved in the recruitment process?

## Privacy & Anonymity

- All feedback is stored as anonymous
- No names, emails, or personal identifiers are displayed
- Feedback is linked only to the application record
- Both parties see feedback only after both have submitted
- Feedback cannot be traced back to specific individuals

## Security

- Recruiters can only submit feedback for applications they have access to
- Applicants can only submit feedback for their own applications
- Feedback can only be viewed when status is unlocked
- Access validation matches application access control logic
- All feedback submissions are validated server-side

## Notifications

- **Applicant Notification**: When recruiter submits feedback and changes status
  - Type: `application_accepted` or `application_rejected`
  - Message indicates feedback is required to view decision

- **Recruiter Notification**: When applicant submits feedback
  - Type: `info`
  - Title: "📝 Applicant Feedback Received"
  - Message: "An applicant has submitted feedback for the position: [Job Title]"

## Future Enhancements

- Analytics dashboard for feedback trends
- Export feedback data for analysis
- Feedback templates for different job types
- Automated reminders for pending feedback
- Feedback quality scoring
- Integration with performance metrics

