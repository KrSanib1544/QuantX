import pytest
from fastapi.testclient import TestClient
import sys
import os

# Clean up any cached 'app' modules to prevent collision
import sys
import os
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Adjust paths to import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/portfolio-service')))
import app.main as portfolio_main
from app.main import app as portfolio_app
sys.path.pop(0)

portfolio_client = TestClient(portfolio_app)

def test_brokerage_settings_lifecycle():
    # 1. Update settings
    payload = {
        "alpaca_api_key": "testkey123",
        "alpaca_secret_key": "testsecret456",
        "live_trading": False
    }
    response = portfolio_client.post("/brokerage/settings", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # 2. Get settings
    response = portfolio_client.get("/brokerage/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["alpaca_api_key"] == "testkey123"
    # Secret key should be masked
    assert "testsecret" not in data["alpaca_secret_key"]
    assert data["live_trading"] is False

def test_brokerage_status_unconfigured(monkeypatch):
    # Mock load_brokerage_credentials to return None keys
    monkeypatch.setattr(portfolio_main, "load_brokerage_credentials", lambda: (None, None, False))
    response = portfolio_client.get("/brokerage/status")
    assert response.status_code == 200
    assert response.json()["status"] == "disconnected"
