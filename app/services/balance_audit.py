from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.balance_movement import BalanceMovement
from app.models.project_member import ProjectMember


def record_balance_movement(
    db: Session,
    *,
    project_id: int,
    user_id: int,
    currency: str,
    amount: Decimal,
    balance_after: Decimal,
    movement_type: str,
    source_type: str,
    source_id: int,
    description: Optional[str] = None,
    created_by: Optional[int] = None,
) -> BalanceMovement:
    movement = BalanceMovement(
        project_id=project_id,
        user_id=user_id,
        currency=currency,
        amount=amount,
        balance_after=balance_after,
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        description=description,
        created_by=created_by,
    )
    db.add(movement)
    return movement


def record_member_balance_delta(
    db: Session,
    *,
    member: ProjectMember,
    currency: str,
    amount: Decimal,
    movement_type: str,
    source_type: str,
    source_id: int,
    description: Optional[str] = None,
    created_by: Optional[int] = None,
) -> BalanceMovement:
    if currency == "USD":
        balance_after = Decimal(str(member.balance_usd))
    else:
        balance_after = Decimal(str(member.balance_ars))

    return record_balance_movement(
        db,
        project_id=member.project_id,
        user_id=member.user_id,
        currency=currency,
        amount=Decimal(str(amount)),
        balance_after=balance_after,
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        description=description,
        created_by=created_by,
    )
