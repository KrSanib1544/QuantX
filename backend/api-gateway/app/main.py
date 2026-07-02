import uvicorn
import logging
import json
import asyncio
import hmac
import hashlib
import base64
import time
import requests
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, select, text
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd

import sys
import os

# Add service folders to path to bypass folders with dashes
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backtesting-service')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../portfolio-service')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

import local_db_helper
from app.backtester import Backtester
from app.optimizer import PortfolioOptimizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("api-gateway")

app = FastAPI(title="QuantX API Gateway", version="1.0.0")

SECRET_KEY = os.getenv("JWT_SECRET", "quantx-super-secret-key-change-in-production")
security_scheme = HTTPBearer()

def base64url_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).decode('utf-8').replace('=', '')

def base64url_decode(s: str) -> bytes:
    padding = '=' * (4 - (len(s) % 4))
    return base64.urlsafe_b64decode(s + padding)

def generate_jwt(payload: dict, secret: str = SECRET_KEY, expires_in: int = 3600) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = payload.copy()
    payload["exp"] = int(time.time()) + expires_in
    header_b64 = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = base64url_encode(json.dumps(payload).encode('utf-8'))
    message = f"{header_b64}.{payload_b64}"
    signature = hmac.new(secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    return f"{message}.{signature_b64}"

def verify_jwt(token: str, secret: str = SECRET_KEY) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        message = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(secret.encode('utf-8'), message.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return None
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def hash_password(password: str, salt: str = None) -> str:
    if salt is None:
        salt = base64.b64encode(os.urandom(16)).decode('utf-8')
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${base64.b64encode(h).decode('utf-8')}"

def verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt, _ = hashed_password.split('$')
        return hash_password(password, salt) == hashed_password
    except Exception:
        return False

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    payload = verify_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token or expired token")
    return payload

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ManualOrderRequest(BaseModel):
    symbol: str
    side: str
    qty: float

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")
engine, DATABASE_URL = local_db_helper.get_database_engine(DATABASE_URL, logger)

# Websocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total active connections: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Handle broken connections gracefully
                pass

# Startup event to prepopulate database with demo records
@app.on_event("startup")
def startup_event():
    import uuid
    import datetime
    
    # Prepopulate tables with demo records if they are empty
    with engine.begin() as conn:
        # Create users table if not exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Seed default admin user
        admin = conn.execute(text("SELECT id FROM users WHERE username = 'admin'")).fetchone()
        if not admin:
            admin_id = str(uuid.uuid4())
            hashed = hash_password("adminpass")
            conn.execute(text("""
                INSERT INTO users (id, username, hashed_password, email)
                VALUES (:id, 'admin', :hashed, 'admin@quantx.local')
            """), {"id": admin_id, "hashed": hashed})
            logger.info("Seeded default admin user (username: admin, password: adminpass).")
        # 1. Prepopulate portfolio
        port = conn.execute(text("SELECT id FROM portfolios LIMIT 1")).fetchone()
        if not port:
            portfolio_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO portfolios (id, name, cash, equity, max_drawdown, sharpe_ratio)
                VALUES (:id, 'HedgeFund Alpha', 45230.12, 124850.50, 0.0450, 2.15)
            """), {"id": portfolio_id})
            logger.info("Prepopulated default portfolio.")
        else:
            portfolio_id = port[0]

        # 2. Prepopulate assets (if empty, though market-data-service handles this)
        assets = conn.execute(text("SELECT id, symbol FROM assets")).fetchall()
        if not assets:
            # Let's insert default assets to match
            default_assets = [
                {"id": str(uuid.uuid4()), "symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
                {"id": str(uuid.uuid4()), "symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology"},
                {"id": str(uuid.uuid4()), "symbol": "TSLA", "name": "Tesla Inc.", "sector": "Automotive"},
                {"id": str(uuid.uuid4()), "symbol": "BTC-USD", "name": "Bitcoin USD", "sector": "Cryptocurrency"}
            ]
            for asset in default_assets:
                conn.execute(text("""
                    INSERT INTO assets (id, symbol, name, sector)
                    VALUES (:id, :symbol, :name, :sector)
                """), asset)
            logger.info("Prepopulated default assets in gateway.")
            assets = conn.execute(text("SELECT id, symbol FROM assets")).fetchall()

        asset_map = {row[1]: row[0] for row in assets}

        # 3. Prepopulate positions if empty
        pos_count = conn.execute(text("SELECT COUNT(*) FROM positions")).fetchone()[0]
        if pos_count == 0 and "AAPL" in asset_map:
            # Add Apple, Bitcoin and Tesla positions
            conn.execute(text("""
                INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                VALUES (:id, :portfolio_id, :asset_id, 250.0, 175.40, 185.10, 2425.00)
            """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["AAPL"]})
            
            if "BTC-USD" in asset_map:
                conn.execute(text("""
                    INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                    VALUES (:id, :portfolio_id, :asset_id, 0.85, 58200.00, 61400.00, 2720.00)
                """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["BTC-USD"]})
                
            if "TSLA" in asset_map:
                conn.execute(text("""
                    INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                    VALUES (:id, :portfolio_id, :asset_id, 80.0, 220.10, 218.40, -136.00)
                """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["TSLA"]})
            logger.info("Prepopulated default positions.")

        # 4. Prepopulate trades if empty
        trades_count = conn.execute(text("SELECT COUNT(*) FROM trades")).fetchone()[0]
        if trades_count == 0 and "AAPL" in asset_map:
            conn.execute(text("""
                INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, status)
                VALUES (:id, :portfolio_id, :asset_id, :timestamp, 'BUY', 250.0, 175.40, 43.85, 'EXECUTED')
            """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["AAPL"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=5)})
            
            if "BTC-USD" in asset_map:
                conn.execute(text("""
                    INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, status)
                    VALUES (:id, :portfolio_id, :asset_id, :timestamp, 'BUY', 0.85, 58200.00, 49.47, 'EXECUTED')
                """), {"id": str(uuid.uuid4()), "portfolio_id": portfolio_id, "asset_id": asset_map["BTC-USD"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(days=3)})
            logger.info("Prepopulated default trades.")

        # 5. Prepopulate signals if empty
        signals_count = conn.execute(text("SELECT COUNT(*) FROM signals")).fetchone()[0]
        if signals_count == 0 and "AAPL" in asset_map:
            # AAPL BUY
            conn.execute(text("""
                INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                VALUES (:id, :asset_id, :timestamp, 'BUY', 0.92, 'Transformer Forecaster', '{"predicted_return": 0.024}')
            """), {"id": str(uuid.uuid4()), "asset_id": asset_map["AAPL"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=5)})
            
            # BTC BUY
            if "BTC-USD" in asset_map:
                conn.execute(text("""
                    INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                    VALUES (:id, :asset_id, :timestamp, 'BUY', 0.88, 'RL Agent PPO', '{"predicted_return": 0.018}')
                """), {"id": str(uuid.uuid4()), "asset_id": asset_map["BTC-USD"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=12)})
                
            # TSLA HOLD
            if "TSLA" in asset_map:
                conn.execute(text("""
                    INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                    VALUES (:id, :asset_id, :timestamp, 'HOLD', 0.65, 'Ensemble Consensus', '{"predicted_return": 0.002}')
                """), {"id": str(uuid.uuid4()), "asset_id": asset_map["TSLA"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=20)})
                
            # MSFT SELL
            if "MSFT" in asset_map:
                conn.execute(text("""
                    INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                    VALUES (:id, :asset_id, :timestamp, 'SELL', 0.76, 'LSTM Forecaster', '{"predicted_return": -0.015}')
                """), {"id": str(uuid.uuid4()), "asset_id": asset_map["MSFT"], "timestamp": datetime.datetime.utcnow() - datetime.timedelta(minutes=28)})
            logger.info("Prepopulated default signals.")

        # 6. Prepopulate risk metrics history if empty
        risk_count = conn.execute(text("SELECT COUNT(*) FROM risk_metrics_history")).fetchone()[0]
        if risk_count == 0:
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
            logger.info("Prepopulated default risk metrics history.")
            
    # Start WebSocket broadcaster task
    asyncio.create_task(broadcast_live_prices())

async def broadcast_live_prices():
    import datetime
    logger.info("Starting WebSocket live price broadcaster...")
    while True:
        await asyncio.sleep(2)
        if not manager.active_connections:
            continue
            
        try:
            with engine.connect() as conn:
                res = conn.execute(text("""
                    SELECT p.timestamp, p.close, p.volume
                    FROM prices p
                    JOIN assets a ON p.asset_id = a.id
                    WHERE a.symbol = 'AAPL'
                    ORDER BY p.timestamp DESC
                    LIMIT 1
                """)).fetchone()
                
                if res:
                    ts, close, vol = res
                    # Use the current time to make it tick forward in the chart
                    now_str = datetime.datetime.now().strftime("%H:%M:%S")
                    payload = {
                        "type": "price",
                        "time": now_str,
                        "price": float(close),
                        "volume": float(vol)
                    }
                    await manager.broadcast(json.dumps(payload))
        except Exception as e:
            logger.error(f"Error in WebSocket price broadcaster: {e}")

manager = ConnectionManager()

# Pydantic schemas
class IngestRequest(BaseModel):
    symbol: str

class BacktestRequest(BaseModel):
    initial_balance: float = 100000.0
    symbol: str = "AAPL"

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "QuantX Gateway"}

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT id FROM users WHERE username = :name"), {"name": req.username}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        user_id = str(uuid.uuid4())
        hashed = hash_password(req.password)
        conn.execute(text("""
            INSERT INTO users (id, username, hashed_password, email)
            VALUES (:id, :username, :hashed, :email)
        """), {"id": user_id, "username": req.username, "hashed": hashed, "email": req.email})
        
    return {"status": "success", "message": "User registered successfully."}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    with engine.connect() as conn:
        user = conn.execute(text("SELECT id, hashed_password, email FROM users WHERE username = :name"), {"name": req.username}).fetchone()
        if not user or not verify_password(req.password, user[1]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
    token = generate_jwt({"sub": req.username, "uid": user[0], "email": user[2]})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

@app.post("/api/trade")
def place_trade(req: ManualOrderRequest, user: dict = Depends(get_current_user)):
    """
    Routes trade requests to portfolio-service
    """
    portfolio_service_url = os.getenv("PORTFOLIO_SERVICE_URL", "http://localhost:8004/execute-manual")
    try:
        res = requests.post(portfolio_service_url, json={
            "symbol": req.symbol.upper(),
            "side": req.side.upper(),
            "qty": req.qty
        }, timeout=5)
        if res.status_code == 200:
            return res.json()
        else:
            raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with portfolio service: {e}")

class RebalanceGatewayRequest(BaseModel):
    method: str = "mvo"
    portfolio_id: Optional[str] = None
    execute: bool = False
    market_weights: Optional[List[float]] = None
    views: Optional[List[float]] = None
    view_link_matrix: Optional[List[List[float]]] = None
    view_omega: Optional[List[List[float]]] = None
    tau: float = 0.05

@app.post("/api/portfolio/rebalance")
def portfolio_rebalance(req: RebalanceGatewayRequest, user: dict = Depends(get_current_user)):
    """
    Routes rebalance requests to portfolio-service
    """
    portfolio_service_url = os.getenv("PORTFOLIO_REBALANCE_URL", "http://localhost:8004/rebalance")
    try:
        payload = {
            "method": req.method,
            "portfolio_id": req.portfolio_id,
            "execute": req.execute,
            "market_weights": req.market_weights,
            "views": req.views,
            "view_link_matrix": req.view_link_matrix,
            "view_omega": req.view_omega,
            "tau": req.tau
        }
        res = requests.post(portfolio_service_url, json=payload, timeout=10)
        if res.status_code == 200:
            return res.json()
        else:
            # Parse detail if returned as json
            try:
                err_detail = json.loads(res.text).get("detail", res.text)
            except Exception:
                err_detail = res.text
            raise HTTPException(status_code=res.status_code, detail=err_detail)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with portfolio rebalance service: {e}")

# Helper to run simple SQL directly for Gateway REST endpoints
def run_query(query: str, params: dict = None) -> List[Dict[str, Any]]:
    with engine.connect() as conn:
        result = conn.execute(text(query), params or {})
        return [dict(row._mapping) for row in result]

@app.get("/api/market-data")
def get_market_data(symbol: Optional[str] = None, user: dict = Depends(get_current_user)):
    """
    Get historical price series.
    """
    if symbol:
        query = """
            SELECT p.timestamp, p.open, p.high, p.low, p.close, p.volume
            FROM prices p
            JOIN assets a ON p.asset_id = a.id
            WHERE a.symbol = :symbol
            ORDER BY p.timestamp ASC
        """
        data = run_query(query, {"symbol": symbol.upper()})
    else:
        query = """
            SELECT a.symbol, p.timestamp, p.close
            FROM prices p
            JOIN assets a ON p.asset_id = a.id
            ORDER BY p.timestamp ASC
        """
        data = run_query(query)
    return data

@app.get("/api/signals")
def get_active_signals(user: dict = Depends(get_current_user)):
    """
    Get latest trade signals.
    """
    query = """
        SELECT a.symbol, s.timestamp, s.signal_type, s.confidence, s.source_service
        FROM signals s
        JOIN assets a ON s.asset_id = a.id
        ORDER BY s.timestamp DESC
        LIMIT 50
    """
    return run_query(query)

@app.get("/api/portfolio")
def get_portfolio(user: dict = Depends(get_current_user)):
    """
    Get portfolio state.
    """
    # Fetch portfolio stats
    port = run_query("SELECT id, name, cash, equity, max_drawdown, sharpe_ratio FROM portfolios LIMIT 1")
    if not port:
        # Prepopulate a portfolio if not existing
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO portfolios (name, cash, equity) VALUES ('HedgeFund Alpha', 100000.00, 100000.00) ON CONFLICT DO NOTHING"))
        port = run_query("SELECT id, name, cash, equity, max_drawdown, sharpe_ratio FROM portfolios LIMIT 1")
        
    portfolio_id = port[0]["id"]
    
    # Fetch held positions
    positions = run_query("""
        SELECT a.symbol, p.quantity, p.average_entry_price, p.current_price, p.unrealized_pnl
        FROM positions p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.portfolio_id = :port_id
    """, {"port_id": portfolio_id})
    
    # Fetch trades
    trades = run_query("""
        SELECT a.symbol, t.timestamp, t.side, t.quantity, t.price, t.execution_cost, t.status
        FROM trades t
        JOIN assets a ON t.asset_id = a.id
        WHERE t.portfolio_id = :port_id
        ORDER BY t.timestamp DESC
        LIMIT 20
    """, {"port_id": portfolio_id})
    
    return {
        "summary": port[0],
        "positions": positions,
        "recent_trades": trades
    }

@app.get("/api/risk")
def get_risk(user: dict = Depends(get_current_user)):
    """
    Get risk and exposure limits.
    """
    query = """
        SELECT timestamp, var_95, cvar_95, leverage_ratio, exposure_limit
        FROM risk_metrics_history
        ORDER BY timestamp DESC
        LIMIT 50
    """
    data = run_query(query)
    if not data:
        # Return mock risk metrics if no history exists
        import datetime
        data = [{
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "var_95": 0.0245,
            "cvar_95": 0.0385,
            "leverage_ratio": 1.0,
            "exposure_limit": 100000.0
        }]
    return data

@app.post("/api/backtest")
def trigger_backtest(req: BacktestRequest, user: dict = Depends(get_current_user)):
    """
    Triggers a backtest on historical price records and returns metrics.
    """
    # Fetch prices from DB for the specified symbol
    raw_prices = run_query("""
        SELECT p.timestamp, a.symbol, p.open, p.high, p.low, p.close, p.volume
        FROM prices p
        JOIN assets a ON p.asset_id = a.id
        WHERE a.symbol = :symbol
        ORDER BY p.timestamp ASC
    """, {"symbol": req.symbol.upper()})
    
    if len(raw_prices) < 20:
        return {"status": "error", "message": f"Not enough historical prices in the database to run a backtest for {req.symbol}."}
        
    # Convert timestamps to string format to avoid Pandas C-level bugs under Python 3.13
    unique_dates = sorted(list(set(str(r["timestamp"]) for r in raw_prices)))
    signals_list = []
    
    # Simple rule: buy symbol on step 0, sell on step 100, etc.
    for i, dt in enumerate(unique_dates):
        if i % 10 == 0:
            signals_list.append({"timestamp": dt, "symbol": req.symbol.upper(), "signal": "BUY", "weight": 0.5})
        elif i % 15 == 0:
            signals_list.append({"timestamp": dt, "symbol": req.symbol.upper(), "signal": "SELL", "weight": 0.5})
            
    prices_list = []
    for r in raw_prices:
        row = dict(r)
        row["timestamp"] = str(row["timestamp"])
        prices_list.append(row)
        
    prices_df = pd.DataFrame(prices_list)
    signals_df = pd.DataFrame(signals_list)
    
    backtester = Backtester(initial_cash=req.initial_balance)
    results = backtester.run(prices_df, signals_df)
    
    # Format dates
    results["dates"] = [str(d) for d in results["dates"]]
    return results

# ==================== AI PREDICTIONS PORTAL ====================
@app.get("/api/predictions/{symbol}")
def get_prediction_gateway(symbol: str, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/predictions/{symbol}"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service connection error: {e}")

@app.get("/api/predictions/{symbol}/explanation")
def get_prediction_explanation_gateway(symbol: str, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/predictions/{symbol}/explanation"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service connection error: {e}")

@app.get("/api/models")
def get_models_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/models"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service connection error: {e}")


# ==================== QUANTUM RESEARCH HUB ====================
class QuantumExperimentGatewayRequest(BaseModel):
    name: str
    params: Dict[str, Any]

class QuantumExperimentPromoteRequest(BaseModel):
    target_engine: str = "Backtest"

@app.post("/api/quantum/experiments")
def create_quantum_experiment_gateway(req: QuantumExperimentGatewayRequest, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/experiments"
    try:
        res = requests.post(url, json={"name": req.name, "params": req.params}, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")

@app.post("/api/quantum/experiments/{exp_id}/run")
def run_quantum_experiment_gateway(exp_id: str, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/experiments/{exp_id}/run"
    try:
        res = requests.post(url, timeout=30)  # longer timeout for quantum annealing simulation
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")

@app.get("/api/quantum/experiments/{exp_id}/results")
def get_quantum_experiment_results_gateway(exp_id: str, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/experiments/{exp_id}/results"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")

@app.post("/api/quantum/experiments/{exp_id}/promote")
def promote_quantum_experiment_gateway(exp_id: str, req: QuantumExperimentPromoteRequest, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/experiments/{exp_id}/promote"
    try:
        res = requests.post(url, json={"target_engine": req.target_engine}, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")

@app.get("/api/quantum/kernels")
def get_quantum_kernels_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/kernels"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")


@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive loop or wait for message
            data = await websocket.receive_text()
            logger.debug(f"Received message from WS client: {data}")
            # Echo back or respond to client requests
            await websocket.send_text(json.dumps({"status": "acknowledged", "msg": data}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
