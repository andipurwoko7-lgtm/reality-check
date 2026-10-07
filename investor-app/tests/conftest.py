import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ADMIN_USER", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("BCRYPT_ROUNDS", "4")


@pytest.fixture()
def klien(tmp_path, monkeypatch):
    monkeypatch.setenv("INVESTOR_DB", str(tmp_path / "uji.db"))
    from app.main import app
    with TestClient(app) as c:
        r = c.post("/api/masuk", json={"nama_pengguna": "admin", "kata_sandi": "admin123"})
        assert r.status_code == 200, r.text
        yield c


@pytest.fixture(autouse=True)
def bersihkan_batas_masuk():
    from app import auth
    auth._gagal.clear()
    yield
    auth._gagal.clear()
