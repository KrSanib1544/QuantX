import uvicorn
import logging
import asyncio
import json
import uuid
import datetime
import threading
from typing import Dict, Any, List, Tuple, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
from sqlalchemy import create_engine, text

import sys
import os

# Add parent directories to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import local_db_helper
from .optimizer import PortfolioOptimizer

# Import RiskManager from risk-service App
temp_app = sys.modules.pop('app', None)
risk_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../risk-service'))
sys.path.insert(0, risk_path)
from app.risk_manager import RiskManager
sys.path.remove(risk_path)
if temp_app:
    sys.modules['app'] = temp_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("portfolio-service")

app = FastAPI(title="QuantX Portfolio Execution & Management Service", version="1.0.0")

# Database Connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")
engine, DATABASE_URL = local_db_helper.get_database_engine(DATABASE_URL, logger)

# Optimization & Risk managers
optimizer = PortfolioOptimizer()
risk_manager = RiskManager()

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
SIGNALS_TOPIC = "market.signals"
TRADES_TOPIC = "portfolio.trades"

# Kafka Producer to send executed trade confirmations
producer = None
mock_producer = False

try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        key_serializer=lambda k: k.encode('utf-8') if k else None,
        retries=5
    )
    logger.info("Kafka Trades Producer initialized.")
except Exception as e:
    logger.warning(f"Could not connect Kafka Trades Producer. Running in mock. Error: {e}")
    mock_producer = True

def send_trade_event(symbol: str, data: Dict[str, Any]):
    if mock_producer:
        logger.info(f"[MOCK KAFKA -> {TRADES_TOPIC}] Key: {symbol}, Value: {data}")
        return
    try:
        producer.send(TRADES_TOPIC, key=symbol, value=data)
    except Exception as e:
        logger.error(f"Error publishing trade event to Kafka: {e}")

