from decimal import Decimal
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.contribution import Contribution, ContributionStatus
from app.models.project_member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.models.expense import Currency
from app.services.exchange_rate import fetch_blue_dollar_rate_sync, convert_currency


def create_contribution(
    db: Session,
    user_id: int,
    project_id: int,
    amount_original: Decimal,
    currency_original: Currency,
    description: Optional[str] = None,
    exchange_rate_override: Optional[Decimal] = None,
    contribution_date: Optional[datetime] = None,
) -> Contribution:
    """
    Create a new contribution.

    For DUAL mode projects:
    - If currency is ARS: stores in ARS, amount_usd = 0
    - If currency is USD: converts to ARS using exchange rate, amount_usd = 0

    The balance is ALWAYS stored in the project's native currency(ies).
    """
    # Get project to determine currency mode
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError("Project not found")

    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Validate currency compatibility
    if currency_mode == "ARS" and currency_original != Currency.ARS:
        raise ValueError("Este proyecto solo permite aportes en ARS")
    if currency_mode == "USD" and currency_original != Currency.USD:
        raise ValueError("Este proyecto solo permite aportes en USD")

    # Calculate amounts based on currency mode
    if currency_mode == "ARS":
        # ARS only mode
        amount_usd = Decimal("0")
        amount_ars = amount_original
        exchange_rate = Decimal("0")
        exchange_rate_source = None
    elif currency_mode == "USD":
        # USD only mode
        amount_usd = amount_original
        amount_ars = Decimal("0")
        exchange_rate = Decimal("0")
        exchange_rate_source = None
    else:
        # DUAL mode - IMPORTANT: contributions are ALWAYS stored in ARS
        if currency_original == Currency.ARS:
            # Direct ARS contribution
            amount_ars = amount_original
            amount_usd = Decimal("0")
            exchange_rate = Decimal("0")
            exchange_rate_source = None
        else:
            # USD contribution - convert to ARS
            if exchange_rate_override:
                exchange_rate = exchange_rate_override
                exchange_rate_source = "manual"
            else:
                exchange_rate = fetch_blue_dollar_rate_sync()
                exchange_rate_source = "auto"

            # Convert USD to ARS
            amount_ars = (amount_original * exchange_rate).quantize(Decimal("0.01"))
            amount_usd = Decimal("0")  # Don't store USD equivalent

    # Create contribution
    contribution = Contribution(
        project_id=project_id,
        user_id=user_id,
        amount_original=amount_original,
        currency_original=currency_original,
        amount_usd=amount_usd,
        amount_ars=amount_ars,
        exchange_rate_used=exchange_rate,
        exchange_rate_source=exchange_rate_source,
        description=description,
        status=ContributionStatus.PENDING,
        contribution_date=contribution_date or datetime.utcnow(),
    )

    db.add(contribution)
    db.commit()
    db.refresh(contribution)

    return contribution


def approve_contribution(
    db: Session,
    contribution_id: int,
    approved_by_user_id: int,
) -> Contribution:
    """
    Approve a contribution and update the member's balance.

    Balance is updated according to currency_mode:
    - ARS mode: updates balance_ars only
    - USD mode: updates balance_usd only
    - DUAL mode: updates balance_ars only (contributions are always in ARS in DUAL mode)
    """
    # Get contribution
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
    if not contribution:
        raise ValueError("Contribution not found")

    if contribution.status != ContributionStatus.PENDING:
        raise ValueError("Contribution is not pending")

    # Get project to determine currency mode
    project = db.query(Project).filter(Project.id == contribution.project_id).first()
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Get or create project member
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == contribution.project_id,
        ProjectMember.user_id == contribution.user_id,
    ).first()

    if not member:
        raise ValueError("User is not a member of this project")

    # Update balance according to currency mode
    if currency_mode == "ARS":
        member.balance_ars += contribution.amount_ars
    elif currency_mode == "USD":
        member.balance_usd += contribution.amount_usd
    else:
        # DUAL mode: balance is ONLY in ARS
        member.balance_ars += contribution.amount_ars

    member.balance_updated_at = datetime.utcnow()

    # Mark contribution as approved
    contribution.status = ContributionStatus.APPROVED
    contribution.approved_by = approved_by_user_id
    contribution.approved_at = datetime.utcnow()

    db.commit()
    db.refresh(contribution)
    db.refresh(member)

    return contribution


