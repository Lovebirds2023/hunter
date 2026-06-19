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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")
GOOGLE_IOS_CLIENT_ID = os.getenv("GOOGLE_IOS_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID")
GOOGLE_ANDROID_CLIENT_ID = os.getenv("GOOGLE_ANDROID_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID")

from google.oauth2 import id_token
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests

class GoogleVerificationUnavailable(Exception):
    pass

class GoogleOAuthRequest:
    def __init__(self, timeout=8):
        self.timeout = timeout
        self.request = requests.Request()

    def __call__(self, url, method="GET", body=None, headers=None, timeout=None, **kwargs):
        if isinstance(timeout, (int, float)):
            effective_timeout = min(timeout, self.timeout)
        else:
            effective_timeout = self.timeout
        return self.request(
            url,
            method=method,
            body=body,
            headers=headers,
            timeout=effective_timeout,
            **kwargs,
        )

def verify_google_token(token: str):
    audiences = [
        client_id
        for client_id in [GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID]
        if client_id
    ]
    if not audiences:
        logger.warning("Google OAuth verification is not configured with any client IDs.")
        return None

    try:
        token_audience = jwt.get_unverified_claims(token).get("aud")
    except Exception:
        token_audience = None

    if token_audience in audiences:
        audiences_to_try = [token_audience]
    else:
        audiences_to_try = audiences

    google_request = GoogleOAuthRequest(timeout=8)
    for audience in audiences_to_try:
        try:
            return id_token.verify_oauth2_token(token, google_request, audience)
        except ValueError as exc:
            logger.info("Google token audience check failed for configured client: %s", exc)
            continue
        except GoogleAuthError as exc:
            logger.warning("Google token verification could not reach Google: %s", exc)
            raise GoogleVerificationUnavailable("Google token verification is temporarily unavailable") from exc
    return None

import bcrypt

def verify_password(plain_password, hashed_password):
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        logger.warning("Invalid password hash encountered during login.")
        return False

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
