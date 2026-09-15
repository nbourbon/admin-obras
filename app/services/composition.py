"""Mandatory zero-sum historical rebalancing, with optimistic previews and closed periods."""
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json

from fastapi import HTTPException
from app.models.composition_change import CompositionChange
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.project_member import ProjectMember
from app.models.user import User
from app.models.contribution import Contribution

ZERO = Decimal('0')
CENT = Decimal('.01')


def dec(value):
    return Decimal(str(value or 0))


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def last_change(db, project_id):
    return db.query(CompositionChange).filter_by(project_id=project_id).order_by(CompositionChange.effective_at.desc()).first()


def guard_open_date(db, project_id, date):
    # Project lock is acquired first by expense writers and composition confirmation.
    from app.models.project import Project
    db.query(Project).filter_by(id=project_id).with_for_update().one()
    last = last_change(db, project_id)
    if last and utc(date) < utc(last.effective_at):
        raise HTTPException(409, 'La fecha pertenece a un período rebalanceado. Conservá el original y registrá una corrección en el período abierto.')


def guard_member_edit(db, project_id, old_percentage, new_percentage, removing=False):
    from app.models.project import Project
    db.query(Project).filter_by(id=project_id).with_for_update().one()
    has_accounts = (last_change(db, project_id) or db.query(Expense.id).filter_by(project_id=project_id).first()
                    or db.query(Contribution.id).filter_by(project_id=project_id).first())
    if has_accounts and (removing or dec(old_percentage) != dec(new_percentage)):
        raise HTTPException(409, 'Usá Cambiar composición para modificar participaciones con rebalanceo. Conservá al miembro con 0% para mantener su cuenta.')


def allocate(total, percentages):
    result = {key: (total * value / 100).quantize(CENT) for key, value in percentages.items()}
    winner = max(percentages, key=lambda key: (percentages[key], key))
    result[winner] += total - sum(result.values(), ZERO)
    return result