def reject_contribution(
    db: Session,
    contribution_id: int,
    rejection_reason: str,
) -> Contribution:
    """Reject a contribution without updating balances."""
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()
    if not contribution:
        raise ValueError("Contribution not found")

    if contribution.status != ContributionStatus.PENDING:
        raise ValueError("Contribution is not pending")

    contribution.status = ContributionStatus.REJECTED
    contribution.rejected_at = datetime.utcnow()
    contribution.rejection_reason = rejection_reason

    db.commit()
    db.refresh(contribution)

    return contribution


def get_member_balance(
    db: Session,
    project_id: int,
    user_id: int,
) -> dict:
    """
    Get a member's balance.

    For DUAL mode, calculates USD equivalent in real-time using current exchange rate.
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()

    if not member:
        return {
            "balance_usd": Decimal("0"),
            "balance_ars": Decimal("0"),
            "balance_updated_at": None,
        }

    # Get project to determine currency mode
    project = db.query(Project).filter(Project.id == project_id).first()
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    if currency_mode == "DUAL":
        # Calculate USD equivalent in real-time
        current_tc = fetch_blue_dollar_rate_sync()
        balance_usd = (member.balance_ars / current_tc).quantize(Decimal("0.01")) if current_tc > 0 else Decimal("0")
    else:
        balance_usd = member.balance_usd

    return {
        "balance_usd": balance_usd,
        "balance_ars": member.balance_ars,
        "balance_updated_at": member.balance_updated_at,
    }


def get_all_member_balances(
    db: Session,
    project_id: int,
) -> List[dict]:
    """
    Get balances for all members of a project.

    For DUAL mode, calculates USD equivalent in real-time using current exchange rate.
    """
    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .filter(ProjectMember.is_active == True)
        .all()
    )

    # Get project to determine currency mode
    project = db.query(Project).filter(Project.id == project_id).first()
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Get current exchange rate if DUAL mode
    current_tc = None
    if currency_mode == "DUAL":
        try:
            current_tc = fetch_blue_dollar_rate_sync()
        except:
            current_tc = Decimal("1000")  # Fallback

    result = []
    for member in members:
        # Calculate USD equivalent for DUAL mode
        if currency_mode == "DUAL" and current_tc:
            balance_usd = (member.balance_ars / current_tc).quantize(Decimal("0.01")) if current_tc > 0 else Decimal("0")
        else:
            balance_usd = member.balance_usd

        result.append({
            "user_id": member.user_id,
            "user_name": member.user.full_name,
            "user_email": member.user.email,
            "participation_percentage": member.participation_percentage,
            "balance_usd": balance_usd,
            "balance_ars": member.balance_ars,
            "balance_updated_at": member.balance_updated_at,
        })

    return result


def get_contributions_by_participant(
    db: Session,
    project_id: int,
) -> List[dict]:
    """
    Get total approved contributions by participant.

    For DUAL mode, all contributions are in ARS, so we sum amount_ars.
    USD equivalent is calculated in real-time if needed.
    """
    # Query approved contributions grouped by user
    results = (
        db.query(
            Contribution.user_id,
            func.sum(Contribution.amount_usd).label("total_usd"),
            func.sum(Contribution.amount_ars).label("total_ars"),
            func.count(Contribution.id).label("contributions_count"),
        )
        .filter(Contribution.project_id == project_id)
        .filter(Contribution.status == ContributionStatus.APPROVED)
        .group_by(Contribution.user_id)
        .all()
    )

    # Get project to determine currency mode
    project = db.query(Project).filter(Project.id == project_id).first()
    currency_mode = getattr(project, 'currency_mode', 'DUAL') or 'DUAL'

    # Get current exchange rate if DUAL mode
    current_tc = None
    if currency_mode == "DUAL":
        try:
            current_tc = fetch_blue_dollar_rate_sync()
        except:
            current_tc = Decimal("1000")  # Fallback

    output = []
    for row in results:
        user = db.query(User).filter(User.id == row.user_id).first()
        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == row.user_id,
        ).first()

        # Calculate USD equivalent for DUAL mode
        if currency_mode == "DUAL" and current_tc:
            total_usd = (row.total_ars / current_tc).quantize(Decimal("0.01")) if current_tc > 0 else Decimal("0")
        else:
            total_usd = row.total_usd or Decimal("0")

        output.append({
            "user_id": row.user_id,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "",
            "participation_percentage": member.participation_percentage if member else Decimal("0"),
            "total_usd": total_usd,
            "total_ars": row.total_ars or Decimal("0"),
            "contributions_count": row.contributions_count or 0,
        })

    return output
