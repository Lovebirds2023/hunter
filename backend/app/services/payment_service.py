from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.wallet import Wallet, Transaction, TransactionType, TransactionStatus
from app.models.service import Booking, BookingStatus

COMMISSION_RATE = 0.20 # 20%

class PaymentService:
    @staticmethod
    async def process_service_completion(db: AsyncSession, booking_id: int):
        # 1. Fetch booking with service/price
        stmt = select(Booking).where(Booking.id == booking_id)
        result = await db.execute(stmt)
        booking = result.scalar_one_or_none()
        
        if not booking or booking.status != BookingStatus.COMPLETED:
            return # Only process if completed
            
        service_price = booking.service.price
        provider_id = booking.service.provider_id
        
        commission_amount = service_price * COMMISSION_RATE
        payout_amount = service_price - commission_amount
        
        # 2. Add to Provider Wallet (Create if not exists)
        stmt_wallet = select(Wallet).where(Wallet.user_id == provider_id)
        result_wallet = await db.execute(stmt_wallet)
        wallet = result_wallet.scalar_one_or_none()
        
        if not wallet:
            wallet = Wallet(user_id=provider_id)
            db.add(wallet)
            await db.commit()
            await db.refresh(wallet)

        # 3. Create Transactions
        # Payout
        tx_payout = Transaction(
            wallet_id=wallet.id,
            amount=payout_amount,
            transaction_type=TransactionType.PAYOUT,
            status=TransactionStatus.COMPLETED,
            reference_id=str(booking.id),
            description=f"Payout for Booking #{booking.id}"
        )
        
        # Commission (Recorded for platform metrics, theoretically in a Platform Wallet)
        # For now we just record it in the provider's wallet log as a 'deduction' explanation or separate ledger
        # Simplified: We just increment balance by net amount.
        
        wallet.balance += payout_amount
        
        db.add(tx_payout)
        await db.commit()
        return tx_payout
