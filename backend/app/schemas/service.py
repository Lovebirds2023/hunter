from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.service import ServiceType, BookingStatus

class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    service_type: ServiceType
    location_lat: float
    location_lon: float
    address: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    id: int
    provider_id: int
    
    class Config:
        from_attributes = True

class BookingBase(BaseModel):
    service_id: int
    dog_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None

class BookingCreate(BookingBase):
    pass

class Booking(BookingBase):
    id: int
    user_id: int
    status: BookingStatus
    created_at: datetime
    
    class Config:
        from_attributes = True
