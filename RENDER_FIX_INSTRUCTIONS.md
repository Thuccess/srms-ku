# Render Build Fix Instructions

## Problem
The build is failing with "Unknown command: 'build'" error because the build command in Render dashboard is incorrect.

## Solution

You have two options to fix this:

### Option 1: Update Build Command in Render Dashboard (Quick Fix)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your service: **srms-ku-server**
3. Click on **Settings** in the left sidebar
4. Scroll down to **Build & Deploy** section
5. Find the **Build Command** field
6. Replace the current build command with:
   ```bash
   cd server && npm install && npm run build || exit 1 && cd ../client && npm install && npm run build || exit 1
   ```
7. Find the **Start Command** field and ensure it's set to:
   ```bash
   cd server && npm start
   ```
8. Click **Save Changes**
9. Go to **Events** tab and click **Manual Deploy** → **Deploy latest commit**

### Option 2: Delete and Recreate Using Blueprint (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your service: **srms-ku-server**
3. Click **Settings** → Scroll to bottom → Click **Delete Service**
4. Confirm deletion
5. Click **New +** → **Blueprint**
6. Connect your GitHub repository: `Thuccess/srms-ku`
7. Render will automatically detect `render.yaml`
8. Review the configuration (should show service name: `student-risk-system`)
9. **Configure Environment Variables** before deploying:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A strong random string (min 32 chars)
   - `OPENAI_API_KEY`: (Optional) If using AI features
   - `SENTRY_DSN`: (Optional) For error tracking
10. Click **Apply** to deploy

## Updated Build Command

The `render.yaml` has been updated with better error handling:

```yaml
buildCommand: |
  cd server && npm install && npm run build || exit 1 &&
  cd ../client && npm install && npm run build || exit 1
```

This ensures:
- Both server and client build successfully
- Build fails fast if any step fails (`|| exit 1`)
- Proper error messages in build logs

## Verification

After deploying, check:
1. Build logs show successful completion of both server and client builds
2. Service starts without errors
3. Health endpoint works: `https://your-service-url.onrender.com/health`
4. Frontend loads: `https://your-service-url.onrender.com`

## Local Build Test Results

The build commands have been tested locally and work correctly:
- ✅ Server build: TypeScript compiles successfully
- ✅ Client build: Vite builds production bundle successfully
