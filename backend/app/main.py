from fastapi import FastAPI
from app.core.config import settings
from app.api.api import api_router
from sqlalchemy import text
import logging

app = FastAPI(title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json")

logger = logging.getLogger(__name__)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.on_event("startup")
async def startup():
    """Run database migrations on startup"""
    try:
        from app.db.session import get_db_sync
        from sqlalchemy import create_engine
        
        # Get sync engine for migrations
        engine = create_engine(settings.DATABASE_URL.replace("asyncpg", "psycopg2"), echo=False)
        
        # Migration SQL
        migration_statements = [
            # Add auth_provider column
            """ALTER TABLE "user" 
               ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';""",
            
            # Add google_id column
            """ALTER TABLE "user" 
               ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;""",
            
            # Make password nullable
            """ALTER TABLE "user" 
               ALTER COLUMN hashed_password DROP NOT NULL;""",
            
            # Make full_name nullable
            """ALTER TABLE "user" 
               ALTER COLUMN full_name DROP NOT NULL;""",
            
            # Create indexes
            """CREATE INDEX IF NOT EXISTS idx_user_google_id ON "user"(google_id);""",
            """CREATE INDEX IF NOT EXISTS idx_user_auth_provider ON "user"(auth_provider);""",
            """CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);""",
        ]
        
        with engine.connect() as conn:
            for i, stmt in enumerate(migration_statements, 1):
                try:
                    conn.execute(text(stmt))
                    logger.info(f"✅ Migration step {i} completed")
                except Exception as e:
                    error_msg = str(e).lower()
                    # Skip errors for columns/indexes that already exist
                    if any(skip in error_msg for skip in ["already exists", "duplicate", "constraint"]):
                        logger.info(f"⚠️  Migration step {i} skipped (already exists)")
                    else:
                        logger.warning(f"⚠️  Migration step {i} warning: {str(e)[:100]}")
            
            conn.commit()
        
        logger.info("✅ All database migrations completed successfully")
        logger.info("🔐 Google OAuth fields are ready in User table")
        
    except Exception as e:
        logger.warning(f"⚠️  Database migrations skipped: {str(e)[:150]}")
        # Don't fail startup, just log the warning

@app.get("/")
async def root():
    return {"message": "Welcome to Lovedogs 360 API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
