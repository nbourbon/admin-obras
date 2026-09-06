from datetime import datetime
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.auth_action import AuthAction
from app.schemas.user import (UserResponse, Token, GoogleAuthRequest, RegistrationRequest,
                              EmailRequest, ActionRequest, CompleteActionRequest)
from app.services.auth import authenticate_user, create_access_token, get_user_by_email, get_password_hash
from app.services.auth_email import rate_limit, require_email_config, issue_action, get_action, send_email
from app.utils.dependencies import get_current_user

router = APIRouter(prefix='/auth', tags=['Authentication'])
MESSAGE = {'message': 'Si corresponde, recibirás un correo con los próximos pasos. Revisá también spam.'}


def access_token(user):
    return Token(access_token=create_access_token({'sub': str(user.id), 'email': user.email, 'ver': user.auth_version}))


@router.post('/register')
@router.post('/register-first-admin')
def retired_registration():
    raise HTTPException(410, 'Usá el registro con verificación de correo o las invitaciones del proyecto.')


@router.post('/self-register', status_code=202)
def register(data: RegistrationRequest, request: Request, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    require_email_config()
    email = str(data.email).strip().lower()
    rate_limit(db, request, 'email', email)
    user = get_user_by_email(db, email)
    if not user:
        # Password is chosen only AFTER proving mailbox ownership, never by the requester.
        user = User(email=email, full_name=data.full_name, is_admin=False, email_verified=False)
        db.add(user)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return MESSAGE
    if user.is_active and not user.email_verified and not user.google_id:
        issue_action(db, tasks, user, 'verify')
        db.commit()
    return MESSAGE


@router.post('/resend-verification', status_code=202)
def resend_verification(data: EmailRequest, request: Request, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    require_email_config()
    rate_limit(db, request, 'email', str(data.email))
    user = get_user_by_email(db, str(data.email))
    if user and user.is_active and not user.email_verified and not user.google_id:
        issue_action(db, tasks, user, 'verify')
        db.commit()
    return MESSAGE


@router.post('/forgot-password', status_code=202)
def forgot_password(data: EmailRequest, request: Request, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    require_email_config()
    rate_limit(db, request, 'email', str(data.email))
    user = get_user_by_email(db, str(data.email))
    if user and user.is_active:
        if user.google_id and not user.password_hash:
            tasks.add_task(send_email, user.email, 'Acceso a Admin Obras',
                           'Tu cuenta usa Google. Elegí Continuar con Google en la aplicación. '
                           'Si perdiste el acceso a Google, recuperalo desde https://accounts.google.com/signin/recovery',
                           'google-help-' + secrets.token_hex(16))
        else:
            issue_action(db, tasks, user, 'reset' if user.email_verified else 'verify')
            db.commit()
    return MESSAGE


@router.post('/action-info')
def action_info(data: ActionRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(db, request, 'action')
    action, user, member = get_action(db, data.token)
    return {'purpose': action.purpose, 'requires_password': action.purpose == 'reset' or not user.email_verified,
            'google_only': bool(user.google_id and not user.password_hash)}


@router.post('/complete-action')
def complete_action(data: CompleteActionRequest, request: Request, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    rate_limit(db, request, 'action')
    action, user, member = get_action(db, data.token)
    needs_password = action.purpose == 'reset' or not user.email_verified
    if action.purpose == 'verify' and user.email_verified:
        raise HTTPException(400, 'La cuenta ya fue verificada. Iniciá sesión.')
    if needs_password and user.google_id and not user.password_hash:
        raise HTTPException(400, 'Esta cuenta usa Google. Iniciá sesión con Google.')
    if needs_password and not data.password:
        raise HTTPException(422, 'Ingresá una contraseña nueva de al menos 10 caracteres.')
    # Single-use claim and credential update commit together; a race loses without changing credentials.
    now = datetime.utcnow()
    result = db.execute(update(AuthAction).where(AuthAction.id == action.id, AuthAction.used_at.is_(None),
                                               AuthAction.expires_at > now).values(used_at=now))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(400, 'El enlace ya fue utilizado.')
    if needs_password:
        result = db.execute(update(User).where(User.id == user.id, User.auth_version == action.auth_version).values(
            password_hash=get_password_hash(data.password), email_verified=True,
            auth_version=User.auth_version + 1, is_admin=False))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(400, 'El enlace ya no es válido.')
        db.execute(update(AuthAction).where(AuthAction.user_id == user.id, AuthAction.used_at.is_(None),
                                           AuthAction.purpose != 'invite').values(used_at=now))
        # Invitations to other works still require acceptance, now against the new credential version.
        db.execute(update(AuthAction).where(AuthAction.user_id == user.id, AuthAction.used_at.is_(None),
                                           AuthAction.purpose == 'invite').values(auth_version=action.auth_version + 1))
    if member:
        member.invitation_accepted = True
        db.execute(update(AuthAction).where(
            AuthAction.member_id == member.id,
            AuthAction.used_at.is_(None),
        ).values(used_at=now))
    db.commit()
    if needs_password:
        tasks.add_task(send_email, user.email, 'Contraseña actualizada — Admin Obras',
                       'Se actualizó tu contraseña de Admin Obras. Las sesiones anteriores fueron cerradas. '
                       'Si no realizaste este cambio, solicitá recuperar tu contraseña desde la aplicación.',
                       f'password-changed-{action.id}')
    return {'message': 'Listo. Ya podés iniciar sesión.'}


@router.post('/login', response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    rate_limit(db, request, 'login', form_data.username)
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user or not user.is_active:
        raise HTTPException(401, 'Email o contraseña incorrectos')
    if not user.email_verified:
        raise HTTPException(403, 'Confirmá tu correo antes de iniciar sesión.')
    return access_token(user)


@router.post('/google', response_model=Token)
def google_login(data: GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(db, request, 'google')
    try:
        info = google_id_token.verify_oauth2_token(data.token, google_requests.Request(), get_settings().google_client_id)
    except ValueError:
        raise HTTPException(401, 'Token de Google inválido')
    email, subject = info.get('email', '').lower(), info.get('sub')
    if not subject or not email or info.get('email_verified') is not True:
        raise HTTPException(401, 'Google no confirmó el correo de esta cuenta')
    # Existing links are keyed by stable Google subject, never replaced by matching email.
    user = db.query(User).filter(User.google_id == subject).first()
    if not user:
        user = get_user_by_email(db, email)
        authoritative = email.endswith('@gmail.com') or bool(info.get('hd'))
        if user and (user.google_id or not authoritative):
            raise HTTPException(403, 'No se pudo vincular esta cuenta. Usá tu acceso habitual o recuperá la contraseña.')
        if not user:
            if not authoritative:
                raise HTTPException(403, 'Para este correo, registrate con verificación por email.')
            user = User(email=email, full_name=info.get('name') or email, is_admin=False, email_verified=True, is_active=True)
            db.add(user)
        elif not user.email_verified:
            # Discard any legacy unverified password before linking verified Google identity.
            user.password_hash = None
            user.auth_version += 1
            db.execute(update(AuthAction).where(
                AuthAction.user_id == user.id,
                AuthAction.used_at.is_(None),
                AuthAction.purpose == 'invite',
            ).values(auth_version=user.auth_version))
        if not user.is_active:
            raise HTTPException(401, 'La cuenta está inactiva')
        user.google_id = subject
        user.email_verified = True
        db.commit()
        db.refresh(user)
    if not user.is_active:
        raise HTTPException(401, 'La cuenta está inactiva')
    return access_token(user)


@router.get('/me', response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user
