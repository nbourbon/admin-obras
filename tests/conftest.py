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
def _clean_test_db_session():
    """Elimina la BD de test al inicio y al final de la sesión."""
    if os.path.exists(_TEST_DB_PATH):
        os.remove(_TEST_DB_PATH)
    yield
    if os.path.exists(_TEST_DB_PATH):
        os.remove(_TEST_DB_PATH)


@pytest.fixture(scope="session")
def _test_client(_clean_test_db_session):
    """TestClient de sesión: se crea una sola vez y se reutiliza."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function", autouse=True)
def _reset_db(_test_client):
    """
    Resetea todas las tablas antes de cada test.
    Garantiza que cada test parte de una BD limpia aunque compartan el mismo cliente.
    """
    from app.database import engine, Base, init_db
    Base.metadata.drop_all(bind=engine)
    init_db()
    yield


@pytest.fixture(scope="function")
def client(_test_client, _reset_db):
    """TestClient con BD limpia para cada test."""
    return _test_client
