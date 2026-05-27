from typing import Optional, List
from pydantic import BaseModel

class DogBase(BaseModel):
    name: str
    breed: str
    color: str
    size: str
    age: int
    microchip_id: Optional[str] = None
    is_lost: bool = False
    last_seen_lat: Optional[float] = None
    last_seen_lon: Optional[float] = None
    lost_description: Optional[str] = None

class DogCreate(DogBase):
    pass

class DogUpdate(DogBase):
    pass

class DogInDBBase(DogBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

class Dog(DogInDBBase):
    pass

class IdentifyRequest(BaseModel):
    # For the stub, we will match primarily on attributes, but hypothetically this would receive image data
    color: Optional[str] = None
    breed: Optional[str] = None
    size: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
