import uvicorn
import logging
import json
import asyncio
import hmac
import hashlib
import base64
import time
import uuid
import os
import requests
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, select, text
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd

import sys
import os

# Add backend folder to path for database helpers
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import local_db_helper

# Load Backtester and Optimizer modules dynamically by temporarily popping the 'app' module
# to bypass 'app' package namespace collisions and allow package relative imports
orig_app = sys.modules.pop('app', None)
sys.modules.pop('app', None)

# 1. Import Backtester from backtesting-service
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backtesting-service')))
from app.backtester import Backtester
sys.path.pop(0)

# Pop 'app' package created by backtesting-service
sys.modules.pop('app', None)

# 2. Import PortfolioOptimizer from portfolio-service
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../portfolio-service')))
from app.optimizer import PortfolioOptimizer
sys.path.pop(0)

# Restore the original api-gateway app module
if orig_app:
    sys.modules['app'] = orig_app

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

def generate_jwt(payload: dict, secret: str = SECRET_KEY, expires_in: int = 60 * 60 * 24 * 30) -> str:  # 30 days
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
    full_name: Optional[str] = None
    fullName: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[str] = None
    persona: Optional[str] = None

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
        # Create users table with full profile columns if not exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                organization TEXT,
                role TEXT DEFAULT 'Trader',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Add profile columns to existing users table if missing (migration)
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name TEXT"))
            logger.info("Migrated users table: added full_name column.")
        except Exception:
            pass  # Column already exists
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN organization TEXT"))
            logger.info("Migrated users table: added organization column.")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Trader'"))
            logger.info("Migrated users table: added role column.")
        except Exception:
            pass
        
        # Seed default admin user
        admin = conn.execute(text("SELECT id FROM users WHERE username = 'admin'")).fetchone()
        if not admin:
            admin_id = str(uuid.uuid4())
            hashed = hash_password("adminpass")
            conn.execute(text("""
                INSERT INTO users (id, username, hashed_password, email, full_name, organization, role)
                VALUES (:id, 'admin', :hashed, 'admin@quantx.local', 'System Admin', 'QuantX Internal', 'System Admin')
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

        # 2. Prepopulate assets and historical prices
        default_assets = [
            {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "class": "equity_us", "price": 185.10},
            {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology", "class": "equity_us", "price": 372.30},
            {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Automotive", "class": "equity_us", "price": 218.40},
            {"symbol": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology", "class": "equity_us", "price": 875.12},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "class": "equity_us", "price": 145.50},
            {"symbol": "GOOG", "name": "Alphabet Inc.", "sector": "Technology", "class": "equity_us", "price": 138.20},
            {"symbol": "FB", "name": "Meta Platforms Inc.", "sector": "Technology", "class": "equity_us", "price": 355.00},
            {"symbol": "AMD", "name": "Advanced Micro Devices", "sector": "Technology", "class": "equity_us", "price": 172.50},
            {"symbol": "INTC", "name": "Intel Corp.", "sector": "Technology", "class": "equity_us", "price": 43.10},
            {"symbol": "NFLX", "name": "Netflix Inc.", "sector": "Communication Services", "class": "equity_us", "price": 485.20},
            {"symbol": "BTC-USD", "name": "Bitcoin USD", "sector": "Cryptocurrency", "class": "crypto", "price": 61400.00},
            {"symbol": "ETH-USD", "name": "Ethereum USD", "sector": "Cryptocurrency", "class": "crypto", "price": 3380.15},
            {"symbol": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy", "class": "equity_in", "price": 2912.40},
            {"symbol": "TCS.NS", "name": "Tata Consultancy Services", "sector": "Technology", "class": "equity_in", "price": 3812.50},
            {"symbol": "INFY.NS", "name": "Infosys Ltd.", "sector": "Technology", "class": "equity_in", "price": 1540.30},
            {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd.", "sector": "Financial Services", "class": "equity_in", "price": 1610.20},
            {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd.", "sector": "Financial Services", "class": "equity_in", "price": 980.50},
            {"symbol": "SBIN.NS", "name": "State Bank of India", "sector": "Financial Services", "class": "equity_in", "price": 620.10},
            {"symbol": "ITC.NS", "name": "ITC Ltd.", "sector": "Consumer Goods", "class": "equity_in", "price": 445.80},
        ]
        
        for a in default_assets:
            row = conn.execute(text("SELECT id FROM assets WHERE symbol = :sym"), {"sym": a["symbol"]}).fetchone()
            if not row:
                asset_id = str(uuid.uuid4())
                conn.execute(text("""
                    INSERT INTO assets (id, symbol, name, asset_class, sector, is_active)
                    VALUES (:id, :symbol, :name, :asset_class, :sector, 1)
                """), {"id": asset_id, "symbol": a["symbol"], "name": a["name"], "asset_class": a["class"], "sector": a["sector"]})
                logger.info(f"Seeded asset: {a['symbol']}")
            else:
                asset_id = row[0]
                
            # Seed prices if empty
            p_exists = conn.execute(text("SELECT 1 FROM prices WHERE asset_id = :id LIMIT 1"), {"id": asset_id}).fetchone()
            if not p_exists:
                base_price = a["price"]
                today = datetime.datetime.utcnow().date()
                for day_idx in range(30, -1, -1):
                    bar_date = today - datetime.timedelta(days=day_idx)
                    change = (random.random() - 0.48) * 0.02
                    close_p = base_price * (1.0 + change)
                    open_p = base_price
                    high_p = max(open_p, close_p) * (1.0 + random.random() * 0.005)
                    low_p = min(open_p, close_p) * (1.0 - random.random() * 0.005)
                    vol = random.randint(100000, 5000000)
                    
                    conn.execute(text("""
                        INSERT INTO prices (id, asset_id, timestamp, open, high, low, close, volume, interval_type)
                        VALUES (:id, :asset_id, :ts, :open, :high, :low, :close, :vol, '1d')
                    """), {
                        "id": str(uuid.uuid4()),
                        "asset_id": asset_id,
                        "ts": datetime.datetime.combine(bar_date, datetime.time(16, 0)),
                        "open": open_p,
                        "high": high_p,
                        "low": low_p,
                        "close": close_p,
                        "vol": vol
                    })
                    base_price = close_p
                logger.info(f"Seeded 30 daily prices for: {a['symbol']}")
                
        # Re-fetch assets for mapping
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

# ──────────────────────────────────────────────────────────
# EMAIL CONFIGURATION  (reads from email_config.env)
# ──────────────────────────────────────────────────────────
def _load_email_config() -> dict:
    """Load SMTP credentials from email_config.env in the project root."""
    config = {}
    config_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '../../../email_config.env')
    )
    if not os.path.exists(config_path):
        logger.warning(f"email_config.env not found at {config_path} — emails disabled.")
        return config
    with open(config_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, val = line.partition('=')
                config[key.strip()] = val.strip()
    return config

EMAIL_CFG = _load_email_config()

def _build_welcome_html(full_name: str, username: str, email: str, organization: str, role: str, token: str = "") -> str:
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to QuantX</title>
  <style>
    body {{ margin:0; padding:0; background:#070A13; font-family:'Segoe UI',Arial,sans-serif; color:#F3F4F6; }}
    .wrapper {{ max-width:600px; margin:0 auto; padding:40px 20px; }}
    .logo-bar {{ display:flex; align-items:center; gap:10px; margin-bottom:32px; }}
    .logo-box {{ background:#10B981; border-radius:8px; width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; color:#fff; }}
    .logo-name {{ font-size:22px; font-weight:800; color:#fff; letter-spacing:2px; }}
    .logo-version {{ font-size:11px; color:#10B981; margin-left:4px; }}
    .card {{ background:#0B0F19; border:1px solid #1F2937; border-radius:16px; padding:40px; }}
    .greeting {{ font-size:26px; font-weight:800; color:#fff; margin-bottom:8px; }}
    .subtitle {{ font-size:14px; color:#9CA3AF; margin-bottom:28px; line-height:1.6; }}
    .divider {{ border:none; border-top:1px solid #1F2937; margin:24px 0; }}
    .info-row {{ display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #111827; }}
    .info-label {{ font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:1px; font-weight:600; }}
    .info-value {{ font-size:13px; color:#F3F4F6; font-weight:600; }}
    .badge {{ display:inline-block; background:#10B981; color:#fff; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; padding:3px 8px; border-radius:4px; }}
    .cta {{ margin-top:32px; text-align:center; }}
    .cta a {{ display:inline-block; background:#10B981; color:#fff; font-weight:800; font-size:13px; text-decoration:none; padding:14px 36px; border-radius:10px; letter-spacing:1px; text-transform:uppercase; }}
    .features {{ margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
    .feature {{ background:#111827; border:1px solid #1F2937; border-radius:10px; padding:16px; }}
    .feature-icon {{ font-size:20px; margin-bottom:6px; }}
    .feature-title {{ font-size:12px; font-weight:700; color:#10B981; margin-bottom:4px; }}
    .feature-desc {{ font-size:11px; color:#6B7280; line-height:1.5; }}
    .footer {{ margin-top:32px; text-align:center; font-size:11px; color:#4B5563; line-height:1.8; }}
    .green {{ color:#10B981; }}
  </style>
</head>
<body>
<div class="wrapper">
  <div class="logo-bar">
    <div class="logo-box">Q</div>
    <span class="logo-name">QuantX <span class="logo-version">v4.2</span></span>
  </div>

  <div class="card">
    <div class="greeting">Welcome To QuantX, {full_name}! 🚀</div>
    <div class="subtitle">
      Your institutional terminal access has been provisioned. You're now part of the QuantX AI trading ecosystem — where quantitative finance meets cutting-edge machine learning.
    </div>

    <hr class="divider">

    <div class="info-row">
      <span class="info-label">Username</span>
      <span class="info-value">{username}</span>
    </div>
    <div class="info-row" style="border-bottom:none">
      <span class="info-label">Role</span>
      <span class="info-value"><span class="badge">{role}</span></span>
    </div>

    <hr class="divider">

    <div style="font-size:13px;color:#9CA3AF;margin-bottom:16px;">Your terminal unlocks access to:</div>
    <div class="features">
      <div class="feature">
        <div class="feature-icon">📈</div>
        <div class="feature-title">AI Price Prediction</div>
        <div class="feature-desc">LSTM + Transformer ensemble forecasting with explainability</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🤖</div>
        <div class="feature-title">RL Trading Agents</div>
        <div class="feature-desc">PPO, DQN & A2C agents deployed on live market data</div>
      </div>
      <div class="feature">
        <div class="feature-icon">🧪</div>
        <div class="feature-title">Backtesting Lab</div>
        <div class="feature-desc">Multi-strategy simulation with CAGR, Sharpe & drawdown analytics</div>
      </div>
      <div class="feature">
        <div class="feature-icon">⚛️</div>
        <div class="feature-title">Quantum Research</div>
        <div class="feature-desc">Quantum-enhanced portfolio optimization via QAOA circuits</div>
      </div>
    </div>

    <div class="cta">
      <a href="http://192.168.1.9:3000/?token={token}">Open QuantX Terminal →</a>
    </div>
  </div>

  <div class="footer">
    <span class="green">QuantX AI Trading Platform</span> · Encrypted · Institutional Grade<br>
    This email was sent to {email} because you created a QuantX account.<br>
    © 2026 QuantX. All rights reserved.
  </div>
</div>
</body>
</html>
"""
def send_welcome_email(to_email: str, full_name: str, username: str, organization: str, role: str, token: str = ""):
    """Send a welcome email in a background thread and save a copy locally for offline verification."""
    smtp_user = EMAIL_CFG.get('SMTP_USER', '')
    smtp_pass = EMAIL_CFG.get('SMTP_PASS', '')
    smtp_host = EMAIL_CFG.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(EMAIL_CFG.get('SMTP_PORT', 587))
    from_name = EMAIL_CFG.get('SMTP_FROM_NAME', 'QuantX Platform')

    # Build the HTML content
    html_content = _build_welcome_html(full_name, username, to_email, organization, role, token)

    # 1. ALWAYS save the welcome email locally so the user and teacher can verify it offline
    try:
        sent_emails_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '../../../sent_emails')
        )
        os.makedirs(sent_emails_dir, exist_ok=True)
        safe_username = "".join(c for c in username if c.isalnum() or c in ('_', '-'))
        local_email_file = os.path.join(sent_emails_dir, f"welcome_{safe_username}.html")
        with open(local_email_file, "w", encoding="utf-8") as f:
            f.write(html_content)
        logger.info(f"Offline welcome email saved locally to: {local_email_file}")
    except Exception as e:
        logger.warning(f"Failed to save local offline email copy: {e}")

    # 2. If SMTP is configured, attempt to send via Gmail SMTP
    if not smtp_user or not smtp_pass or 'your_gmail' in smtp_user or 'your_16' in smtp_pass or smtp_pass.strip() == "":
        logger.info("Email credentials not fully configured in email_config.env. Saved offline copy only.")
        return

    def _send():
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"Welcome to QuantX Terminal, {full_name}! 🚀"
            msg['From'] = f"{from_name} <{smtp_user}>"
            msg['To'] = to_email

            plain = (
                f"Welcome to QuantX, {full_name}!\n\n"
                f"Your account has been created successfully.\n"
                f"Username: {username}\n"
                f"Organization: {organization}\n"
                f"Role: {role}\n\n"
                f"Sign in at: http://192.168.1.9:3000/?token={token}\n\n"
                f"— The QuantX Team"
            )
            msg.attach(MIMEText(plain, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, to_email, msg.as_string())

            logger.info(f"Welcome email successfully sent to {to_email}")
        except Exception as e:
            logger.warning(f"Could not send SMTP email to {to_email}. (Ensure SMTP password is correct). Error: {e}")

    # Fire-and-forget in background thread — never blocks the API response
    threading.Thread(target=_send, daemon=True).start()


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
    logger.info(f"Registration request received: username={req.username}, email={req.email}")
    try:
        # Enforce password length: 6–12 characters
        if len(req.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        if len(req.password) > 12:
            raise HTTPException(status_code=400, detail="Password cannot exceed 12 characters.")

        email_val = req.email or req.username
        full_name_val = req.full_name or req.fullName or req.username
        role_val = req.role or req.persona or "Trader"

        with engine.begin() as conn:
            existing = conn.execute(text("SELECT id FROM users WHERE username = :name"), {"name": req.username}).fetchone()
            if existing:
                raise HTTPException(status_code=400, detail="Username already exists.")

            existing_email = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email_val}).fetchone()
            if existing_email:
                raise HTTPException(status_code=400, detail="Email address already registered.")
            
            user_id = str(uuid.uuid4())
            hashed = hash_password(req.password)
            conn.execute(text("""
                INSERT INTO users (id, username, hashed_password, email, full_name, organization, role)
                VALUES (:id, :username, :hashed, :email, :full_name, :organization, :role)
            """), {
                "id": user_id,
                "username": req.username,
                "hashed": hashed,
                "email": email_val,
                "full_name": full_name_val,
                "organization": req.organization or "Independent",
                "role": role_val
            })
            logger.info(f"New user registered: {req.username} ({email_val})")
    except HTTPException as e:
        logger.warning(f"Registration failed for username={req.username}, email={req.email}. Reason: {e.detail}")
        raise e

    # Generate token to embed in email link for direct passwordless login
    token = generate_jwt({
        "sub": req.username,
        "uid": user_id,
        "email": email_val,
        "full_name": full_name_val,
        "organization": req.organization or "Independent",
        "role": role_val
    })

    # Send welcome email in background (non-blocking — failure never breaks signup)
    if email_val:
        display_username = req.username.split('@')[0] if '@' in req.username else req.username
        send_welcome_email(
            to_email=email_val,
            full_name=full_name_val,
            username=display_username,
            organization=req.organization or "Independent",
            role=role_val,
            token=token
        )
        
    return {"status": "success", "message": "Account created successfully. A welcome email has been sent to your inbox!"}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    with engine.connect() as conn:
        user = conn.execute(text(
            "SELECT id, hashed_password, email, full_name, organization, role FROM users WHERE username = :name"
        ), {"name": req.username}).fetchone()
        if not user or not verify_password(req.password, user[1]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Include full profile in JWT payload so it can be restored without another DB call
    token = generate_jwt({
        "sub": req.username,
        "uid": user[0],
        "email": user[2] or "",
        "full_name": user[3] or req.username,
        "organization": user[4] or "Independent",
        "role": user[5] or "Trader"
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": req.username,
            "email": user[2] or "",
            "full_name": user[3] or req.username,
            "organization": user[4] or "Independent",
            "role": user[5] or "Trader"
        }
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    """Return full user profile from the database."""
    with engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id, username, email, full_name, organization, role, created_at FROM users WHERE username = :sub"
        ), {"sub": user["sub"]}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "uid": row[0],
        "username": row[1],
        "email": row[2] or "",
        "full_name": row[3] or row[1],
        "organization": row[4] or "Independent",
        "role": row[5] or "Trader",
        "created_at": str(row[6]) if row[6] else ""
    }

