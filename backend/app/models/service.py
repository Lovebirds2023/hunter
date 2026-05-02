from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.db.base_class import Base

class ServiceType(str, enum.Enum):
    WALKING = "walking"
    GROOMING = "grooming"
    VET = "vet"
    BOARDING = "boarding"
    TRAINING = "training"

class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Service(Base):
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("user.id"))
    name = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    service_type = Column(Enum(ServiceType), index=True)
    
    # Location for "Uber-like" discovery
    location_lat = Column(Float)
    location_lon = Column(Float)
    address = Column(String, nullable=True)

    provider = relationship("User", back_populates="services")
    bookings = relationship("Booking", back_populates="service")

class Booking(Base):
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("service.id"))
    user_id = Column(Integer, ForeignKey("user.id")) # The consumer
    dog_id = Column(Integer, ForeignKey("dog.id"), nullable=True)
    
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    scheduled_at = Column(DateTime, nullable=True)

    service = relationship("Service", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    dog = relationship("Dog", back_populates="bookings")
