# Quick Start: Deploy to Render

## 🚀 Fastest Way (Blueprint)

1. **Push code to GitHub/GitLab/Bitbucket**

2. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Click "New +" → "Blueprint"

3. **Connect Repository**
   - Select your Git provider
   - Choose this repository

4. **Set Environment Variables**

   **Backend Service:**
   ```
   MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
   JWT_SECRET=<generate with: openssl rand -base64 32>
   CLIENT_URL=https://student-risk-frontend.onrender.com
   ```

   **Frontend Service:**
   ```
   VITE_API_URL=https://student-risk-api.onrender.com/api
   ```

5. **Deploy!** Click "Apply"

## 📋 Required Setup

### MongoDB Atlas (Free Tier Available)

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create cluster (M0 Free tier)
3. Create database user
4. Network Access → Add IP: `0.0.0.0/0`
5. Get connection string from "Connect" → "Connect your application"

### Generate JWT Secret

```bash
openssl rand -base64 32
```

Or using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 🔗 After Deployment

1. **Update CORS**: Set `CLIENT_URL` in backend to your frontend URL
2. **Update API URL**: Set `VITE_API_URL` in frontend to your backend URL
3. **Test**: Visit your frontend URL and test login

## 📝 Service URLs

After deployment, your services will be available at:
- Frontend: `https://student-risk-frontend.onrender.com`
- Backend: `https://student-risk-api.onrender.com`

## ⚠️ Important Notes

- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- For production, upgrade to paid plans for always-on services
- MongoDB Atlas free tier is sufficient for development

## 🆘 Troubleshooting

**Build fails?** Check that all dependencies are in package.json

**Can't connect to API?** Verify `VITE_API_URL` matches your backend URL

**CORS errors?** Ensure `CLIENT_URL` in backend matches frontend URL exactly

**Database errors?** Check MongoDB connection string and IP whitelist

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

