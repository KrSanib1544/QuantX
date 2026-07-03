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

def test_rl_prediction():
    response = client.get("/api/v1/predictions/AAPL/rl?cash=100000.0&position_qty=10.0&average_entry_price=150.0")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert "recommended_action" in data
    assert "observation" in data
    assert "details" in data
    assert data["status"] == "success"

def test_trigger_retrain_and_status(monkeypatch):
    import subprocess
    class MockCompletedProcess:
        def __init__(self, returncode=0, stdout="", stderr=""):
            self.returncode = returncode
            self.stdout = stdout
            self.stderr = stderr
            
    def mock_run(*args, **kwargs):
        return MockCompletedProcess()
        
    monkeypatch.setattr(subprocess, "run", mock_run)
    
    response = client.post("/api/v1/models/retrain")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["started", "already_running"]
    
    status_response = client.get("/api/v1/models/retrain/status")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert "status" in status_data
    assert "in_progress" in status_data

