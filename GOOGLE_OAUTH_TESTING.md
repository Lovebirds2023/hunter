# Complete Google OAuth Setup - Testing & Deployment

## ✅ What's Been Completed

Your application now has full Google OAuth support:

### Backend ✅
- [x] User model updated with `auth_provider` and `google_id` fields
- [x] `/auth/google` endpoint for Google login/signup
- [x] `/auth/link-google` endpoint for account linking  
- [x] Automatic migrations on app startup
- [x] Google token verification
- [x] Auto-account creation for first-time users
- [x] Password now optional for OAuth users

### Frontend ✅
- [x] "Sign up with Google" button on RegisterScreen
- [x] "Continue with Google" button on LoginScreen
- [x] Secure token management
- [x] Google Client IDs configured

### Files Created ✅
- [x] `backend/.env` - Backend configuration
- [x] `frontend/.env` - Frontend configuration  
- [x] `backend/.env.example` - Example configuration
- [x] `backend/run_migration.py` - Manual migration script
- [x] `backend/migrations/001_add_oauth_to_users.sql` - Migration SQL

---

## 🚀 For Local Development Testing

### Step 1: Start PostgreSQL Locally

**Using Docker:**
```bash
docker run --name postgres_local \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lovedogs \
  -p 5432:5432 \
  -d postgres:15
```

**Or if PostgreSQL is installed locally:**
```bash
# Windows (WSL or native)
pg_ctl start

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Step 2: Verify Database Connection

```bash
# Test connection
psql -h localhost -U postgres -d lovedogs -c "SELECT version();"
```

Expected output:
```
PostgreSQL 15.x on x86_64-pc-linux-gnu...
```

### Step 3: Start Backend

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Watch for this message:
```
✅ Google OAuth database migrations completed
✅ Successfully initialized database tables
```

### Step 4: Verify API Endpoints

Test in terminal:

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status": "ok"}
```

### Step 5: Test Google OAuth Endpoint

**Option A: Using Postman**
1. Open Postman
2. Create POST request to `http://localhost:8000/auth/google`
3. Set header: `Content-Type: application/json`
4. Send with body:
```json
{
  "id_token": "<your-google-id-token>"
}
```

**Option B: Using cURL**
```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<your-google-id-token>"}'
```

**Getting a Real Google ID Token:**
1. Install Google OAuth token generator:
```bash
pip install google-auth-oauthlib
```

2. Create `test_google_token.py`:
```python
from google.oauth2.service_account import ServiceAccountCredentials
from google.oauth2 import id_token
from google.auth.transport import requests

# Or use this simpler approach to get a token from browser
print("Visit this URL to get a Google ID token for testing:")
print("https://myaccount.google.com/device")

# Then test with the token you receive
```

### Step 6: Start Frontend Development

```bash
cd frontend
npm install
npm start
```

Expected output:
```
✔ Expo dev server is running on xxxxxxx
```

### Step 7: Test Complete Flow in App

1. **New User Test:**
   - Open app
   - Go to LoginScreen or RegisterScreen
   - Click "Continue with Google" or "Sign up with Google"
   - Select Google account
   - ✅ Should auto-login and see home screen

2. **Existing User Test:**
   - Register with email/password first
   - Login and go to profile
   - Find "Link Google Account" option
   - Click Google auth button
   - ✅ Google should link to existing account

3. **Check Database:**
   ```bash
   psql -h localhost -U postgres -d lovedogs -c "SELECT id, email, auth_provider, google_id FROM \"user\";"
   ```

Expected output:
```
 id | email              | auth_provider | google_id
----+--------------------+---------------+----------------------------------------------
  1 | user@gmail.com     | google        | 103847524682174XXX
  2 | user@example.com   | email         | NULL
  3 | newuser@gmail.com  | google        | 103847524682175XXX
```

---

## 🚢 For Production Deployment (Railway)

### Step 1: Set Railway Environment Variables

Go to **Railway Project** > **Settings** > **Environment Variables**

Add these variables:

```
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=616203224372-756q5k5ujlqnaaekeo9pgb2pqai3ussf.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=616203224372-o8137t06ph20itjsfqvec0envtllto8j.apps.googleusercontent.com

# JWT Secret (generate random: python -c "import secrets; print(secrets.token_urlsafe(64))")
JWT_SECRET=<generate-unique-64-char-key>

# Other config
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520
```

Note: Railway automatically sets `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### Step 2: Deploy Backend

```bash
# In your Railway CLI or via GitHub push
git push railway main

# Watch deployment logs
railway logs
```

Expected in logs:
```
✅ Google OAuth database migrations completed
✅ Successfully initialized database tables
API running on https://your-railway-app.railway.app
```

### Step 3: Update Frontend to Production URL

In `frontend/.env`:
```
EXPO_PUBLIC_API_URL=https://your-railway-app.railway.app
```

### Step 4: Deploy Frontend

```bash
# Vercel deployment
npm run build
vercel --prod