@app.get("/api/auth/verify")
def verify_token(user: dict = Depends(get_current_user)):
    """Lightweight endpoint to verify a stored JWT is still valid.
    Returns the user profile embedded in the token — no DB hit needed.
    """
    return {
        "valid": True,
        "username": user.get("sub", ""),
        "email": user.get("email", ""),
        "full_name": user.get("full_name", user.get("sub", "")),
        "organization": user.get("organization", "Independent"),
        "role": user.get("role", "Trader")
    }

@app.post("/api/trade")
def place_trade(req: ManualOrderRequest, user: dict = Depends(get_current_user)):
    """
    Routes trade requests to portfolio-service, with a direct SQLite fallback if offline
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
        logger.warning(f"Portfolio service offline ({e}). Executing trade fallback locally in DB.")
        symbol = req.symbol.upper()
        side = req.side.upper()
        qty = float(req.qty)
        
        from sqlalchemy import text
        import uuid
        import datetime
        
        try:
            with engine.begin() as conn:
                # 1. Get asset ID
                asset = conn.execute(
                    text("SELECT id FROM assets WHERE symbol = :sym"),
                    {"sym": symbol}
                ).fetchone()
                if not asset:
                    raise HTTPException(status_code=404, detail="Asset not found.")
                asset_id = asset[0]
                
                # 2. Get latest price
                latest_price_rec = conn.execute(
                    text("SELECT close FROM prices WHERE asset_id = :id ORDER BY timestamp DESC LIMIT 1"),
                    {"id": asset_id}
                ).fetchone()
                price = float(latest_price_rec[0]) if latest_price_rec else 100.0
                
                # 3. Get portfolio
                port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
                if not port:
                    raise HTTPException(status_code=400, detail="No portfolio found.")
                portfolio_id, cash, equity = port
                portfolio_id = str(portfolio_id)
                cash = float(cash)
                equity = float(equity)
                
                cost = qty * price
                commission = cost * 0.001
                slippage = cost * 0.0005
                
                if side == "BUY":
                    execution_cost = cost + commission + slippage
                    if cash < execution_cost:
                        raise HTTPException(status_code=400, detail="Insufficient cash for execution")
                    new_cash = cash - execution_cost
                    
                    pos = conn.execute(
                        text("SELECT quantity, average_entry_price FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                        {"port_id": portfolio_id, "asset_id": asset_id}
                    ).fetchone()
                    
                    if pos:
                        old_qty = float(pos[0])
                        old_avg = float(pos[1])
                        new_qty = old_qty + qty
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
                    pos = conn.execute(
                        text("SELECT quantity, average_entry_price FROM positions WHERE portfolio_id = :port_id AND asset_id = :asset_id"),
                        {"port_id": portfolio_id, "asset_id": asset_id}
                    ).fetchone()
                    
                    if not pos or float(pos[0]) < qty:
                        raise HTTPException(status_code=400, detail="Insufficient position size to execute SELL order")
                        
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
                        
                # 4. Save executed trade log
                conn.execute(
                    text("""
                        INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
                        VALUES (:id, :port_id, :asset_id, :ts, :side, :qty, :price, :exec_cost, :slip, 'EXECUTED')
                    """),
                    {
                        "id": str(uuid.uuid4()),
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
                
                # 5. Update Portfolio Cash & Equity
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
                
            return {
                "status": "success",
                "message": f"Mock {side} order executed for {qty} shares of {symbol} (Local Fallback)",
                "details": {
                    "symbol": symbol,
                    "side": side,
                    "qty": qty,
                    "price": price,
                    "execution_cost": commission,
                    "new_cash": new_cash,
                    "new_equity": new_equity
                }
            }
        except Exception as db_err:
            logger.error(f"Fallback database execution failed: {db_err}")
            raise HTTPException(status_code=500, detail=f"Database execution failed: {db_err}")

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
    Routes rebalance requests to portfolio-service, with a direct SQLite fallback if offline
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
            try:
                err_detail = json.loads(res.text).get("detail", res.text)
            except Exception:
                err_detail = res.text
            raise HTTPException(status_code=res.status_code, detail=err_detail)
    except Exception as e:
        logger.warning(f"Portfolio service offline ({e}). Executing rebalance fallback locally in DB.")
        
        from sqlalchemy import text
        import uuid
        import datetime
        
        try:
            # Setup optimization target weights
            target_weights = {
                "AAPL": 0.20,
                "MSFT": 0.20,
                "TSLA": 0.15,
                "NVDA": 0.15,
                "BTC-USD": 0.10,
                "ETH-USD": 0.10,
                "RELIANCE.NS": 0.05,
                "TCS.NS": 0.05
            }
            
            with engine.begin() as conn:
                # 1. Fetch portfolio
                port = conn.execute(text("SELECT id, cash, equity FROM portfolios LIMIT 1")).fetchone()
                if not port:
                    raise HTTPException(status_code=404, detail="No portfolio found.")
                portfolio_id, cash, equity = port
                portfolio_id = str(portfolio_id)
                cash = float(cash)
                equity = float(equity)
                
                # Fetch positions
                positions_rows = conn.execute(
                    text("SELECT a.symbol, p.quantity, p.current_price FROM positions p JOIN assets a ON p.asset_id = a.id WHERE p.portfolio_id = :port_id"),
                    {"port_id": portfolio_id}
                ).fetchall()
                
                current_qtys = {sym: 0.0 for sym in target_weights.keys()}
                current_prices = {sym: 0.0 for sym in target_weights.keys()}
                for row in positions_rows:
                    sym = row[0]
                    if sym in current_qtys:
                        current_qtys[sym] = float(row[1])
                        current_prices[sym] = float(row[2])
                        
                # Get latest prices for target assets
                for sym in target_weights.keys():
                    if current_prices[sym] == 0.0:
                        asset = conn.execute(
                            text("SELECT id FROM assets WHERE symbol = :sym"),
                            {"sym": sym}
                        ).fetchone()
                        if asset:
                            latest_price_rec = conn.execute(
                                text("SELECT close FROM prices WHERE asset_id = :id ORDER BY timestamp DESC LIMIT 1"),
                                {"id": asset[0]}
                            ).fetchone()
                            current_prices[sym] = float(latest_price_rec[0]) if latest_price_rec else 100.0
                            
                # Calculate current weights
                position_value = sum(current_qtys[s] * current_prices[s] for s in target_weights.keys())
                current_equity = cash + position_value
                
                current_weights = {}
                for sym in target_weights.keys():
                    current_weights[sym] = (current_qtys[sym] * current_prices[sym]) / current_equity if current_equity > 0 else 0.0
                    
                # Calculate proposed trades
                proposed_trades = []
                for sym, target_w in target_weights.items():
                    curr_w = current_weights.get(sym, 0.0)
                    diff_w = target_w - curr_w
                    trade_val = diff_w * current_equity
                    price = current_prices[sym]
                    if price > 0 and abs(trade_val) > 10.0:
                        side = "BUY" if trade_val > 0 else "SELL"
                        trade_qty = abs(trade_val) / price
                        proposed_trades.append({
                            "symbol": sym,
                            "side": side,
                            "qty": round(trade_qty, 6),
                            "price": price,
                            "estimated_value": round(trade_qty * price, 2)
                        })
                        
                if req.execute:
                    # Clear old positions
                    conn.execute(
                        text("DELETE FROM positions WHERE portfolio_id = :port_id"),
                        {"port_id": portfolio_id}
                    )
                    
                    # 99.5% equity allocated to positions, 0.5% kept as cash
                    new_cash = current_equity * 0.005
                    
                    for sym, target_w in target_weights.items():
                        price = current_prices[sym]
                        qty = (target_w * current_equity) / price
                        
                        asset = conn.execute(
                            text("SELECT id FROM assets WHERE symbol = :sym"),
                            {"sym": sym}
                        ).fetchone()
                        
                        if asset:
                            conn.execute(
                                text("""
                                    INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
                                    VALUES (:id, :port_id, :asset_id, :qty, :avg, :curr, 0.0)
                                """),
                                {"id": str(uuid.uuid4()), "port_id": portfolio_id, "asset_id": asset[0], "qty": qty, "avg": price, "curr": price}
                            )
                            
                            # Log trade
                            conn.execute(
                                text("""
                                    INSERT INTO trades (id, portfolio_id, asset_id, timestamp, side, quantity, price, execution_cost, slippage, status)
                                    VALUES (:id, :port_id, :asset_id, :ts, :side, :qty, :price, 0.0, 0.0, 'EXECUTED')
                                """),
                                {
                                    "id": str(uuid.uuid4()),
                                    "port_id": portfolio_id,
                                    "asset_id": asset[0],
                                    "ts": datetime.datetime.utcnow(),
                                    "side": "BUY",
                                    "qty": qty,
                                    "price": price,
                                }
                            )
                            
                    # Update portfolio cash & equity
                    conn.execute(
                        text("UPDATE portfolios SET cash = :cash, equity = :equity, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                        {"cash": new_cash, "equity": current_equity, "id": portfolio_id}
                    )
                    
            return {
                "status": "success",
                "method": req.method,
                "weights": target_weights,
                "current_weights": current_weights,
                "proposed_trades": proposed_trades,
                "execution_logs": [{"symbol": t["symbol"], "side": t["side"], "qty": t["qty"], "success": True, "message": "Executed locally"} for t in proposed_trades] if req.execute else []
            }
        except Exception as db_err:
            logger.error(f"Fallback rebalance execution failed: {db_err}")
            raise HTTPException(status_code=500, detail=f"Rebalance execution failed: {db_err}")

class BrokerageGatewaySettingsRequest(BaseModel):
    alpaca_api_key: str
    alpaca_secret_key: str
    live_trading: bool = False

@app.get("/api/portfolio/brokerage")
def get_brokerage_settings_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('PORTFOLIO_SERVICE_URL', 'http://localhost:8004/execute-manual').split('/execute-manual')[0]}/brokerage/settings"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio service connection error: {e}")

@app.post("/api/portfolio/brokerage")
def update_brokerage_settings_gateway(req: BrokerageGatewaySettingsRequest, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('PORTFOLIO_SERVICE_URL', 'http://localhost:8004/execute-manual').split('/execute-manual')[0]}/brokerage/settings"
    try:
        res = requests.post(url, json={
            "alpaca_api_key": req.alpaca_api_key,
            "alpaca_secret_key": req.alpaca_secret_key,
            "live_trading": req.live_trading
        }, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio service connection error: {e}")

@app.get("/api/portfolio/brokerage/status")
def get_brokerage_status_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('PORTFOLIO_SERVICE_URL', 'http://localhost:8004/execute-manual').split('/execute-manual')[0]}/brokerage/status"
    try:
        res = requests.get(url, timeout=7)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Portfolio service connection error: {e}")

@app.get("/api/market-data/options-chain/{symbol}")
def get_options_chain_gateway(symbol: str, user: dict = Depends(get_current_user)):
    url = f"{os.getenv('MARKET_DATA_SERVICE_URL', 'http://localhost:8001')}/options-chain/{symbol.upper()}"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Market data service connection error: {e}")

@app.get("/api/market-data/forex")
def get_forex_rates_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('MARKET_DATA_SERVICE_URL', 'http://localhost:8001')}/forex-rates"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Market data service connection error: {e}")

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
    
    # Query live portfolio metrics from portfolio-service
    live_metrics = {
        "cagr": 0.142,
        "sharpe_ratio": port[0]["sharpe_ratio"] or 2.15,
        "sortino_ratio": 2.45,
        "max_drawdown": port[0]["max_drawdown"] or 0.0412,
        "var_95": 0.0245
    }
    
    try:
        res = requests.get(f"http://localhost:8004/portfolio-metrics?portfolio_id={portfolio_id}", timeout=2.0)
        if res.status_code == 200:
            m_data = res.json()
            live_metrics.update({
                "cagr": m_data.get("cagr", 0.142),
                "sharpe_ratio": m_data.get("sharpe_ratio", live_metrics["sharpe_ratio"]),
                "sortino_ratio": m_data.get("sortino_ratio", 2.45),
                "max_drawdown": m_data.get("max_drawdown", live_metrics["max_drawdown"]),
                "var_95": m_data.get("var_95", 0.0245)
            })
    except Exception as e:
        logger.warning(f"Error calling portfolio-service metrics: {e}")
    
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
    
    # Combine the live metrics into the summary object
    summary = port[0].copy()
    summary["sharpe_ratio"] = live_metrics["sharpe_ratio"]
    summary["max_drawdown"] = live_metrics["max_drawdown"]
    summary["sortino_ratio"] = live_metrics["sortino_ratio"]
    summary["cagr"] = live_metrics["cagr"]
    summary["var_95"] = live_metrics["var_95"]
    
    return {
        "summary": summary,
        "positions": positions,
        "recent_trades": trades
    }

@app.get("/api/risk")
def get_risk(user: dict = Depends(get_current_user)):
    """
    Get risk and exposure limits.
    """
    # Try fetching live VaR
    live_var = 0.0245
    try:
        port = run_query("SELECT id FROM portfolios LIMIT 1")
        if port:
            res = requests.get(f"http://localhost:8004/portfolio-metrics?portfolio_id={port[0]['id']}", timeout=1.0)
            if res.status_code == 200:
                live_var = res.json().get("var_95", 0.0245)
    except Exception:
        pass
        
    query = """
        SELECT timestamp, var_95, cvar_95, leverage_ratio, exposure_limit
        FROM risk_metrics_history
        ORDER BY timestamp DESC
        LIMIT 50
    """
    data = run_query(query)
    if not data:
        import datetime
        data = [{
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "var_95": live_var,
            "cvar_95": live_var * 1.5,
            "leverage_ratio": 1.0,
            "exposure_limit": 100000.0
        }]
    else:
        # Override the latest historical data point with the current live VaR
        data[0]["var_95"] = live_var
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

@app.get("/api/predictions/{symbol}/rl")
def get_prediction_rl_gateway(
    symbol: str, 
    cash: float = 100000.0, 
    position_qty: float = 0.0, 
    average_entry_price: float = 0.0,
    user: dict = Depends(get_current_user)
):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/predictions/{symbol}/rl"
    try:
        res = requests.get(url, params={
            "cash": cash,
            "position_qty": position_qty,
            "average_entry_price": average_entry_price
        }, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service connection error: {e}")

@app.post("/api/models/retrain")
def trigger_retrain_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/models/retrain"
    try:
        res = requests.post(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service connection error: {e}")

@app.get("/api/models/retrain/status")
def get_retrain_status_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('AI_PREDICTION_SERVICE_URL', 'http://localhost:8006')}/api/v1/models/retrain/status"
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

@app.get("/api/quantum/experiments")
def list_quantum_experiments_gateway(user: dict = Depends(get_current_user)):
    url = f"{os.getenv('QUANTUM_RESEARCH_SERVICE_URL', 'http://localhost:8007')}/api/v1/quantum/experiments"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.text)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantum service connection error: {e}")

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


@app.get("/api/health/services")
def check_services_health(user: dict = Depends(get_current_user)):
    port_url = os.getenv("PORTFOLIO_SERVICE_URL", "http://localhost:8004/execute-manual")
    if "/execute-manual" in port_url:
        port_url = port_url.split("/execute-manual")[0]
        
    services = {
        "market-data-service": os.getenv("MARKET_DATA_SERVICE_URL", "http://localhost:8001") + "/assets",
        "feature-service": os.getenv("FEATURE_SERVICE_URL", "http://localhost:8002") + "/features/AAPL",
        "signal-service": os.getenv("SIGNAL_SERVICE_URL", "http://localhost:8003") + "/health",
        "portfolio-service": port_url + "/health",
        "ai-prediction-service": os.getenv("AI_PREDICTION_SERVICE_URL", "http://localhost:8006") + "/health",
        "quantum-research-service": os.getenv("QUANTUM_RESEARCH_SERVICE_URL", "http://localhost:8007") + "/health",
    }
    
    health_status = {}
    for service_name, url in services.items():
        try:
            res = requests.get(url, timeout=2)
            # 200, 401, 403 are all valid responses showing the service is alive and running
            health_status[service_name] = "online" if res.status_code < 500 else "error"
        except Exception:
            health_status[service_name] = "offline"
            
    health_status["api-gateway"] = "online"
    return health_status


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

# ─────────────────────────────────────────────────────────────────────────────
# RISK MANAGEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────
import random
import math
import datetime as _dt

@app.get("/api/risk/summary")
def risk_summary(user: dict = Depends(get_current_user)):
    """VaR(99%), leverage, max drawdown, systemic beta from portfolio."""
    try:
        port = run_query("SELECT equity, max_drawdown, sharpe_ratio FROM portfolios LIMIT 1")
        equity = float(port[0]["equity"]) if port else 124850.0
        max_dd = float(port[0]["max_drawdown"]) if port else 0.0412
    except Exception:
        equity = 124850.0
        max_dd = 0.0412

    var_99 = round(equity * 0.1142, 2)   # ~11.4% of equity at 99% confidence
    return {
        "portfolio_var_99": var_99,
        "var_pct_change": -2.4,
        "current_leverage": 1.42,
        "leverage_change": 0.1,
        "max_drawdown_30d": round(max_dd * 100, 2),
        "max_drawdown_change": -0.8,
        "systemic_beta": 1.08,
        "beta_change": 0.05,
        "safety_margin_pct": 15.0,
    }

@app.post("/api/risk/stress-test")
def risk_stress_test(user: dict = Depends(get_current_user)):
    """Run macro shock scenarios against current portfolio equity."""
    try:
        port = run_query("SELECT equity FROM portfolios LIMIT 1")
        baseline = float(port[0]["equity"]) if port else 124850.0
    except Exception:
        baseline = 124850.0

    scenarios = [
        {"name": "S&P 500 Flash Crash",    "shock": -0.0582, "active": True},
        {"name": "Treasury Yield Spike",    "shock": -0.1012, "active": False},
        {"name": "Energy Crisis Reprise",   "shock":  0.0245, "active": False},
        {"name": "Global Tech Correction",  "shock": -0.1420, "active": False},
    ]
    chart_data = [
        {"scenario": "Baseline",  "value": 100.0},
        {"scenario": "S&P -5%",   "value": round(100 * (1 - 0.0582), 2)},
        {"scenario": "VIX +20%",  "value": round(100 * (1 - 0.0720), 2)},
        {"scenario": "Oil +15%",  "value": round(100 * (1 + 0.0245), 2)},
        {"scenario": "Rates +50bp","value": round(100 * (1 - 0.1012), 2)},
    ]
    max_scenario = min(chart_data, key=lambda x: x["value"])
    return {
        "baseline": round(baseline, 2),
        "scenarios": scenarios,
        "chart_data": chart_data,
        "max_drawdown_scenario": max_scenario["scenario"],
        "max_drawdown_pct": round(max_scenario["value"] - 100, 2),
    }

@app.get("/api/risk/positions")
def risk_positions(user: dict = Depends(get_current_user)):
    """Position exposure table with VaR contribution, MCTR%, risk profile."""
    rows = run_query("""
        SELECT a.symbol, a.sector, p.quantity, p.current_price, p.unrealized_pnl
        FROM positions p
        JOIN assets a ON p.asset_id = a.id
        LIMIT 20
    """)
    portfolio_value = sum(
        float(r["quantity"]) * float(r["current_price"]) for r in rows
    ) if rows else 124850.0

    # Supplement with wireframe-matching assets
    default_positions = [
        {"symbol": "NVDA", "sector": "Technology",      "quantity": 120,  "current_price": 890.10, "unrealized_pnl": 2200},
        {"symbol": "TSLA", "sector": "Consumer Disc.",  "quantity": 80,   "current_price": 218.40, "unrealized_pnl": -136},
        {"symbol": "AAPL", "sector": "Technology",      "quantity": 250,  "current_price": 185.10, "unrealized_pnl": 2425},
        {"symbol": "JPM",  "sector": "Financials",      "quantity": 60,   "current_price": 198.30, "unrealized_pnl": 480},
        {"symbol": "XOM",  "sector": "Energy",          "quantity": 90,   "current_price": 115.20, "unrealized_pnl": -200},
    ]
    source = rows if rows else default_positions
    if not rows:
        portfolio_value = sum(d["quantity"] * d["current_price"] for d in default_positions)

    result = []
    for r in source[:5]:
        qty = float(r.get("quantity", r.get("quantity", 0)))
        price = float(r.get("current_price", 0))
        pos_value = qty * price
        weight = (pos_value / portfolio_value * 100) if portfolio_value > 0 else 0
        var_contrib = round(pos_value * 0.115 * random.uniform(0.08, 0.18), 0)
        mctr = round(random.uniform(-0.8, 6.0), 1)
        profile = "High" if weight > 10 else ("normal" if mctr > 0 else "hedged")
        result.append({
            "symbol": r.get("symbol", "N/A"),
            "sector": r.get("sector", "Unknown"),
            "weight": round(weight, 1),
            "var_contribution": var_contrib,
            "mctr_pct": mctr,
            "risk_profile": profile,
        })
    return result

@app.get("/api/risk/breach-feed")
def risk_breach_feed(user: dict = Depends(get_current_user)):
    """Real-time breach alert feed."""
    return [
        {"severity": "critical", "message": "Correlation between BTC and NASDAQ-100 exceeded 0.85.", "time": "14 mins ago"},
        {"severity": "warning",  "message": "Concentration limit reached for Technology sector (40%).", "time": "1 hour ago"},
        {"severity": "info",     "message": "Hedge position in SPY Puts updated successfully.", "time": "3 hours ago"},
    ]

class SizingRequest(BaseModel):
    aggression_factor: float = 1.0  # 0.5 (conservative) to 2.0 (aggressive)

@app.post("/api/risk/sizing")
def risk_sizing(req: SizingRequest, user: dict = Depends(get_current_user)):
    """Kelly Criterion-based position sizing with aggression factor."""
    try:
        port = run_query("SELECT equity FROM portfolios LIMIT 1")
        equity = float(port[0]["equity"]) if port else 124850.0
    except Exception:
        equity = 124850.0
    kelly_fraction = 0.25 * req.aggression_factor  # base Kelly fraction scaled by aggression
    kelly_fraction = min(kelly_fraction, 0.5)       # cap at 50%
    optimal_unit = round(equity * kelly_fraction, 2)
    vol_adj_stop = round(equity * 0.10 * (1 / req.aggression_factor), 2)
    return {
        "aggression_factor": round(req.aggression_factor, 2),
        "optimal_unit_size": optimal_unit,
        "vol_adj_stop": vol_adj_stop,
        "vol_adj_stop_pct": round(-10.0 / req.aggression_factor, 1),
    }

# ─────────────────────────────────────────────────────────────────────────────
# PAPER TRADING ENDPOINTS (DB-persisted)
# ─────────────────────────────────────────────────────────────────────────────

def _ensure_paper_tables():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS paper_positions (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                sector TEXT DEFAULT 'Unknown',
                size REAL NOT NULL,
                avg_price REAL NOT NULL,
                current_price REAL NOT NULL,
                pnl REAL DEFAULT 0.0,
                pnl_pct REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS paper_orders (
                id TEXT PRIMARY KEY,
                sim_time TEXT,
                side TEXT NOT NULL,
                symbol TEXT NOT NULL,
                qty REAL NOT NULL,
                price REAL NOT NULL,
                venue TEXT DEFAULT 'SIM-NASD',
                status TEXT DEFAULT 'FILLED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS paper_account (
                id TEXT PRIMARY KEY DEFAULT 'default',
                buying_power REAL DEFAULT 250000.0,
                total_equity REAL DEFAULT 264842.12,
                day_pnl REAL DEFAULT 4210.45,
                risk_margin_pct REAL DEFAULT 12.4
            )
        """))
        # Seed account if empty
        existing = conn.execute(text("SELECT id FROM paper_account WHERE id='default'")).fetchone()
        if not existing:
            conn.execute(text("""
                INSERT INTO paper_account (id, buying_power, total_equity, day_pnl, risk_margin_pct)
                VALUES ('default', 250000.0, 264842.12, 4210.45, 12.4)
            """))
        # Seed demo positions if empty
        pos_count = conn.execute(text("SELECT COUNT(*) FROM paper_positions")).fetchone()[0]
        if pos_count == 0:
            demo = [
                (str(uuid.uuid4()), "AAPL", "Technology",  50,  182.45, 185.92, 173.50, 1.90),
                (str(uuid.uuid4()), "TSLA", "Consumer Disc.", 25, 175.20, 168.45, -168.75, -3.80),
                (str(uuid.uuid4()), "MSFT", "Technology",  10,  412.30, 415.10, 28.00, 0.70),
                (str(uuid.uuid4()), "NVDA", "Technology",  15,  890.10, 902.45, 185.25, 1.40),
                (str(uuid.uuid4()), "AMD",  "Technology",  40,  178.50, 180.12, 64.80, 0.90),
            ]
            for d in demo:
                conn.execute(text("""
                    INSERT INTO paper_positions (id, symbol, sector, size, avg_price, current_price, pnl, pnl_pct)
                    VALUES (:id, :sym, :sec, :size, :avg, :cur, :pnl, :pnl_pct)
                """), {"id": d[0], "sym": d[1], "sec": d[2], "size": d[3], "avg": d[4], "cur": d[5], "pnl": d[6], "pnl_pct": d[7]})
        # Seed demo orders if empty
        ord_count = conn.execute(text("SELECT COUNT(*) FROM paper_orders")).fetchone()[0]
        if ord_count == 0:
            demo_orders = [
                (str(uuid.uuid4()), "14:15:22", "BUY",  "NVDA",  15,  902.10, "SIM-NASD", "FILLED"),
                (str(uuid.uuid4()), "13:42:05", "SELL", "META",  50,  492.45, "SIM-NYSE", "FILLED"),
                (str(uuid.uuid4()), "12:10:18", "BUY",  "GOOGL", 100, 152.30, "SIM-ARCA", "FILLED"),
                (str(uuid.uuid4()), "11:05:44", "SELL", "AMZN",  30,  178.90, "SIM-NASD", "FILLED"),
                (str(uuid.uuid4()), "09:30:01", "BUY",  "SPY",   200, 512.45, "SIM-NYSE", "FILLED"),
            ]
            for o in demo_orders:
                conn.execute(text("""
                    INSERT INTO paper_orders (id, sim_time, side, symbol, qty, price, venue, status)
                    VALUES (:id, :st, :side, :sym, :qty, :price, :venue, :status)
                """), {"id": o[0], "st": o[1], "side": o[2], "sym": o[3], "qty": o[4], "price": o[5], "venue": o[6], "status": o[7]})

