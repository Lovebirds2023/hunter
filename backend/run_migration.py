#!/usr/bin/env python3
"""
Database Migration Runner for Google OAuth Setup
This script applies the OAuth migration to the PostgreSQL database.
"""

import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Database configuration
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_SERVER = os.getenv("POSTGRES_SERVER", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "lovedogs")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

def run_migration():
    """Run the OAuth migration on the database."""
    print("🔄 Starting Google OAuth Database Migration...")
    print(f"📊 Database: {POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}")
    
    try:
        # Create connection
        engine = create_engine(DATABASE_URL)
        print("✅ Database connection successful")
        
        # Read migration file
        migration_path = os.path.join(os.path.dirname(__file__), 'migrations', '001_add_oauth_to_users.sql')
        
        if not os.path.exists(migration_path):
            print(f"❌ Migration file not found: {migration_path}")
            return False
        
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        with engine.connect() as conn:
            # Split by semicolon and execute each statement
            statements = migration_sql.split(';')
            executed = 0
            
            for i, statement in enumerate(statements, 1):
                statement = statement.strip()
                if not statement:
                    continue
                
                try:
                    conn.execute(text(statement))
                    executed += 1
                    print(f"✅ Step {executed}: Executed successfully")
                except Exception as e:
                    print(f"⚠️  Step {executed}: {type(e).__name__}: {str(e)[:100]}")
                    # Continue on some errors (like index already exists)
                    if "already exists" in str(e).lower() or "duplicate key" in str(e).lower():
                        continue
                    elif "column" in str(e).lower() and "already exists" in str(e).lower():
                        continue
                    else:
                        raise
            
            conn.commit()
        
        print(f"\n✅ Migration completed successfully! ({executed} statements executed)")
        print("📋 Your User table now supports Google OAuth:")
        print("   - auth_provider: Tracks signup method (email/google)")
        print("   - google_id: Stores Google's unique ID")
        print("   - hashed_password: Now optional for OAuth users")
        print("   - full_name: Now optional for OAuth users")
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {type(e).__name__}")
        print(f"📝 Error: {str(e)}")
        print("\n💡 Troubleshooting:")
        print("   1. Check database connection in .env file")
        print("   2. Verify PostgreSQL is running")
        print("   3. Ensure database exists: CREATE DATABASE lovedogs;")
        print("   4. Run manual migration: psql -h localhost -U postgres -d lovedogs < migrations/001_add_oauth_to_users.sql")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
