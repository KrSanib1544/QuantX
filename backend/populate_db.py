import sys
import os
# Inject venv site-packages so system python can load all dependencies
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".venv", "Lib", "site-packages")))
sys.path.insert(0, os.path.dirname(__file__))

import uuid
import datetime
import random
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
import local_db_helper

def populate(engine=None):
    if engine is None:
        print("Initializing SQLite Database...")
        engine, url = local_db_helper.create_sqlite_engine_and_init()
        print(f"Connected to SQLite DB: {url}")
    else:
        print("Using provided database engine.")

    # Locate CSV file
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    csv_path = os.path.join(workspace_root, "Nifty50_Stocks", "nifty50_historical_data.csv")
    
    if not os.path.exists(csv_path):
        print(f"ERROR: Nifty 50 CSV not found at: {csv_path}")
        sys.exit(1)

    print(f"Reading Nifty 50 historical data from {csv_path}...")
    start_time = datetime.datetime.now()
    df_nifty = pd.read_csv(csv_path)
    print(f"Read {len(df_nifty)} rows in {(datetime.datetime.now() - start_time).total_seconds():.2f} seconds.")

    with engine.begin() as conn:
        print("Clearing existing tables...")
        for table in ["risk_metrics_history", "trades", "positions", "portfolios", "signals", "predictions", "features", "prices", "assets"]:
            try:
                conn.execute(text(f"DELETE FROM {table}"))
            except Exception as e:
                print(f"Warning: could not clear table {table}: {e}")

        print("Ingesting assets...")
        assets = []
        asset_map = {} # symbol -> id
        
        # 1. Parse Indian Assets
        nifty_assets = df_nifty.groupby("Ticker").first().reset_index()
        for _, row in nifty_assets.iterrows():
            ticker = row["Ticker"].upper()
            asset_id = str(uuid.uuid4())
            asset_map[ticker] = asset_id
            assets.append({
                "id": asset_id,
                "symbol": ticker,
                "name": row["Company_Name"],
                "asset_class": "equity_in",
                "sector": row["Sector"],
                "is_active": 1
            })

        global_assets_def = [
            {"symbol": "AAPL", "name": "Apple Inc.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "MSFT", "name": "Microsoft Corp.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "TSLA", "name": "Tesla Inc.", "asset_class": "equity_us", "sector": "Automotive"},
            {"symbol": "NVDA", "name": "NVIDIA Corp.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "asset_class": "equity_us", "sector": "Consumer Cyclical"},
            {"symbol": "GOOG", "name": "Alphabet Inc.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "FB", "name": "Meta Platforms Inc.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "AMD", "name": "Advanced Micro Devices Inc.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "INTC", "name": "Intel Corp.", "asset_class": "equity_us", "sector": "Technology"},
            {"symbol": "NFLX", "name": "Netflix Inc.", "asset_class": "equity_us", "sector": "Communication Services"},
            {"symbol": "BTC-USD", "name": "Bitcoin USD", "asset_class": "crypto", "sector": "Cryptocurrency"},
        ]
        for a in global_assets_def:
            asset_id = str(uuid.uuid4())
            asset_map[a["symbol"]] = asset_id
            assets.append({
                "id": asset_id,
                "symbol": a["symbol"],
                "name": a["name"],
                "asset_class": a["asset_class"],
                "sector": a["sector"],
                "is_active": 1
            })

        # Insert assets to DB
        for a in assets:
            conn.execute(text("""
                INSERT INTO assets (id, symbol, name, asset_class, sector, is_active)
                VALUES (:id, :symbol, :name, :asset_class, :sector, :is_active)
            """), a)

        # 3. Clean and Ingest Indian Prices
        print("Processing Indian Prices...")
        nifty_records = df_nifty.to_dict("records")
        indian_prices = []
        last_prices = {}
        
        for row in nifty_records:
            ticker = row["Ticker"].upper()
            if ticker in asset_map:
                # Skip rows with NaN or null values
                if pd.isna(row["Open"]) or pd.isna(row["High"]) or pd.isna(row["Low"]) or pd.isna(row["Close"]) or pd.isna(row["Volume"]):
                    continue
                dt = datetime.datetime.strptime(row["Date"].split("+")[0], "%Y-%m-%d %H:%M:%S")
                indian_prices.append({
                    "id": str(uuid.uuid4()),
                    "asset_id": asset_map[ticker],
                    "timestamp": dt,
                    "open": float(row["Open"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "close": float(row["Close"]),
                    "volume": float(row["Volume"]),
                    "interval_type": "1d"
                })
                last_prices[ticker] = float(row["Close"])

        print(f"Bulk inserting {len(indian_prices)} Indian price records...")
        chunk_size = 5000
        for i in range(0, len(indian_prices), chunk_size):
            chunk = indian_prices[i:i+chunk_size]
            conn.execute(text("""
                INSERT INTO prices (id, asset_id, timestamp, open, high, low, close, volume, interval_type)
                VALUES (:id, :asset_id, :timestamp, :open, :high, :low, :close, :volume, :interval_type)
            """), chunk)
        print("Indian prices ingested successfully.")

        # 4. Generate and Ingest Global Prices
        print("Processing Global Prices (NASDAQ from CSV / Crypto simulated)...")
        unique_date_strs = sorted(list(set(row["Date"] for row in nifty_records)))
        unique_dates = [datetime.datetime.strptime(d.split("+")[0], "%Y-%m-%d %H:%M:%S") for d in unique_date_strs]
        N_steps = len(unique_dates)
        
        global_params = {
            "AAPL": {"vol": 0.018},
            "MSFT": {"vol": 0.015},
            "TSLA": {"vol": 0.035},
            "NVDA": {"vol": 0.032},
            "AMZN": {"vol": 0.022},
            "GOOG": {"vol": 0.020},
            "FB": {"vol": 0.024},
            "AMD": {"vol": 0.028},
            "INTC": {"vol": 0.019},
            "NFLX": {"vol": 0.026},
            "BTC-USD": {"vol": 0.045}
        }
        
        global_prices = []
        for symbol, params in global_params.items():
            asset_id = asset_map[symbol]
            vol = params["vol"]
            csv_path = os.path.join(workspace_root, "Nasdaq_Stocks", "stocks", f"{symbol}.csv")
            
            price_map = {}
            if os.path.exists(csv_path) and symbol != "BTC-USD":
                print(f"Reading historical CSV for {symbol}...")
                df_global = pd.read_csv(csv_path)
                df_global = df_global[df_global["Date"] >= "1999-01-01"]
                df_global["Date_Parsed"] = pd.to_datetime(df_global["Date"])
                for _, row in df_global.iterrows():
                    # Skip rows with NaN or null values
                    if pd.isna(row["Open"]) or pd.isna(row["High"]) or pd.isna(row["Low"]) or pd.isna(row["Close"]) or pd.isna(row["Volume"]):
                        continue
                    dt_str = row["Date_Parsed"].strftime("%Y-%m-%d")
                    price_map[dt_str] = {
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "close": float(row["Close"]),
                        "volume": float(row["Volume"])
                    }
            
            # Align with unique_dates and generate simulation for missing parts
            last_price = 100.0
            if len(price_map) > 0:
                # Get the last close price in the CSV
                last_price = list(price_map.values())[-1]["close"]
            elif symbol == "BTC-USD":
                # Crypto base price in 1999
                last_price = 0.05
                
            drift = 0.0005
            
            for dt in unique_dates:
                dt_str = dt.strftime("%Y-%m-%d")
                if dt_str in price_map:
                    row_data = price_map[dt_str]
                    open_px = row_data["open"]
                    high_px = row_data["high"]
                    low_px = row_data["low"]
                    close_px = row_data["close"]
                    volume = row_data["volume"]
                    last_price = close_px
                else:
                    # Random walk step
                    change = np.random.normal(drift, vol)
                    close_px = last_price * np.exp(change)
                    open_px = last_price
                    high_px = max(open_px, close_px) * (1.0 + abs(np.random.normal(0, vol/4)))
                    low_px = min(open_px, close_px) * (1.0 - abs(np.random.normal(0, vol/4)))
                    volume = random.randint(1000000, 20000000) if symbol != "BTC-USD" else random.randint(10000, 100000)
                    last_price = close_px
                
                global_prices.append({
                    "id": str(uuid.uuid4()),
                    "asset_id": asset_id,
                    "timestamp": dt,
                    "open": float(open_px),
                    "high": float(high_px),
                    "low": float(low_px),
                    "close": float(close_px),
                    "volume": float(volume),
                    "interval_type": "1d"
                })
            
            # Set the actual final simulated/historical price as last_price for position valuation
            last_prices[symbol] = last_price

        print(f"Bulk inserting {len(global_prices)} Global price records...")
        for i in range(0, len(global_prices), chunk_size):
            chunk = global_prices[i:i+chunk_size]
            conn.execute(text("""
                INSERT INTO prices (id, asset_id, timestamp, open, high, low, close, volume, interval_type)
                VALUES (:id, :asset_id, :timestamp, :open, :high, :low, :close, :volume, :interval_type)
            """), chunk)
        print("Global prices ingested successfully.")

        # 5. Insert Portfolios
        portfolio_id = str(uuid.uuid4())
        conn.execute(text("""
            INSERT INTO portfolios (id, name, cash, equity, max_drawdown, sharpe_ratio)
            VALUES (:id, 'HedgeFund Alpha', 150000.00, 550000.00, 0.0380, 2.45)
        """), {"id": portfolio_id})

        # 6. Insert Positions
        print("Inserting Positions...")
        positions = [
            {"symbol": "AAPL", "qty": 120.0, "entry": 185.20},
            {"symbol": "TSLA", "qty": 80.0, "entry": 190.50},
            {"symbol": "NVDA", "qty": 60.0, "entry": 750.00},
            {"symbol": "RELIANCE.NS", "qty": 100.0, "entry": 2200.00},
            {"symbol": "TCS.NS", "qty": 30.0, "entry": 3500.00},
            {"symbol": "INFY.NS", "qty": 80.0, "entry": 1400.00}
        ]
        
        for pos in positions:
            sym = pos["symbol"]
            curr_px = last_prices[sym] if sym in last_prices else 100.0
            entry_px = pos["entry"]
            qty = pos["qty"]
            pnl = (curr_px - entry_px) * qty
            
            conn.execute(text("""
                INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                VALUES (:id, :portfolio_id, :asset_id, :quantity, :average_entry_price, :current_price, :unrealized_pnl)
            """), {
                "id": str(uuid.uuid4()),
                "portfolio_id": portfolio_id,
                "asset_id": asset_map[sym],
                "quantity": qty,
                "average_entry_price": entry_px,
                "current_price": curr_px,
                "unrealized_pnl": pnl
            })

        # 7. Insert Trades
        print("Inserting Trades...")
        for pos in positions:
            sym = pos["symbol"]
            entry_px = pos["entry"]
            qty = pos["qty"]
            
            conn.execute(text("""
                INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
                VALUES (:id, :portfolio_id, :asset_id, :timestamp, 'BUY', :quantity, :price, :cost, :slippage, 'EXECUTED')
            """), {
                "id": str(uuid.uuid4()),
                "portfolio_id": portfolio_id,
                "asset_id": asset_map[sym],
                "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=10),
                "quantity": qty,
                "price": entry_px,
                "cost": qty * entry_px * 0.001,
                "slippage": qty * entry_px * 0.0005
            })

        # 8. Insert Signals
        print("Inserting Signals...")
        signals_def = [
            {"symbol": "AAPL", "type": "BUY", "conf": 0.92, "source": "Transformer Forecaster", "ret": 0.024},
            {"symbol": "BTC-USD", "type": "BUY", "conf": 0.88, "source": "RL Agent PPO", "ret": 0.018},
            {"symbol": "TSLA", "type": "HOLD", "conf": 0.65, "source": "Ensemble Consensus", "ret": 0.002},
            {"symbol": "RELIANCE.NS", "type": "BUY", "conf": 0.95, "source": "Transformer Forecaster", "ret": 0.028},
            {"symbol": "TCS.NS", "type": "SELL", "conf": 0.78, "source": "LSTM Forecaster", "ret": -0.016},
            {"symbol": "INFY.NS", "type": "HOLD", "conf": 0.70, "source": "Ensemble Consensus", "ret": 0.005}
        ]
        
        for sig in signals_def:
            conn.execute(text("""
                INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                VALUES (:id, :asset_id, :timestamp, :signal_type, :confidence, :source_service, :metadata)
            """), {
                "id": str(uuid.uuid4()),
                "asset_id": asset_map[sig["symbol"]],
                "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=10),
                "signal_type": sig["type"],
                "confidence": sig["conf"],
                "source_service": sig["source"],
                "metadata": f'{{"predicted_return": {sig["ret"]}}}'
            })

        # 9. Insert Predictions
        print("Inserting Predictions...")
        target_forecast_assets = ["AAPL", "MSFT", "TSLA", "BTC-USD", "RELIANCE.NS", "TCS.NS", "INFY.NS"]
        models = ["LSTM Forecaster", "GRU Forecaster", "Transformer Forecaster", "RL Agent PPO"]
        
        for sym in target_forecast_assets:
            asset_id = asset_map[sym]
            for model in models:
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

        # 10. Insert Risk Metrics History
        print("Inserting Risk Metrics History...")
        for i in range(10):
            conn.execute(text("""
                INSERT INTO risk_metrics_history (id, portfolio_id, timestamp, var_95, cvar_95, leverage_ratio, exposure_limit)
                VALUES (:id, :portfolio_id, :timestamp, :var, :cvar, 1.0, 500000.0)
            """), {
                "id": str(uuid.uuid4()),
                "portfolio_id": portfolio_id,
                "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=i),
                "var": 0.0245 - (i * 0.0002),
                "cvar": 0.0385 - (i * 0.0003)
            })

    print("Database population completed successfully!")

if __name__ == "__main__":
    import traceback
    try:
        populate()
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        traceback.print_exc()