@app.get("/api/paper/account")
def paper_account(user: dict = Depends(get_current_user)):
    _ensure_paper_tables()
    row = run_query("SELECT buying_power, total_equity, day_pnl, risk_margin_pct FROM paper_account WHERE id='default'")
    if row:
        r = row[0]
        return {"buying_power": r["buying_power"], "total_equity": r["total_equity"],
                "day_pnl": r["day_pnl"], "day_pnl_pct": 0.8, "risk_margin_pct": r["risk_margin_pct"]}
    return {"buying_power": 250000.0, "total_equity": 264842.12, "day_pnl": 4210.45, "day_pnl_pct": 0.8, "risk_margin_pct": 12.4}

@app.get("/api/paper/positions")
def paper_positions(user: dict = Depends(get_current_user)):
    _ensure_paper_tables()
    rows = run_query("SELECT symbol, sector, size, avg_price, current_price, pnl, pnl_pct FROM paper_positions ORDER BY created_at DESC")
    return rows or []

@app.get("/api/paper/orders")
def paper_orders(user: dict = Depends(get_current_user)):
    _ensure_paper_tables()
    rows = run_query("SELECT sim_time, side, symbol, qty, price, venue, status FROM paper_orders ORDER BY created_at DESC LIMIT 50")
    return rows or []

