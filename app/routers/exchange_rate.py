from typing import List
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.utils.dependencies import get_current_user
from app.models.user import User
from app.models.payment import ExchangeRateLog
from app.services.exchange_rate import (
    fetch_blue_dollar_rate_sync,
    get_exchange_rate_history,
    log_exchange_rate,
)

router = APIRouter(prefix="/exchange-rate", tags=["Exchange Rate"])


class ExchangeRateResponse(BaseModel):
    rate: Decimal
    source: str
    fetched_at: datetime


class ExchangeRateHistoryItem(BaseModel):
    id: int
    rate_usd_to_ars: Decimal
    source: str
    fetched_at: datetime

    class Config:
        from_attributes = True


@router.get("/current", response_model=ExchangeRateResponse)
async def get_current_exchange_rate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current blue dollar exchange rate.
    """
    try:
        rate = fetch_blue_dollar_rate_sync()
        # Log the fetched rate
        log_exchange_rate(db, rate, "bluelytics")

        return ExchangeRateResponse(
            rate=rate,
            source="bluelytics",
            fetched_at=datetime.utcnow(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch exchange rate: {str(e)}",
        )


@router.get("/history", response_model=List[ExchangeRateHistoryItem])
async def get_rate_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 100,
):
    """
    Get exchange rate history.
    """
    history = get_exchange_rate_history(db, limit)
    return history
