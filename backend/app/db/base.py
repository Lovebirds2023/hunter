# Import all models here so Alembic can find them
from app.db.base_class import Base
from app.models.user import User
from app.models.dog import Dog, BiometricProfile
from app.models.service import Service, Booking
from app.models.wallet import Wallet, Transaction
from app.models.notification import Notification
