# Google OAuth Setup Guide - LovedDogs 360

## Overview

This guide walks you through implementing Google Sign-In/Sign-Up for your app with a streamlined registration flow.

### What Was Implemented

✅ **Backend**
- Updated User model with OAuth tracking (`auth_provider`, `google_id`)
- New `/auth/google` endpoint for Google login/signup
- New `/auth/link-google` endpoint to link Google to existing email accounts
- Auto-account creation when new users sign in with Google
- Proper password handling (optional for OAuth users)

✅ **Frontend**
- Google Sign-Up button on RegisterScreen
- "Continue with Google" button on LoginScreen
- Automatic account creation on first Google login (no manual signup needed)
- Secure token management

---

## Step 1: Environment Variables Setup

### For Backend

Create a `.env` file in the `backend/` folder with:

```bash
# Database (Railway/PostgreSQL)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_SERVER=your-db-host.railway.app
POSTGRES_PORT=5432
POSTGRES_DB=lovedogs

# JWT Secret (generate a secure random string)
JWT_SECRET=your_super_secret_key_min_64_chars_xxxxxxxxxxxxxxxx
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=11520

# Google OAuth - Get these from Google Cloud Console
# https://console.cloud.google.com/ > APIs & Services > Credentials
GOOGLE_CLIENT_ID=616203224372-756q5k5ujlqnaaekeo9pgb2pqai3ussf.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=616203224372-o8137t06ph20itjsfqvec0envtllto8j.apps.googleusercontent.com
GOOGLE_ANDROID_CLIENT_ID=<your_android_client_id_for_lovedogs360.co.ke>
```

### For Frontend

Your `.env` file (frontend/) should already have Google Client IDs from your .env.example:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=616203224372-756q5k5ujlqnaaekeo9pgb2pqai3ussf.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=616203224372-o8137t06ph20itjsfqvec0envtllto8j.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<your_android_client_id_for_lovedogs360.co.ke>
EXPO_PUBLIC_GOOGLE_REDIRECT_PATH=auth/google
```

### Android Play/Internal Testing Client

The production app now starts Google through Supabase OAuth on Android and iOS. Do not use the Expo native Google ID-token request for Android sign-in; Google rejects that custom URI scheme flow with `invalid_request`.

Android OAuth client IDs are only needed if you later add a native Google Sign-In SDK. The current Supabase flow uses the Google **Web client** configured in Supabase, then returns to the app with `lovedogs360://auth/google`.

### Google Cloud Console Redirect URIs

In Google Cloud Console, open **APIs & Services > Credentials > OAuth 2.0 Client IDs > Web client** and add the Supabase callback under **Authorized redirect URIs**:

```text
https://dnuwenqsyurjgmyurttj.supabase.co/auth/v1/callback
```

Also add these under **Authorized JavaScript origins** for the web app:

```text
https://hunter-k9lr.vercel.app
https://lovedogs360.co.ke
https://www.lovedogs360.co.ke
http://localhost:19006
http://localhost:8081
http://localhost:8082
```

In Supabase Dashboard, open **Authentication > URL Configuration** and allow these redirect URLs:

```text
https://lovedogs360.co.ke/auth/google
https://www.lovedogs360.co.ke/auth/google
https://hunter-k9lr.vercel.app/auth/google
lovedogs360://auth/google
http://localhost:19006/auth/google
http://localhost:8081/auth/google
http://localhost:8082/auth/google
```

If Google still shows `redirect_uri_mismatch`, expand the error details and copy the exact `redirect_uri` value into the Google Web client's **Authorized redirect URIs**. For Supabase OAuth it should be the Supabase `/auth/v1/callback` URL, not the app URL.

---

## Step 2: Database Migration

Run the migration to add OAuth columns to the User table:

### Option A: Using SQL Script (Recommended for Production)

```bash
# Connect to your database and run:
psql -h your-db-host -U postgres -d lovedogs < backend/migrations/001_add_oauth_to_users.sql
```

### Option B: Using Python

```bash
cd backend
python -c "
from sqlalchemy import text
from app.db.session import SessionLocal
from app.core.config import settings

# Read migration file
with open('migrations/001_add_oauth_to_users.sql') as f:
    sql = f.read()

# Execute migration
db = SessionLocal()
for statement in sql.split(';'):
    if statement.strip():
        db.execute(text(statement))
db.commit()
print('✅ Migration completed successfully')
"
```

### Option C: Using FastAPI Dependency (Automatic on Startup)

Add this to your `main.py` startup event:

```python
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        with open('backend/migrations/001_add_oauth_to_users.sql') as f:
            sql = f.read()
        for statement in sql.split(';'):
            if statement.strip():
                try:
                    await conn.execute(text(statement))
                except Exception as e:
                    print(f"⚠️ Migration step skipped: {e}")
        await conn.commit()
```

---

## Step 3: API Endpoints Reference

### Login with Google

**Endpoint:** `POST /auth/google`

