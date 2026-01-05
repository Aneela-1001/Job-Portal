# Quick Deployment Checklist

## 🚀 Fast Track Deployment (15 minutes)

### 1. MongoDB Atlas (2 min)
- [ ] Sign up at https://www.mongodb.com/cloud/atlas
- [ ] Create FREE M0 cluster
- [ ] Create database user (save password!)
- [ ] Allow access from anywhere (0.0.0.0/0)
- [ ] Copy connection string

### 2. Backend - Render (5 min)
- [ ] Sign up at https://render.com (GitHub login)
- [ ] New → Web Service → Connect GitHub repo
- [ ] Settings:
  - **Name**: `jobportal-backend`
  - **Build Command**: `cd backend && npm install`
  - **Start Command**: `cd backend && npm start`
- [ ] Add Environment Variables:
  ```
  MONGODB_URI=your-mongodb-connection-string
  JWT_SECRET=your-32-char-secret-key
  FRONTEND_URL=https://your-frontend.vercel.app (update after frontend deploy)
  PORT=10000
  NODE_ENV=production
  ```
- [ ] Deploy → Copy backend URL

### 3. Frontend - Vercel (5 min)
- [ ] Sign up at https://vercel.com (GitHub login)
- [ ] Import Project → Select repo
- [ ] Settings:
  - **Framework**: Create React App
  - **Root Directory**: `frontend`
  - **Build Command**: `npm run build`
  - **Output Directory**: `build`
- [ ] Environment Variables:
  ```
  REACT_APP_API_URL=https://your-backend.onrender.com
  ```
- [ ] Deploy → Copy frontend URL

### 4. Update URLs (2 min)
- [ ] Go back to Render
- [ ] Update `FRONTEND_URL` with Vercel URL
- [ ] Redeploy backend

### 5. Test (1 min)
- [ ] Open frontend URL
- [ ] Register new user
- [ ] Login
- [ ] ✅ Done!

---

## 📝 Environment Variables Summary

### Backend (Render)
```env
PORT=10000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jobportal
JWT_SECRET=your-32-character-secret-key-here
FRONTEND_URL=https://your-app.vercel.app
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

### Frontend (Vercel)
```env
REACT_APP_API_URL=https://your-backend.onrender.com
```

---

## 🔗 Free Services URLs

| Service | URL | Free Tier |
|---------|-----|-----------|
| **MongoDB Atlas** | https://mongodb.com/cloud/atlas | 512MB storage |
| **Render** | https://render.com | 750 hrs/month |
| **Vercel** | https://vercel.com | Unlimited |
| **Railway** | https://railway.app | $5 credit/month |
| **Netlify** | https://netlify.com | 100GB bandwidth |

---

## ⚠️ Important Notes

1. **Render Free Tier**: Spins down after 15 min inactivity (first request takes 30-60s)
2. **File Uploads**: Files stored in backend/uploads will be lost on restart
   - **Solution**: Use Cloudinary (free tier: 25GB)
3. **Email**: Use Gmail App Password (not regular password)
4. **CORS**: Backend automatically includes FRONTEND_URL in allowed origins

---

## 🐛 Common Issues

**Backend won't start?**
- Check MongoDB connection string
- Verify all environment variables are set
- Check Render logs

**CORS errors?**
- Update FRONTEND_URL in backend
- Redeploy backend after updating

**Files not uploading?**
- Backend storage is ephemeral (files lost on restart)
- Consider Cloudinary for persistent storage

---

## 📚 Full Guide

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.


