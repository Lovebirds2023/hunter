from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.api import deps
from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, AuthProvider
from app.schemas import user as user_schema, token as token_schema
from sqlalchemy import select

router = APIRouter()

@router.post("/login/access-token", response_model=token_schema.Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            user.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=user_schema.User)
async def register_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: user_schema.UserCreate,
) -> Any:
    """
    Register a new user via email/password
    """
    stmt = select(User).where(User.email == user_in.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    
    # Password is required for email registration
    if not user_in.password:
        raise HTTPException(
            status_code=400,
            detail="Password is required for email registration. Use Google Sign-Up for passwordless signup.",
        )
    
    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        auth_provider=AuthProvider.EMAIL,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/google", response_model=token_schema.GoogleLoginResponse)
async def google_login(
    *,
    db: AsyncSession = Depends(get_db),
    request: token_schema.GoogleLoginRequest,
) -> Any:
    """
    Google OAuth login/signup endpoint.
    Automatically creates a new account if user doesn't exist.
    """
    # Verify the Google token
    id_info = security.verify_google_token(request.id_token)
    if not id_info:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    
    email = id_info.get("email")
    full_name = id_info.get("name", "")
    google_id = id_info.get("sub")  # Google's unique ID
    
    if not email or not google_id:
        raise HTTPException(status_code=400, detail="Invalid Google token - missing required fields")
    
    # Check if user exists by email
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user if they don't exist
        user = User(
            email=email,
            full_name=full_name if full_name else None,
            google_id=google_id,
            auth_provider=AuthProvider.GOOGLE,
            hashed_password=None,  # No password for Google users
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Link Google account to existing user if not already linked
        if not user.google_id:
            user.google_id = google_id
            user.auth_provider = AuthProvider.GOOGLE
            await db.commit()
            await db.refresh(user)
    
    # Create JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/link-google", response_model=user_schema.User)
async def link_google_account(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    request: token_schema.GoogleLoginRequest,
) -> Any:
    """
    Link a Google account to an existing email-based user account.
    Requires user to be authenticated.
    """
    # Verify the Google token
    id_info = security.verify_google_token(request.id_token)
    if not id_info:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    
    google_id = id_info.get("sub")
    if not google_id:
        raise HTTPException(status_code=400, detail="Invalid Google token - missing ID")
    
    # Check if this Google ID is already linked to another user
    stmt = select(User).where(User.google_id == google_id)
    result = await db.execute(stmt)
    existing_google_user = result.scalar_one_or_none()
    
    if existing_google_user and existing_google_user.id != current_user.id:
        raise HTTPException(status_code=400, detail="This Google account is already linked to another user")
    
    # Link Google account to current user
    current_user.google_id = google_id
    current_user.auth_provider = AuthProvider.GOOGLE
    await db.commit()
    await db.refresh(current_user)
    
    return current_user
