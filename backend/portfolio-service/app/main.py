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
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../risk-service')))
from app.risk_manager import RiskManager

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
        alpaca_key = os.getenv("ALPACA_API_KEY")
        alpaca_secret = os.getenv("ALPACA_SECRET_KEY")
        alpaca_live = os.getenv("LIVE_TRADING", "false").lower() in ("true", "1", "yes")
        
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
    
    key = os.getenv("ALPACA_API_KEY")
    secret = os.getenv("ALPACA_SECRET_KEY")
    live = os.getenv("LIVE_TRADING", "false").lower() in ("true", "1", "yes")
    
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
            
        alpaca_key = os.getenv("ALPACA_API_KEY")
        alpaca_secret = os.getenv("ALPACA_SECRET_KEY")
        alpaca_live = os.getenv("LIVE_TRADING", "false").lower() in ("true", "1", "yes")
        
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

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8004, reload=True)