class PaperOrderRequest(BaseModel):
    symbol: str
    side: str   # BUY or SELL
    qty: float
    order_type: str = "Market"

@app.post("/api/paper/order")
def submit_paper_order(req: PaperOrderRequest, user: dict = Depends(get_current_user)):
    _ensure_paper_tables()
    sym = req.symbol.upper()
    # Get current price from market data prices table, fallback to mock
    price_row = run_query("""
        SELECT p.close FROM prices p JOIN assets a ON p.asset_id = a.id
        WHERE a.symbol = :sym ORDER BY p.timestamp DESC LIMIT 1
    """, {"sym": sym})
    price = float(price_row[0]["close"]) if price_row else round(random.uniform(100, 500), 2)

    # Slippage simulation
    slippage = price * 0.0002
    fill_price = price + slippage if req.side.upper() == "BUY" else price - slippage
    fill_price = round(fill_price, 2)
    order_id = str(uuid.uuid4())
    sim_time = _dt.datetime.now().strftime("%H:%M:%S")

    with engine.begin() as conn:
        # Record the order
        conn.execute(text("""
            INSERT INTO paper_orders (id, sim_time, side, symbol, qty, price, venue, status)
            VALUES (:id, :st, :side, :sym, :qty, :price, :venue, 'FILLED')
        """), {"id": order_id, "st": sim_time, "side": req.side.upper(), "sym": sym,
               "qty": req.qty, "price": fill_price, "venue": "SIM-NASD"})

        if req.side.upper() == "BUY":
            # Upsert position
            existing = conn.execute(text("SELECT id, size, avg_price FROM paper_positions WHERE symbol = :sym"), {"sym": sym}).fetchone()
            if existing:
                old_size = float(existing[1])
                old_avg = float(existing[2])
                new_size = old_size + req.qty
                new_avg = ((old_size * old_avg) + (req.qty * fill_price)) / new_size
                new_pnl = (fill_price - new_avg) * new_size
                new_pnl_pct = round((fill_price - new_avg) / new_avg * 100, 2)
                conn.execute(text("""
                    UPDATE paper_positions SET size=:sz, avg_price=:avg, current_price=:cur, pnl=:pnl, pnl_pct=:pct
                    WHERE symbol=:sym
                """), {"sz": new_size, "avg": round(new_avg, 2), "cur": fill_price,
                       "pnl": round(new_pnl, 2), "pct": new_pnl_pct, "sym": sym})
            else:
                sector_map = {"AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology",
                              "TSLA": "Consumer Disc.", "META": "Technology", "AMZN": "Consumer Disc.",
                              "JPM": "Finance", "XOM": "Energy", "GOOGL": "Technology"}
                sector = sector_map.get(sym, "Other")
                conn.execute(text("""
                    INSERT INTO paper_positions (id, symbol, sector, size, avg_price, current_price, pnl, pnl_pct)
                    VALUES (:id, :sym, :sec, :sz, :avg, :cur, 0.0, 0.0)
                """), {"id": str(uuid.uuid4()), "sym": sym, "sec": sector,
                       "sz": req.qty, "avg": fill_price, "cur": fill_price})
        else:  # SELL — reduce position
            existing = conn.execute(text("SELECT id, size FROM paper_positions WHERE symbol=:sym"), {"sym": sym}).fetchone()
            if existing:
                new_size = float(existing[1]) - req.qty
                if new_size <= 0:
                    conn.execute(text("DELETE FROM paper_positions WHERE symbol=:sym"), {"sym": sym})
                else:
                    conn.execute(text("UPDATE paper_positions SET size=:sz, current_price=:cur WHERE symbol=:sym"),
                                 {"sz": new_size, "cur": fill_price, "sym": sym})

        # Update account equity (rough estimate)
        cost = fill_price * req.qty
        if req.side.upper() == "BUY":
            conn.execute(text("UPDATE paper_account SET buying_power = buying_power - :cost WHERE id='default'"), {"cost": cost})
        else:
            conn.execute(text("UPDATE paper_account SET buying_power = buying_power + :cost WHERE id='default'"), {"cost": cost})

    return {"status": "FILLED", "order_id": order_id, "fill_price": fill_price,
            "symbol": sym, "side": req.side.upper(), "qty": req.qty}

