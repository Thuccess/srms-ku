# Deployment Guide for Render

This guide will help you deploy the Student Risk System to Render.

## Prerequisites

1. A [Render](https://render.com) account
2. A MongoDB database (MongoDB Atlas recommended for production)
3. GitHub repository with your code (or GitLab/Bitbucket)

## Deployment Options

### Option 1: Blueprint Deployment (Recommended)

This is the easiest way to deploy using the `render.yaml` file. **Note:** Render Blueprints don't support static site services directly, so we deploy as a single web service that serves both the API and the frontend.

#### Steps:

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Go to Render Dashboard**
   - Navigate to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"

3. **Connect your repository**
   - Select your Git provider
   - Choose the repository containing this project
   - Render will automatically detect the `render.yaml` file

4. **Configure Environment Variables**
   
   For the **Service** (`student-risk-system`):
   - `MONGO_URI`: Your MongoDB connection string
     - Format: `mongodb+srv://username:password@cluster.mongodb.net/database-name`
   - `JWT_SECRET`: A strong random string (minimum 32 characters)
     - Generate with: `openssl rand -base64 32`
   - `CLIENT_URL`: Your service URL (set after deployment)
     - Example: `https://student-risk-system.onrender.com`
   - `OPENAI_API_KEY`: (Optional) Your OpenAI API key for AI features
   - `SENTRY_DSN`: (Optional) Sentry DSN for error tracking
   - `SERVE_STATIC`: Set to `"true"` (already configured in render.yaml)

5. **Deploy**
   - Click "Apply" to create both services
   - Render will build and deploy both services

### Option 2: Manual Deployment

If you prefer to deploy services separately:

#### Deploy Backend (API)

1. **Create a new Web Service**
   - Go to Render Dashboard → "New +" → "Web Service"
   - Connect your repository

2. **Configure the service:**
   - **Name**: `student-risk-api`
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Starter (or higher for production)

3. **Set Environment Variables:**
   ```
   NODE_ENV=production
   MONGO_URI=your-mongodb-connection-string
   JWT_SECRET=your-jwt-secret-minimum-32-chars
   CLIENT_URL=https://your-frontend-url.onrender.com
   OPENAI_API_KEY=your-openai-key (optional)
   SENTRY_DSN=your-sentry-dsn (optional)
   LOG_LEVEL=info
   ```

4. **Deploy**

#### Deploy Frontend (Static Site)

1. **Create a new Static Site**
   - Go to Render Dashboard → "New +" → "Static Site"
   - Connect your repository

2. **Configure the service:**
   - **Name**: `student-risk-frontend`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/dist`

3. **Set Environment Variables:**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

4. **Deploy**

## Post-Deployment Configuration

### 1. Update CORS Settings

After both services are deployed, update the backend's `CLIENT_URL` environment variable to match your frontend URL.

### 2. Update Frontend API URL

Update the frontend's `VITE_API_URL` to match your backend URL.

### 3. Test the Deployment

1. Visit your frontend URL
2. Check the health endpoint: `https://your-api-url.onrender.com/health`
3. Test login functionality
4. Verify API connectivity

## MongoDB Setup

### Using MongoDB Atlas (Recommended)

1. **Create a MongoDB Atlas account** at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

2. **Create a new cluster**
   - Choose a free tier (M0) for development
   - Select a region close to your Render region

3. **Create a database user**
   - Go to Database Access
   - Create a new user with username and password
   - Grant "Atlas Admin" role (or custom role with read/write permissions)

4. **Whitelist IP addresses**
   - Go to Network Access
   - Add `0.0.0.0/0` to allow all IPs (or specific Render IPs)
   - For production, restrict to Render's IP ranges

5. **Get connection string**
   - Go to Clusters → Connect
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `student-risk-system`)

### Connection String Format

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/student-risk-system?retryWrites=true&w=majority
```

## Environment Variables Reference

### Backend (API) Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URI` | Yes | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Yes | Secret for JWT tokens (min 32 chars) | Generated with `openssl rand -base64 32` |
| `CLIENT_URL` | Yes | Frontend URL for CORS | `https://student-risk-frontend.onrender.com` |
| `NODE_ENV` | No | Environment (auto-set to `production`) | `production` |
| `PORT` | No | Server port (auto-set by Render) | `10000` |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features | `sk-...` |
| `SENTRY_DSN` | No | Sentry DSN for error tracking | `https://...@sentry.io/...` |
| `LOG_LEVEL` | No | Logging level | `info` |

### Frontend Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API URL | `https://student-risk-api.onrender.com/api` |

## Troubleshooting

### Backend Issues

**Build Fails:**
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility
- Check build logs for specific errors

**Server Won't Start:**
- Verify all required environment variables are set
- Check MongoDB connection string is correct
- Ensure JWT_SECRET is at least 32 characters
- Review server logs in Render dashboard

**Database Connection Errors:**
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0` or Render IPs
- Check database username and password
- Verify connection string format

**CORS Errors:**
- Ensure `CLIENT_URL` matches your frontend URL exactly
- Check that frontend is making requests to the correct API URL

### Frontend Issues

**Build Fails:**
- Check that `VITE_API_URL` is set correctly
- Verify all dependencies are installed
- Check build logs for specific errors

**API Connection Errors:**
- Verify `VITE_API_URL` points to your backend URL
- Check that backend is running and accessible
- Verify CORS settings on backend

**404 Errors on Routes:**
- This is normal for React Router - Render Static Sites handle this automatically
- If issues persist, check that `index.html` is in the dist folder

### General Issues

**Services Not Communicating:**
- Verify environment variables are set correctly
- Check that both services are deployed and running
- Review service logs in Render dashboard

**Slow Performance:**
- Consider upgrading to a paid plan
- Check database query performance
- Review application logs for bottlenecks

## Updating the Deployment

### Automatic Deployments

By default, Render automatically deploys when you push to your main branch.

### Manual Deployments

1. Go to your service in Render dashboard
2. Click "Manual Deploy"
3. Select the branch/commit to deploy

### Rolling Back

1. Go to your service in Render dashboard
2. Click "Events" tab
3. Find a previous successful deployment
4. Click "Redeploy"

## Security Considerations

1. **JWT Secret**: Use a strong, randomly generated secret (minimum 32 characters)
2. **MongoDB**: Use strong database passwords
3. **Environment Variables**: Never commit secrets to Git
4. **HTTPS**: Render provides HTTPS by default
5. **CORS**: Restrict `CLIENT_URL` to your actual frontend domain
6. **Rate Limiting**: Already configured in the application

## Cost Estimation

### Free Tier (Development)
- **Backend**: Free tier available (spins down after 15 min inactivity)
- **Frontend**: Free tier available
- **MongoDB Atlas**: Free tier (M0) available

### Paid Tier (Production)
- **Backend**: Starter plan ~$7/month (always on)
- **Frontend**: Starter plan ~$7/month
- **MongoDB Atlas**: M10 cluster ~$57/month (or use free M0 for small scale)

## Support

For issues specific to:
- **Render**: Check [Render Documentation](https://render.com/docs)
- **Application**: Review application logs in Render dashboard
- **MongoDB**: Check [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)

## Next Steps

After successful deployment:

1. ✅ Test all functionality
2. ✅ Set up monitoring and alerts
3. ✅ Configure automated backups for MongoDB
4. ✅ Set up custom domain (optional)
5. ✅ Review security settings
6. ✅ Set up CI/CD pipeline (optional)

