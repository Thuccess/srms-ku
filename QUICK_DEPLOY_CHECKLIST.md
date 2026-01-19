# Quick Client Deployment Checklist

## ✅ What I've Done (Automated)

- [x] Fixed client Dockerfile health check
- [x] Created comprehensive deployment guide (`CLIENT_DEPLOYMENT_GUIDE.md`)
- [x] Committed and pushed changes to GitHub
- [x] Verified client configuration files are ready

## ⚠️ What You Need to Do (Manual Steps)

### Step 1: Create Client Service on Render (5 minutes)

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Click:** "New +" → "Web Service"
3. **Connect Repository:** Select `Thuccess/srms-ku`
4. **Configure Service:**
   ```
   Name: srms-ku-client
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: client
   Runtime: Docker
   Dockerfile Path: Dockerfile
   ```
5. **Add Environment Variable:**
   ```
   Key: VITE_API_URL
   Value: https://srms-ku.onrender.com/api
   ```
6. **Advanced Settings:**
   ```
   Health Check Path: /health
   Auto-Deploy: Yes
   ```
7. **Click:** "Create Web Service"
8. **Wait for build** (5-10 minutes)

### Step 2: Update Backend CORS (2 minutes)

After client is deployed, you'll get a URL like: `https://srms-ku-client.onrender.com`

1. **Go to Backend Service:** `srms-ku` on Render
2. **Go to:** Environment tab
3. **Add/Update:**
   ```
   Key: CLIENT_URL
   Value: https://srms-ku-client.onrender.com
   ```
   (Replace with your actual client URL)
4. **Save Changes** (this will trigger a redeploy)

### Step 3: Test (2 minutes)

1. Visit your client URL
2. Open browser DevTools (F12) → Console tab
3. Try to log in
4. Check:
   - ✅ No CORS errors
   - ✅ API calls succeed
   - ✅ Login works

## 🎯 Expected Result

- **Backend API:** `https://srms-ku.onrender.com`
- **Frontend Client:** `https://srms-ku-client.onrender.com` (or your chosen name)
- **Full Stack:** Working login, dashboard, and all features

## 📝 Notes

- Both services will auto-deploy on git push
- Free tier services spin down after inactivity (50s wake time)
- Consider upgrading for production use

## 🆘 If Something Goes Wrong

1. Check build logs in Render dashboard
2. Check browser console for errors
3. Verify environment variables are set correctly
4. See `CLIENT_DEPLOYMENT_GUIDE.md` for detailed troubleshooting
