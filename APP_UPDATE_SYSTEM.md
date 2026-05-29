# App Update Notification System

## Overview

This system enables automatic app update notifications to all users. When a new version is released on Play Store or App Store, admins can register it in the backend, and all app users will receive notifications.

---

## How It Works

### User Experience (Client Side)

1. **On App Launch**: The app automatically checks for available updates
2. **Background Check**: Checks once every 24 hours to avoid excessive API calls
3. **Optional Update**: If available, shows a modal with release notes and "Update Now" button
4. **Critical Update**: If marked as required, forces the user to update before continuing
5. **Direct Store Link**: When user clicks "Update Now", they're directed to Play Store or App Store

### Admin Flow (Server Side)

1. **Release New Version**: Admin publishes new app build on Play Store/App Store
2. **Register Version**: Admin calls backend API to register the version
3. **Auto Notifications**: All users receive a notification about the new version
4. **Manual Notify**: Can also trigger notifications again manually if needed

---

## Backend API Endpoints

### 1. Check Latest Version (Public)
```
GET /app/version/latest?platform=android
```

**Parameters:**
- `platform` (optional): `"android"`, `"ios"`, or `"all"` (default: `"all"`)

**Response:**
```json
{
  "id": "uuid",
  "version": "1.0.2",
  "platform": "all",
  "release_notes": "Bug fixes and performance improvements",
  "download_url": "https://play.google.com/store/apps/details?id=com.lovedogs360",
  "is_required": false,
  "is_active": true,
  "created_at": "2026-05-27T10:00:00",
  "updated_at": "2026-05-27T10:00:00"
}
```

---

### 2. Create New Version (Admin Only)
```
POST /app/version
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "version": "1.0.2",
  "platform": "all",
  "release_notes": "Bug fixes and performance improvements",
  "download_url": "https://play.google.com/store/apps/details?id=com.lovedogs360",
  "is_required": false
}
```

**Parameters:**
- `version` (required): Semantic version (e.g., "1.0.2")
- `platform` (required): `"android"`, `"ios"`, or `"all"`
- `release_notes` (optional): What's new in this version
- `download_url` (optional): Link to Play Store or App Store
- `is_required` (optional): Force update or optional (default: false)

**Response:**
```json
{
  "id": "uuid",
  "version": "1.0.2",
  "platform": "all",
  "release_notes": "Bug fixes and performance improvements",
  "download_url": "https://play.google.com/store/apps/details?id=com.lovedogs360",
  "is_required": false,
  "is_active": true,
  "created_at": "2026-05-27T10:00:00",
  "updated_at": "2026-05-27T10:00:00"
}
```

**Note:** Creating a new version automatically sends notifications to all users!

---

### 3. Send Notification for Existing Version (Admin Only)
```
POST /app/version/{version_id}/notify
Authorization: Bearer {admin_jwt_token}
```

**Response:**
```json
{
  "message": "Notification sent to all users for version 1.0.2"
}
```

---

## How to Use (Step by Step)

### Step 1: Build and Release App

1. Update app version in `frontend/package.json`
2. Build for Android:
   ```bash
   eas build --platform android
   ```
3. Build for iOS:
   ```bash
   eas build --platform ios
   ```
4. Upload builds to Play Store (Android) and App Store (iOS)
5. Get the download URLs from both stores

### Step 2: Register Version in Backend

Use the API endpoint to register the new version:

**Using curl:**
```bash
curl -X POST http://localhost:8000/app/version \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.2",
    "platform": "all",
    "release_notes": "- Bug fixes\n- Performance improvements\n- New features",
    "download_url": "https://play.google.com/store/apps/details?id=com.lovedogs360",
    "is_required": false
  }'
```