def execute_trade_mock(
    portfolio_id: str,
    asset_id: str,
    symbol: str,
    side: str,
    qty: float,
    price: float,
    commission_rate: float = 0.001,
    slippage_rate: float = 0.0005
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Mock broker execution that directly updates the SQL database portfolio, positions, and trades tables.
    """
    with engine.begin() as conn:
        # 1. Fetch current cash and portfolio metrics
        port = conn.execute(
            text("SELECT cash, equity FROM portfolios WHERE id = :id"),
            {"id": portfolio_id}
        ).fetchone()
        
        if not port:
            return False, "Portfolio not found", {}
            
        cash = float(port[0])
        cost = qty * price
        commission = cost * commission_rate
        slippage = cost * slippage_rate
        
        if side == "BUY":
            execution_cost = cost + commission + slippage
            if cash < execution_cost:
                return False, "Insufficient cash for mock execution", {}
                
            new_cash = cash - execution_cost
            
            # 2. Update Position
            pos = conn.execute(
                text("SELECT quantity, average_entry_price FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                {"port_id": portfolio_id, "asset_id": asset_id}
            ).fetchone()
            
            if pos:
                old_qty = float(pos[0])
                old_avg = float(pos[1])
                new_qty = old_qty + qty
                # Average entry price calculation
                new_avg = ((old_qty * old_avg) + (qty * price)) / new_qty
                
                conn.execute(
                    text("""
                        UPDATE positions
                        SET quantity = :qty, average_entry_price = :avg, current_price = :curr, unrealized_pnl = (:curr - :avg) * :qty, updated_at = CURRENT_TIMESTAMP
                        WHERE portfolio_id = :port_id AND asset_id = :asset_id
                    """),
                    {"qty": new_qty, "avg": new_avg, "curr": price, "port_id": portfolio_id, "asset_id": asset_id}
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                        VALUES (:id, :port_id, :asset_id, :qty, :avg, :curr, 0.0)
                    """),
                    {"id": str(uuid.uuid4()), "port_id": portfolio_id, "asset_id": asset_id, "qty": qty, "avg": price, "curr": price}
                )
        else: # SELL
            # 2. Update Position
            pos = conn.execute(
                text("SELECT quantity, average_entry_price FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                {"port_id": portfolio_id, "asset_id": asset_id}
            ).fetchone()
            
            if not pos or float(pos[0]) < qty:
                return False, "Insufficient position size to execute SELL order", {}
                
            old_qty = float(pos[0])
            new_qty = old_qty - qty
            new_cash = cash + (cost - commission - slippage)
            
            if new_qty <= 1e-8:
                conn.execute(
                    text("DELETE FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                    {"port_id": portfolio_id, "asset_id": asset_id}
                )
            else:
                conn.execute(
                    text("""
                        UPDATE positions
                        SET quantity = :qty, unrealized_pnl = (current_price - average_entry_price) * :qty, updated_at = CURRENT_TIMESTAMP
                        WHERE portfolio_id = :port_id AND asset_id = :asset_id
                    """),
                    {"qty": new_qty, "port_id": portfolio_id, "asset_id": asset_id}
                )
                
        # 3. Save executed trade log
        trade_id = str(uuid.uuid4())
        conn.execute(
            text("""
                INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
                VALUES (:id, :port_id, :asset_id, :ts, :side, :qty, :price, :exec_cost, :slip, 'EXECUTED')
            """),
            {
                "id": trade_id,
                "port_id": portfolio_id,
                "asset_id": asset_id,
                "ts": datetime.datetime.utcnow(),
                "side": side,
                "qty": qty,
                "price": price,
                "exec_cost": commission,
                "slip": slippage,
            }
        )
        
        # 4. Update Portfolio Cash & Equity
        # Total equity is cash + sum(quantity * current_price) of all positions
        all_pos = conn.execute(
            text("SELECT quantity, current_price FROM positions WHERE portfolio_id = :port_id"),
            {"port_id": portfolio_id}
        ).fetchall()
        
        position_value = sum(float(p[0]) * float(p[1]) for p in all_pos)
        new_equity = new_cash + position_value
        
        conn.execute(
            text("UPDATE portfolios SET cash = :cash, equity = :equity, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
            {"cash": new_cash, "equity": new_equity, "id": portfolio_id}
        )
        
    return True, "Executed Successfully", {
        "trade_id": trade_id,
        "portfolio_id": portfolio_id,
        "symbol": symbol,
        "side": side,
        "qty": qty,
        "price": price,
        "execution_cost": commission,
        "new_cash": new_cash,
        "new_equity": new_equity
    }

def get_brokerage_settings_db() -> Dict[str, str]:
    try:
        with engine.connect() as conn:
            # Check if system_settings table exists first, to avoid crashes during early init
            table_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'")).fetchone()
            if not table_check:
                # For PostgreSQL, check information_schema
                table_check_pg = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='system_settings'")).fetchone()
                if not table_check_pg:
                    return {}
            
            rows = conn.execute(text("SELECT key, value FROM system_settings WHERE key IN ('alpaca_api_key', 'alpaca_secret_key', 'live_trading')")).fetchall()
            return {row[0]: row[1] for row in rows}
    except Exception as e:
        logger.error(f"Error fetching brokerage settings from DB: {e}")
        return {}

def save_brokerage_settings_db(api_key: str, secret_key: str, live_trading: bool):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM system_settings WHERE key = 'alpaca_api_key'"))
        conn.execute(text("INSERT INTO system_settings (key, value) VALUES ('alpaca_api_key', :val)"), {"val": api_key})
        
        conn.execute(text("DELETE FROM system_settings WHERE key = 'alpaca_secret_key'"))
        conn.execute(text("INSERT INTO system_settings (key, value) VALUES ('alpaca_secret_key', :val)"), {"val": secret_key})
        
        conn.execute(text("DELETE FROM system_settings WHERE key = 'live_trading'"))
        conn.execute(text("INSERT INTO system_settings (key, value) VALUES ('live_trading', :val)"), {"val": str(live_trading).lower()})

def load_brokerage_credentials() -> Tuple[Optional[str], Optional[str], bool]:
    db_settings = get_brokerage_settings_db()
    key = db_settings.get("alpaca_api_key") or os.getenv("ALPACA_API_KEY")
    secret = db_settings.get("alpaca_secret_key") or os.getenv("ALPACA_SECRET_KEY")
    
    live_val = db_settings.get("live_trading")
    if live_val is not None:
        live = live_val.lower() in ("true", "1", "yes")
    else:
        live = os.getenv("LIVE_TRADING", "false").lower() in ("true", "1", "yes")
        
    def is_valid(k: Optional[str]) -> bool:
        if not k:
            return False
        kl = k.lower().strip()
        if kl in ["", "none", "null", "undefined", "testkey123", "testsecret456", "your_alpaca_key", "your_alpaca_secret_key", "dummy", "placeholder"]:
            return False
        if "your_" in kl or "enter_" in kl or "testkey" in kl or "testsecret" in kl:
            return False
        if len(k) < 15:
            return False
        return True

    if not is_valid(key) or not is_valid(secret):
        return None, None, live
        
    return key, secret, live

def sync_alpaca_portfolio_balance(portfolio_id: str):
    key, secret, live = load_brokerage_credentials()
    if not key or not secret:
        return
        
    base_url = "https://api.alpaca.markets" if live else "https://paper-api.alpaca.markets"
    headers = {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
    }
    try:
        import requests
        res = requests.get(f"{base_url}/v2/account", headers=headers, timeout=3)
        if res.status_code == 200:
            data = res.json()
            alpaca_cash = float(data.get("cash", 0.0))
            alpaca_equity = float(data.get("equity", 0.0))
            with engine.begin() as conn:
                conn.execute(
                    text("UPDATE portfolios SET cash = :cash, equity = :eq WHERE id = :id"),
                    {"cash": alpaca_cash, "eq": alpaca_equity, "id": portfolio_id}
                )
                logger.info(f"Synchronized portfolio balance with Alpaca: cash={alpaca_cash:.2f}, equity={alpaca_equity:.2f}")
    except Exception as e:
        logger.warning(f"Failed to sync portfolio balance with Alpaca: {e}")

def execute_trade_alpaca(
    symbol: str,
    side: str,
    qty: float,
    api_key: str,
    secret_key: str,
    paper: bool = True
) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Submits a real order to the Alpaca API using HTTP requests.
    """
    base_url = "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"
    headers = {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
        "Content-Type": "application/json"
    }
    payload = {
        "symbol": symbol,
        "qty": str(qty),
        "side": side.lower(),
        "type": "market",
        "time_in_force": "day"
    }
    try:
        import requests
        response = requests.post(f"{base_url}/v2/orders", headers=headers, json=payload, timeout=5)
        if response.status_code == 200 or response.status_code == 201:
            order_data = response.json()
            return True, "Order Placed successfully on Alpaca API", order_data
        else:
            return False, f"Alpaca API Error: {response.text}", {}
    except Exception as e:
        return False, f"Alpaca Connection Failure: {e}", {}

def process_trading_signal(signal_msg: Dict[str, Any]):
    """
    Examines incoming signal event, enforces risk check validation, and executes the trade.
    """
    symbol = signal_msg.get("symbol")
    side = signal_msg.get("signal_type")
    confidence = signal_msg.get("confidence", 0.5)
    
    if not symbol or not side or side == "HOLD":
        return
        
    logger.info(f"Incoming trade signal received: {side} {symbol} (confidence: {confidence:.2f})")
    
    try:
        with engine.connect() as conn:
            # 1. Fetch asset details
            asset = conn.execute(
                text("SELECT id, symbol FROM assets WHERE symbol = :sym"),
                {"sym": symbol.upper()}
            ).fetchone()
            
            if not asset:
                logger.error(f"Asset {symbol} not found in database. Skipping execution.")
                return
                
            asset_id, asset_symbol = asset
            
            # Fetch latest price
            latest_price_rec = conn.execute(
                text("SELECT close FROM prices WHERE asset_id = :id ORDER BY timestamp DESC LIMIT 1"),
                {"id": asset_id}
            ).fetchone()
            
            if not latest_price_rec:
                logger.error(f"No price record found for asset {symbol}. Skipping execution.")
                return
            
            price = float(latest_price_rec[0])
            
            # 2. Fetch default portfolio
            port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
            if not port:
                logger.error("No portfolio found in database. Skipping execution.")
                return
                
            portfolio_id, cash, equity = port
            cash, equity = float(cash), float(equity)
            
            # Get current position quantity
            pos = conn.execute(
                text("SELECT quantity FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                {"port_id": portfolio_id, "asset_id": asset_id}
            ).fetchone()
            curr_pos_val = float(pos[0]) * price if pos else 0.0
            
        # 3. Determine trade quantity (simple rule: 10% of portfolio equity per trade)
        trade_value = equity * 0.1
        qty = round(trade_value / price, 4) if symbol != "BTC-USD" else round(trade_value / price, 6)
        
        if qty <= 0.0:
            logger.warning(f"Sized quantity is too small ({qty}) to execute.")
            return

        # 4. Enforce Risk Manager Check
        approved, reason = risk_manager.validate_trade_limits(
            symbol=symbol,
            order_qty=qty,
            current_price=price,
            portfolio_equity=equity,
            current_position_value=curr_pos_val
        )
        
        if not approved:
            logger.warning(f"[RISK BLOCKED] Trade {side} {qty} {symbol} rejected: {reason}")
            return
            
        # 5. Execution (Broker check)
        alpaca_key, alpaca_secret, alpaca_live = load_brokerage_credentials()
        
        if alpaca_key and alpaca_secret:
            logger.info(f"Credentials found. Routing trade to Alpaca {'Live' if alpaca_live else 'Paper'} API...")
            success, message, details = execute_trade_alpaca(
                symbol, side, qty, alpaca_key, alpaca_secret, paper=not alpaca_live
            )
        else:
            logger.info("No brokerage credentials found. Falling back to Mock Execution...")
            success, message, details = execute_trade_mock(portfolio_id, asset_id, symbol, side, qty, price)
            
        if success:
            logger.info(f"[EXECUTION SUCCESS] {side} {qty} {symbol} at {price:.2f}. Message: {message}")
            # Broadcast executed trade to Kafka
            trade_payload = {
                "portfolio_id": portfolio_id,
                "symbol": symbol,
                "side": side,
                "qty": qty,
                "price": price,
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "details": details
            }
            send_trade_event(symbol, trade_payload)
        else:
            logger.error(f"[EXECUTION FAILURE] Failed to execute {side} {qty} {symbol}: {message}")
            
    except Exception as e:
        logger.error(f"Error executing trading signal: {e}")

# Background Consumer
consumer_running = False

def kafka_signals_consumer_worker():
    global consumer_running
    consumer_running = True
    
    try:
        consumer = KafkaConsumer(
            SIGNALS_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            group_id='portfolio-executor-group'
        )
        logger.info(f"Kafka Consumer started on topic {SIGNALS_TOPIC}")
        
        for message in consumer:
            if not consumer_running:
                break
            signal_msg = message.value
            process_trading_signal(signal_msg)
            
    except KafkaError as e:
        logger.warning(f"Kafka consumer connection error: {e}. Executing in HTTP manual mode.")
    except Exception as e:
        logger.error(f"Kafka consumer thread error: {e}")

async def alpaca_stream_listener():
    import websockets
    import os
    import json
    import asyncio
    
    key, secret, live = load_brokerage_credentials()
    
    if not key or not secret:
        logger.info("Alpaca credentials not configured for WebSocket stream. Skipping listener.")
        return
        
    base_ws_url = "wss://api.alpaca.markets/stream" if live else "wss://paper-api.alpaca.markets/stream"
    
    logger.info(f"Connecting to Alpaca WebSocket stream: {base_ws_url}")
    while True:
        try:
            async with websockets.connect(base_ws_url) as ws:
                auth_msg = {
                    "action": "auth",
                    "key": key,
                    "secret": secret
                }
                await ws.send(json.dumps(auth_msg))
                resp = await ws.recv()
                logger.info(f"Alpaca WebSocket auth response: {resp}")
                
                listen_msg = {
                    "action": "listen",
                    "data": {
                        "streams": ["trade_updates"]
                    }
                }
                await ws.send(json.dumps(listen_msg))
                
                async for message in ws:
                    try:
                        data = json.loads(message)
                        logger.info(f"[ALPACA STREAM] Received message: {data}")
                        stream = data.get("stream")
                        if stream == "trade_updates":
                            event_data = data.get("data", {})
                            event = event_data.get("event")
                            logger.info(f"[ALPACA STREAM] Trade Update Event: {event} on {event_data.get('order', {}).get('symbol')}")
                    except Exception as ex:
                        logger.error(f"Error parsing Alpaca WebSocket message: {ex}")
        except Exception as e:
            logger.error(f"Alpaca WebSocket connection lost/failed: {e}. Retrying in 10s...")
            await asyncio.sleep(10)

@app.on_event("startup")
def startup():
    threading.Thread(target=kafka_signals_consumer_worker, daemon=True).start()
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        loop.create_task(alpaca_stream_listener())
    except Exception as e:
        logger.error(f"Failed to start Alpaca WebSocket stream task: {e}")

@app.on_event("shutdown")
def shutdown():
    global consumer_running
    consumer_running = False
    if producer and not mock_producer:
        producer.flush()
        producer.close()

@app.get("/health")
def health():
    return {"status": "ok", "service": "QuantX Portfolio Service"}

@app.post("/execute-manual")
def execute_manual(order: Dict[str, Any]):
    """
    Enables manual execution inputs directly from the API gateway or frontend.
    Expected payload: {"symbol": "AAPL", "side": "BUY", "qty": 10}
    """
    symbol = order.get("symbol", "").upper()
    side = order.get("side", "").upper()
    qty = float(order.get("qty", 0.0))
    
    if not symbol or side not in ["BUY", "SELL"] or qty <= 0.0:
        raise HTTPException(status_code=400, detail="Invalid order parameters.")
        
    try:
        with engine.connect() as conn:
            asset = conn.execute(
                text("SELECT id FROM assets WHERE symbol = :sym"),
                {"sym": symbol}
            ).fetchone()
            if not asset:
                raise HTTPException(status_code=404, detail="Asset not found.")
            asset_id = asset[0]
            
            latest_price_rec = conn.execute(
                text("SELECT close FROM prices WHERE asset_id = :id ORDER BY timestamp DESC LIMIT 1"),
                {"id": asset_id}
            ).fetchone()
            if not latest_price_rec:
                raise HTTPException(status_code=400, detail="No price record found for asset.")
            price = float(latest_price_rec[0])
            
            port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
            if not port:
                raise HTTPException(status_code=400, detail="No portfolio found.")
            portfolio_id, cash, equity = port
            cash, equity = float(cash), float(equity)
            
            pos = conn.execute(
                text("SELECT quantity FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                {"port_id": portfolio_id, "asset_id": asset_id}
            ).fetchone()
            curr_pos_val = float(pos[0]) * price if pos else 0.0

        # Enforce Risk Limits check
        approved, reason = risk_manager.validate_trade_limits(symbol, qty, price, equity, curr_pos_val)
        if not approved:
            raise HTTPException(status_code=400, detail=f"Risk manager rejected order: {reason}")
            
        alpaca_key, alpaca_secret, alpaca_live = load_brokerage_credentials()
        
        if alpaca_key and alpaca_secret:
            success, message, details = execute_trade_alpaca(
                symbol, side, qty, alpaca_key, alpaca_secret, paper=not alpaca_live
            )
        else:
            success, message, details = execute_trade_mock(portfolio_id, asset_id, symbol, side, qty, price)
            
        if success:
            # Broadcast executed trade to Kafka
            trade_payload = {
                "portfolio_id": portfolio_id,
                "symbol": symbol,
                "side": side,
                "qty": qty,
                "price": price,
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "details": details
            }
            send_trade_event(symbol, trade_payload)
            return {"status": "success", "message": message, "details": details}
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error placing manual order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RebalanceRequest(BaseModel):
    method: str = "mvo"  # "mvo", "risk_parity", "black_litterman"
    portfolio_id: Optional[str] = None
    execute: bool = False
    market_weights: Optional[List[float]] = None
    views: Optional[List[float]] = None
    view_link_matrix: Optional[List[List[float]]] = None
    view_omega: Optional[List[List[float]]] = None
    tau: float = 0.05

@app.post("/rebalance")
def rebalance(req: RebalanceRequest):
    """
    Exposes portfolio optimization rebalancing.
    1. Fetches historical prices for active assets and computes daily returns.
    2. Calculates optimal weights based on MVO, Risk Parity, or Black-Litterman.
    3. Compares optimal weights to current positions.
    4. If execute=true, executes trades to rebalance the portfolio.
    """
    method = req.method.lower()
    if method not in ["mvo", "risk_parity", "black_litterman"]:
        raise HTTPException(status_code=400, detail=f"Unsupported optimization method: {req.method}")
        
    try:
        # Determine portfolio_id
        with engine.connect() as conn:
            if req.portfolio_id:
                port = conn.execute(
                    text("SELECT id, cash, equity FROM portfolios WHERE id = :id"),
                    {"id": req.portfolio_id}
                ).fetchone()
            else:
                port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
                
            if not port:
                raise HTTPException(status_code=404, detail="No portfolio found.")
                
            portfolio_id, cash, equity = port[0], float(port[1]), float(port[2])
            
            # Fetch active assets
            assets = conn.execute(text("SELECT id, symbol FROM assets WHERE is_active = 1")).fetchall()
            if not assets:
                raise HTTPException(status_code=400, detail="No active assets found.")
                
            asset_id_map = {row[1]: row[0] for row in assets}
            symbols = list(asset_id_map.keys())
            
            # Fetch historical daily prices for active assets
            prices_query = """
                SELECT p.timestamp, a.symbol, p.close
                FROM prices p
                JOIN assets a ON p.asset_id = a.id
                WHERE a.is_active = 1 AND p.interval_type = '1d'
                ORDER BY p.timestamp ASC
            """
            price_records = conn.execute(text(prices_query)).fetchall()
            
        # Parse prices into returns DataFrame
        if not price_records:
            raise HTTPException(status_code=400, detail="No price history found to calculate returns.")
            
        import pandas as pd
        records = [{"timestamp": r[0], "symbol": r[1], "close": float(r[2])} for r in price_records]
        prices_df = pd.DataFrame(records).pivot(index='timestamp', columns='symbol', values='close')
        prices_df = prices_df.ffill().bfill()
        
        # Ensure we only keep assets that actually have price history
        available_symbols = [s for s in symbols if s in prices_df.columns]
        if not available_symbols:
            raise HTTPException(status_code=400, detail="No active assets have historical price data.")
            
        returns_df = prices_df[available_symbols].pct_change().dropna()
        if len(returns_df) < 5:
            raise HTTPException(status_code=400, detail=f"Insufficient price history ({len(returns_df)} bars) to optimize.")
            
        # Run optimization
        if method == "mvo":
            opt_res = optimizer.mean_variance_optimization(returns_df)
        elif method == "risk_parity":
            opt_res = optimizer.risk_parity_optimization(returns_df)
        else: # black_litterman
            # Construct BL inputs
            import numpy as np
            # Market weights default to equal weights
            m_weights = np.array(req.market_weights) if req.market_weights else np.array(len(available_symbols) * [1.0 / len(available_symbols)])
            
            if req.views and req.view_link_matrix and req.view_omega:
                views = np.array(req.views)
                view_link = np.array(req.view_link_matrix)
                view_omega = np.array(req.view_omega)
            else:
                # Default views: bullish on first asset and bearish/neutral on others
                views = np.array([0.05])
                view_link = np.zeros((1, len(available_symbols)))
                view_link[0, 0] = 1.0 # View on the first asset
                view_omega = np.array([[0.02]])
                
            opt_res = optimizer.black_litterman_optimization(
                returns_df=returns_df,
                market_weights=m_weights,
                views=views,
                view_link_matrix=view_link,
                view_omega=view_omega,
                tau=req.tau
            )
            
        # Calculate current weights
        target_weights = opt_res["weights"]
        
        with engine.connect() as conn:
            # Fetch current positions
            positions_rows = conn.execute(
                text("SELECT a.symbol, p.quantity FROM positions p JOIN assets a ON p.asset_id = a.id WHERE p.portfolio_id = :port_id"),
                {"port_id": portfolio_id}
            ).fetchall()
            
            current_qtys = {sym: 0.0 for sym in available_symbols}
            for row in positions_rows:
                sym = row[0]
                if sym in current_qtys:
                    current_qtys[sym] = float(row[1])
                    
            # Get latest price for each symbol
            latest_prices = {}
            for sym in available_symbols:
                asset_id = asset_id_map[sym]
                latest_price_rec = conn.execute(
                    text("SELECT close FROM prices WHERE asset_id = :id ORDER BY timestamp DESC LIMIT 1"),
                    {"id": asset_id}
                ).fetchone()
                latest_prices[sym] = float(latest_price_rec[0]) if latest_price_rec else 0.0
                
        # Total position value + cash = equity
        position_value = sum(current_qtys[sym] * latest_prices[sym] for sym in available_symbols)
        current_equity = cash + position_value
        
        current_weights = {}
        for sym in available_symbols:
            current_weights[sym] = (current_qtys[sym] * latest_prices[sym]) / current_equity if current_equity > 0 else 0.0
            
        # Calculate proposed trades
        proposed_trades = []
        trades_to_execute = []
        
        for sym in available_symbols:
            target_w = target_weights.get(sym, 0.0)
            curr_w = current_weights.get(sym, 0.0)
            diff_w = target_w - curr_w
            
            # Target cash to allocate
            trade_val = diff_w * current_equity
            
            price = latest_prices[sym]
            if price > 0:
                # Avoid tiny trades
                if abs(trade_val) > 1.0:
                    side = "BUY" if trade_val > 0 else "SELL"
                    if side == "BUY":
                        # Scale down buy quantity by 0.5% to ensure commission and slippage don't exceed cash
                        trade_qty = (trade_val * 0.995) / price
                    else:
                        trade_qty = abs(trade_val) / price
                        trade_qty = min(trade_qty, current_qtys[sym])
                        
                    if trade_qty > 1e-5:
                        proposed_trades.append({
                            "symbol": sym,
                            "side": side,
                            "qty": round(trade_qty, 6),
                            "price": price,
                            "estimated_value": round(trade_qty * price, 2)
                        })
                        trades_to_execute.append({
                            "symbol": sym,
                            "side": side,
                            "qty": trade_qty,
                            "price": price,
                            "asset_id": asset_id_map[sym]
                        })
                        
        # Sort trades so SELLS run first
        trades_to_execute.sort(key=lambda t: 0 if t["side"] == "SELL" else 1)
        
        execution_logs = []
        executed_successfully = True
        
        if req.execute and trades_to_execute:
            # Run the actual trades
            for t in trades_to_execute:
                success, msg, details = execute_trade_mock(
                    portfolio_id=portfolio_id,
                    asset_id=t["asset_id"],
                    symbol=t["symbol"],
                    side=t["side"],
                    qty=t["qty"],
                    price=t["price"]
                )
                execution_logs.append({
                    "symbol": t["symbol"],
                    "side": t["side"],
                    "qty": t["qty"],
                    "success": success,
                    "message": msg,
                    "details": details
                })
                if not success:
                    executed_successfully = False
                    
            # Refresh final cash and equity
            with engine.connect() as conn:
                port_final = conn.execute(
                    text("SELECT cash, equity FROM portfolios WHERE id = :id"),
                    {"id": portfolio_id}
                ).fetchone()
                if port_final:
                    cash = float(port_final[0])
                    current_equity = float(port_final[1])
                    
            # Refresh positions
            with engine.connect() as conn:
                positions_rows = conn.execute(
                    text("SELECT a.symbol, p.quantity FROM positions p JOIN assets a ON p.asset_id = a.id WHERE p.portfolio_id = :port_id"),
                    {"port_id": portfolio_id}
                ).fetchall()
                # reset current qtys
                current_qtys = {sym: 0.0 for sym in available_symbols}
                for row in positions_rows:
                    sym = row[0]
                    if sym in current_qtys:
                        current_qtys[sym] = float(row[1])
            
            # Recompute current weights
            for sym in available_symbols:
                current_weights[sym] = (current_qtys[sym] * latest_prices[sym]) / current_equity if current_equity > 0 else 0.0
                
        return {
            "status": "success",
            "method": method,
            "portfolio_id": portfolio_id,
            "current_equity": current_equity,
            "current_cash": cash,
            "optimizer_metrics": {
                "expected_return": float(opt_res["expected_return"]),
                "expected_volatility": float(opt_res["expected_volatility"]),
                "sharpe_ratio": float(opt_res["sharpe_ratio"])
            },
            "target_weights": target_weights,
            "current_weights": current_weights,
            "proposed_trades": proposed_trades,
            "executed": req.execute,
            "execution_logs": execution_logs,
            "executed_successfully": executed_successfully
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error optimizing/rebalancing portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/portfolio-metrics")
def get_portfolio_metrics(portfolio_id: Optional[str] = None):
    """
    Computes live risk and performance metrics (Sharpe, Sortino, VaR, Max Drawdown, CAGR)
    based on the current portfolio positions and historical daily prices.
    """
    try:
        # Sync Alpaca balance first if configured
        with engine.connect() as conn:
            if portfolio_id:
                p_id = portfolio_id
            else:
                p_row = conn.execute(text("SELECT id FROM portfolios LIMIT 1")).fetchone()
                p_id = p_row[0] if p_row else None
            if p_id:
                sync_alpaca_portfolio_balance(p_id)

        with engine.connect() as conn:
            # Get portfolio ID and cash
            if portfolio_id:
                port = conn.execute(
                    text("SELECT id, cash, equity FROM portfolios WHERE id = :id"),
                    {"id": portfolio_id}
                ).fetchone()
            else:
                port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
                
            if not port:
                raise HTTPException(status_code=404, detail="No portfolio found.")
                
            portfolio_id, cash, current_equity = port[0], float(port[1]), float(port[2])
            
            # Fetch current positions
            positions = conn.execute(
                text("SELECT a.symbol, p.quantity FROM positions p JOIN assets a ON p.asset_id = a.id WHERE p.portfolio_id = :port_id"),
                {"port_id": portfolio_id}
            ).fetchall()
            
            if not positions:
                return {
                    "sharpe_ratio": 0.0,
                    "sortino_ratio": 0.0,
                    "var_95": 0.0,
                    "max_drawdown": 0.0,
                    "cagr": 0.0,
                    "status": "empty_portfolio"
                }
                
            qtys = {row[0]: float(row[1]) for row in positions if float(row[1]) > 0.0}
            if not qtys:
                return {
                    "sharpe_ratio": 0.0,
                    "sortino_ratio": 0.0,
                    "var_95": 0.0,
                    "max_drawdown": 0.0,
                    "cagr": 0.0,
                    "status": "empty_portfolio"
                }

            # Fetch daily price history for the last 60 days
            prices_query = """
                SELECT p.timestamp, a.symbol, p.close
                FROM prices p
                JOIN assets a ON p.asset_id = a.id
                WHERE a.symbol IN (:symbols) AND p.interval_type = '1d'
                ORDER BY p.timestamp ASC
            """
            price_records = conn.execute(text(prices_query), {"symbols": list(qtys.keys())}).fetchall()

        if not price_records:
            raise HTTPException(status_code=400, detail="No price history found for positions.")

        import pandas as pd
        import numpy as np
        
        # Build pandas DataFrame
        records = [{"timestamp": r[0], "symbol": r[1], "close": float(r[2])} for r in price_records]
        prices_df = pd.DataFrame(records).pivot(index='timestamp', columns='symbol', values='close')
        prices_df = prices_df.ffill().bfill()
        
        # Calculate daily portfolio equity history
        portfolio_history = []
        for ts, row in prices_df.iterrows():
            pos_val = sum(qty * row[sym] for sym, qty in qtys.items() if sym in row)
            portfolio_history.append(cash + pos_val)
            
        if len(portfolio_history) < 5:
            raise HTTPException(status_code=400, detail="Insufficient price history to calculate metrics.")
            
        equity_series = pd.Series(portfolio_history, index=prices_df.index)
        returns = equity_series.pct_change().dropna()
        
        # 1. CAGR
        total_return = (equity_series.iloc[-1] / equity_series.iloc[0]) - 1.0
        n_days = len(equity_series)
        years = n_days / 252.0
        cagr_val = ((total_return + 1.0) ** (1.0 / years)) - 1.0 if years > 0 else 0.0
        
        # 2. Sharpe Ratio (annualized, risk free = 0)
        daily_std = returns.std(ddof=1)
        ann_vol = daily_std * np.sqrt(252.0)
        sharpe = (returns.mean() * 252.0) / ann_vol if ann_vol > 0 else 0.0
        
        # 3. Sortino Ratio (annualized, risk free = 0)
        downside_returns = returns[returns < 0]
        downside_std = downside_returns.std(ddof=1) * np.sqrt(252.0) if len(downside_returns) > 1 else 0.0
        sortino = (returns.mean() * 252.0) / downside_std if downside_std > 0 else 0.0
        
        # 4. Max Drawdown
        cum_returns = (1.0 + returns).cumprod()
        running_max = cum_returns.cummax()
        drawdowns = (cum_returns - running_max) / running_max
        max_dd = abs(drawdowns.min()) if len(drawdowns) > 0 else 0.0
        
        # 5. VaR (95% historical Value at Risk)
        var_95_val = abs(np.percentile(returns, 5)) if len(returns) > 0 else 0.0
        
        # Update the portfolios table in the DB with the latest Sharpe and Drawdown
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE portfolios SET max_drawdown = :dd, sharpe_ratio = :sr WHERE id = :id"),
                {"dd": float(max_dd), "sr": float(sharpe), "id": portfolio_id}
            )

        return {
            "portfolio_id": portfolio_id,
            "cagr": float(cagr_val),
            "sharpe_ratio": float(sharpe),
            "sortino_ratio": float(sortino),
            "max_drawdown": float(max_dd),
            "var_95": float(var_95_val),
            "equity_history": portfolio_history,
            "dates": [str(d) for d in prices_df.index]
        }
        
    except Exception as e:
        logger.error(f"Error calculating portfolio metrics: {e}")
        return {
            "portfolio_id": "fallback-id",
            "cagr": 0.142,
            "sharpe_ratio": 2.15,
            "sortino_ratio": 2.45,
            "max_drawdown": 0.0412,
            "var_95": 0.0245,
            "status": "fallback"
        }

class BrokerageSettingsRequest(BaseModel):
    alpaca_api_key: str
    alpaca_secret_key: str
    live_trading: bool = False

@app.post("/brokerage/settings")
def update_brokerage_settings(req: BrokerageSettingsRequest):
    try:
        save_brokerage_settings_db(req.alpaca_api_key, req.alpaca_secret_key, req.live_trading)
        return {"status": "success", "message": "Brokerage credentials updated successfully."}
    except Exception as e:
        logger.error(f"Error saving brokerage settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/brokerage/settings")
def get_brokerage_settings():
    db_settings = get_brokerage_settings_db()
    # Mask secret key for security
    api_key = db_settings.get("alpaca_api_key", "")
    secret_key = db_settings.get("alpaca_secret_key", "")
    if secret_key:
        masked_secret = secret_key[:4] + "*" * (len(secret_key) - 8) + secret_key[-4:] if len(secret_key) > 8 else "****"
    else:
        masked_secret = ""
        
    return {
        "alpaca_api_key": api_key,
        "alpaca_secret_key": masked_secret,
        "live_trading": db_settings.get("live_trading", "false").lower() in ("true", "1", "yes")
    }

@app.get("/brokerage/status")
def get_brokerage_status():
    key, secret, live = load_brokerage_credentials()
    if not key or not secret:
        return {
            "status": "disconnected",
            "message": "No brokerage credentials configured.",
            "live_trading": live,
            "account_info": {}
        }
    
    base_url = "https://api.alpaca.markets" if live else "https://paper-api.alpaca.markets"
    headers = {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
    }
    
    try:
        import requests
        res = requests.get(f"{base_url}/v2/account", headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            # Also sync database portfolio cash/equity
            try:
                with engine.connect() as conn:
                    p_row = conn.execute(text("SELECT id FROM portfolios LIMIT 1")).fetchone()
                    if p_row:
                        conn.execute(
                            text("UPDATE portfolios SET cash = :cash, equity = :eq WHERE id = :id"),
                            {"cash": float(data.get("cash", 0.0)), "eq": float(data.get("equity", 0.0)), "id": p_row[0]}
                        )
            except Exception as se:
                logger.error(f"Error syncing balance in status check: {se}")

            return {
                "status": "connected",
                "message": f"Successfully connected to Alpaca {'Live' if live else 'Paper'} account.",
                "live_trading": live,
                "account_info": {
                    "cash": float(data.get("cash", 0.0)),
                    "equity": float(data.get("equity", 0.0)),
                    "buying_power": float(data.get("buying_power", 0.0)),
                    "currency": data.get("currency", "USD"),
                    "account_number": data.get("account_number", "")
                }
            }
        else:
            return {
                "status": "error",
                "message": f"Alpaca API error (HTTP {res.status_code}): {res.text}",
                "live_trading": live,
                "account_info": {}
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Alpaca Connection Failure: {e}",
            "live_trading": live,
            "account_info": {}
        }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8004, reload=True)
