from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.providers import router as providers_router
from app.routers.categories import router as categories_router
from app.routers.rubros import router as rubros_router
from app.routers.expenses import router as expenses_router
from app.routers.payments import router as payments_router
from app.routers.dashboard import router as dashboard_router
from app.routers.exchange_rate import router as exchange_rate_router
from app.routers.projects import router as projects_router
from app.routers.notes import router as notes_router
from app.routers.contributions import router as contributions_router
from app.routers.avance_obra import router as avance_obra_router

__all__ = [
    "auth_router",
    "users_router",
    "providers_router",
    "categories_router",
    "rubros_router",
    "expenses_router",
    "payments_router",
    "dashboard_router",
    "exchange_rate_router",
    "projects_router",
    "notes_router",
    "contributions_router",
    "avance_obra_router",
]
