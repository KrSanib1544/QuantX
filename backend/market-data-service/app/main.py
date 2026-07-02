import uvicorn
import logging
import asyncio
import datetime
import yfinance as yf
import os
import random
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, ForeignKey, UUID
import uuid

from .database import engine, Base, get_db, SessionLocal
from .producer import MarketDataProducer

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("market-data-service")

# Define SQLAlchemy models locally for simplicity & independence
class AssetModel(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100))
    asset_class = Column(String(50), default="equity")
    sector = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PriceModel(Base):
    __tablename__ = "prices"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    open = Column(Numeric(16, 6), nullable=False)
    high = Column(Numeric(16, 6), nullable=False)
    low = Column(Numeric(16, 6), nullable=False)
    close = Column(Numeric(16, 6), nullable=False)
    volume = Column(Numeric(20, 4), nullable=False)
    interval_type = Column(String(10), default="1d")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="QuantX Market Data Service", version="1.0.0")
producer = MarketDataProducer(bootstrap_servers=engine.url.host + ":9092" if engine.url.host else "localhost:9092")

# Background Ingestion Loop status
ingestion_task = None
is_ingesting = False

async def fetch_and_publish_ohlcv(db: Session, asset_id, asset_symbol: str):
    try:
        offline = os.getenv("OFFLINE_MODE", "true").lower() in ("true", "1", "yes")
        if offline:
            # Generate mock price based on last price in DB
            latest_price_rec = db.query(PriceModel).filter_by(asset_id=asset_id).order_by(PriceModel.timestamp.desc()).first()
            if latest_price_rec:
                last_close = float(latest_price_rec.close)
            else:
                if "USD" in asset_symbol and "=" in asset_symbol:  # Forex symbol e.g., EURUSD=X
                    last_close = 1.10
                elif len(asset_symbol) > 10:  # Options contract symbol format e.g. AAPL260116C00180000
                    last_close = 15.0
                elif asset_symbol == "BTC-USD":
                    last_close = 60000.0
                else:
                    last_close = 180.0
            
            timestamp = datetime.datetime.utcnow()
            
            # Differentiate changes based on asset class
            is_forex = "USD" in asset_symbol and "=" in asset_symbol
            is_option = len(asset_symbol) > 10
            
            if is_forex:
                change = random.normalvariate(0.0, 0.0008)  # smaller moves for currencies
                volume_val = float(random.randint(50000, 1000000))
            elif is_option:
                change = random.normalvariate(0.001, 0.04)   # larger swings for derivatives
                volume_val = float(random.randint(10, 5000))
            else:
                change = random.normalvariate(0.0001, 0.005) # standard equities/crypto
                volume_val = float(random.randint(1000, 100000))
                
            close_val = last_close * (1.0 + change)
            open_val = last_close
            high_val = max(open_val, close_val) * (1.0 + abs(random.normalvariate(0, 0.001)))
            low_val = min(open_val, close_val) * (1.0 - abs(random.normalvariate(0, 0.001)))
            
            price_db = PriceModel(
                asset_id=asset_id,
                timestamp=timestamp,
                open=open_val,
                high=high_val,
                low=low_val,
                close=close_val,
                volume=volume_val,
                interval_type="1d"
            )
            db.add(price_db)
            db.commit()
            logger.info(f"[OFFLINE] Generated price for {asset_symbol} ({'Forex' if is_forex else 'Option' if is_option else 'Equity'}) at {timestamp}: Close={close_val:.4f}")
            
            # Publish to Kafka
            payload = {
                "symbol": asset_symbol,
                "timestamp": timestamp.isoformat(),
                "open": open_val,
                "high": high_val,
                "low": low_val,
                "close": close_val,
                "volume": volume_val,
                "interval": "1d"
            }
            producer.send_market_data(asset_symbol, payload)
            return

        ticker = yf.Ticker(asset_symbol)
        # Download last 1 day of data
        df = ticker.history(period="1d")
        if df.empty:
            logger.warning(f"No price data returned for {asset_symbol}")
            return
            
        latest = df.iloc[-1]
        timestamp = df.index[-1].to_pydatetime()
        
        # Save to DB
        price_db = PriceModel(
            asset_id=asset_id,
            timestamp=timestamp,
            open=float(latest["Open"]),
            high=float(latest["High"]),
            low=float(latest["Low"]),
            close=float(latest["Close"]),
            volume=float(latest["Volume"]),
            interval_type="1d"
        )
        
        # Check duplicate
        existing = db.query(PriceModel).filter_by(
            asset_id=asset_id, 
            timestamp=timestamp, 
            interval_type="1d"
        ).first()
        
        if not existing:
            db.add(price_db)
            db.commit()
            logger.info(f"Saved price for {asset_symbol} at {timestamp}")
        
        # Publish to Kafka
        payload = {
            "symbol": asset_symbol,
            "timestamp": timestamp.isoformat(),
            "open": float(latest["Open"]),
            "high": float(latest["High"]),
            "low": float(latest["Low"]),
            "close": float(latest["Close"]),
            "volume": float(latest["Volume"]),
            "interval": "1d"
        }
        producer.send_market_data(asset_symbol, payload)
        
    except Exception as e:
        logger.error(f"Error fetching data for {asset_symbol}: {e}")

