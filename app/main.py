import logging
import time
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.database import init_db
from app.routers import (
    auth_router,
    users_router,
    providers_router,
    categories_router,
    rubros_router,
    expenses_router,
    payments_router,
    dashboard_router,
    exchange_rate_router,
    projects_router,
    notes_router,
    contributions_router,
    avance_obra_router,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Backend API for managing construction expenses among multiple participants",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# Middleware to prevent connection reuse when waking from suspend
class ConnectionCloseMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Log incoming request with timestamp for diagnostics
        timestamp = datetime.utcnow().isoformat()
        start = time.perf_counter()
        logger.info(f"[{timestamp}] {request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Force connection close to prevent zombie connections when Fly.io suspends
        response.headers["Connection"] = "close"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

        logger.info(
            f"[{timestamp}] {request.method} {request.url.path} - "
            f"Response: {response.status_code} - Duration: {duration_ms:.1f}ms"
        )
        return response


app.add_middleware(ConnectionCloseMiddleware)

# CORS middleware - configure as needed for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(providers_router)
app.include_router(categories_router)
app.include_router(rubros_router)
app.include_router(expenses_router)
app.include_router(payments_router)
app.include_router(dashboard_router)
app.include_router(exchange_rate_router)
app.include_router(projects_router)
app.include_router(notes_router)
app.include_router(contributions_router)
app.include_router(avance_obra_router)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
