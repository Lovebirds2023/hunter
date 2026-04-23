from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.service import Service, Booking, BookingStatus
from app.schemas import service as service_schema

router = APIRouter()

@router.get("/", response_model=List[service_schema.Booking])
async def read_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    stmt = select(Booking).where(Booking.user_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=service_schema.Booking)
async def create_booking(
    *,
    db: AsyncSession = Depends(get_db),
    booking_in: service_schema.BookingCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    service = await db.get(Service, booking_in.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    booking = Booking(
        **booking_in.dict(),
        user_id=current_user.id,
        status=BookingStatus.PENDING
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking
from app.services.payment_service import PaymentService

@router.put("/{booking_id}/complete")
async def complete_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    # In reality, only Provider or Consumer confirms completion. Let's say User (Dog Owner) confirms it.
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    booking.status = BookingStatus.COMPLETED
    db.add(booking)
    await db.commit()
    
    # Trigger Commission Logic
    await PaymentService.process_service_completion(db, booking_id)
    
    return {"message": "Booking completed and payment processed"}
