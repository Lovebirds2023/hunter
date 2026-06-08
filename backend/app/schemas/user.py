from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole, AuthProvider

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.OWNER

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional for Google OAuth users

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    is_active: bool
    auth_provider: AuthProvider = AuthProvider.EMAIL
    google_id: Optional[str] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass
