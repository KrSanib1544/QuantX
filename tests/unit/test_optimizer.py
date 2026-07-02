# pyrefly: ignore [missing-import]
import pytest
import numpy as np
import pandas as pd
import datetime
import sys
import os

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Add portfolio-service folder to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/portfolio-service')))

# pyrefly: ignore [missing-import]
from app.optimizer import PortfolioOptimizer
sys.path.pop(0)

@pytest.fixture
def sample_returns_df():
    # Generate mock daily returns for 3 assets: A, B, C over 100 days
    # Avoid pd.date_range due to Windows Pandas C-level bugs under Python 3.13
    np.random.seed(42)
    start_date = datetime.date(2026, 1, 1)
    dates = [start_date + datetime.timedelta(days=i) for i in range(100)]
    
    data = {
        "Asset_A": np.random.normal(0.0005, 0.01, 100),
        "Asset_B": np.random.normal(0.0008, 0.012, 100),
        "Asset_C": np.random.normal(0.0003, 0.008, 100)
    }
    return pd.DataFrame(data, index=dates)

def test_mean_variance_optimization(sample_returns_df):
    optimizer = PortfolioOptimizer(risk_free_rate=0.02)
    result = optimizer.mean_variance_optimization(sample_returns_df)
    
    assert "weights" in result
    assert "expected_return" in result
    assert "expected_volatility" in result
    assert "sharpe_ratio" in result
    
    weights = result["weights"]
    assert len(weights) == 3
    assert set(weights.keys()) == {"Asset_A", "Asset_B", "Asset_C"}
    
    # Weights should sum to 1.0 (approximately)
    total_weight = sum(weights.values())
    assert pytest.approx(total_weight) == 1.0
    
    # All weights should be long-only (between 0.0 and 1.0)
    for w in weights.values():
        assert 0.0 <= w <= 1.0

def test_risk_parity_optimization(sample_returns_df):
    optimizer = PortfolioOptimizer(risk_free_rate=0.0)
    result = optimizer.risk_parity_optimization(sample_returns_df)
    
    assert "weights" in result
    assert "expected_return" in result
    assert "expected_volatility" in result
    assert "sharpe_ratio" in result
    
    weights = result["weights"]
    assert len(weights) == 3
    
    # Weights should sum to 1.0
    total_weight = sum(weights.values())
    assert pytest.approx(total_weight) == 1.0
    
    # All weights should be long-only
    for w in weights.values():
        assert 0.0 <= w <= 1.0

def test_black_litterman_optimization(sample_returns_df):
    optimizer = PortfolioOptimizer(risk_free_rate=0.02)
    
    # 3 assets
    market_weights = np.array([0.4, 0.4, 0.2])
    
    # Views: Asset_B will outperform by 5% annualized (excess return)
    views = np.array([0.05])
    view_link_matrix = np.array([[0.0, 1.0, 0.0]])
    view_omega = np.array([[0.02]])  # uncertainty matrix
    
    result = optimizer.black_litterman_optimization(
        returns_df=sample_returns_df,
        market_weights=market_weights,
        views=views,
        view_link_matrix=view_link_matrix,
        view_omega=view_omega,
        tau=0.05
    )
    
    assert "weights" in result
    assert "expected_return" in result
    assert "expected_volatility" in result
    assert "sharpe_ratio" in result
    
    weights = result["weights"]
    assert len(weights) == 3
    assert pytest.approx(sum(weights.values())) == 1.0
    
    for w in weights.values():
        assert 0.0 <= w <= 1.0
        
    # Test fallback to equal weight if shapes mismatch
    bad_weights = np.array([0.5, 0.5])  # should be 3
    fallback_result = optimizer.black_litterman_optimization(
        returns_df=sample_returns_df,
        market_weights=bad_weights,
        views=views,
        view_link_matrix=view_link_matrix,
        view_omega=view_omega,
        tau=0.05
    )
    assert pytest.approx(sum(fallback_result["weights"].values())) == 1.0
