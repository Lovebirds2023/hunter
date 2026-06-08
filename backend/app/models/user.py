from sqlalchemy import Boolean, Column, Integer, String, Enum
from sqlalchemy.orm import relationship
import enum
from app.db.base_class import Base

class UserRole(str, enum.Enum):
    OWNER = "owner"
    PROVIDER = "provider"
    ADMIN = "admin"

class AuthProvider(str, enum.Enum):
    EMAIL = "email"
    GOOGLE = "google"

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    auth_provider = Column(Enum(AuthProvider), default=AuthProvider.EMAIL)  # Track signup method
    google_id = Column(String, unique=True, nullable=True, index=True)  # Store Google's unique ID
    role = Column(Enum(UserRole), default=UserRole.OWNER)
    is_active = Column(Boolean(), default=True)
    is_verified = Column(Boolean(), default=False) # For providers/admin approval

    dogs = relationship("Dog", back_populates="owner")
    services = relationship("Service", back_populates="provider")
    bookings = relationship("Booking", back_populates="user")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
