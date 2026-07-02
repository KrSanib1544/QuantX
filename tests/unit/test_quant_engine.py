import numpy as np
import pandas as pd
import pytest
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Add service folder to path to bypass folders with dashes
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/backtesting-service')))

from app.quant_engine.returns import (
    annualized_return, cagr, annualized_volatility, downside_volatility, 
    sharpe_ratio, sortino_ratio, max_drawdown, calmar_ratio
)
from app.quant_engine.risk_metrics import (
    beta, alpha, value_at_risk, conditional_value_at_risk
)
from app.quant_engine.portfolio_metrics import (
    portfolio_returns, portfolio_variance, portfolio_volatility, portfolio_sharpe
)
from app.backtester import Backtester, Order
sys.path.pop(0)

# Helper to create mock returns
@pytest.fixture
def sample_returns():
    # 10 days of returns: 1%, 2%, -1%, -2%, 1.5%, 0.5%, -0.5%, 3%, -1%, 2.5%
    rets = [0.01, 0.02, -0.01, -0.02, 0.015, 0.005, -0.005, 0.03, -0.01, 0.025]
    dates = [pd.Timestamp(f"2026-01-{i:02d}") for i in range(1, 11)]
    return pd.Series(rets, index=dates)

@pytest.fixture
def benchmark_returns():
    # 10 days of benchmark returns: 0.5%, 1%, 0%, -1%, 1%, 0.5%, 0%, 2%, -0.5%, 1.5%
    rets = [0.005, 0.01, 0.0, -0.01, 0.01, 0.005, 0.0, 0.02, -0.005, 0.015]
    dates = [pd.Timestamp(f"2026-01-{i:02d}") for i in range(1, 11)]
    return pd.Series(rets, index=dates)

def test_annualized_return(sample_returns):
    ann_ret = annualized_return(sample_returns, periods_per_year=252)
    expected = sample_returns.mean() * 252
    assert pytest.approx(ann_ret) == expected

def test_cagr(sample_returns):
    calculated_cagr = cagr(sample_returns, periods_per_year=252)
    total_val = (1.0 + sample_returns).prod()
    years = 10 / 252
    expected = (total_val ** (1.0 / years)) - 1.0
    assert pytest.approx(calculated_cagr) == expected

def test_annualized_volatility(sample_returns):
    vol = annualized_volatility(sample_returns, periods_per_year=252)
    expected = sample_returns.std(ddof=1) * np.sqrt(252)
    assert pytest.approx(vol) == expected

def test_max_drawdown():
    # Create simple series: start at 100, go to 110, then 90, then 120
    # Returns from 100 to 110: 10% (0.1)
    # Returns from 110 to 90: -18.18% (-0.181818)
    # Returns from 90 to 120: 33.33% (0.333333)
    rets = pd.Series([0.1, -0.181818, 0.333333])
    # Peak is 110. Valley is 90. Max drawdown = (110 - 90)/110 = 20/110 = 18.18%
    assert pytest.approx(max_drawdown(rets), rel=1e-3) == 0.181818

def test_sharpe_ratio(sample_returns):
    sr = sharpe_ratio(sample_returns, risk_free_rate=0.05, periods_per_year=252)
    daily_rf = 0.05 / 252
    excess = sample_returns - daily_rf
    expected = (excess.mean() * 252) / (sample_returns.std(ddof=1) * np.sqrt(252))
    assert pytest.approx(sr) == expected

def test_beta(sample_returns, benchmark_returns):
    b = beta(sample_returns, benchmark_returns)
    covariance = np.cov(sample_returns, benchmark_returns)[0][1]
    variance = np.var(benchmark_returns, ddof=1)
    expected = covariance / variance
    assert pytest.approx(b) == expected

def test_value_at_risk(sample_returns):
    var_hist = value_at_risk(sample_returns, confidence_level=0.90, method="historical")
    # alpha = 0.10. 10th percentile of sample_returns
    expected = -np.percentile(sample_returns, 10)
    assert pytest.approx(var_hist) == expected

def test_conditional_value_at_risk(sample_returns):
    cvar_hist = conditional_value_at_risk(sample_returns, confidence_level=0.90, method="historical")
    var_hist = value_at_risk(sample_returns, confidence_level=0.90, method="historical")
    tail = sample_returns[sample_returns <= -var_hist]
    expected = -tail.mean()
    assert pytest.approx(cvar_hist) == expected

def test_portfolio_metrics():
    # 2 assets, 3 days
    asset_data = pd.DataFrame({
        "AAPL": [0.01, -0.005, 0.02],
        "MSFT": [0.005, 0.01, -0.01]
    })
    weights = np.array([0.6, 0.4])
    port_rets = portfolio_returns(weights, asset_data)
    expected_rets = asset_data["AAPL"] * 0.6 + asset_data["MSFT"] * 0.4
    pd.testing.assert_series_equal(port_rets, expected_rets)

def test_backtester():
    # Simple backtester test
    dates_list = [pd.Timestamp(f"2026-01-{i:02d}") for i in range(1, 6) for _ in range(2)]
    data = pd.DataFrame({
        "timestamp": dates_list,
        "symbol": ["AAPL", "MSFT"] * 5,
        "open": [150.0, 300.0, 151.0, 301.0, 149.0, 299.0, 152.0, 302.0, 155.0, 305.0],
        "high": [152.0, 302.0, 153.0, 303.0, 150.0, 300.0, 154.0, 304.0, 156.0, 306.0],
        "low": [149.0, 299.0, 148.0, 298.0, 147.0, 297.0, 151.0, 301.0, 153.0, 303.0],
        "close": [151.0, 301.0, 150.0, 299.0, 149.0, 298.0, 153.0, 303.0, 154.0, 304.0],
        "volume": [1000, 2000] * 5
    })
    
    signals = pd.DataFrame({
        "timestamp": [pd.Timestamp("2026-01-01"), pd.Timestamp("2026-01-03")],
        "symbol": ["AAPL", "AAPL"],
        "signal": ["BUY", "SELL"],
        "weight": [0.5, 0.5]
    })
    
    backtester = Backtester(initial_cash=100000.0, commission_rate=0.0, slippage_rate=0.0)
    results = backtester.run(data, signals)
    
    assert "cagr" in results
    assert "sharpe" in results
    assert results["final_value"] > 0.0