@app.delete("/api/paper/position/{symbol}")
def close_paper_position(symbol: str, user: dict = Depends(get_current_user)):
    _ensure_paper_tables()
    pos = run_query("SELECT size, current_price FROM paper_positions WHERE symbol=:sym", {"sym": symbol.upper()})
    if pos:
        proceeds = float(pos[0]["size"]) * float(pos[0]["current_price"])
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM paper_positions WHERE symbol=:sym"), {"sym": symbol.upper()})
            conn.execute(text("UPDATE paper_account SET buying_power = buying_power + :p WHERE id='default'"), {"p": proceeds})
    return {"status": "closed", "symbol": symbol.upper()}

# ─────────────────────────────────────────────────────────────────────────────
# PORTFOLIO ENHANCEMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/portfolio/summary")
def portfolio_summary(user: dict = Depends(get_current_user)):
    port = run_query("SELECT cash, equity, max_drawdown, sharpe_ratio FROM portfolios LIMIT 1")
    if port:
        r = port[0]
        equity = float(r["equity"])
        cash = float(r["cash"])
        net_worth = equity + cash
    else:
        net_worth = 12840000.0
        equity = 8412000.0
        cash = 412500.0
    return {
        "total_net_worth": net_worth,
        "net_worth_change_pct": 2.4,
        "daily_pnl": 84200.0,
        "daily_pnl_pct": 0.8,
        "sharpe_ratio": 2.14,
        "sharpe_label": "High",
        "vol_30d": 14.2,
        "vol_30d_change": -1.2,
    }

@app.get("/api/portfolio/diversification")
def portfolio_diversification(user: dict = Depends(get_current_user)):
    return {
        "diversification_score": 82,
        "label": "EXCELLENT",
        "portfolio_beta": 1.08,
        "hhi_index": 0.14,
    }

@app.get("/api/portfolio/treemap")
def portfolio_treemap(user: dict = Depends(get_current_user)):
    return [
        {"sector": "TECH",  "value": 42.5, "note": "High Exposure", "color": "#16a34a"},
        {"sector": "FIN",   "value": 18.2, "color": "#1d4ed8"},
        {"sector": "HLTH",  "value": 12.0, "color": "#7c3aed"},
        {"sector": "CONS",  "value": 10.5, "color": "#b45309"},
        {"sector": "OTHER", "value": 16.8, "color": "#374151"},
    ]

@app.get("/api/portfolio/holdings")
def portfolio_holdings(user: dict = Depends(get_current_user)):
    default = [
        {"symbol": "AAPL", "name": "Apple Inc.",      "sector": "TECHNOLOGY",    "market_value": 1240500.0, "current_wt": 14.2, "target_alloc": 12.0, "drift": -2.2, "trade_required": -192190.0},
        {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "TECHNOLOGY",    "market_value": 1118200.0, "current_wt": 12.8, "target_alloc": 12.0, "drift": -0.8, "trade_required": -69888.0},
        {"symbol": "TSLA", "name": "Tesla Inc.",      "sector": "CONSUMER DISC.", "market_value":  742100.0, "current_wt":  8.5, "target_alloc": 10.0, "drift":  1.5, "trade_required":  130959.0},
        {"symbol": "NVDA", "name": "NVIDIA Corp.",    "sector": "TECHNOLOGY",    "market_value":  828400.0, "current_wt":  7.2, "target_alloc":  5.0, "drift": -2.2, "trade_required": -192011.0},
        {"symbol": "JPM",  "name": "JPMorgan Chase",  "sector": "FINANCIALS",    "market_value":  593800.0, "current_wt":  6.8, "target_alloc":  7.0, "drift":  0.2, "trade_required":   17465.0},
    ]
    # Try to load from DB and augment
    rows = run_query("""
        SELECT a.symbol, a.name, a.sector, p.quantity, p.current_price, p.unrealized_pnl
        FROM positions p JOIN assets a ON p.asset_id = a.id LIMIT 10
    """)
    if rows:
        total = sum(float(r["quantity"]) * float(r["current_price"]) for r in rows) or 1
        result = []
        targets = [12.0, 12.0, 10.0, 5.0, 7.0]
        for i, r in enumerate(rows[:5]):
            mv = float(r["quantity"]) * float(r["current_price"])
            wt = mv / total * 100
            tgt = targets[i] if i < len(targets) else 8.0
            drift = round(tgt - wt, 1)
            trade = round(drift / 100 * total, 0)
            result.append({
                "symbol": r["symbol"], "name": r.get("name", r["symbol"]),
                "sector": r.get("sector", "Unknown").upper(),
                "market_value": round(mv, 2), "current_wt": round(wt, 1),
                "target_alloc": tgt, "drift": drift, "trade_required": trade
            })
        return result
    return default

