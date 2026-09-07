"""Exact, auditable reversals for account-current accounting records."""

from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.contribution_absorption import ContributionAbsorption
from app.models.contribution_payment import ContributionPayment
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.services.balance_audit import record_member_balance_delta


ZERO = Decimal("0")


def contribution_payment_credit(payment: ContributionPayment, currency_mode: str) -> tuple[str, Decimal]:
    """Return the exact balance credit originally represented by a payment."""
    if currency_mode == "USD":
        return "USD", Decimal(str(payment.amount_paid_usd or payment.amount_paid or 0))
    return "ARS", Decimal(str(payment.amount_paid_ars or payment.amount_paid or 0))


def expense_payment_debit(payment: ParticipantPayment, currency_mode: str) -> tuple[str, Decimal]:
    """Return the exact current-account debit stored when an expense was paid."""
    if currency_mode == "USD":
        return "USD", Decimal(str(payment.amount_paid_usd or payment.amount_due_usd or 0))
    return "ARS", Decimal(str(payment.amount_paid_ars or payment.amount_due_ars or 0))


def change_member_balance(
    db: Session,
    member: ProjectMember,
    currency: str,
    amount: Decimal,
    *,
    movement_type: str,
    source_type: str,
    source_id: int,
    description: str,
    actor_id: int,
) -> None:
    if not amount:
        return
    if currency == "USD":
        member.balance_usd = Decimal(str(member.balance_usd or 0)) + amount
    else:
        member.balance_ars = Decimal(str(member.balance_ars or 0)) + amount
    member.balance_updated_at = datetime.utcnow()
    record_member_balance_delta(
        db,
        member=member,
        currency=currency,
        amount=amount,
        movement_type=movement_type,
        source_type=source_type,
        source_id=source_id,
        description=description,
        created_by=actor_id,
    )


def locked_members(db: Session, project_id: int) -> dict[int, ProjectMember]:
    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .with_for_update()
        .all()
    )
    return {member.user_id: member for member in members}


def reverse_contribution(
    db: Session,
    contribution: Contribution,
    *,
    project: Project,
    actor_id: int,
    reason: str,
    members: dict[int, ProjectMember] | None = None,
    allow_linked_expense: bool = False,
) -> None:
    """Reverse credits using stored payment amounts and soft-delete the source."""
    if contribution.is_deleted:
        return
    if contribution.expense_id and not allow_linked_expense:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este aporte pertenece a un gasto. Eliminá el gasto para revertir ambos movimientos juntos.",
        )
    if db.query(ContributionAbsorption).filter(
        ContributionAbsorption.unilateral_id == contribution.id,
        ContributionAbsorption.is_deleted == False,
    ).count():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este aporte fue aplicado a una solicitud grupal y no puede revertirse hasta deshacer esa aplicación.",
        )

    payments = (
        db.query(ContributionPayment)
        .filter(
            ContributionPayment.contribution_id == contribution.id,
            ContributionPayment.is_deleted == False,
        )
        .with_for_update()
        .all()
    )
    if not contribution.is_unilateral and not contribution.is_adjustment and any(p.is_paid for p in payments):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La solicitud tiene pagos realizados y requiere revertirlos antes de eliminarla.",
        )

    member_map = members if members is not None else locked_members(db, project.id)
    currency_mode = getattr(project, "currency_mode", "DUAL") or "DUAL"
    if contribution.status.value == "approved":
        for payment in payments:
            if not payment.is_paid:
                continue
            member = member_map.get(payment.user_id)
            if not member:
                raise HTTPException(status_code=409, detail="No se encontró la cuenta histórica de un participante")
            currency, credited = contribution_payment_credit(payment, currency_mode)
            change_member_balance(
                db, member, currency, -credited,
                movement_type="reversal", source_type="contribution_payment", source_id=payment.id,
                description=f"Reversión de aporte: {contribution.description}", actor_id=actor_id,
            )

    now = datetime.utcnow()
    used_absorptions = db.query(ContributionAbsorption).filter(
        ContributionAbsorption.solicitud_id == contribution.id,
        ContributionAbsorption.is_deleted == False,
    ).with_for_update().all()
    for absorption in used_absorptions:
        unilateral = db.query(Contribution).filter(
            Contribution.id == absorption.unilateral_id,
            Contribution.is_deleted == False,
        ).with_for_update().first()
        if unilateral:
            unilateral.absorbed_amount = max(
                ZERO,
                Decimal(str(unilateral.absorbed_amount or 0)) - Decimal(str(absorption.amount_absorbed)),
            )
        absorption.is_deleted = True
        absorption.deleted_at = now
        absorption.deleted_by = actor_id
    for payment in payments:
        payment.is_deleted = True
        payment.deleted_at = now
        payment.deleted_by = actor_id
    contribution.is_deleted = True
    contribution.deleted_at = now
    contribution.deleted_by = actor_id
    contribution.deletion_reason = reason


def restore_contribution(
    db: Session,
    contribution: Contribution,
    *,
    project: Project,
    actor_id: int,
    members: dict[int, ProjectMember],
) -> None:
    """Replay a deleted contribution from its stored allocations."""
    currency_mode = getattr(project, "currency_mode", "DUAL") or "DUAL"
    payments = (
        db.query(ContributionPayment)
        .filter(ContributionPayment.contribution_id == contribution.id)
        .with_for_update()
        .all()
    )
    if contribution.status.value == "approved":
        for payment in payments:
            if not payment.is_paid:
                continue
            member = members.get(payment.user_id)
            if not member:
                raise HTTPException(status_code=409, detail="No se encontró la cuenta histórica de un participante")
            currency, credited = contribution_payment_credit(payment, currency_mode)
            change_member_balance(
                db, member, currency, credited,
                movement_type="restoration", source_type="contribution_payment", source_id=payment.id,
                description=f"Restauración de aporte: {contribution.description}", actor_id=actor_id,
            )
    for payment in payments:
        payment.is_deleted = False
        payment.deleted_at = None
        payment.deleted_by = None
    contribution.is_deleted = False
    contribution.deleted_at = None
    contribution.deleted_by = None
    contribution.deletion_reason = None
