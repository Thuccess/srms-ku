# Client Deployment Guide for Render

This guide will help you deploy the React/Vite client as a separate service on Render.

## Prerequisites

- Backend API is already deployed at: `https://srms-ku.onrender.com`
- GitHub repository connected to Render
- Render account (free tier works)

## Option 1: Deploy via Render Dashboard (Recommended)

### Step 1: Create New Web Service

1. Go to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your repository: `Thuccess/srms-ku`
4. Configure the service:

   **Basic Settings:**
   - **Name:** `srms-ku-client` (or any name you prefer)
   - **Region:** `Oregon` (or closest to your users)
   - **Branch:** `main`
   - **Root Directory:** `client`
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `client/Dockerfile` (or just `Dockerfile` if root is set to `client`)

   **Build & Deploy:**
   - **Build Command:** (Leave empty - Docker handles this)
   - **Start Command:** (Leave empty - Docker handles this)

   **Environment Variables:**
   Add these environment variables:
   ```
   VITE_API_URL=https://srms-ku.onrender.com/api
   ```
   
   **Note:** The `VITE_` prefix is important - Vite only exposes variables with this prefix to the client.

   **Advanced Settings:**
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** `Yes` (deploys on every push to main)

### Step 2: Deploy

1. Click **"Create Web Service"**
2. Render will start building your Docker image
3. Monitor the build logs
4. Once deployed, you'll get a URL like: `https://srms-ku-client.onrender.com`

### Step 3: Update Backend CORS (if needed)

Make sure your backend allows requests from the new client URL:

1. Go to your backend service settings (`srms-ku`)
2. Add/Update environment variable:
   ```
   CLIENT_URL=https://srms-ku-client.onrender.com
   ```
3. Redeploy the backend service

## Option 2: Deploy via Render Blueprint (render.yaml)

If you prefer infrastructure-as-code, you can uncomment and configure the frontend service in `render.yaml`.

### Step 1: Update render.yaml

Uncomment the frontend service section (lines 69-78) and update it:

```yaml
# Frontend Static Site
- type: web
  name: srms-ku-client
  env: docker
  dockerfilePath: ./client/Dockerfile
  dockerContext: ./client
  region: oregon
  plan: starter
  envVars:
    - key: VITE_API_URL
      value: https://srms-ku.onrender.com/api
  healthCheckPath: /health
```

### Step 2: Deploy via Blueprint

1. In Render dashboard, go to **"Blueprints"**
2. Click **"New Blueprint"**
3. Connect your repository
4. Render will detect `render.yaml` and create both services

## Option 3: Single Service (Backend serves Frontend)

If you want everything on one URL, you can modify the backend to serve the client:

### Step 1: Update Backend Dockerfile

Modify `server/Dockerfile` to build both server and client:

```dockerfile
# In builder stage, after building server:
# Build client
WORKDIR /app/client
COPY ../client/package*.json ./
RUN npm ci && npm cache clean --force
COPY ../client . .
RUN npm run build

# In production stage:
# Copy client build
COPY --from=builder /app/client/dist ./client/dist
```

### Step 2: Set Environment Variables

In your backend service on Render:
```
SERVE_STATIC=true
NODE_ENV=production
```

### Step 3: Redeploy

The backend will now serve the client at the root URL and API at `/api/*`

## Verification

After deployment:

1. **Check Client URL:** Visit your client URL (e.g., `https://srms-ku-client.onrender.com`)
2. **Check API Connection:** Open browser DevTools → Network tab → Verify API calls go to `https://srms-ku.onrender.com/api`
3. **Test Login:** Try logging in to verify the full stack works

## Troubleshooting

### Client shows "Cannot connect to API"
- Verify `VITE_API_URL` is set correctly in client service
- Check backend CORS settings (`CLIENT_URL` environment variable)
- Ensure backend is running and accessible

### 404 errors on client routes
- This is normal for SPAs - nginx should handle it
- Check `client/nginx.conf` has the SPA routing rule: `try_files $uri $uri/ /index.html;`

### Build fails
- Check Docker logs in Render
- Verify `client/Dockerfile` is correct
- Ensure `client/package.json` has all dependencies

### Health check fails
- Verify `/health` endpoint exists in `client/nginx.conf`
- Check Render health check path is set to `/health`

## Recommended Setup

**For Production:**
- Use **Option 1** (Separate services) - Better separation, easier scaling
- Backend: `https://srms-ku.onrender.com`
- Frontend: `https://srms-ku-client.onrender.com`

**For Development/Testing:**
- Option 3 (Single service) - Simpler, one URL

## Next Steps

1. Set up custom domain (optional)
2. Configure SSL (automatic on Render)
3. Set up monitoring and alerts
4. Configure environment-specific variables