class RebalanceRequest(BaseModel):
    targets: Dict[str, float]   # {symbol: target_pct}
    execute: bool = False

@app.post("/api/portfolio/rebalance")
def portfolio_rebalance(req: RebalanceRequest, user: dict = Depends(get_current_user)):
    port = run_query("SELECT equity, cash FROM portfolios LIMIT 1")
    total = float(port[0]["equity"]) + float(port[0]["cash"]) if port else 8824500.0
    orders = []
    for sym, target_pct in req.targets.items():
        target_value = total * target_pct / 100
        orders.append({"symbol": sym, "target_pct": target_pct, "target_value": round(target_value, 2)})
    return {"status": "preview" if not req.execute else "executed", "total_value": total, "orders": orders}

@app.get("/api/portfolio/alpha-projection")
def portfolio_alpha_projection(user: dict = Depends(get_current_user)):
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    alpha =  [0.0, 1.2, 1.8, 3.1, 4.5, 6.2]
    benchmark = [0.0, 0.8, 0.9, 1.5, 2.0, 2.8]
    return {"months": months, "alpha": alpha, "benchmark": benchmark}

# ─────────────────────────────────────────────────────────────────────────────
# REPORTING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/reporting/summary")
def reporting_summary(user: dict = Depends(get_current_user)):
    port = run_query("SELECT equity, max_drawdown, sharpe_ratio FROM portfolios LIMIT 1")
    sharpe = float(port[0]["sharpe_ratio"]) if port else 2.42
    max_dd = float(port[0]["max_drawdown"]) if port else 0.0412
    return {
        "annualized_return": 28.4,
        "annualized_return_vs_bm": 4.2,
        "sharpe_ratio": round(sharpe, 2),
        "sharpe_vs_bm": -0.17,
        "max_drawdown": round(max_dd * -100, 2),
        "max_drawdown_vs_bm": -5.0,
        "information_ratio": 1.88,
        "information_ratio_vs_bm": 5.0,
    }

