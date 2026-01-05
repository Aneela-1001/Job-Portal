# Free Deployment Guide - JobPortal

This guide covers free deployment options for the JobPortal application. We'll deploy the frontend, backend, and database separately using free hosting services.

## 🎯 Deployment Architecture

```
Frontend (React) → Vercel/Netlify (Free)
Backend (Node.js) → Render/Railway (Free)
Database → MongoDB Atlas (Free)
File Storage → Cloudinary (Free) or Backend storage
```

## 📋 Prerequisites

1. GitHub account (for code hosting)
2. Accounts for:
   - [Vercel](https://vercel.com) or [Netlify](https://netlify.com) (Frontend)
   - [Render](https://render.com) or [Railway](https://railway.app) (Backend)
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (Database)
   - [Cloudinary](https://cloudinary.com) (Optional - for file storage)

---

## 🗄️ Step 1: Setup MongoDB Atlas (Free)

1. **Create Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free account

2. **Create Cluster**
   - Click "Build a Database"
   - Choose **FREE (M0) Shared** tier
   - Select a cloud provider and region (closest to your deployment)
   - Click "Create"

3. **Setup Database Access**
   - Go to "Database Access" → "Add New Database User"
   - Choose "Password" authentication
   - Create username and password (save these!)
   - Set user privileges to "Atlas admin" or "Read and write to any database"
   - Click "Add User"

4. **Setup Network Access**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0) for development
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/jobportal?retryWrites=true&w=majority`

---

## 🖥️ Step 2: Deploy Backend (Render - Free)

### Option A: Render (Recommended - Free Tier Available)

1. **Create Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure Service**
   ```
   Name: jobportal-backend
   Environment: Node
   Build Command: cd backend && npm install
   Start Command: cd backend && npm start
   Root Directory: (leave empty or set to project root)
   ```

4. **Environment Variables**
   Add these in Render dashboard:
   ```
   PORT=10000
   NODE_ENV=production
   MONGODB_URI=your-mongodb-atlas-connection-string
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   BREVO_API_KEY=your-brevo-api-key (optional)
   PREFERRED_EMAIL_SERVICE=brevo
   ENABLE_EMAIL_FALLBACK=true
   IPINFO_API_KEY=your-ipinfo-api-key (optional)
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Copy the service URL (e.g., `https://jobportal-backend.onrender.com`)

**Note**: Render free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds.

### Option B: Railway (Alternative - Free Trial)

1. **Create Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Configure Service**
   - Railway auto-detects Node.js
   - Set Root Directory to `backend`
   - Set Start Command to `npm start`

4. **Environment Variables**
   - Add the same variables as Render
   - Railway provides `PORT` automatically

5. **Deploy**
   - Railway auto-deploys on push
   - Get your service URL

---

## 🎨 Step 3: Deploy Frontend (Vercel - Free)

### Option A: Vercel (Recommended)

1. **Create Account**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your GitHub repository

3. **Configure Project**
   ```
   Framework Preset: Create React App
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: build
   ```

4. **Environment Variables**
   ```
   REACT_APP_API_URL=https://your-backend-url.onrender.com
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build (2-5 minutes)
   - Get your frontend URL (e.g., `https://jobportal.vercel.app`)

6. **Update Backend CORS**
   - Go back to Render/Railway
   - Update `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy backend

### Option B: Netlify (Alternative)

1. **Create Account**
   - Go to https://netlify.com
   - Sign up with GitHub

2. **New Site from Git**
   - Click "Add new site" → "Import an existing project"
   - Connect GitHub repository

3. **Build Settings**
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/build
   ```

4. **Environment Variables**
   - Go to "Site settings" → "Environment variables"
   - Add `REACT_APP_API_URL`

5. **Deploy**
   - Click "Deploy site"
   - Get your Netlify URL

---

## 📁 Step 4: Handle File Uploads

The free hosting services have ephemeral file systems. You have two options:

### Option A: Use Backend Storage (Temporary - Files Lost on Restart)

**For Render/Railway:**
- Files are stored in `backend/uploads`
- Files persist until service restarts
- **Limitation**: Files are lost on service restart (Render free tier restarts daily)

### Option B: Use Cloudinary (Recommended - Free Tier)

1. **Create Cloudinary Account**
   - Go to https://cloudinary.com
   - Sign up for free account
   - Get your credentials from dashboard

2. **Install Cloudinary**
   ```bash
   cd backend
   npm install cloudinary multer-storage-cloudinary
   ```

3. **Update Backend Code**
   Create `backend/config/cloudinary.js`:
   ```javascript
   const cloudinary = require('cloudinary').v2;
   const { CloudinaryStorage } = require('multer-storage-cloudinary');
   const multer = require('multer');

   cloudinary.config({
     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
     api_key: process.env.CLOUDINARY_API_KEY,
     api_secret: process.env.CLOUDINARY_API_SECRET
   });

   const storage = new CloudinaryStorage({
     cloudinary: cloudinary,
     params: {
       folder: 'jobportal',
       allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']
     }
   });

   module.exports = multer({ storage: storage });
   ```

4. **Update Routes**
   - Replace multer disk storage with Cloudinary storage in your routes
   - Update file URL generation to use Cloudinary URLs

5. **Environment Variables**
   Add to Render/Railway:
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

---

## 🔧 Step 5: Update Code for Production

### 1. Update Backend CORS

In `backend/index.js`, update CORS to include production URLs:

```javascript
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.FRONTEND_URL, // Add this
    "https://your-frontend.vercel.app", // Add your actual URL
  ],
  credentials: true
}));
```

### 2. Update Frontend API URL

In `frontend/src/api.js`, ensure it uses environment variable:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

### 3. Handle File Serving

If using backend storage, update file serving in `backend/index.js`:

```javascript
// For production, serve files from Cloudinary or update paths
app.use('/uploads', express.static(uploadsDir));
```

---

## 🚀 Step 6: Deployment Checklist

- [ ] MongoDB Atlas cluster created and configured
- [ ] Backend deployed on Render/Railway
- [ ] Frontend deployed on Vercel/Netlify
- [ ] Environment variables set in both frontend and backend
- [ ] CORS configured with production URLs
- [ ] File upload solution configured (Cloudinary or backend storage)
- [ ] Email service configured (Gmail or Brevo)
- [ ] Test login/registration
- [ ] Test file uploads
- [ ] Test email sending (password reset)

---

## 🔍 Step 7: Post-Deployment Testing

1. **Test Authentication**
   - Register new user
   - Login
   - Check JWT token in cookies

2. **Test File Uploads**
   - Upload resume
   - Upload profile picture
   - Verify files are accessible

3. **Test API Calls**
   - Create job (recruiter)
   - Apply to job (applicant)
   - Check notifications

4. **Test Email**
   - Request password reset
   - Check email delivery

---

## 🆓 Free Tier Limitations

### Render
- ✅ Free tier available
- ⚠️ Spins down after 15 min inactivity (cold start ~30-60s)
- ⚠️ 750 hours/month free
- ✅ Auto-deploy from GitHub

### Railway
- ✅ $5 free credit monthly
- ⚠️ Credit expires after 30 days
- ✅ Auto-deploy from GitHub
- ✅ No cold starts

### Vercel
- ✅ Unlimited free deployments
- ✅ Free SSL
- ✅ Global CDN
- ✅ 100GB bandwidth/month

### Netlify
- ✅ 100GB bandwidth/month
- ✅ Free SSL
- ✅ 300 build minutes/month

### MongoDB Atlas
- ✅ 512MB storage free
- ✅ Shared cluster
- ✅ Sufficient for development/small projects

### Cloudinary
- ✅ 25GB storage free
- ✅ 25GB bandwidth/month
- ✅ Perfect for file uploads

---

## 🐛 Troubleshooting

### Backend Not Starting
- Check environment variables are set correctly
- Verify MongoDB connection string
- Check build logs in Render/Railway dashboard

### CORS Errors
- Verify `FRONTEND_URL` in backend matches actual frontend URL
- Check CORS configuration includes production URLs
- Ensure credentials: true is set

### File Upload Issues
- If using backend storage, files may be lost on restart
- Switch to Cloudinary for persistent storage
- Check file size limits

### Database Connection Issues
- Verify MongoDB Atlas network access allows all IPs (0.0.0.0/0)
- Check connection string has correct password
- Verify database user has proper permissions

### Email Not Sending
- For Gmail, use App Password (not regular password)
- Check email service environment variables
- Verify SMTP settings

---

## 📝 Quick Deploy Commands

### Render (Backend)
```bash
# Connect GitHub repo in Render dashboard
# Set build: cd backend && npm install
# Set start: cd backend && npm start
# Add environment variables
```

### Vercel (Frontend)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel

# Follow prompts
```

### Railway (Backend)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway init
railway up
```

---

## 🔐 Security Notes

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use strong JWT_SECRET** - At least 32 characters
3. **Use App Passwords for Gmail** - Not regular passwords
4. **Limit MongoDB Network Access** - Use specific IPs in production
5. **Enable HTTPS** - Vercel/Netlify provide free SSL

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/getting-started/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)

---

## 🎉 Success!

Once deployed, your application will be accessible at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.onrender.com`
- **Database**: MongoDB Atlas (cloud-hosted)

All services are free and suitable for development, testing, and small-scale production use!


