# Fix Client Connection Issue

## Problem
Client at `https://srms-ku-1.onrender.com` is trying to connect to `localhost:5000` instead of `https://srms-ku.onrender.com/api`

## Solution: Update Environment Variables

### Step 1: Fix Client Service (2 minutes)

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Click on your client service:** `srms-ku-1` (or whatever you named it)
3. **Go to:** "Environment" tab
4. **Add/Update this environment variable:**
   ```
   Key: VITE_API_URL
   Value: https://srms-ku.onrender.com/api
   ```
5. **Click:** "Save Changes"
6. **This will trigger a redeploy** - wait for it to complete (5-10 minutes)

### Step 2: Update Backend CORS (2 minutes)

1. **Go to your backend service:** `srms-ku` on Render
2. **Go to:** "Environment" tab
3. **Add/Update this environment variable:**
   ```
   Key: CLIENT_URL
   Value: https://srms-ku-1.onrender.com
   ```
4. **Click:** "Save Changes"
5. **This will trigger a redeploy** - wait for it to complete

### Step 3: Verify (1 minute)

1. Visit: `https://srms-ku-1.onrender.com`
2. Open browser DevTools (F12) → Console tab
3. Try to log in
4. Check console - you should see API calls going to `https://srms-ku.onrender.com/api`
5. Login should work!

## Why This Happened

- Vite only exposes environment variables that start with `VITE_` to the client
- The variable must be set **before** the build happens
- Since it wasn't set, the client defaulted to `http://localhost:5000/api`

## Quick Checklist

- [ ] Set `VITE_API_URL=https://srms-ku.onrender.com/api` in client service
- [ ] Set `CLIENT_URL=https://srms-ku-1.onrender.com` in backend service
- [ ] Wait for both services to redeploy
- [ ] Test login on client

## Expected Result

After both services redeploy:
- ✅ Client connects to correct backend URL
- ✅ No more "Cannot connect to server" errors
- ✅ Login works with test credentials
- ✅ All API calls succeed
