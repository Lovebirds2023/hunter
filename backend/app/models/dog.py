from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Float, Text
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Dog(Base):
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("user.id"))
    name = Column(String, index=True)
    breed = Column(String, index=True)
    color = Column(String, index=True)
    size = Column(String) # Small, Medium, Large
    age = Column(Integer)
    microchip_id = Column(String, unique=True, nullable=True)
    
    # Lost & Found Logic
    is_lost = Column(Boolean, default=False)
    last_seen_lat = Column(Float, nullable=True)
    last_seen_lon = Column(Float, nullable=True)
    lost_description = Column(Text, nullable=True)

    owner = relationship("User", back_populates="dogs")
    biometric_profile = relationship("BiometricProfile", back_populates="dog", uselist=False)
    bookings = relationship("Booking", back_populates="dog")

class BiometricProfile(Base):
    id = Column(Integer, primary_key=True, index=True)
    dog_id = Column(Integer, ForeignKey("dog.id"))
    
    # Stores JSON string or simple text for the vector/stub
    nose_print_vector = Column(Text, nullable=True) 
    
    # URLs to images used for registration
    front_image_url = Column(String, nullable=True)
    nose_image_url = Column(String, nullable=True)
    
    dog = relationship("Dog", back_populates="biometric_profile")
