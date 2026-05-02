from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Try to get DATABASE_URL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback to individual variables if DATABASE_URL is missing (e.g. on Railway or local Docker)
if not SQLALCHEMY_DATABASE_URL:
    pg_user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER", "postgres")
    pg_password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD", "password")
    pg_host = os.getenv("PGHOST") or os.getenv("POSTGRES_SERVER", "db")
    pg_port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT", "5432")
    pg_db = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB", "lovedogs")
    SQLALCHEMY_DATABASE_URL = f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_db}"

# Fix for SQLAlchemy 2.0+ with postgresql:// vs postgres://
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
