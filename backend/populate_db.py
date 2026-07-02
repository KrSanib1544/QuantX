import os
import uuid
import datetime
import random
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, text

import sys
sys.path.insert(0, os.path.dirname(__file__))
import local_db_helper

def populate():
    print("Initializing SQLite Database...")
    engine, url = local_db_helper.create_sqlite_engine_and_init()
    
    print(f"Connected to SQLite DB: {url}")
    
    with engine.begin() as conn:
        # Clear existing data to ensure a fresh, consistent state
        print("Clearing existing tables...")
        for table in ["risk_metrics_history", "trades", "positions", "portfolios", "signals", "predictions", "features", "prices", "assets"]:
            conn.execute(text(f"DELETE FROM {table}"))
            
        print("Inserting assets...")
        assets = [
            {"id": str(uuid.uuid4()), "symbol": "AAPL", "name": "Apple Inc.", "asset_class": "equity", "sector": "Technology", "is_active": 1},
            {"id": str(uuid.uuid4()), "symbol": "MSFT", "name": "Microsoft Corp.", "asset_class": "equity", "sector": "Technology", "is_active": 1},
            {"id": str(uuid.uuid4()), "symbol": "TSLA", "name": "Tesla Inc.", "asset_class": "equity", "sector": "Automotive", "is_active": 1},
            {"id": str(uuid.uuid4()), "symbol": "BTC-USD", "name": "Bitcoin USD", "asset_class": "crypto", "sector": "Cryptocurrency", "is_active": 1}
        ]
        for a in assets:
            conn.execute(text("""
                INSERT INTO assets (id, symbol, name, asset_class, sector, is_active)
                VALUES (:id, :symbol, :name, :asset_class, :sector, :is_active)
            """), a)
            
        asset_map = {a["symbol"]: a["id"] for a in assets}
        
        print("Inserting historical prices (120 days)...")
        # Generates 120 days of historical daily prices
        base_prices = {
            "AAPL": 180.0,
            "MSFT": 400.0,
            "TSLA": 200.0,
            "BTC-USD": 63000.0
        }
        
        # Volatilities
        vols = {
            "AAPL": 0.015,
            "MSFT": 0.012,
            "TSLA": 0.03,
            "BTC-USD": 0.04
        }
        
        start_date = datetime.datetime.utcnow() - datetime.timedelta(days=120)
        
        for symbol, base_px in base_prices.items():
            asset_id = asset_map[symbol]
            curr_px = base_px
            for day in range(120):
                date = start_date + datetime.timedelta(days=day)
                # Random walk
                change = random.normalvariate(0.0002, vols[symbol])
                close_px = curr_px * (1.0 + change)
                open_px = curr_px * (1.0 + random.normalvariate(0, vols[symbol]/2))
                high_px = max(open_px, close_px) * (1.0 + abs(random.normalvariate(0, vols[symbol]/4)))
                low_px = min(open_px, close_px) * (1.0 - abs(random.normalvariate(0, vols[symbol]/4)))
                volume = random.randint(100000, 5000000) if symbol != "BTC-USD" else random.randint(1000, 50000)
                
                conn.execute(text("""
                    INSERT INTO prices (id, asset_id, timestamp, open, high, low, close, volume, interval_type)
                    VALUES (:id, :asset_id, :timestamp, :open, :high, :low, :close, :volume, '1d')
                """), {
                    "id": str(uuid.uuid4()),
                    "asset_id": asset_id,
                    "timestamp": date,
                    "open": open_px,
                    "high": high_px,
                    "low": low_px,
                    "close": close_px,
                    "volume": volume
                })
                curr_px = close_px
        
        print("Inserting portfolios...")
        portfolio_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO portfolios (id, name, cash, equity, max_drawdown, sharpe_ratio)
            VALUES (:id, 'HedgeFund Alpha', 45230.12, 124850.50, 0.0450, 2.15)
        """), {"id": portfolio_id})
        
        print("Inserting positions...")
        # AAPL
        conn.execute(text("""
            INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
            VALUES (:id, :portfolio_id, :asset_id, 250.0, 175.40, 185.10, 2425.00)
        """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["AAPL"]})
        
        # BTC-USD
        conn.execute(text("""
            INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
            VALUES (:id, :portfolio_id, :asset_id, 0.85, 58200.00, 61400.00, 2720.00)
        """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["BTC-USD"]})
        
        # TSLA
        conn.execute(text("""
            INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
            VALUES (:id, :portfolio_id, :asset_id, 80.0, 220.10, 218.40, -136.00)
        """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["TSLA"]})
        
        print("Inserting trades...")
        # AAPL BUY
        conn.execute(text("""
            INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
            VALUES (:id, :portfolio_id, :asset_id, :timestamp, 'BUY', 250.0, 175.40, 43.85, 21.90, 'EXECUTED')
        """), {
            "id": str(uuid.uuid4()),
            "portfolio_id": portfolio_id,
            "asset_id": asset_map["AAPL"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=5)
        })
        
        # BTC-USD BUY
        conn.execute(text("""
            INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
            VALUES (:id, :portfolio_id, :asset_id, :timestamp, 'BUY', 0.85, 58200.00, 49.47, 24.70, 'EXECUTED')
        """), {
            "id": str(uuid.uuid4()),
            "portfolio_id": portfolio_id,
            "asset_id": asset_map["BTC-USD"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=3)
        })
        
        print("Inserting signals...")
        # AAPL BUY
        conn.execute(text("""
            INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
            VALUES (:id, :asset_id, :timestamp, 'BUY', 0.92, 'Transformer Forecaster', '{"predicted_return": 0.024}')
        """), {
            "id": str(uuid.uuid4()),
            "asset_id": asset_map["AAPL"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
        })
        
        # BTC BUY
        conn.execute(text("""
            INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
            VALUES (:id, :asset_id, :timestamp, 'BUY', 0.88, 'RL Agent PPO', '{"predicted_return": 0.018}')
        """), {
            "id": str(uuid.uuid4()),
            "asset_id": asset_map["BTC-USD"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=12)
        })
        
        # TSLA HOLD
        conn.execute(text("""
            INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
            VALUES (:id, :asset_id, :timestamp, 'HOLD', 0.65, 'Ensemble Consensus', '{"predicted_return": 0.002}')
        """), {
            "id": str(uuid.uuid4()),
            "asset_id": asset_map["TSLA"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=20)
        })
        
        # MSFT SELL
        conn.execute(text("""
            INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
            VALUES (:id, :asset_id, :timestamp, 'SELL', 0.76, 'LSTM Forecaster', '{"predicted_return": -0.015}')
        """), {
            "id": str(uuid.uuid4()),
            "asset_id": asset_map["MSFT"],
            "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=28)
        })
        
        print("Inserting predictions...")
        # Create predictions for active assets
        for symbol in ["AAPL", "MSFT", "TSLA", "BTC-USD"]:
            asset_id = asset_map[symbol]
            for model in ["LSTM Forecaster", "GRU Forecaster", "Transformer Forecaster", "RL Agent PPO"]:
                conn.execute(text("""
                    INSERT INTO predictions (id, asset_id, timestamp, model_name, predicted_return, confidence_score, horizon)
                    VALUES (:id, :asset_id, :timestamp, :model_name, :predicted_return, :confidence_score, '1d')
                """), {
                    "id": str(uuid.uuid4()),
                    "asset_id": asset_id,
                    "timestamp": datetime.datetime.utcnow(),
                    "model_name": model,
                    "predicted_return": random.uniform(-0.03, 0.03),
                    "confidence_score": random.uniform(0.6, 0.95)
                })
        
        print("Inserting risk metrics history...")
        for i in range(10):
            conn.execute(text("""
                INSERT INTO risk_metrics_history (id, portfolio_id, timestamp, var_95, cvar_95, leverage_ratio, exposure_limit)
                VALUES (:id, :portfolio_id, :timestamp, :var, :cvar, 1.0, 100000.0)
            """), {
                "id": str(uuid.uuid4()),
                "portfolio_id": portfolio_id,
                "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=i),
                "var": 0.0245 - (i * 0.0002),
                "cvar": 0.0385 - (i * 0.0003)
            })
            
    print("Database population completed successfully!")

if __name__ == "__main__":
    populate()
