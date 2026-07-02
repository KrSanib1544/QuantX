-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    asset_class VARCHAR(50) DEFAULT 'equity',
    sector VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on symbol for speed
CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);

-- 2. PRICES TABLE (Timeseries data)
CREATE TABLE IF NOT EXISTS prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open NUMERIC(16, 6) NOT NULL,
    high NUMERIC(16, 6) NOT NULL,
    low NUMERIC(16, 6) NOT NULL,
    close NUMERIC(16, 6) NOT NULL,
    volume NUMERIC(20, 4) NOT NULL,
    interval_type VARCHAR(10) DEFAULT '1d',
    UNIQUE (asset_id, timestamp, interval_type)
);

CREATE INDEX IF NOT EXISTS idx_prices_asset_timestamp ON prices(asset_id, timestamp DESC);

-- 3. FEATURES TABLE
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    feature_value NUMERIC(16, 6) NOT NULL,
    version VARCHAR(20) DEFAULT 'v1',
    UNIQUE (asset_id, timestamp, feature_name, version)
);

CREATE INDEX IF NOT EXISTS idx_features_asset_timestamp ON features(asset_id, timestamp DESC);

-- 4. PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    model_name VARCHAR(50) NOT NULL,
    predicted_return NUMERIC(10, 6) NOT NULL,
    confidence_score NUMERIC(5, 4) DEFAULT 1.0,
    horizon VARCHAR(10) DEFAULT '1d',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_asset_timestamp ON predictions(asset_id, timestamp DESC);

-- 5. SIGNALS TABLE
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    signal_type VARCHAR(10) NOT NULL, -- BUY, SELL, HOLD
    confidence NUMERIC(5, 4) NOT NULL, -- 0.0000 to 1.0000
    source_service VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_asset_timestamp ON signals(asset_id, timestamp DESC);

-- 6. PORTFOLIOS TABLE
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    cash NUMERIC(16, 2) NOT NULL DEFAULT 100000.00,
    equity NUMERIC(16, 2) NOT NULL DEFAULT 100000.00,
    max_drawdown NUMERIC(5, 4) DEFAULT 0.0000,
    sharpe_ratio NUMERIC(6, 4) DEFAULT 0.0000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. POSITIONS TABLE
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    quantity NUMERIC(16, 8) NOT NULL DEFAULT 0.00000000,
    average_entry_price NUMERIC(16, 6) NOT NULL,
    current_price NUMERIC(16, 6) NOT NULL,
    unrealized_pnl NUMERIC(16, 6) NOT NULL DEFAULT 0.000000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (portfolio_id, asset_id)
);

-- 8. TRADES TABLE
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    side VARCHAR(10) NOT NULL, -- BUY, SELL
    quantity NUMERIC(16, 8) NOT NULL,
    price NUMERIC(16, 6) NOT NULL,
    execution_cost NUMERIC(10, 2) DEFAULT 0.00, -- Commission
    slippage NUMERIC(16, 6) DEFAULT 0.000000,
    status VARCHAR(20) DEFAULT 'EXECUTED', -- EXECUTED, REJECTED, PENDING
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_portfolio_timestamp ON trades(portfolio_id, timestamp DESC);

-- 9. RISK METRICS HISTORY TABLE
CREATE TABLE IF NOT EXISTS risk_metrics_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    var_95 NUMERIC(8, 6) NOT NULL,
    cvar_95 NUMERIC(8, 6) NOT NULL,
    leverage_ratio NUMERIC(6, 4) NOT NULL,
    exposure_limit NUMERIC(16, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_metrics_portfolio_timestamp ON risk_metrics_history(portfolio_id, timestamp DESC);

-- 10. EXPERIMENTS TABLE
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID,
    owner_id UUID,
    name VARCHAR(120) NOT NULL,
    params JSONB,
    results JSONB,
    mlflow_run_id VARCHAR(120),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. QUANTUM EXPERIMENTS TABLE
CREATE TABLE IF NOT EXISTS quantum_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_experiment UUID REFERENCES experiments(id) ON DELETE CASCADE,
    backend VARCHAR(50) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    qubits INT NOT NULL,
    circuit_depth INT NOT NULL,
    shots INT NOT NULL,
    quantum_confidence NUMERIC(5, 4),
    classical_lift NUMERIC(8, 6)
);

