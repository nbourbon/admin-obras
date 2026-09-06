from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database import Base


class AuthAction(Base):
    __tablename__ = "auth_actions"
    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(String(20), nullable=False)
    member_id = Column(Integer, ForeignKey("project_members.id"), nullable=True)
    auth_version = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


class AuthRateLimit(Base):
    __tablename__ = "auth_rate_limits"
    key = Column(String(64), primary_key=True)
    window = Column(Integer, primary_key=True)
    count = Column(Integer, nullable=False, default=0)
