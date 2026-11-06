"""Exercise engine initialization without connecting to a production database."""
from pathlib import Path
from types import SimpleNamespace
import runpy

import pytest
import sqlalchemy
from app import config
from app.database import engine


@pytest.mark.parametrize('url', [
    'postgresql://test:test@pooler.invalid:6543/postgres',
    'postgresql+psycopg://test:test@pooler.invalid:6543/postgres',
])
def test_postgres_engine_disables_prepared_statements_for_transaction_pooler(monkeypatch, url):
    calls = []
    def capture(database_url, **kwargs):
        calls.append((database_url, kwargs))
        return engine
    monkeypatch.setattr(config, 'get_settings', lambda: SimpleNamespace(database_url=url, debug=False))
    monkeypatch.setattr(sqlalchemy, 'create_engine', capture)
    runpy.run_path(str(Path(__file__).resolve().parents[2] / 'app/database.py'))
    assert calls[0][0].startswith('postgresql+psycopg://')
    assert calls[0][1]['connect_args']['prepare_threshold'] is None
