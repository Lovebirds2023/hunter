from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os
import logging
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

logger = logging.getLogger(__name__)

# --- JWT Configuration ---
SECRET_KEY = os.getenv("JWT_SECRET", "development_secret_key_that_is_at_least_32_characters_long")
if SECRET_KEY == "development_secret_key_that_is_at_least_32_characters_long":
    logger.warning("WARNING: JWT_SECRET environment variable is not set. Using unsafe default secret key.")
elif len(SECRET_KEY) < 32:
    logger.warning("WARNING: JWT_SECRET is too short. Use at least 64 random characters for production security.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))  # 30 days
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

from google.oauth2 import id_token
from google.auth.transport import requests

def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID)
        return idinfo
    except ValueError:
        return None

import bcrypt

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
