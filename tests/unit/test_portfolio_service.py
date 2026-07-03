import pytest
import sys
import os
import uuid
import datetime
from sqlalchemy import create_engine, text

# Clean up any cached 'app' modules to prevent collision
for mod in list(sys.modules.keys()):
    if mod == 'app' or mod.startswith('app.'):
        del sys.modules[mod]

# Add portfolio-service folder to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend/portfolio-service")))
import local_db_helper
import app.main as portfolio_main
sys.path.pop(0)
sys.path.pop(0)

@pytest.fixture
def test_db():
    """
    Create an in-memory SQLite database populated with base tables and default portfolio/assets.
    """
    engine = create_engine("sqlite:///:memory:")
    
    # Initialize the tables using local_db_helper schema
    with engine.begin() as conn:
        for stmt in local_db_helper.SQLITE_SCHEMA.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
                
        # Insert default portfolio
        portfolio_id = "test-portfolio-id-123"
        conn.execute(text("""
            INSERT INTO portfolios (id, name, cash, equity)
            VALUES (:id, 'Test Portfolio', 100000.0, 100000.0)
        """), {"id": portfolio_id})
        
        # Insert asset AAPL
        asset_id = "test-asset-id-aapl"
        conn.execute(text("""
            INSERT INTO assets (id, symbol, name, sector)
            VALUES (:id, 'AAPL', 'Apple Inc.', 'Technology')
        """), {"id": asset_id})
        
    return engine, portfolio_id, asset_id

def test_execute_trade_mock_buy(test_db, monkeypatch):
    engine, portfolio_id, asset_id = test_db
    
    # Monkeypatch the engine inside main.py to use our in-memory test database
    monkeypatch.setattr(portfolio_main, "engine", engine)
    
    # Execute a BUY trade
    success, msg, details = portfolio_main.execute_trade_mock(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        symbol="AAPL",
        side="BUY",
        qty=10.0,
        price=150.0,
        commission_rate=0.0,
        slippage_rate=0.0
    )
    
    assert success is True
    assert msg == "Executed Successfully"
    assert details["new_cash"] == 98500.0
    assert details["new_equity"] == 100000.0 # cash + position value: 98500 + 1500 = 100000
    
    # Check that position has been added
    with engine.connect() as conn:
        pos = conn.execute(text("SELECT quantity, average_entry_price FROM positions")).fetchone()
        assert pos is not None
        assert float(pos[0]) == 10.0
        assert float(pos[1]) == 150.0
        
        trade = conn.execute(text("SELECT side, quantity, price FROM trades")).fetchone()
        assert trade is not None
        assert trade[0] == "BUY"
        assert float(trade[1]) == 10.0
        assert float(trade[2]) == 150.0

def test_execute_trade_mock_sell(test_db, monkeypatch):
    engine, portfolio_id, asset_id = test_db
    monkeypatch.setattr(portfolio_main, "engine", engine)
    
    # Establish a position first
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price)
            VALUES ('pos-id', :port_id, :asset_id, 20.0, 150.0, 150.0)
        """), {"port_id": portfolio_id, "asset_id": asset_id})
        
    # Execute a SELL trade
    success, msg, details = portfolio_main.execute_trade_mock(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        symbol="AAPL",
        side="SELL",
        qty=15.0,
        price=160.0,
        commission_rate=0.0,
        slippage_rate=0.0
    )
    
    assert success is True
    assert details["new_cash"] == 102400.0 # 100000 + 15 * 160 = 102400
    
    with engine.connect() as conn:
        pos = conn.execute(text("SELECT quantity FROM positions")).fetchone()
        assert float(pos[0]) == 5.0 # 20 - 15 = 5

def test_rebalance_endpoint(test_db, monkeypatch):
    engine, portfolio_id, asset_id = test_db
    monkeypatch.setattr(portfolio_main, "engine", engine)
    
    # Insert historical prices for AAPL (need at least 6 to have len(returns_df) >= 5)
    import datetime
    with engine.begin() as conn:
        for i in range(10):
            conn.execute(text("""
                INSERT INTO prices (id, asset_id, timestamp, open, high, low, close, volume, interval_type)
                VALUES (:id, :asset_id, :timestamp, :open, :high, :low, :close, 100000, '1d')
            """), {
                "id": f"price-id-{i}",
                "asset_id": asset_id,
                "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=10-i),
                "open": 140.0 + i,
                "high": 142.0 + i,
                "low": 139.0 + i,
                "close": 141.0 + i
            })
            
    # Run optimization preview
    req = portfolio_main.RebalanceRequest(method="mvo", portfolio_id=portfolio_id, execute=False)
    res = portfolio_main.rebalance(req)
    
    assert res["status"] == "success"
    assert "AAPL" in res["target_weights"]
    assert res["target_weights"]["AAPL"] == 1.0
    assert res["executed"] is False
    assert len(res["proposed_trades"]) > 0 # should propose a BUY since we own nothing and AAPL weight is 1.0
    
    # Test actual execution
    req_exec = portfolio_main.RebalanceRequest(method="mvo", portfolio_id=portfolio_id, execute=True)
    res_exec = portfolio_main.rebalance(req_exec)
    
    assert res_exec["status"] == "success"
    assert res_exec["executed"] is True
    assert res_exec["executed_successfully"] is True
    
    # Verify database position has been created
    with engine.connect() as conn:
        pos = conn.execute(text("SELECT quantity FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"), {
            "port_id": portfolio_id,
            "asset_id": asset_id
        }).fetchone()
        assert pos is not None
        assert float(pos[0]) > 0.0

