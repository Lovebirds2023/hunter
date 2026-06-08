from typing import Optional
from pydantic import BaseModel
from app.schemas.user import User

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class GoogleLoginRequest(BaseModel):
    id_token: str

class GoogleLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User
