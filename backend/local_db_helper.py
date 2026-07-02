import os
import logging
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, text

logger = logging.getLogger("quantx.local_db_helper")

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL,
    name TEXT,
    asset_class TEXT DEFAULT 'equity',
    sector TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prices (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    interval_type TEXT DEFAULT '1d',
    UNIQUE (asset_id, timestamp, interval_type)
);

CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    feature_name TEXT NOT NULL,
    feature_value REAL NOT NULL,
    version TEXT DEFAULT 'v1',
    UNIQUE (asset_id, timestamp, feature_name, version)
);

CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    model_name TEXT NOT NULL,
    predicted_return REAL NOT NULL,
    confidence_score REAL DEFAULT 1.0,
    horizon TEXT DEFAULT '1d',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    signal_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    source_service TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolios (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    cash REAL NOT NULL DEFAULT 100000.00,
    equity REAL NOT NULL DEFAULT 100000.00,
    max_drawdown REAL DEFAULT 0.0000,
    sharpe_ratio REAL DEFAULT 0.0000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    quantity REAL NOT NULL DEFAULT 0.00000000,
    average_entry_price REAL NOT NULL,
    current_price REAL NOT NULL,
    unrealized_pnl REAL NOT NULL DEFAULT 0.000000,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (portfolio_id, asset_id)
);

CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    execution_cost REAL DEFAULT 0.00,
    slippage REAL DEFAULT 0.000000,
    status TEXT DEFAULT 'EXECUTED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_metrics_history (
    id TEXT PRIMARY KEY,
    portfolio_id TEXT REFERENCES portfolios(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    var_95 REAL NOT NULL,
    cvar_95 REAL NOT NULL,
    leverage_ratio REAL NOT NULL,
    exposure_limit REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    model_id TEXT,
    owner_id TEXT,
    name TEXT NOT NULL,
    params TEXT,
    results TEXT,
    mlflow_run_id TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quantum_experiments (
    id TEXT PRIMARY KEY,
    parent_experiment TEXT REFERENCES experiments(id) ON DELETE CASCADE,
    backend TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    qubits INTEGER NOT NULL,
    circuit_depth INTEGER NOT NULL,
    shots INTEGER NOT NULL,
    quantum_confidence REAL,
    classical_lift REAL
);
"""

def create_sqlite_engine_and_init():
    sqlite_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../quantx_local.db"))
    url = f"sqlite:///{sqlite_db_path}"
    logger.info(f"Creating local SQLite engine: {url}")
    engine = create_engine(url, connect_args={"check_same_thread": False})
    
    # Initialize the tables
    with engine.begin() as conn:
        # SQLite doesn't support executing multiple statements via execute(text(...)) directly in some setups
        # so we split by semicolon
        for stmt in SQLITE_SCHEMA.split(";"):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
                
    logger.info("Local SQLite database tables initialized successfully.")
    return engine, url

def get_database_engine(default_url, service_logger=None):
    log = service_logger or logger
    try:
        if default_url.startswith("postgresql"):
            # Attempt to connect to Postgres with a short timeout
            engine = create_engine(default_url, connect_args={"connect_timeout": 2})
            with engine.connect() as conn:
                pass
            log.info("Successfully connected to PostgreSQL database.")
            return engine, default_url
        else:
            engine = create_engine(default_url)
            return engine, default_url
    except Exception as e:
        log.warning(f"Could not connect to PostgreSQL ({default_url}). Falling back to SQLite. Error: {e}")
        return create_sqlite_engine_and_init()
