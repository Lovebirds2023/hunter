from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.service import Service, Booking
from app.schemas import service as service_schema

router = APIRouter()

@router.get("/", response_model=List[service_schema.Service])
async def read_services(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    # In a real app, we would filter by geo-location (lat/lon radius)
    stmt = select(Service).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=service_schema.Service)
async def create_service(
    *,
    db: AsyncSession = Depends(get_db),
    service_in: service_schema.ServiceCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    if current_user.role != UserRole.PROVIDER and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Only providers can create services")
        
    service = Service(**service_in.dict(), provider_id=current_user.id)
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service
