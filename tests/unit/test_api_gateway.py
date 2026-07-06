import pytest
from fastapi.testclient import TestClient
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Adjust paths to import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/api-gateway')))

import app.main as gateway_main
from app.main import app
sys.path.pop(0)

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_check_services_health_unauthorized():
    # Calling the endpoint without token should return 401 or 403
    response = client.get("/api/health/services")
    assert response.status_code in [401, 403]

def test_check_services_health_authorized(monkeypatch):
    # Override get_current_user dependency
    app.dependency_overrides[gateway_main.get_current_user] = lambda: {"username": "admin"}
    
    # Mock requests.get to return a mock response for microservices
    import requests
    class MockResponse:
        def __init__(self, status_code=200):
            self.status_code = status_code
            
    def mock_get(*args, **kwargs):
        return MockResponse(200)
        
    monkeypatch.setattr(requests, "get", mock_get)
    
    response = client.get("/api/health/services")
    assert response.status_code == 200
    data = response.json()
    assert data["api-gateway"] == "online"
    assert data["quantum-research-service"] == "online"
    assert data["market-data-service"] == "online"
    
    # Clean up overrides
    app.dependency_overrides.clear()
