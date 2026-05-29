#!/usr/bin/env python3
"""
App Version Management Script
Register new app versions and send update notifications to all users
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"  # Change to production URL when deploying
ADMIN_EMAIL = "admin@lovedogs360.com"
ADMIN_PASSWORD = "your_admin_password"  # Use environment variables in production

# Platform options: "android", "ios", "all"
PLATFORM = "all"

def login_admin(email, password):
    """Get admin JWT token"""
    print("🔐 Logging in admin account...")
    response = requests.post(
        f"{BASE_URL}/token",
        data={"username": email, "password": password}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.json()}")
        sys.exit(1)
    
    token = response.json().get("access_token")
    print("✅ Admin login successful")
    return token

def register_app_version(token, version, platform, release_notes, download_url, is_required=False):
    """Register a new app version"""
    print(f"\n📱 Registering version {version}...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "version": version,
        "platform": platform,
        "release_notes": release_notes,
        "download_url": download_url,
        "is_required": is_required
    }
    
    response = requests.post(
        f"{BASE_URL}/app/version",
        json=payload,
        headers=headers
    )
    
    if response.status_code != 200:
        print(f"❌ Registration failed: {response.json()}")
        return None
    
    version_info = response.json()
    print("✅ Version registered successfully!")
    print(f"   Version ID: {version_info['id']}")
    print(f"   Version: {version_info['version']}")
    print(f"   Platform: {version_info['platform']}")
    print(f"   Required: {'Yes (critical update)' if version_info['is_required'] else 'No (optional)'}")
    print(f"   Release Notes: {version_info['release_notes']}")
    
    return version_info

def get_latest_version(platform="all"):
    """Check latest available version"""
    print(f"\n🔍 Checking latest version ({platform})...")
    
    response = requests.get(
        f"{BASE_URL}/app/version/latest",
        params={"platform": platform}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get version: {response.json()}")
        return None
    
    version_info = response.json()
    if not version_info:
        print("ℹ️  No versions found")
        return None
    
    print("✅ Latest version:")
    print(f"   Version: {version_info['version']}")
    print(f"   Platform: {version_info['platform']}")
    print(f"   Required: {'Yes' if version_info['is_required'] else 'No'}")
    print(f"   Release Notes: {version_info['release_notes']}")
    
    return version_info

def main():
    """Main function with example usage"""
    
    print("=" * 60)
    print("  🎯 Lovedogs 360 App Version Management")
    print("=" * 60)
    
    # Step 1: Login
    token = login_admin(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    # Step 2: Get current version
    get_latest_version(platform="android")
    get_latest_version(platform="ios")
    
    # Step 3: Register new version
    # ⚠️  Update these values before running
    VERSION = "1.0.2"
    RELEASE_NOTES = """
    🐕 What's New in Version 1.0.2:
    
    ✨ Improvements:
    • Fixed payment processing issues
    • Improved app performance
    • Better error messages
    
    🔧 Bug Fixes:
    • Fixed notification delivery
    • Resolved login timeout issue
    • Fixed image upload on slower connections
    
    🔐 Security:
    • Updated security certificates
    • Improved data encryption
    """
    
    # Play Store URL (Android)
    ANDROID_URL = "https://play.google.com/store/apps/details?id=com.lovedogs360"
    
    # App Store URL (iOS)
    IOS_URL = "https://apps.apple.com/app/lovedogs-360/id1234567890"
    
    # Register for all platforms
    print("\n" + "=" * 60)
    print("📲 RELEASING NEW VERSION TO ALL PLATFORMS")
    print("=" * 60)
    
    # Register for Android
    register_app_version(
        token,
        version=VERSION,
        platform="android",
        release_notes=RELEASE_NOTES,
        download_url=ANDROID_URL,
        is_required=False
    )
    
    # Register for iOS
    register_app_version(
        token,
        version=VERSION,
        platform="ios",
        release_notes=RELEASE_NOTES,
        download_url=IOS_URL,
        is_required=False
    )
    
    print("\n" + "=" * 60)
    print("✅ ALL DONE!")
    print("=" * 60)
    print("\n📢 Notifications have been sent to all users!")
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n💡 Users will see the update notification when they next open the app.")
    print("   Optional updates can be dismissed.")
    print("   Critical updates (is_required=true) cannot be dismissed.")

if __name__ == "__main__":
    main()
