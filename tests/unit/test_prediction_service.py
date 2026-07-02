import pytest
from fastapi.testclient import TestClient
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Adjust paths to import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/ai-prediction-service')))

from app.main import app
sys.path.pop(0)

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "loaded_models" in response.json()

def test_get_predictions():
    # If the DB lookup fails during tests, it will hit the fallback, which returns 200.
    response = client.get("/api/v1/predictions/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "predicted_return" in data
    assert "confidence_score" in data
    assert "breakdown" in data

def test_batch_predictions():
    response = client.post("/api/v1/predictions/batch", json={"symbols": ["AAPL", "MSFT"]})
    assert response.status_code == 200
    data = response.json()
    assert "AAPL" in data
    assert "MSFT" in data
    assert "predicted_return" in data["AAPL"]
    assert "confidence_score" in data["AAPL"]

def test_explain_prediction():
    response = client.get("/api/v1/predictions/AAPL/explanation")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "attributions" in data
    assert "method" in data
    assert "rsi_14" in data["attributions"]

def test_models_list():
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["model_id"] == "lstm"
    assert "status" in data[0]
