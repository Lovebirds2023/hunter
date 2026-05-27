from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.dog import Dog
from app.models.service import Booking, Service
from app.models.wallet import Wallet

router = APIRouter()

def check_admin(current_user: User = Depends(deps.get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    # Count Users
    user_count = await db.scalar(select(func.count(User.id)))
    # Count Dogs
    dog_count = await db.scalar(select(func.count(Dog.id)))
    # Count Bookings
    booking_count = await db.scalar(select(func.count(Booking.id)))
    
    return {
        "users": user_count,
        "dogs": dog_count,
        "bookings": booking_count
    }

@router.put("/users/{user_id}/verify")
async def verify_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_admin)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_verified = True
    await db.commit()
    return {"message": f"User {user.email} verified"}
