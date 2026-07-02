import pytest
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Add risk-service folder to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/risk-service')))

from app.risk_manager import RiskManager
sys.path.pop(0)

@pytest.fixture
def risk_manager():
    return RiskManager(
        max_portfolio_drawdown=0.20,
        max_asset_exposure=0.25,
        var_limit_95=0.05,
        default_stop_loss=0.02,
        default_trailing_stop=0.05
    )

def test_size_position_kelly(risk_manager):
    # Test normal kelly sizing
    # win_prob = 0.6, win_loss_ratio = 2.0, leverage_scale = 0.5
    # f* = 0.6 - (1 - 0.6)/2.0 = 0.6 - 0.2 = 0.4
    # scaled = 0.4 * 0.5 = 0.2
    size = risk_manager.size_position_kelly(0.6, 2.0)
    assert pytest.approx(size) == 0.2
    
    # Test kelly sizing exceeding max asset exposure limit
    # f* = 0.8 - 0.2/2.0 = 0.7
    # scaled = 0.7 * 0.5 = 0.35 -> should be capped at max_asset_exposure (0.25)
    size_capped = risk_manager.size_position_kelly(0.8, 2.0)
    assert size_capped == 0.25

    # Test negative/zero win loss ratio
    assert risk_manager.size_position_kelly(0.6, -1.0) == 0.0
    assert risk_manager.size_position_kelly(0.6, 0.0) == 0.0

def test_size_position_volatility(risk_manager):
    # Target portfolio risk = 0.02, asset volatility = 0.10
    # Allocation = 0.02 / 0.10 = 0.20
    assert pytest.approx(risk_manager.size_position_volatility(0.02, 0.10)) == 0.20
    
    # Exceeding limit: 0.05 / 0.10 = 0.50 -> capped at 0.25
    assert risk_manager.size_position_volatility(0.05, 0.10) == 0.25
    
    # Zero or negative volatility
    assert risk_manager.size_position_volatility(0.02, 0.0) == 0.0
    assert risk_manager.size_position_volatility(0.02, -0.05) == 0.0

def test_validate_trade_limits(risk_manager):
    # 10 shares * $10 = $100 value. Portfolio equity = $1000. Current position = $100.
    # exposure = (100 + 100) / 1000 = 0.20 (<= 0.25) -> True
    approved, reason = risk_manager.validate_trade_limits(
        symbol="AAPL",
        order_qty=10.0,
        current_price=10.0,
        portfolio_equity=1000.0,
        current_position_value=100.0
    )
    assert approved is True
    assert reason == "Approved"

    # Exceeding exposure limit:
    # 20 shares * $10 = $200. new exposure = (100 + 200)/1000 = 0.30 (> 0.25) -> False
    approved, reason = risk_manager.validate_trade_limits(
        symbol="AAPL",
        order_qty=20.0,
        current_price=10.0,
        portfolio_equity=1000.0,
        current_position_value=100.0
    )
    assert approved is False
    assert "exceeds max asset exposure" in reason

def test_process_stops(risk_manager):
    # Stop loss test
    # entry = 100.0. default_stop_loss = 0.02. stop price = 98.0
    # current = 99.0 -> not triggered
    triggered, price = risk_manager.process_stops(99.0, 100.0, 100.0, stop_type="stop_loss")
    assert triggered is False
    
    # current = 97.5 -> triggered
    triggered, price = risk_manager.process_stops(97.5, 100.0, 100.0, stop_type="stop_loss")
    assert triggered is True
    assert pytest.approx(price) == 98.0

    # Trailing stop test
    # highest = 120.0. default_trailing_stop = 0.05. stop price = 114.0
    # current = 115.0 -> not triggered
    triggered, price = risk_manager.process_stops(115.0, 100.0, 120.0, stop_type="trailing_stop")
    assert triggered is False

    # current = 113.0 -> triggered
    triggered, price = risk_manager.process_stops(113.0, 100.0, 120.0, stop_type="trailing_stop")
    assert triggered is True
    assert pytest.approx(price) == 114.0
