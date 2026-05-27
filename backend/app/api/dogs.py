from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.dog import Dog
from app.schemas import dog as dog_schema
from app.services.ai_matcher import ai_matcher

router = APIRouter()

@router.get("/", response_model=List[dog_schema.Dog])
async def read_dogs(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    # Owners see their dogs. Providers/Admin might see all (simplified logic here)
    stmt = select(Dog).active() # Assuming basic select for now
    # Filter by owner for standard users
    stmt = select(Dog).where(Dog.owner_id == current_user.id).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=dog_schema.Dog)
async def create_dog(
    *,
    db: AsyncSession = Depends(get_db),
    dog_in: dog_schema.DogCreate,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    dog = Dog(**dog_in.dict(), owner_id=current_user.id)
    db.add(dog)
    await db.commit()
    await db.refresh(dog)
    return dog

@router.post("/identify", response_model=List[dict])
async def identify_dog(
    *,
    db: AsyncSession = Depends(get_db),
    id_request: dog_schema.IdentifyRequest, 
    # current_user: User = Depends(deps.get_current_user) # Public or protected? Let's say protected
) -> Any:
    """
    Identify a dog based on attributes (and implied nose print match).
    Returns list of matches with confidence scores.
    """
    # Fetch all lost dogs or all dogs? 
    # Usually you match against missing dogs database OR all dogs if found roaming.
    stmt = select(Dog) # In production, optimize this
    result = await db.execute(stmt)
    all_dogs = result.scalars().all()

    matches = ai_matcher.filter_candidates(
        all_dogs, 
        query_color=id_request.color, 
        query_breed=id_request.breed
    )
    
    # Format response
    response = []
    for dog, score in matches:
        response.append({
            "dog": dog,
            "confidence": score,
            "match_reason": "Attribute + Biometric Logic Stub"
        })
    return response