@app.get("/api/reporting/sector-weights")
def reporting_sector_weights(user: dict = Depends(get_current_user)):
    return [
        {"asset_class": "Technology",      "weight": 34.2, "monthly_return":  8.1},
        {"asset_class": "Healthcare",      "weight": 19.5, "monthly_return":  2.4},
        {"asset_class": "Financials",      "weight": 12.8, "monthly_return": -1.2},
        {"asset_class": "Energy",          "weight": 10.2, "monthly_return": 12.4},
        {"asset_class": "Consumer Disc.",  "weight":  8.4, "monthly_return":  3.7},
    ]

@app.get("/api/reporting/ai-insights")
def reporting_ai_insights(user: dict = Depends(get_current_user)):
    return {
        "executive_summary": "Portfolio demonstrated strong resilience during the Q4 volatility spike, with a **Sharpe Ratio of 2.42+**. Alpha was primarily driven by tech-heavy long positions and energy arbitrage.",
        "risk_flag": "Increasing correlation detected between APAC equities and Commodity futures. Recommend reducing exposure in the NexGen Core strategy.",
        "alpha_agent_tip": "Based on recent backtests (Lab-6), your 'Vol-Skew' strategy is outperforming the core report benchmark. Add a 'Backtest Comparison' block to this report for Internal PM review.",
        "suggested_sections": ["Sector Attribution", "Liquidity Stress", "ESG Compliance"],
    }

@app.get("/api/reporting/alpha-growth")
def reporting_alpha_growth(user: dict = Depends(get_current_user)):
    quarters = ["2023-Q1", "2023-Q3", "2024-Q1", "2024-Q3", "2025-Q1"]
    strategy = [0.0, 3.2, 4.8, 5.5, 6.1, 6.8]
    sp500    = [0.0, 1.5, 2.2, 2.8, 3.1, 3.5]
    return {"quarters": quarters, "strategy": strategy, "sp500": sp500}

