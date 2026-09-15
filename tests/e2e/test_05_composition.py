"""Real API cutovers; all data stays in the isolated SQLite test database."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4
import pytest
from app.database import SessionLocal
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.expense import Expense
from app.models.payment import ParticipantPayment
from app.models.balance_movement import BalanceMovement
from app.models.composition_change import CompositionChange
from tests.e2e.test_02_construccion_ars_current_account import setup_two_member_ars_current_account_project


def seed(client, mode='USD', payment_mode='current_account', pending=False, individual=False):
    pid, a, b, headers = setup_two_member_ars_current_account_project(client, 'composition')
    db = SessionLocal()
    project = db.get(Project, pid)
    project.currency_mode = mode
    project.project_type = 'generico' if payment_mode == 'generic' else 'construccion'
    project.type_parameters = {'contribution_mode': 'both' if payment_mode == 'generic' else payment_mode}
    project.is_individual = individual
    if individual:
        db.query(ProjectMember).filter_by(project_id=pid, user_id=b).delete()
    else:
        for n in range(2):
            u = User(email=f'original{n}@example.com', full_name=f'Original {n}', email_verified=True)
            db.add(u); db.flush()
            db.add(ProjectMember(project_id=pid, user_id=u.id, participation_percentage=25))
    db.flush()
    members = db.query(ProjectMember).filter_by(project_id=pid).order_by(ProjectMember.user_id).all()
    for m in members:
        m.participation_percentage = 100 if individual else 25
    e = Expense(project_id=pid, created_by=a, description='Inversión histórica',
                amount_original=100000, currency_original='USD' if mode != 'ARS' else 'ARS',
                amount_usd=100000 if mode != 'ARS' else 0, amount_ars=100000000 if mode == 'DUAL' else 100000 if mode == 'ARS' else 0,
                exchange_rate_used=1000 if mode == 'DUAL' else 1,
                expense_date=datetime.now(timezone.utc)-timedelta(days=3))
    db.add(e); db.flush()
    for m in members:
        db.add(ParticipantPayment(expense_id=e.id, user_id=m.user_id,
                                  amount_due_usd=e.amount_usd/len(members), amount_due_ars=e.amount_ars/len(members),
                                  is_paid=not pending, is_pending_approval=pending))
    db.commit()
    payload = dict(effective_at=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat(), reason='Ingreso de inversor',
                   exchange_rate='1200' if mode == 'DUAL' else None,
                   members=[dict(key=str(m.user_id), user_id=m.user_id, percentage=50 if individual else 20) for m in members] +
                           [dict(key='new', email='new@example.com', full_name='Nuevo inversor', percentage=50 if individual else 20)], settlements=[])
    expense_id=e.id
    db.close()
    return pid, headers, payload, expense_id


def calculate(client, pid, h, payload):
    response = client.post(f'/projects/{pid}/compositions/preview', json=payload, headers=h)
    assert response.status_code == 200, response.text
    return response.json()


def confirm(client, pid, h, payload, result):
    request = {**payload, 'preview_token': result['preview_token'], 'request_key': str(uuid4())}
    response = client.post(f'/projects/{pid}/compositions', json=request, headers=h)
    assert response.status_code == 201, response.text
    repeated = client.post(f'/projects/{pid}/compositions', json=request, headers=h)
    assert repeated.json()['id'] == response.json()['id']
    return response.json()


@pytest.mark.parametrize('mode,payment_mode,pending', [
    ('USD','current_account',False), ('ARS','current_account',False), ('DUAL','current_account',False),
    ('USD','direct_payment',True), ('ARS','both',True), ('DUAL','generic',True)])
def test_four_to_five_preserves_cash_and_history(client, mode, payment_mode, pending):
    pid,h,payload,eid=seed(client,mode,payment_mode,pending)
    result=calculate(client,pid,h,payload)
    assert [Decimal(r['adjustment']) for r in result['rows']] == [Decimal(5000)]*4+[Decimal(-20000)]
    saved=confirm(client,pid,h,payload,result)
    db=SessionLocal()
    members=db.query(ProjectMember).filter_by(project_id=pid).all()
    assert sum(m.balance_usd for m in members) == 0
    assert sum(m.balance_ars for m in members) == 0
    assert sum(m.participation_percentage for m in members) == 100
    assert db.query(ParticipantPayment).filter_by(expense_id=eid).count() == 4
    assert all(p.is_paid == (not pending) for p in db.query(ParticipantPayment).filter_by(expense_id=eid))
    assert db.query(CompositionChange).count() == 1
    assert db.query(BalanceMovement).filter_by(source_type='composition_change').count() == 5
    db.close()
    # Historical operations cannot silently invalidate the rebalance.
    assert client.post('/expenses',json=dict(description='Atrasado',amount_original=100,currency_original=mode if mode!='DUAL' else 'ARS',expense_date='2020-01-01T00:00:00Z'),headers=h).status_code==409
    assert client.delete(f'/expenses/{eid}?confirmed=true',headers=h).status_code==409
    # Repeating the same ownership later must not repeat the adjustment.
    payload['members']=[dict(key=r['key'],user_id=r['user_id'],percentage=r['percentage']) for r in saved['rows']]
    payload['effective_at']=datetime.now(timezone.utc).isoformat()
    next_result=calculate(client,pid,h,payload)
    assert all(Decimal(r['adjustment']) == 0 for r in next_result['rows'])


@pytest.mark.parametrize('amount,remaining', [('5000',0), ('2000',-12000)])
def test_external_compensation(client,amount,remaining):
    pid,h,payload,eid=seed(client)
    payload['settlements']=[dict(payer_key='new',recipient_key=r['key'],amount=amount,paid_at=payload['effective_at'],reference='Pago directo') for r in payload['members'][:-1]]
    result=calculate(client,pid,h,payload)
    assert Decimal(result['rows'][-1]['balance_after']) == remaining
    confirm(client,pid,h,payload,result)
    db=SessionLocal()
    assert sum(m.balance_usd for m in db.query(ProjectMember).filter_by(project_id=pid))==0
    db.close()


def test_stale_invalid_unauthorized_and_legacy_bypass(client):
    pid,h,payload,eid=seed(client)
    result=calculate(client,pid,h,payload)
    db=SessionLocal();m=db.query(ProjectMember).filter_by(project_id=pid).first();m.balance_usd=100;db.commit();db.close()
    r=client.post(f'/projects/{pid}/compositions',json={**payload,'request_key':str(uuid4()),'preview_token':result['preview_token']},headers=h)
    assert r.status_code==409
    invalid={**payload,'members':payload['members'][:-1]}
    assert client.post(f'/projects/{pid}/compositions/preview',json=invalid,headers=h).status_code==422
    assert client.post(f'/projects/{pid+1}/compositions/preview',json=payload,headers=h).status_code==403
    uid=payload['members'][0]['user_id']
    assert client.put(f'/projects/{pid}/members/{uid}',json={'participation_percentage':30},headers=h).status_code==409
    assert client.delete(f'/projects/{pid}/members/{uid}',headers=h).status_code in (400,409)
    db=SessionLocal();p=db.query(ParticipantPayment).filter_by(expense_id=eid).first();p.amount_due_usd+=1;db.commit();db.close()
    assert client.post(f'/projects/{pid}/compositions/preview',json=payload,headers=h).status_code==409


def test_individual_and_overpayment(client):
    pid,h,payload,eid=seed(client,individual=True)
    result=calculate(client,pid,h,payload)
    assert Decimal(result['rows'][-1]['adjustment'])==-50000
    payload['settlements']=[dict(payer_key='new',recipient_key=payload['members'][0]['key'],amount=50001,paid_at=payload['effective_at'],reference='Demasiado')]
    assert client.post(f'/projects/{pid}/compositions/preview',json=payload,headers=h).status_code==422
