"""Account emails. Bearer links are never written to logs or persisted in plaintext."""
import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime, timedelta
from urllib.parse import urlsplit

import httpx
from fastapi import BackgroundTasks, HTTPException, Request
from sqlalchemy import update, delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.auth_action import AuthAction, AuthRateLimit

logger = logging.getLogger(__name__)


def require_email_config():
    settings = get_settings()
    url = urlsplit(settings.frontend_url)
    if not settings.resend_api_key or url.scheme not in ('http', 'https') or not url.netloc:
        raise HTTPException(503, 'El envío de correos no está disponible. Intentá más tarde.')
    if url.scheme != 'https' and url.hostname not in ('localhost', '127.0.0.1'):
        raise HTTPException(503, 'La dirección de la aplicación debe usar HTTPS.')


def rate_limit(db: Session, request: Request, scope: str, email: str = ''):
    """Atomic shared counters, valid across workers/restarts. Never trust forwarded headers."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert
    now = int(time.time()) // 900
    ip = request.client.host if request.client else 'unknown'
    subjects = [(f'ip:{scope}:{ip}', 60)]
    if email:
        subjects.append((f'email:{scope}:{email.strip().lower()}', 5 if scope == 'email' else 15))
    insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else pg_insert
    for subject, limit in subjects:
        key = hmac.new(get_settings().secret_key.encode(), subject.encode(), hashlib.sha256).hexdigest()
        db.execute(insert(AuthRateLimit).values(key=key, window=now, count=0).on_conflict_do_nothing())
        result = db.execute(update(AuthRateLimit).where(
            AuthRateLimit.key == key, AuthRateLimit.window == now, AuthRateLimit.count < limit
        ).values(count=AuthRateLimit.count + 1))
        if result.rowcount != 1:
            db.commit()
            raise HTTPException(429, 'Demasiados intentos. Esperá 15 minutos.', headers={'Retry-After': '900'})
    db.execute(delete(AuthRateLimit).where(AuthRateLimit.window < now - 96))
    db.commit()


async def send_email(to: str, subject: str, text: str, delivery_id: str):
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post('https://api.resend.com/emails', headers={
                'Authorization': f'Bearer {settings.resend_api_key}',
                'Idempotency-Key': delivery_id,
            }, json={'from': settings.email_from, 'to': [to], 'subject': subject, 'text': text})
            response.raise_for_status()
    except httpx.HTTPError:
        # Do not include recipient, response body, API key, or link in logs.
        logger.error('Account email delivery failed; user can request another link (delivery %s)', delivery_id)


def issue_action(db: Session, tasks: BackgroundTasks, user, purpose: str, member=None, project_name=''):
    require_email_config()
    raw = secrets.token_urlsafe(32)
    action = AuthAction(token_hash=hashlib.sha256(raw.encode()).hexdigest(), user_id=user.id,
                        purpose=purpose, member_id=member.id if member else None,
                        auth_version=user.auth_version,
                        expires_at=datetime.utcnow() + timedelta(minutes=20 if purpose == 'reset' else 1440))
    db.add(action)
    db.flush()
    url = f'{get_settings().frontend_url.rstrip("/")}/account-action#token={raw}'
    subjects = {'verify': 'Confirmá tu correo', 'reset': 'Restablecé tu contraseña', 'invite': 'Invitación a una obra'}
    intro = (f'Te invitaron a la obra {project_name}.\n' if purpose == 'invite' else '')
    heading = 'Restablecé tu Contraseña en Obrador' if purpose == 'reset' else f'{subjects[purpose]} en Obrador'
    text = (f'{intro}{heading}:\n\n{url}\n\n'
            f'Este enlace se puede usar una sola vez y vence en {"20 minutos" if purpose == "reset" else "24 horas"}.\n'
            'Si no esperabas este correo, podés ignorarlo. No compartas el enlace.\n\n'
            'Proyectos Compartidos - una solución de obrador.xyz')
    tasks.add_task(send_email, user.email, subjects[purpose] + ' — Proyectos Compartidos', text,
                   f'auth-action-{action.token_hash}')
    return action


def get_action(db: Session, raw: str):
    action = db.query(AuthAction).filter_by(token_hash=hashlib.sha256(raw.encode()).hexdigest()).first()
    from app.models.user import User
    from app.models.project_member import ProjectMember
    from app.models.project import Project
    user = db.get(User, action.user_id) if action else None
    if not action or action.used_at or action.expires_at <= datetime.utcnow() or not user or not user.is_active:
        raise HTTPException(400, 'El enlace venció o ya fue utilizado. Solicitá uno nuevo.')
    if action.auth_version != user.auth_version:
        raise HTTPException(400, 'El enlace ya no es válido. Solicitá uno nuevo.')
    member = db.get(ProjectMember, action.member_id) if action.member_id else None
    if action.purpose == 'invite':
        project = db.get(Project, member.project_id) if member else None
        if not member or not member.is_active or not project or not project.is_active or member.user_id != user.id:
            raise HTTPException(400, 'La invitación ya no está vigente.')
    return action, user, member
