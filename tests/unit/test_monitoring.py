import pytest
import numpy as np

# Python module names with dashes can be tricky to import directly, so we can use importlib or sys.path adjustment.
# But since we run pytest from the workspace, we should make sure feature-service is importable.
# Let's adjust sys.path in the test file if needed or mock import.
# Wait, let's look at how backend is organized. The folder is `backend/feature-service`.
# So to import from it, we can add it to sys.path:
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/feature-service")))
from app.monitoring import FeatureMonitor
sys.path.pop(0)

def test_data_quality_ok():
    monitor = FeatureMonitor()
    features = {
        "timestamp": "2026-07-01T12:00:00",
        "symbol": "AAPL",
        "rsi_14": 55.5,
        "atr_14": 2.4,
        "regime": 1
    }
    result = monitor.check_data_quality("AAPL", features)
    assert result["status"] == "OK"
    assert result["nan_count"] == 0
    assert result["inf_count"] == 0

def test_data_quality_warning():
    monitor = FeatureMonitor()
    features = {
        "timestamp": "2026-07-01T12:00:00",
        "symbol": "AAPL",
        "rsi_14": None, # NaN trigger
        "atr_14": float('inf'), # Inf trigger
        "regime": 1
    }
    result = monitor.check_data_quality("AAPL", features)
    assert result["status"] == "WARNING"
    assert result["nan_count"] == 1
    assert result["inf_count"] == 1
    assert "rsi_14" in result["nan_fields"]
    assert "atr_14" in result["inf_fields"]

def test_feature_drift_detection():
    # Use small baseline window to test easily
    monitor = FeatureMonitor(baseline_windows=3, z_score_threshold=2.0)
    
    # Establish baseline history for AAPL rsi_14 around 50
    monitor.check_feature_drift("AAPL", {"rsi_14": 50.0})
    monitor.check_feature_drift("AAPL", {"rsi_14": 51.0})
    monitor.check_feature_drift("AAPL", {"rsi_14": 49.0})
    
    # 4th observation: within normal range
    result_normal = monitor.check_feature_drift("AAPL", {"rsi_14": 50.5})
    assert result_normal["drift_detected"] is False
    
    # 5th observation: massive drift
    result_drift = monitor.check_feature_drift("AAPL", {"rsi_14": 95.0})
    assert result_drift["drift_detected"] is True
    assert "rsi_14" in result_drift["details"]
    assert result_drift["details"]["rsi_14"]["z_score"] > 2.0
