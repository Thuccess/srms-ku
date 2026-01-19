# Deployment Checklist

Use this checklist to verify your deployment is configured correctly and ready for production.

## Pre-Deployment Checklist

### Environment Configuration

- [ ] **Server Environment Variables**
  - [ ] `MONGO_URI` is set to production MongoDB instance
  - [ ] `JWT_SECRET` is set and is at least 32 characters
  - [ ] `NODE_ENV` is set to `production`
  - [ ] `CLIENT_URL` matches your production frontend URL
  - [ ] `SERVE_STATIC` is set correctly (true for single service, false for separate)
  - [ ] `LOG_LEVEL` is set to `info` or `warn` for production
  - [ ] `OPENAI_API_KEY` is set if using AI features (optional)
  - [ ] `SENTRY_DSN` is set for error tracking (optional)

- [ ] **Client Environment Variables**
  - [ ] `VITE_API_URL` is set to production backend API URL
  - [ ] Environment variables are set during build time (not runtime)

### Code Quality

- [ ] All debug code removed (no hardcoded localhost URLs)
- [ ] No console.log statements in production code
- [ ] No sensitive data in code or comments
- [ ] All environment variables use `.env` files (not hardcoded)

### Build Verification

- [ ] **Server Build**
  - [ ] `cd server && npm run build` completes without errors
  - [ ] `dist/` directory contains compiled JavaScript
  - [ ] TypeScript compilation successful

- [ ] **Client Build**
  - [ ] `cd client && npm run build` completes without errors
  - [ ] `dist/` directory contains optimized production build
  - [ ] Build size is reasonable (check for large bundles)
  - [ ] Source maps are disabled in production build

### Security

- [ ] `.env` files are in `.gitignore` and not committed
- [ ] JWT_SECRET is strong and unique for production
- [ ] MongoDB connection uses strong authentication
- [ ] CORS is configured to only allow production frontend URL
- [ ] Rate limiting is enabled
- [ ] Security headers (Helmet) are configured
- [ ] HTTPS is enabled (platform should provide this)

### Database

- [ ] MongoDB is accessible from deployment platform
- [ ] Database user has appropriate permissions
- [ ] IP whitelist includes deployment platform IPs (if using Atlas)
- [ ] Database backups are configured
- [ ] Connection string is correct and tested

## Deployment Steps

### For Render

- [ ] Repository is connected to Render
- [ ] `render.yaml` is in the repository root
- [ ] Environment variables are set in Render dashboard
- [ ] Build command is correct
- [ ] Start command is correct
- [ ] Health check path is configured (`/health`)

### For Docker

- [ ] Docker images build successfully
- [ ] `docker-compose.yml` is configured correctly
- [ ] Environment variables are set in `.env` or docker-compose
- [ ] Ports are mapped correctly
- [ ] Health checks are configured

### For Manual Deployment

- [ ] Server is built and deployed
- [ ] Client is built and deployed
- [ ] Web server (Nginx/Apache) is configured
- [ ] Process manager (PM2/systemd) is configured
- [ ] Services start on server reboot

## Post-Deployment Verification

### Health Checks

- [ ] **Backend Health Endpoint**
  ```bash
  curl https://your-api-url.com/health
  # Should return: {"status":"ok"}
  ```

- [ ] **Frontend Accessibility**
  - [ ] Frontend loads at production URL
  - [ ] No 404 errors for static assets
  - [ ] React Router works (test navigation)

### API Functionality

- [ ] **Authentication**
  - [ ] Login endpoint works: `POST /api/auth/login`
  - [ ] JWT tokens are generated correctly
  - [ ] Protected routes require authentication

- [ ] **Student Endpoints**
  - [ ] `GET /api/students` returns data
  - [ ] `POST /api/students` creates students
  - [ ] `GET /api/students/:id` returns student details
  - [ ] RBAC filtering works correctly

- [ ] **Risk Prediction**
  - [ ] `POST /api/risk/predict-risk` calculates risk scores
  - [ ] AI explanations work (if OpenAI key is set)

### Frontend Functionality

- [ ] **Login Flow**
  - [ ] Login page loads
  - [ ] Can log in with valid credentials
  - [ ] Redirects to dashboard after login
  - [ ] Logout works correctly

- [ ] **Dashboard**
  - [ ] Dashboard loads with data
  - [ ] Charts render correctly
  - [ ] Role-based content displays correctly

- [ ] **Student Management**
  - [ ] Student list loads
  - [ ] Can view student details
  - [ ] Can create/edit students (if role allows)
  - [ ] Filters work correctly

- [ ] **API Connectivity**
  - [ ] Frontend can connect to backend API
  - [ ] No CORS errors in browser console
  - [ ] Socket.io connection works (if applicable)

### Performance

- [ ] **Load Times**
  - [ ] Initial page load < 3 seconds
  - [ ] API responses < 1 second
  - [ ] No timeout errors

- [ ] **Resource Usage**
  - [ ] Check server CPU/memory usage
  - [ ] Check database connection pool
  - [ ] Monitor for memory leaks

### Error Handling

- [ ] **Error Responses**
  - [ ] 404 errors return proper JSON (not stack traces)
  - [ ] 500 errors don't expose stack traces in production
  - [ ] Error messages are user-friendly

- [ ] **Logging**
  - [ ] Errors are logged to files/external service
  - [ ] Logs don't contain sensitive information
  - [ ] Log rotation is configured

### Security Verification

- [ ] **Headers**
  ```bash
  curl -I https://your-api-url.com/health
  # Check for security headers:
  # - X-Frame-Options
  # - X-Content-Type-Options
  # - X-XSS-Protection
  # - Content-Security-Policy
  ```

- [ ] **CORS**
  - [ ] Only production frontend URL is allowed
  - [ ] Preflight requests work correctly

- [ ] **Rate Limiting**
  - [ ] Too many requests return 429 status
  - [ ] Rate limits are appropriate for production

## Monitoring Setup

- [ ] **Error Tracking**
  - [ ] Sentry (or similar) is configured
  - [ ] Errors are being captured
  - [ ] Alerts are configured for critical errors

- [ ] **Uptime Monitoring**
  - [ ] Health check monitoring is set up
  - [ ] Alerts for downtime are configured

- [ ] **Performance Monitoring**
  - [ ] Response time monitoring
  - [ ] Database query performance
  - [ ] Memory and CPU usage

## Rollback Plan

- [ ] Previous deployment version is identified
- [ ] Rollback procedure is documented
- [ ] Database migrations can be rolled back (if applicable)
- [ ] Backup of current deployment is available

## Documentation

- [ ] Deployment process is documented
- [ ] Environment variables are documented
- [ ] Troubleshooting guide is available
- [ ] Team members know how to access logs

## Sign-Off

- [ ] All critical items checked
- [ ] Application tested in production environment
- [ ] Team notified of deployment
- [ ] Monitoring and alerts verified

---

## Quick Verification Commands

```bash
# Health check
curl https://your-api-url.com/health

# Check environment (should not expose secrets)
curl https://your-api-url.com/api/health

# Test authentication
curl -X POST https://your-api-url.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check security headers
curl -I https://your-api-url.com/health

# Frontend build size
du -sh client/dist

# Server build verification
ls -la server/dist
```

---

**Last Updated:** After each deployment, update this checklist with any new requirements or issues discovered.
