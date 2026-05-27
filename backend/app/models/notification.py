from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Notification(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"))
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Optional metadata for Deep Linking (e.g., {"screen": "DogProfile", "id": 1})
    data = Column(String, nullable=True) 

    user = relationship("User", back_populates="notifications")