# Or Expo:
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Step 5: Verify Production

Test login at: `https://your-app-url.com/login`

---

## 🧪 Complete API Testing Guide

### 1. Register with Email/Password

```bash
curl -X POST http://localhost:8000/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "full_name": "Test User",
    "role": "owner"
  }'

# Response:
{
  "id": 1,
  "email": "test@example.com",
  "full_name": "Test User",
  "role": "owner",
  "auth_provider": "email",
  "google_id": null,
  "is_active": true,
  "is_verified": false
}
```

### 2. Login with Email/Password

```bash
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test@example.com&password=TestPassword123!"

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### 3. Google Sign-Up (Auto Creates Account)

```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "eyJhbGciOiJSUzI1NiIs..."
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "googler@gmail.com",
    "full_name": "Googler Name",
    "auth_provider": "google",
    "google_id": "103847524682174...",
    "role": "owner",
    "is_active": true,
    "is_verified": false
  }
}
```

### 4. Link Google to Existing Account

```bash
# First get the JWT token from email login
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Then link Google
curl -X POST http://localhost:8000/auth/link-google \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "eyJhbGciOiJSUzI1NiIs..."
  }'

# Response:
{
  "id": 1,
  "email": "test@example.com",
  "auth_provider": "google",
  "google_id": "103847524682175...",
  ...
}
```

### 5. Get Current User Profile

```bash
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## 🐛 Troubleshooting

### ❌ Database Connection Refused

**Problem:** `connection refused` error when starting backend

**Solutions:**
1. Check PostgreSQL is running: `psql -U postgres -c "SELECT 1"`
2. Verify port 5432 is available: `netstat -an | grep 5432`
3. Check .env variables are correct
4. On Railway: Ensure DATABASE_URL is set

### ❌ "Invalid Google Token"

**Problem:** Google token verification fails

**Solutions:**
1. Verify Google Client IDs match in .env and Google Cloud Console
2. Check token hasn't expired (tokens expire in 1 hour)
3. Ensure token audience matches your Client ID
4. Try getting a fresh token from Google

### ❌ "Column already exists"

**Problem:** Migration errors on second run

**Solution:** This is expected! Migrations check `IF NOT EXISTS` so they're idempotent. Safe to ignore.

### ❌ Email Already Exists Error

**Problem:** User tries Google with email that already has email account

**Expected:** This is by design! User should:
- Option 1: Use "Link Google Account" from profile
- Option 2: Use email/password login first
- Option 3: Reset password to use Google next time

### ❌ Frontend shows "Google login unavailable"

**Problem:** Google button shows "Set up Google login" instead of working

**Solutions:**
1. Check `frontend/.env` has real Google Client IDs (not placeholders)
2. Verify Client IDs match your Google Cloud Console
3. Clear browser cache and reload
4. Check console for errors: Open DevTools > Console tab

### ❌ Token Not Working

**Problem:** Valid login but subsequent requests fail with 401 Unauthorized

**Solutions:**
1. Check token is being sent: `Authorization: Bearer <token>`
2. Verify JWT_SECRET is same on all requests
3. Check token hasn't expired (8 days default)
4. Check token is in `Authorization` header, not body

---

## ✅ Deployment Checklist

- [ ] Verified PostgreSQL connection locally or confirmed Railway DATABASE_URL
- [ ] Set all Google OAuth credentials in environment
- [ ] Set strong JWT_SECRET (64+ characters)
- [ ] Backend starts without errors
- [ ] Can successfully POST to `/auth/google`
- [ ] Database migrations completed (`✅ Google OAuth database migrations completed`)
- [ ] Tested email/password registration
- [ ] Tested Google signup (creates account)
- [ ] Tested existing user + Google linking
- [ ] Tested all API endpoints with valid tokens
- [ ] Frontend environment variables updated
- [ ] Frontend Google buttons working
- [ ] Deployed to production
- [ ] Production login tested

---

## 📞 Support

**For local issues:**
```bash
# View backend logs
docker-compose logs -f backend

# View frontend logs
npm run web  # Check browser console
```

**For production issues:**
```bash
# View Railway logs
railway logs --follow

# Check Railway environment
railway env
```

**Database Issues:**
```bash
# Connect directly
psql $DATABASE_URL

# Check user table structure
\d "user"

# Check data
SELECT id, email, auth_provider, google_id FROM "user" LIMIT 10;
```

---

## 🎉 You're All Set!

Your app now has:
✅ One-click Google signup (creates account instantly)
✅ Email/password registration (traditional flow)
✅ Account linking (connect Google to email accounts)
✅ Secure JWT authentication
✅ Production-ready deployment

**Next Steps:**
1. Test locally with PostgreSQL
2. Deploy to Railway/Vercel
3. Monitor logs for any issues
4. Promote to users! 🚀
