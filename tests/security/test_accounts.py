from datetime import datetime, timedelta
import re
from unittest.mock import patch
import pytest
from app.database import SessionLocal
from app.models.user import User
from app.models.auth_action import AuthAction
from app.models.project_member import ProjectMember
from app.services.auth import create_access_token, verify_password
from tests.user_factory import seed_verified_user

PASSWORD = 'Secure-pass-123'


def token_from(messages):
    return re.search(r'#token=([\w-]+)', messages[-1]['text']).group(1)


def seed(email='owner@example.com', admin=False):
    uid = seed_verified_user({'email': email, 'password': PASSWORD, 'full_name': email}).json()['id']
    if admin:
        with SessionLocal() as db:
            db.get(User, uid).is_admin = True
            db.commit()
    return uid, {'Authorization': 'Bearer ' + create_access_token({'sub': str(uid)})}


def project(client, headers):
    response = client.post('/projects', headers=headers, json={'name': 'Obra', 'currency_mode': 'ARS'})
    assert response.status_code == 200, response.text
    pid = response.json()['id']
    return pid, {**headers, 'X-Project-ID': str(pid)}


def test_registration_proves_email_and_ignores_admin_and_password(client, sent_emails):
    body = {'email': 'NEW@example.com', 'full_name': 'New', 'password': 'attacker-password', 'is_admin': True}
    assert client.post('/auth/self-register', json=body).status_code == 202
    token = token_from(sent_emails)
    with SessionLocal() as db:
        user = db.query(User).filter_by(email='new@example.com').one()
        assert user.password_hash is None and not user.email_verified and not user.is_admin
        action = db.query(AuthAction).one()
        assert action.token_hash != token
    info = client.post('/auth/action-info', json={'token': token}).json()
    assert info['requires_password']
    assert client.post('/auth/complete-action', json={'token': token, 'password': PASSWORD}).status_code == 200
    assert client.post('/auth/complete-action', json={'token': token, 'password': PASSWORD}).status_code == 400
    login = client.post('/auth/login', data={'username': 'NEW@example.com', 'password': PASSWORD})
    assert login.status_code == 200
    _, h = project(client, {'Authorization': 'Bearer ' + login.json()['access_token']})
    assert client.get('/projects', headers=h).json()[0]['current_user_is_admin'] is True


def test_public_registration_cannot_claim_google_or_existing_account(client, sent_emails):
    uid, _ = seed()
    with SessionLocal() as db:
        user = db.get(User, uid)
        user.google_id = 'google-sub'
        user.password_hash = None
        db.commit()
    body = {'email': 'owner@example.com', 'full_name': 'Attacker', 'password': PASSWORD, 'is_admin': True}
    assert client.post('/auth/self-register', json=body).status_code == 202
    assert sent_emails == []
    with SessionLocal() as db:
        assert db.get(User, uid).password_hash is None
    assert client.post('/auth/forgot-password', json={'email': body['email']}).status_code == 202
    assert 'token=' not in sent_emails[-1]['text']
    assert 'Google' in sent_emails[-1]['text']


def test_reset_is_single_use_revokes_all_sessions_and_old_links(client, sent_emails):
    uid, old_headers = seed()
    tokens = []
    for _ in range(2):
        assert client.post('/auth/forgot-password', json={'email': 'owner@example.com'}).status_code == 202
        tokens.append(token_from(sent_emails))
    assert client.get('/auth/me', headers=old_headers).status_code == 200
    assert client.post('/auth/complete-action', json={'token': tokens[0], 'password': 'new-password-123'}).status_code == 200
    assert client.get('/auth/me', headers=old_headers).status_code == 401
    assert client.post('/auth/complete-action', json={'token': tokens[1], 'password': PASSWORD}).status_code == 400
    assert client.post('/auth/login', data={'username': 'owner@example.com', 'password': PASSWORD}).status_code == 401
    login = client.post('/auth/login', data={'username': 'owner@example.com', 'password': 'new-password-123'})
    assert login.status_code == 200
    assert client.get('/auth/me', headers={'Authorization': 'Bearer ' + login.json()['access_token']}).status_code == 200


