import pytest
from fastapi.testclient import TestClient
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Adjust paths to import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/quantum-research-service')))

from app.main import app
sys.path.pop(0)

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_kernels():
    response = client.get("/api/v1/quantum/kernels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert "kernel_id" in data[0]
    assert "qubits" in data[0]

def test_quantum_experiment_lifecycle():
    # 1. Create experiment
    payload = {
        "name": "QA-Portfolio-Optimization-v4.2",
        "params": {
            "symbols": ["AAPL", "MSFT", "TSLA", "BTC-USD"],
            "target": "Sharpe Maximization"
        }
    }
    response = client.post("/api/v1/quantum/experiments", json=payload)
    assert response.status_code == 200
    exp = response.json()
    assert "id" in exp
    assert exp["status"] == "created"
    exp_id = exp["id"]

    # 2. Run experiment
    run_response = client.post(f"/api/v1/quantum/experiments/{exp_id}/run")
    assert run_response.status_code == 200
    run_data = run_response.json()
    assert run_data["experiment_id"] == exp_id
    assert run_data["status"] == "completed"
    assert "portfolio_optimization" in run_data["results"]
    assert "feature_selection" in run_data["results"]

    # 3. Retrieve results
    res_response = client.get(f"/api/v1/quantum/experiments/{exp_id}/results")
    assert res_response.status_code == 200
    res_data = res_response.json()
    assert res_data["status"] == "completed"
    assert "portfolio_optimization" in res_data["results"]

    # 4. Promote experiment strategy
    promo_payload = {"target_engine": "Backtest"}
    promo_response = client.post(f"/api/v1/quantum/experiments/{exp_id}/promote", json=promo_payload)
    assert promo_response.status_code == 200
    promo_data = promo_response.json()
    assert promo_data["status"] == "success"
    assert promo_data["promoted_to"] == "Backtest"
