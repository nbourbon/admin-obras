from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional
import httpx
from sqlalchemy.orm import Session

from app.models.payment import ExchangeRateLog
from app.config import get_settings

settings = get_settings()

# Cache for exchange rate
_cached_rate: Optional[Decimal] = None
_cache_timestamp: Optional[datetime] = None


async def fetch_blue_dollar_rate() -> Decimal:
    """Fetch the current blue dollar rate from bluelytics API."""
    global _cached_rate, _cache_timestamp

    # Check cache
    if _cached_rate and _cache_timestamp:
        cache_age = datetime.utcnow() - _cache_timestamp
        if cache_age < timedelta(minutes=settings.exchange_rate_cache_minutes):
            return _cached_rate

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.bluelytics.com.ar/v2/latest",
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            # Get blue dollar sell rate (venta)
            blue_rate = Decimal(str(data["blue"]["value_sell"]))

            # Update cache
            _cached_rate = blue_rate
            _cache_timestamp = datetime.utcnow()

            return blue_rate

    except Exception as e:
        # If fetch fails and we have a cached rate, use it
        if _cached_rate:
            return _cached_rate
        # Default fallback rate (should be updated)
        raise Exception(f"Failed to fetch exchange rate: {e}")


def fetch_blue_dollar_rate_sync() -> Decimal:
    """Synchronous version for non-async contexts."""
    global _cached_rate, _cache_timestamp

    # Check cache
    if _cached_rate and _cache_timestamp:
        cache_age = datetime.utcnow() - _cache_timestamp
        if cache_age < timedelta(minutes=settings.exchange_rate_cache_minutes):
            return _cached_rate

    try:
        with httpx.Client() as client:
            response = client.get(
                "https://api.bluelytics.com.ar/v2/latest",
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()

            blue_rate = Decimal(str(data["blue"]["value_sell"]))

            _cached_rate = blue_rate
            _cache_timestamp = datetime.utcnow()

            return blue_rate

    except Exception as e:
        if _cached_rate:
            return _cached_rate
        raise Exception(f"Failed to fetch exchange rate: {e}")


def log_exchange_rate(db: Session, rate: Decimal, source: str = "bluelytics") -> ExchangeRateLog:
    """Log an exchange rate to the database."""
    log_entry = ExchangeRateLog(
        rate_usd_to_ars=rate,
        source=source,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def get_exchange_rate_history(db: Session, limit: int = 100) -> list[ExchangeRateLog]:
    """Get exchange rate history."""
    return (
        db.query(ExchangeRateLog)
        .order_by(ExchangeRateLog.fetched_at.desc())
        .limit(limit)
        .all()
    )


def convert_currency(
    amount: Decimal,
    from_currency: str,
    exchange_rate: Decimal
) -> tuple[Decimal, Decimal]:
    """
    Convert an amount to both USD and ARS.
    Returns (amount_usd, amount_ars)
    """
    if from_currency == "USD":
        amount_usd = amount
        amount_ars = amount * exchange_rate
    else:  # ARS
        amount_ars = amount
        amount_usd = amount / exchange_rate

    return (amount_usd.quantize(Decimal("0.01")), amount_ars.quantize(Decimal("0.01")))