def test_expired_invalid_and_weak_password_do_not_consume_valid_link(client, sent_emails):
    seed()
    client.post('/auth/forgot-password', json={'email': 'owner@example.com'})
    token = token_from(sent_emails)
    assert client.post('/auth/complete-action', json={'token': token, 'password': 'short'}).status_code == 422
    assert client.post('/auth/action-info', json={'token': token}).status_code == 200
    with SessionLocal() as db:
        db.query(AuthAction).update({'expires_at': datetime.utcnow() - timedelta(seconds=1)})
        db.commit()
    assert client.post('/auth/complete-action', json={'token': token, 'password': PASSWORD}).status_code == 400
    assert client.post('/auth/action-info', json={'token': 'x' * 43}).status_code == 400


def test_global_endpoints_are_retired_even_for_legacy_admin(client):
    uid, headers = seed(admin=True)
    victim, _ = seed('victim@example.com')
    for method, path, body in [('get', '/users', None), ('put', f'/users/{victim}/change-password', {'new_password': PASSWORD}),
                               ('put', f'/users/{victim}', {'email': 'stolen@example.com'}), ('delete', f'/users/{victim}', None)]:
        kwargs = {'headers': headers}
        if body: kwargs['json'] = body
        assert getattr(client, method)(path, **kwargs).status_code == 410
    for path in ['/auth/register', '/auth/register-first-admin']:
        assert client.post(path, json={'email': 'x@example.com', 'password': PASSWORD, 'full_name': 'X'}).status_code == 410


def test_admin_of_a_cannot_manage_b_using_a_header(client):
    owner, h1 = seed()
    other, h2 = seed('other@example.com')
    p1, h1p = project(client, h1)
    p2, h2p = project(client, h2)
    for method, path, data in [('put', f'/projects/{p2}', {'name': 'Stolen'}),
                              ('put', f'/projects/{p2}/members/{other}', {'is_admin': False}),
                              ('post', f'/projects/{p2}/members', {'user_id': owner}),
                              ('delete', f'/projects/{p2}/members/{other}', None)]:
        kwargs = {'headers': h1p}
        if data: kwargs['json'] = data
        assert getattr(client, method)(path, **kwargs).status_code == 403
    assert client.get(f'/projects/{p2}/members/history', headers=h1p).status_code == 403
    # An admin in one project can be an ordinary participant in another.
    assert client.post(f'/projects/{p2}/members', headers=h2p, json={'user_id': owner}).status_code == 200
    assert client.put(f'/projects/{p2}', headers={**h1, 'X-Project-ID': str(p2)}, json={'name': 'Stolen'}).status_code == 403


def test_new_invitation_acceptance_and_no_global_admin(client, sent_emails):
    owner, headers = seed()
    pid, hp = project(client, headers)
    response = client.post(f'/projects/{pid}/members/by-email', headers=hp, params={
        'email': 'guest@example.com', 'full_name': 'Guest', 'participation_percentage': 20})
    assert response.status_code == 200, response.text
    guest = response.json()['user_id']
    assert response.json()['invitation_accepted'] is False
    token = token_from(sent_emails)
    assert client.post('/auth/complete-action', json={'token': token, 'password': PASSWORD}).status_code == 200
    login = client.post('/auth/login', data={'username': 'guest@example.com', 'password': PASSWORD})
    gh = {'Authorization': 'Bearer ' + login.json()['access_token']}
    assert client.get('/projects', headers=gh).json()[0]['current_user_is_admin'] is False
    assert client.put(f'/projects/{pid}', headers={**gh, 'X-Project-ID': str(pid)}, json={'name': 'No'}).status_code == 403
    with SessionLocal() as db:
        assert not db.get(User, guest).is_admin


