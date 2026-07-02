import pytest
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/signal-service")))
from app.signal_engine import SignalEngine
sys.path.pop(0)

def test_signal_engine_single_buy():
    engine = SignalEngine(buy_threshold=0.01, sell_threshold=-0.01)
    sig, conf = engine.generate_single_signal(0.015, 0.8)
    assert sig == "BUY"
    assert conf == 0.8

def test_signal_engine_single_sell():
    engine = SignalEngine(buy_threshold=0.01, sell_threshold=-0.01)
    sig, conf = engine.generate_single_signal(-0.02, 0.9)
    assert sig == "SELL"
    assert conf == 0.9

def test_signal_engine_single_hold():
    engine = SignalEngine(buy_threshold=0.01, sell_threshold=-0.01)
    sig, conf = engine.generate_single_signal(0.005, 0.5)
    assert sig == "HOLD"
    # predicted_return is close to 0, so confidence should be high for holding
    assert conf > 0.4

def test_signal_engine_ensemble():
    engine = SignalEngine(buy_threshold=0.01, sell_threshold=-0.01)
    predictions = [
        {"model_name": "lstm", "predicted_return": 0.015, "confidence_score": 0.8},
        {"model_name": "gru", "predicted_return": 0.012, "confidence_score": 0.7},
        {"model_name": "transformer", "predicted_return": -0.005, "confidence_score": 0.5}
    ]
    result = engine.generate_ensemble_signal(predictions)
    assert result["signal"] == "BUY"
    assert result["confidence"] > 0.5
    assert result["vote_distribution"]["BUY"] > 0.5
    assert abs(result["average_predicted_return"] - 0.0073) < 1e-4