async def ingestion_loop():
    global is_ingesting
    is_ingesting = True
    logger.info("Market data ingestion loop started.")
    while is_ingesting:
        db = SessionLocal()
        try:
            active_assets = db.query(AssetModel).filter(AssetModel.is_active == True).all()
            assets_data = [{"id": a.id, "symbol": a.symbol} for a in active_assets]
            for asset_info in assets_data:
                await fetch_and_publish_ohlcv(db, asset_info["id"], asset_info["symbol"])
                await asyncio.sleep(1) # Small gap between assets
        except Exception as e:
            logger.error(f"Error in ingestion loop: {e}")
        finally:
            db.close()
        
        # Run every 60 seconds (or shorter for testing, e.g. 10s)
        await asyncio.sleep(10)

def fetch_historical_ohlcv(db: Session, asset: AssetModel, period: str = "1y"):
    try:
        offline = os.getenv("OFFLINE_MODE", "true").lower() in ("true", "1", "yes")
        if offline:
            logger.info(f"[OFFLINE] Skipping historical data fetch for {asset.symbol} (database populated via script)")
            return

        ticker = yf.Ticker(asset.symbol)
        df = ticker.history(period=period)
        if df.empty:
            logger.warning(f"No historical price data returned for {asset.symbol}")
            return
        
        added_count = 0
        for idx, row in df.iterrows():
            timestamp = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
            existing = db.query(PriceModel).filter_by(
                asset_id=asset.id,
                timestamp=timestamp,
                interval_type="1d"
            ).first()
            
            if not existing:
                price_db = PriceModel(
                    asset_id=asset.id,
                    timestamp=timestamp,
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(row["Volume"]),
                    interval_type="1d"
                )
                db.add(price_db)
                added_count += 1
        db.commit()
        logger.info(f"Loaded {added_count} historical price records for {asset.symbol}")
    except Exception as e:
        logger.error(f"Error fetching historical data for {asset.symbol}: {e}")

@app.on_event("startup")
def startup_event():
    global ingestion_task
    # Pre-populate some assets if database is empty
    db = SessionLocal()
    try:
        count = db.query(AssetModel).count()
        if count == 0:
            default_assets = [
                {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
                {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology"},
                {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Automotive"},
                {"symbol": "BTC-USD", "name": "Bitcoin USD", "sector": "Cryptocurrency"}
            ]
            for asset_data in default_assets:
                db.add(AssetModel(
                    symbol=asset_data["symbol"], 
                    name=asset_data["name"], 
                    sector=asset_data["sector"]
                ))
            db.commit()
            logger.info("Initialized default assets database.")
            
        # Fetch historical prices for any active assets if prices are empty
        prices_count = db.query(PriceModel).count()
        if prices_count == 0:
            logger.info("Database prices table is empty. Fetching historical data (1 year)...")
            active_assets = db.query(AssetModel).filter(AssetModel.is_active == True).all()
            for asset in active_assets:
                fetch_historical_ohlcv(db, asset, period="1y")
    except Exception as e:
        logger.error(f"Failed to populate default assets or historical prices: {e}")
    finally:
        db.close()
        
    # Start loop
    ingestion_task = asyncio.create_task(ingestion_loop())

@app.on_event("shutdown")
def shutdown_event():
    global is_ingesting
    is_ingesting = False
    producer.close()
    logger.info("Market data service shutting down.")

@app.get("/assets")
def list_assets(db: Session = Depends(get_db)):
    return db.query(AssetModel).all()

@app.post("/assets")
def create_asset(symbol: str, name: str, sector: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    existing = db.query(AssetModel).filter_by(symbol=symbol).first()
    if existing:
        raise HTTPException(status_code=400, detail="Asset already exists")
    
    asset = AssetModel(symbol=symbol, name=name, sector=sector)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

@app.post("/ingest/{symbol}")
async def trigger_ingest(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    asset = db.query(AssetModel).filter_by(symbol=symbol).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found. Add it first.")
    
    await fetch_and_publish_ohlcv(db, asset.id, asset.symbol)
    return {"status": "success", "message": f"Ingestion triggered for {symbol}"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