**Request:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "auth_provider": "google",
    "google_id": "103847524682174...",
    "role": "owner",
    "is_active": true,
    "is_verified": false
  }
}
```

### Link Google to Existing Account

**Endpoint:** `POST /auth/link-google`
**Requires:** Valid JWT token

**Request:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response:** Updated user object with linked Google ID

---

## Step 4: Testing the Complete Flow

### Test Case 1: New User Google Sign-Up

```bash
# 1. Open login screen on app
# 2. Click "Continue with Google" or "Sign up with Google"
# 3. Select Google account
# ✅ Account automatically created, logged in

curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "<your-google-id-token>"
  }'
```

### Test Case 2: Existing User Email Login

```bash
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=yourpassword"
```

### Test Case 3: Link Google to Email Account

```bash
curl -X POST http://localhost:8000/auth/link-google \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id_token": "<your-google-id-token>"
  }'
```

### Test Case 4: Get User Profile

```bash
curl -X GET http://localhost:8000/users/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## Step 5: Common Issues & Solutions

### ❌ "Invalid Google token"
- **Cause:** Google Client ID mismatch or token expired
- **Solution:** Verify `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, and `GOOGLE_ANDROID_CLIENT_ID` in `.env`
- **Check:** Ensure tokens expire within 1 hour

### ❌ "This email already exists"
- **Cause:** User registered with email, now trying Google with same email
- **Solution:** This is expected! The user should:
  1. Login with their email/password
  2. Go to Profile Settings
  3. Click "Link Google Account"
  4. Or they can reset password and use "Continue with Google" next time

### ❌ Database migration fails
- **Cause:** User table doesn't exist or SQL syntax error
- **Solution:** 
  ```bash
  # Check database connection
  psql -h your-host -U postgres -d lovedogs -c "SELECT version();"
  
  # Run migration manually with errors displayed
  psql -h your-host -U postgres -d lovedogs < backend/migrations/001_add_oauth_to_users.sql
  ```

### ❌ Frontend showing "Google login unavailable"
- **Cause:** Missing or invalid Google Client IDs in .env
- **Solution:** 
  ```bash
  # In frontend/
  cat .env | grep GOOGLE
  
  # Make sure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is real, not placeholder
  ```

---

## Step 6: Deployment Checklist

- [ ] Set `GOOGLE_CLIENT_ID` in Railway/production environment
- [ ] Set `GOOGLE_IOS_CLIENT_ID` in Railway/production environment
- [ ] Set `GOOGLE_ANDROID_CLIENT_ID` in Railway and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in frontend builds before enabling Google on Android
- [ ] Set `JWT_SECRET` to a strong, random value (min 64 chars)
- [ ] Run database migration in production
- [ ] Test Google login in production URL
- [ ] Verify auth tokens work across requests
- [ ] Test linking Google to existing accounts
- [ ] Monitor error logs for token verification issues

---

## Step 7: User Flow Explanation

### New User Google Sign-Up (Fastest Path)
```
User opens app
    ↓
Sees LoginScreen with "Continue with Google"
    ↓
Clicks button → Selects Google account
    ↓
Backend receives ID token
    ↓
Verifies Google token
    ↓
Checks if email exists:
  - No → Create account with full_name from Google, no password
  - Yes → Link Google to existing account
    ↓
Return JWT token + user info
    ↓
✅ User logged in, fully authenticated
```

### Existing User Email → Google Linking
```
User has email account
    ↓
Logs in with email/password
    ↓
Goes to Profile Settings
    ↓
Clicks "Link Google Account"
    ↓
Sends Google token to /auth/link-google
    ↓
Backend updates user.google_id
    ↓
✅ Can now use "Continue with Google" next time
```

---

## Step 8: Frontend Code Reference

### LoginScreen Auto-Login with Google
```javascript
const result = await startSupabaseGoogleOAuth();

if (result.type === 'success') {
  await completeSupabaseOAuthSession(result.session);
}
```

### RegisterScreen Google Sign-Up
```javascript
<TouchableOpacity
    style={styles.googleSignUpBtn}
    onPress={handleGoogleSignupPress}
>
    <Text>Sign up with Google</Text>
</TouchableOpacity>
```

---

## Advanced: Custom Post-Registration Flow

After Google signup, you might want to redirect users to:

1. **Profile Completion Screen** - Collect phone, location, bio
2. **Role Selection Screen** - Let them choose owner/provider
3. **Welcome Tour** - Show onboarding
4. **Home Screen** - Direct to main app

Modify `AuthContext.js`:

```javascript
const googleLogin = async (idToken) => {
  // ... existing code ...
  
  // Check if user is new (first time login)
  if (user.is_verified === false && !user.phone_number) {
    // New user, redirect to onboarding
    navigation.navigate('CompleteProfile');
  } else {
    // Existing user, go to home
    navigation.navigate('Home');
  }
};
```

---

## Support & Next Steps

- **Questions?** Check backend logs: `docker-compose logs backend`
- **Frontend issues?** Check React Native console
- **Database issues?** Verify PostgreSQL connection: `psql -h host -U user -d db -c "SELECT 1"`
- **Need two-factor auth?** Add SMS verification layer on top

---

## Summary

Users can now:
✅ Sign up instantly with Google (no form filling)
✅ Link Google to existing email accounts
✅ Switch between email and Google login anytime
✅ Automatic account creation on first Google login
✅ Secure JWT tokens for all authentication methods

**That's it! Your Google OAuth is ready to go.** 🚀
