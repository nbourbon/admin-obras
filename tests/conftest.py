"""
Configuración de tests E2E.

IMPORTANTE: El DATABASE_URL se sobreescribe ANTES de importar cualquier módulo
de la app, de modo que el engine de SQLAlchemy se crea apuntando a la BD de test.
"""
import os
import pytest

# 1. Setear la BD de test ANTES de cualquier import de la app
_TEST_DB_PATH = "./tests/test_e2e.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"

# 2. Limpiar caché de settings para garantizar que lean el env var recién seteado
from app.config import get_settings  # noqa: E402
get_settings.cache_clear()

# 3. Ahora sí importar el resto
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402 — este import dispara la creación del engine


@pytest.fixture(scope="session", autouse=True)
def _clean_test_db():
    """Elimina la BD de test antes y después de la sesión."""
    if os.path.exists(_TEST_DB_PATH):
        os.remove(_TEST_DB_PATH)
    yield
    if os.path.exists(_TEST_DB_PATH):
        os.remove(_TEST_DB_PATH)


@pytest.fixture(scope="session")
def client(_clean_test_db):
    """
    TestClient de sesión completa.
    El startup event de FastAPI crea las tablas (init_db) en la BD de test.
    """
    with TestClient(app) as c:
        yield c