**Using Python:**
```python
import requests

url = "http://localhost:8000/app/version"
headers = {
    "Authorization": f"Bearer {admin_token}",
    "Content-Type": "application/json"
}
payload = {
    "version": "1.0.2",
    "platform": "all",
    "release_notes": "Bug fixes and improvements",
    "download_url": "https://play.google.com/store/apps/details?id=com.lovedogs360",
    "is_required": False
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

**Using JavaScript/Node.js:**
```javascript
const response = await fetch('http://localhost:8000/app/version', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    version: '1.0.2',
    platform: 'all',
    release_notes: 'Bug fixes and improvements',
    download_url: 'https://play.google.com/store/apps/details?id=com.lovedogs360',
    is_required: false
  })
});

const data = await response.json();
console.log(data);
```

### Step 3: All Users Receive Notification

- **Optional Updates**: Users see a notification in their notification feed and can dismiss it
- **Critical Updates**: Users see a modal that forces them to update

---

## Frontend Implementation

### Version Check Locations

1. **On App Launch** (`App.js`):
   - Automatically checks for updates when app starts
   - Shows modal if update available

2. **In Settings** (Optional - can be added to ProfileScreen):
   ```javascript
   import { useAppUpdateCheck } from './src/hooks/useAppUpdateCheck';
   
   // In component
   const { manualCheck } = useAppUpdateCheck(currentVersion, onAvailable, onRequired);
   
   // In a button
   <Button onPress={manualCheck} title="Check for Updates" />
   ```

---

## Update Types

### Optional Update
```json
{
  "version": "1.0.2",
  "is_required": false
}
```
- Users see notification
- Can dismiss and continue using app
- Users redirected to store when clicking "Update"

### Critical/Required Update
```json
{
  "version": "1.0.3",
  "is_required": true
}
```
- Modal cannot be dismissed
- Users must update to continue
- Good for security patches or critical bugs

---

## Database Schema

### App Versions Table

```sql
CREATE TABLE app_versions (
    id VARCHAR PRIMARY KEY,
    version VARCHAR UNIQUE NOT NULL,
    platform VARCHAR NOT NULL,
    release_notes VARCHAR,
    download_url VARCHAR,
    is_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Best Practices

1. **Version Numbering**: Use semantic versioning (MAJOR.MINOR.PATCH)
   - 1.0.0 = initial release
   - 1.0.1 = patch/bug fix
   - 1.1.0 = new features (minor)
   - 2.0.0 = breaking changes (major)

2. **Release Notes**: Write clear, user-friendly notes
   - ✅ "Fixed login issues"
   - ❌ "Fixed OAuth2 token refresh bug"

3. **Critical Updates**:
   - Use `is_required: true` only for security fixes
   - Use `is_required: false` for feature updates

4. **Platform-Specific**: Use `platform: "android"` or `platform: "ios"` for OS-specific releases
   - Use `platform: "all"` for universal updates

5. **Download URLs**: Always provide correct store links
   - Play Store: `https://play.google.com/store/apps/details?id=com.lovedogs360`
   - App Store: `https://apps.apple.com/app/lovedogs-360/id{app_id}`

---

## Testing

### Test Update Check
```bash
# Get latest version
curl http://localhost:8000/app/version/latest?platform=android

# Test with specific platform
curl http://localhost:8000/app/version/latest?platform=ios
```

### Test Version Creation
Register a test version and check:
1. Response includes all fields
2. Users receive notification
3. App update modal appears

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Update not showing | Check if `is_active: true` and version is newer |
| Notification not sent | Check if user has email/phone configured |
| Can't open store link | Verify download_url is correct |
| Modal won't dismiss | Check if `is_required: true` (critical updates can't dismiss) |

---

## Files Modified/Created

- ✅ `backend/models.py` - Added `AppVersion` model
- ✅ `backend/schemas.py` - Added version schemas
- ✅ `backend/main.py` - Added version endpoints
- ✅ `frontend/src/api/appUpdates.js` - API helper functions
- ✅ `frontend/src/hooks/useAppUpdateCheck.js` - React hook for checking updates
- ✅ `frontend/src/components/UpdateModal.js` - UI modal component
- ✅ `frontend/App.js` - Integrated update checking on app launch
