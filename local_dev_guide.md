# QuantX Local Development Guide

This guide details how to launch and run the QuantX services locally in offline/SQLite fallback mode.

## Startup Commands

### 1. Database Initialization
Ensure the local SQLite database is populated with mock assets, prices, portfolios, and positions:
```bash
.venv\Scripts\python.exe backend/populate_db.py
```

### 2. API Gateway Service (Port 8005)
Navigate to the API Gateway directory and run the uvicorn server:
```bash
cd backend/api-gateway
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8005
```

### 3. Market Data Service (Port 8001)
Navigate to the Market Data Service directory and run the uvicorn server in offline mode:
```bash
cd backend/market-data-service
$env:OFFLINE_MODE="true"
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### 4. Feature Service (Port 8002)
Navigate to the Feature Service directory and run the uvicorn server:
```bash
cd backend/feature-service
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

### 5. Portfolio Service (Port 8004)
Navigate to the Portfolio Service directory and run the uvicorn server:
```bash
cd backend/portfolio-service
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8004
```

### 6. Signal Ingestion & Decision Service (Port 8003)
Navigate to the Signal Service directory and run the uvicorn server:
```bash
cd backend/signal-service
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8003
```

### 7. Next.js Dashboard Frontend (Port 3000)
Navigate to the frontend directory and start the dev server:
```bash
cd frontend/dashboard
npm run dev
```

---

## Service URLs and Endpoints

| Service / App | Host / URL | Type | Description |
| :--- | :--- | :--- | :--- |
| **Next.js Dashboard** | `http://localhost:3000` | Web UI | Main user interface and dashboards |
| **API Gateway** | `http://127.0.0.1:8005` | REST / WS | Primary entry point for frontend |
| **Market Data Service** | `http://127.0.0.1:8001` | REST | Live price simulation and ingestion |
| **Feature Service** | `http://127.0.0.1:8002` | REST | Feature store values fetcher |
| **Portfolio Service** | `http://127.0.0.1:8004` | REST | Execution and optimization engine |
| **Signal Service** | `http://127.0.0.1:8003` | REST | Consumable signals generator |

---

## Health Checks and Key REST Endpoints

### 1. API Gateway Endpoints
- **Health Check:** `GET http://127.0.0.1:8005/api/health`
- **Portfolio Details:** `GET http://127.0.0.1:8005/api/portfolio`
- **Active Signals:** `GET http://127.0.0.1:8005/api/signals`
- **Risk Metrics History:** `GET http://127.0.0.1:8005/api/risk`
- **Market Data prices (AAPL):** `GET http://127.0.0.1:8005/api/market-data?symbol=AAPL`
- **Run Backtest Strategy:** `POST http://127.0.0.1:8005/api/backtest`
- **Live Price Tick WebSocket:** `ws://127.0.0.1:8005/ws/live`

### 2. Market Data Endpoints
- **List Assets:** `GET http://127.0.0.1:8001/assets`
- **Trigger OHLCV Ingestion:** `POST http://127.0.0.1:8001/ingest/{SYMBOL}`

### 3. Feature Service Endpoints
- **Get Latest Features:** `GET http://127.0.0.1:8002/features/{SYMBOL}`

### 4. Portfolio Service Endpoints
- **Health Check:** `GET http://127.0.0.1:8004/health`
- **Execute Manual Trade:** `POST http://127.0.0.1:8004/execute-manual`
- **Optimize & Rebalance:** `POST http://127.0.0.1:8004/rebalance`

### 5. Signal Service Endpoints
- **Health Check:** `GET http://127.0.0.1:8003/health`
- **Trigger Signal Decision:** `POST http://127.0.0.1:8003/mock-trigger`
