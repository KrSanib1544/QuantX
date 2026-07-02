import sys
import os
import pytest
import pandas as pd
import numpy as np
import datetime

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Add backtesting service to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend/backtesting-service')))

from app.backtester import ParallelBacktester
sys.path.pop(0)

def test_parallel_backtester():
    # 1. Generate some mock market data (avoiding pd.date_range for Windows)
    start_date = datetime.date(2026, 1, 1)
    dates = [start_date + datetime.timedelta(days=i) for i in range(100)]
    
    data_list = []
    for d in dates:
        data_list.append({
            "timestamp": d,
            "symbol": "AAPL",
            "open": 150.0,
            "high": 152.0,
            "low": 149.0,
            "close": 151.0,
            "volume": 10000.0
        })
    data_df = pd.DataFrame(data_list)
    
    # 2. Generate a grid of parameters
    # Parameter Set 1: Heavy BUY weight (0.5)
    sig_list_1 = []
    for i, d in enumerate(dates):
        sig_list_1.append({
            "timestamp": d,
            "symbol": "AAPL",
            "signal": "BUY" if i % 10 == 0 else "HOLD",
            "weight": 0.5
        })
    signals_df_1 = pd.DataFrame(sig_list_1)
    
    # Parameter Set 2: Light BUY weight (0.1)
    sig_list_2 = []
    for i, d in enumerate(dates):
        sig_list_2.append({
            "timestamp": d,
            "symbol": "AAPL",
            "signal": "BUY" if i % 10 == 0 else "HOLD",
            "weight": 0.1
        })
    signals_df_2 = pd.DataFrame(sig_list_2)
    
    grid_signals = [
        ("run_heavy", signals_df_1, {"weight": 0.5}),
        ("run_light", signals_df_2, {"weight": 0.1})
    ]
    
    # 3. Run parallel grid backtester
    p_backtester = ParallelBacktester(initial_cash=100000.0)
    results = p_backtester.run_grid_search(data_df, grid_signals)
    
    # 4. Verify results
    assert len(results) == 2
    assert results[0]["param_id"] in ["run_heavy", "run_light"]
    assert "sharpe" in results[0]
    assert "cagr" in results[0]
    assert "parameters" in results[0]
