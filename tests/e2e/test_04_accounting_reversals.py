"""Regression tests for exact, auditable accounting corrections."""

from decimal import Decimal

from app.database import SessionLocal
from app.models.contribution import Contribution
from app.models.contribution_payment import ContributionPayment
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project_member import ProjectMember
from tests.e2e.test_02_construccion_ars_current_account import (
    setup_two_member_ars_current_account_project,
)


def member_balances(project_id):
    db = SessionLocal()
    try:
        return {
            member.user_id: Decimal(str(member.balance_ars))
            for member in db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
        }
    finally:
        db.close()

def test_expense_delete_and_restore_reverse_linked_contribution_atomically(client):
    project_id, user1_id, user2_id, headers = setup_two_member_ars_current_account_project(
        client, "atomic-reversal"
    )
    created = client.post(
        "/expenses",
        json={
            "description": "Gasto con aporte asociado",
            "amount_original": "1000.00",
            "currency_original": "ARS",
            "payers": [{"user_id": user1_id, "amount": "1000.00"}],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    expense_id = created.json()["id"]
    original = member_balances(project_id)
    assert original == {user1_id: Decimal("300.00"), user2_id: Decimal("-300.00")}

    changed = client.put(
        f"/expenses/{expense_id}",
        json={"amount_original": "1200.00"},
        headers=headers,
    )
    assert changed.status_code == 409

    deleted = client.delete(
        f"/expenses/{expense_id}?confirmed=true&reason=Importe+cargado+por+error",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert member_balances(project_id) == {user1_id: Decimal("0.00"), user2_id: Decimal("0.00")}

    db = SessionLocal()
    try:
        expense = db.query(Expense).filter(Expense.id == expense_id).one()
        contribution = db.query(Contribution).filter(Contribution.expense_id == expense_id).one()
        assert expense.is_deleted is True
        assert contribution.is_deleted is True
        assert contribution.deletion_reason == "Importe cargado por error"
        assert db.query(ParticipantPayment).filter_by(expense_id=expense_id).count() == 2
        assert db.query(ContributionPayment).filter_by(contribution_id=contribution.id).count() == 1
    finally:
        db.close()

    restored = client.put(f"/expenses/{expense_id}/restore", headers=headers)
    assert restored.status_code == 200, restored.text
    assert member_balances(project_id) == original


def test_adjustment_reversal_uses_original_allocations_after_percentages_change(client):
    project_id, user1_id, user2_id, headers = setup_two_member_ars_current_account_project(
        client, "historic-percentages"
    )
    created = client.post(
        "/contributions/adjust-balance",
        json={"description": "Ajuste inicial", "amount": "1000.00", "currency": "ARS"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    contribution_id = created.json()["id"]
    assert member_balances(project_id) == {user1_id: Decimal("700.00"), user2_id: Decimal("300.00")}

    db = SessionLocal()
    try:
        members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
        for member in members:
            member.participation_percentage = Decimal("50.00")
        db.commit()
    finally:
        db.close()

    deleted = client.delete(
        f"/contributions/{contribution_id}?reason=Ajuste+duplicado",
        headers=headers,
    )
    assert deleted.status_code == 200, deleted.text
    assert member_balances(project_id) == {user1_id: Decimal("0.00"), user2_id: Decimal("0.00")}

    db = SessionLocal()
    try:
        contribution = db.query(Contribution).filter(Contribution.id == contribution_id).one()
        assert contribution.is_deleted is True
        assert contribution.deletion_reason == "Ajuste duplicado"
        assert db.query(ContributionPayment).filter_by(contribution_id=contribution_id).count() == 2
        assert all(
            payment.is_deleted
            for payment in db.query(ContributionPayment).filter_by(contribution_id=contribution_id).all()
        )
    finally:
        db.close()


def test_unmarking_current_account_payment_returns_exact_debit(client):
    project_id, user1_id, user2_id, headers = setup_two_member_ars_current_account_project(
        client, "unmark-payment"
    )
    contribution = client.post(
        "/contributions/unilateral",
        json={"description": "Fondo inicial", "amount": "1000.00", "currency": "ARS"},
        headers=headers,
    )
    assert contribution.status_code == 201, contribution.text
    expense = client.post(
        "/expenses",
        json={
            "description": "Gasto desde caja",
            "amount_original": "500.00",
            "currency_original": "ARS",
        },
        headers=headers,
    )
    assert expense.status_code == 201, expense.text

    db = SessionLocal()
    try:
        payment = db.query(ParticipantPayment).filter_by(
            expense_id=expense.json()["id"], user_id=user2_id
        ).one()
        payment_id = payment.id
        assert Decimal(str(payment.amount_paid_ars)) == Decimal("150.00")
    finally:
        db.close()

    unmarked = client.put(f"/payments/{payment_id}/unmark-paid", headers=headers)
    assert unmarked.status_code == 200, unmarked.text
    assert unmarked.json()["is_paid"] is False
    assert member_balances(project_id) == {
        user1_id: Decimal("650.00"),
        user2_id: Decimal("0.00"),
    }


def test_repeated_creation_key_does_not_duplicate_accounting(client):
    project_id, user1_id, user2_id, headers = setup_two_member_ars_current_account_project(
        client, "idempotency"
    )
    request_headers = {**headers, "Idempotency-Key": "same-browser-action"}
    payload = {
        "description": "Gasto enviado dos veces",
        "amount_original": "1000.00",
        "currency_original": "ARS",
        "payers": [{"user_id": user1_id, "amount": "1000.00"}],
    }
    first = client.post("/expenses", json=payload, headers=request_headers)
    second = client.post("/expenses", json=payload, headers=request_headers)
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]

    db = SessionLocal()
    try:
        assert db.query(Expense).filter(Expense.project_id == project_id).count() == 1
        assert db.query(Contribution).filter(Contribution.project_id == project_id).count() == 1
        assert db.query(ParticipantPayment).filter_by(expense_id=first.json()["id"]).count() == 2
    finally:
        db.close()
    assert member_balances(project_id) == {
        user1_id: Decimal("300.00"),
        user2_id: Decimal("-300.00"),
    }