def test_invite_existing_user_does_not_change_password_and_revoke_on_removal(client, sent_emails):
    owner, headers = seed()
    guest, gh = seed('guest@example.com')
    pid, hp = project(client, headers)
    params = {'email': 'guest@example.com', 'participation_percentage': 20}
    assert client.post(f'/projects/{pid}/members/by-email', headers=hp, params=params).status_code == 200
    token = token_from(sent_emails)
    assert client.get('/projects', headers=gh).json() == []
    assert client.get('/expenses', headers={**gh, 'X-Project-ID': str(pid)}).status_code == 403
    assert client.post('/auth/complete-action', json={'token': token, 'password': 'ignored-password'}).status_code == 200
    with SessionLocal() as db:
        assert verify_password(PASSWORD, db.get(User, guest).password_hash)
    assert client.delete(f'/projects/{pid}/members/{guest}', headers=hp).status_code == 200
    client.post(f'/projects/{pid}/members/by-email', headers=hp, params=params)
    new_token = token_from(sent_emails)
    client.delete(f'/projects/{pid}/members/{guest}', headers=hp)
    assert client.post('/auth/complete-action', json={'token': new_token}).status_code == 400


def test_email_rate_limit_and_generic_unknown_response(client, sent_emails):
    for _ in range(5):
        assert client.post('/auth/forgot-password', json={'email': 'missing@example.com'}).status_code == 202
    assert client.post('/auth/forgot-password', json={'email': 'missing@example.com'}).status_code == 429
    assert sent_emails == []


def test_google_subject_and_email_authority(client):
    with patch('app.routers.auth.google_id_token.verify_oauth2_token', return_value={
        'sub': 'g123', 'email': 'real@gmail.com', 'email_verified': True}):
        response = client.post('/auth/google', json={'token': 'fake-local-test'})
        assert response.status_code == 200, response.text
        headers = {'Authorization': 'Bearer ' + response.json()['access_token']}
        assert client.get('/auth/me', headers=headers).json()['is_admin'] is False
    seed('external@example.com')
    with patch('app.routers.auth.google_id_token.verify_oauth2_token', return_value={
        'sub': 'g999', 'email': 'external@example.com', 'email_verified': True}):
        assert client.post('/auth/google', json={'token': 'fake-local-test'}).status_code == 403


def test_legacy_migration_preserves_accounts_and_is_repeatable(client, monkeypatch):
    from sqlalchemy import create_engine, text
    from app import database
    test_engine = create_engine('sqlite://')
    database.Base.metadata.create_all(test_engine)
    with test_engine.begin() as conn:
        conn.execute(text("INSERT INTO users (email,full_name,password_hash,is_active,email_verified,auth_version) VALUES ('old@example.com','Old','hash',1,0,0),('invited@example.com','Invited',NULL,1,0,0)"))
        conn.execute(text('ALTER TABLE users DROP COLUMN email_verified'))
        conn.execute(text('ALTER TABLE users DROP COLUMN auth_version'))
        conn.execute(text('ALTER TABLE project_members DROP COLUMN invitation_accepted'))
    monkeypatch.setattr(database, 'engine', test_engine)
    monkeypatch.setattr(database, 'database_url', 'sqlite://')
    database.init_db()
    database.init_db()
    with test_engine.connect() as conn:
        rows = conn.execute(text('SELECT email_verified,auth_version FROM users ORDER BY id')).all()
        assert rows == [(1, 0), (0, 0)]
    test_engine.dispose()


def test_last_admin_cannot_deactivate_or_rely_on_unaccepted_invite(client, sent_emails):
    uid, h = seed()
    pid, hp = project(client, h)
    client.post(f'/projects/{pid}/members/by-email', headers=hp, params={
        'email': 'pending@example.com', 'full_name': 'Pending', 'participation_percentage': 0, 'is_admin': True})
    assert client.put(f'/projects/{pid}/members/{uid}', headers=hp, json={'is_active': False}).status_code == 400
    assert client.delete(f'/projects/{pid}/members/{uid}', headers=hp).status_code == 400


def test_missing_email_config_fails_without_creating_account(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), 'resend_api_key', '')
    assert client.post('/auth/self-register', json={'email': 'new@example.com', 'full_name': 'New'}).status_code == 503
    with SessionLocal() as db:
        assert db.query(User).count() == 0
