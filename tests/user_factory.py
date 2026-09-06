"""Verified account factory for accounting scenarios, independent of signup UX."""
import httpx
from app.database import SessionLocal
from app.services.auth import create_user


def seed_verified_user(json, **_):
    with SessionLocal() as db:
        user = create_user(db, json['email'], json['password'], json['full_name'])
        user.email_verified = True
        db.commit()
        return httpx.Response(201, json={'id': user.id, 'email': user.email, 'is_admin': False})
