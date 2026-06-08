-- Migration: Add OAuth Support to User Table
-- Description: Adds fields to support Google OAuth authentication
-- Created: 2026-06-08

-- Add auth_provider column to track authentication method
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';

-- Add google_id column to store Google's unique identifier
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Make password nullable for OAuth users (who don't use passwords)
ALTER TABLE "user" 
ALTER COLUMN hashed_password DROP NOT NULL;

-- Make full_name nullable (users might not provide it initially)
ALTER TABLE "user" 
ALTER COLUMN full_name DROP NOT NULL;

-- Create index on google_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_google_id ON "user"(google_id);

-- Create index on auth_provider for faster queries
CREATE INDEX IF NOT EXISTS idx_user_auth_provider ON "user"(auth_provider);

-- Add constraint to ensure email uniqueness remains
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
