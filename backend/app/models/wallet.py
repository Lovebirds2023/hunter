from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Enum, Text
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.db.base_class import Base

class TransactionType(str, enum.Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    PAYMENT = "payment" # User pays for service
    COMMISSION = "commission" # Platform fee
    PAYOUT = "payout" # Provider gets paid

class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

class Wallet(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True)
    balance = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="wallet")
    transactions = relationship("Transaction", back_populates="wallet")

class Transaction(Base):
    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallet.id"))
    amount = Column(Float, nullable=False)
    transaction_type = Column(Enum(TransactionType), index=True)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    reference_id = Column(String, nullable=True) # E.g., Booking ID or External Payment ID
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("Wallet", back_populates="transactions")
