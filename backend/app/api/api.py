from fastapi import APIRouter
from app.api import auth, dogs, services, bookings

api_router = APIRouter()
api_router.include_router(auth.router, tags=["login"])
api_router.include_router(dogs.router, prefix="/dogs", tags=["dogs"])
api_router.include_router(services.router, prefix="/services", tags=["services"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
from app.api import admin
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