def preview(db, project, data):
    effective = utc(data.effective_at)
    if effective > datetime.now(timezone.utc):
        raise HTTPException(422, 'El corte debe ser actual o pasado; no se programan cambios futuros.')
    last = last_change(db, project.id)
    if last and effective <= utc(last.effective_at):
        raise HTTPException(409, 'El corte debe ser posterior al último rebalanceo.')
    members = db.query(ProjectMember).filter_by(project_id=project.id).order_by(ProjectMember.user_id).all()
    by_id = {m.user_id: m for m in members}
    keys, identities, rows, percentages = set(), set(), [], {}
    mode = project.currency_mode
    currency = 'ARS' if mode == 'ARS' else 'USD'
    balance_currency = 'USD' if mode == 'USD' else 'ARS'
    rate = data.exchange_rate if mode == 'DUAL' else Decimal(1)
    if not rate:
        raise HTTPException(422, 'Ingresá la cotización ARS por USD del rebalanceo.')
    for item in data.members:
        if item.key in keys:
            raise HTTPException(422, 'Hay claves de miembros duplicadas')
        keys.add(item.key)
        member = by_id.get(item.user_id) if item.user_id else None
        if item.user_id and (not member or not member.is_active):
            raise HTTPException(422, 'Miembro ajeno al proyecto o inactivo')
        user = db.get(User, item.user_id) if member else db.query(User).filter(User.email == str(item.email).lower()).first()
        if user and (not user.is_active or (not member and user.id in by_id)):
            raise HTTPException(422, 'La cuenta ya pertenece al proyecto o está inactiva')
        identity = user.id if user else str(item.email).lower()
        if identity in identities:
            raise HTTPException(422, 'El mismo participante figura más de una vez')
        identities.add(identity)
        percentages[item.key] = item.percentage
        rows.append(dict(key=item.key, user_id=member.user_id if member else None,
                         email=user.email if user else str(item.email).lower(),
                         name=user.full_name if user else item.full_name.strip(),
                         old_percentage=str(member.participation_percentage if member else ZERO),
                         percentage=str(item.percentage),
                         balance_before=str(dec(getattr(member, 'balance_usd' if mode == 'USD' else 'balance_ars', 0)))))
    if sum(percentages.values(), ZERO) != 100:
        raise HTTPException(422, 'La nueva composición debe sumar exactamente 100%')
    if {r['user_id'] for r in rows if r['user_id']} != {m.user_id for m in members if m.is_active}:
        raise HTTPException(422, 'Incluí a todos los miembros actuales; usá 0% para una salida')
    expenses = db.query(Expense).filter_by(project_id=project.id, is_deleted=False, is_contribution=False).order_by(Expense.id).all()
    if any(utc(e.expense_date) >= effective for e in expenses):
        raise HTTPException(409, 'Hay gastos en o después del corte. Elegí un corte posterior al último gasto registrado.')
    payments = db.query(ParticipantPayment).join(Expense).filter(
        Expense.project_id == project.id, Expense.is_deleted == False, Expense.is_contribution == False,
        ParticipantPayment.is_deleted == False).all()
    grouped = defaultdict(list)
    for p in payments:
        grouped[p.expense_id].append(p)
    assigned = defaultdict(lambda: ZERO)
    pending = defaultdict(lambda: ZERO)
    total, unpaid = ZERO, ZERO
    fingerprints = []
    for e in expenses:
        ps = grouped[e.id]
        # Do not fabricate a historical baseline from inconsistent existing allocations.
        if any(abs(sum((dec(getattr(p, 'amount_due_' + c)) for p in ps), ZERO) - dec(getattr(e, 'amount_' + c))) > CENT
               for c in (['ars'] if mode == 'ARS' else ['usd'] if mode == 'USD' else ['ars', 'usd'])):
            raise HTTPException(409, f'El gasto #{e.id} ({e.description}) no coincide con sus asignaciones. Conciliá esa diferencia antes del rebalanceo.')
        amount = dec(getattr(e, 'amount_' + currency.lower()))
        total += amount
        for p in ps:
            share = dec(getattr(p, 'amount_due_' + currency.lower()))
            assigned[p.user_id] += share
            if not p.is_paid:
                unpaid += share
                pending[p.user_id] += dec(getattr(p, 'amount_due_' + balance_currency.lower()))
            fingerprints.append([p.id, str(p.amount_due_usd), str(p.amount_due_ars), p.is_paid, p.is_pending_approval])
    changes = db.query(CompositionChange).filter_by(project_id=project.id).order_by(CompositionChange.id).all()
    for change in changes:
        for row in change.snapshot['rows']:
            assigned[row['user_id']] -= dec(row['adjustment'])
    represented = {r['user_id'] for r in rows}
    if any(value and user_id not in represented for user_id, value in assigned.items()):
        raise HTTPException(409, 'Hay inversión asignada a miembros inactivos. Recuperá su cuenta antes del rebalanceo.')
    targets = allocate(total, percentages)
    adjustments = {r['key']: assigned[r['user_id']] - targets[r['key']] for r in rows}
    if sum(adjustments.values(), ZERO) != ZERO:
        raise HTTPException(409, 'La inversión histórica no está conciliada')
    native = {key: (amount * rate).quantize(CENT) for key, amount in adjustments.items()}
    winner = max(native, key=lambda key: (abs(native[key]), key))
    native[winner] -= sum(native.values(), ZERO)
    external = {key: ZERO for key in keys}
    credits = {key: max(amount, ZERO) for key, amount in adjustments.items()}
    debts = {key: max(-amount, ZERO) for key, amount in adjustments.items()}
    external_native = {key: ZERO for key in keys}
    for settlement in data.settlements:
        payer, recipient, amount = settlement.payer_key, settlement.recipient_key, settlement.amount
        if payer not in keys or recipient not in keys or payer == recipient:
            raise HTTPException(422, 'Compensación entre miembros inválida')
        if utc(settlement.paid_at) > datetime.now(timezone.utc):
            raise HTTPException(422, 'La fecha del pago externo no puede ser futura')
        if amount > debts[payer] or amount > credits[recipient]:
            raise HTTPException(422, 'La compensación excede la deuda o el crédito generado por el cambio')
        debts[payer] -= amount
        credits[recipient] -= amount
        external[payer] += amount
        external[recipient] -= amount
        converted = (amount * rate).quantize(CENT)
        external_native[payer] += converted
        external_native[recipient] -= converted
    # A fully settled change must cancel even cent rounding from FX allocation.
    if data.settlements and all(v == ZERO for v in debts.values()) and all(v == ZERO for v in credits.values()):
        external_native = {key: -value for key, value in native.items()}
    for row in rows:
        key = row['key']
        row.update(previous_burden=str(assigned[row['user_id']]), target_burden=str(targets[key]),
                   adjustment=str(adjustments[key]), balance_adjustment=str(native[key]),
                   external_settlement=str(external[key]), external_balance_settlement=str(external_native[key]),
                   pending_expenses=str(pending[row['user_id']]),
                   balance_after=str(dec(row['balance_before']) + native[key] + external_native[key]))
    result = dict(effective_at=effective.isoformat(), reason=data.reason, currency=currency,
                  balance_currency=balance_currency, exchange_rate=str(rate), total_investment=str(total),
                  unpaid_investment=str(unpaid), cash_impact='0.00', rows=rows,
                  settlements=[s.model_dump(mode='json') for s in data.settlements])
    token_input = dict(result=result, payments=fingerprints, last_id=last.id if last else None)
    result['preview_token'] = hashlib.sha256(json.dumps(token_input, sort_keys=True).encode()).hexdigest()
    return result
