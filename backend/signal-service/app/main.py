import uvicorn
import logging
import asyncio
import json
import uuid
import datetime
import threading
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
from sqlalchemy import create_engine, text

import sys
import os

# Add parent directories to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
import local_db_helper
from .signal_engine import SignalEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("signal-service")

app = FastAPI(title="QuantX Signal Ingestion & Decision Service", version="1.0.0")

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://quantx_user:quantx_password@localhost:5432/quantx_db")
engine, DATABASE_URL = local_db_helper.get_database_engine(DATABASE_URL, logger)

# Signal Engine
signal_engine = SignalEngine(
    buy_threshold=float(os.getenv("BUY_THRESHOLD", "0.01")),
    sell_threshold=float(os.getenv("SELL_THRESHOLD", "-0.01"))
)

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
FEATURES_TOPIC = "market.features"
SIGNALS_TOPIC = "market.signals"

# Kafka Producer to broadcast generated signals
producer = None
mock_producer = False

try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        key_serializer=lambda k: k.encode('utf-8') if k else None,
        retries=5
    )
    logger.info("Kafka Signals Producer initialized.")
except Exception as e:
    logger.warning(f"Could not connect Kafka Signals Producer. Running in mock mode. Error: {e}")
    mock_producer = True

def send_signal_event(symbol: str, data: Dict[str, Any]):
    if mock_producer:
        logger.info(f"[MOCK KAFKA -> {SIGNALS_TOPIC}] Key: {symbol}, Value: {data}")
        return
    try:
        producer.send(SIGNALS_TOPIC, key=symbol, value=data)
    except Exception as e:
        logger.error(f"Error publishing signal to Kafka: {e}")

def process_features_message(msg_val: Dict[str, Any]):
    """
    Process engineered features, invoke models or rule-based indicators,
    and persist generated signals to the database.
    """
    symbol = msg_val.get("symbol")
    timestamp_str = msg_val.get("timestamp")
    
    if not symbol or not timestamp_str:
        logger.warning("Invalid features message: missing symbol or timestamp.")
        return
        
    try:
        # 1. Retrieve or generate predicted return
        predicted_return = 0.0
        confidence = 0.5
        prediction_fetched = False
        
        try:
            import requests
            pred_svc_url = os.getenv("AI_PREDICTION_SERVICE_URL", "http://localhost:8006")
            url = f"{pred_svc_url}/api/v1/predictions/{symbol}"
            logger.info(f"Querying AI Prediction Service for {symbol} at {url}...")
            resp = requests.get(url, timeout=1.0)
            if resp.status_code == 200:
                pred_data = resp.json()
                predicted_return = float(pred_data.get("predicted_return", 0.0))
                confidence = float(pred_data.get("confidence_score", 0.5))
                prediction_fetched = True
                logger.info(f"Successfully fetched AI prediction for {symbol}: Return={predicted_return}, Confidence={confidence}")
        except Exception as e:
            logger.warning(f"Failed to fetch AI Prediction from service, falling back to heuristics: {e}")
            
        if not prediction_fetched:
            # Heuristic consensus fallback using technical indicators from features
            rsi_14 = msg_val.get("rsi_14", 50.0)
            regime = msg_val.get("regime", 0)
            macdh = msg_val.get("MACDh_12_26_9", 0.0)
            
            # Simple heuristic mapping rules to a predicted return (-0.03 to 0.03)
            predicted_return = 0.0
            confidence = 0.5
            
            # Bullish factors
            if rsi_14 < 35: # oversold -> correction likely
                predicted_return += 0.015
                confidence += 0.1
            if regime == 1: # uptrend
                predicted_return += 0.01
                confidence += 0.15
            if macdh > 0: # positive MACD histogram
                predicted_return += 0.005
                confidence += 0.05
                
            # Bearish factors
            if rsi_14 > 65: # overbought
                predicted_return -= 0.015
                confidence += 0.1
            if regime == -1: # downtrend
                predicted_return -= 0.01
                confidence += 0.15
            if macdh < 0:
                predicted_return -= 0.005
                confidence += 0.05

            confidence = min(max(confidence, 0.0), 1.0)
        
        # 2. Invoke Consensus Signal Engine
        sig, sig_conf = signal_engine.generate_single_signal(predicted_return, confidence)
        
        # 3. Save to database
        with engine.begin() as conn:
            # Get asset ID
            asset = conn.execute(
                text("SELECT id FROM assets WHERE symbol = :symbol"),
                {"symbol": symbol.upper()}
            ).fetchone()
            
            if not asset:
                logger.error(f"Asset {symbol} not found in database. Skipping signal generation.")
                return
                
            asset_id = asset[0]
            signal_id = str(uuid.uuid4())
            timestamp = datetime.datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            
            metadata = {
                "predicted_return": float(predicted_return),
                "rsi_14": float(rsi_14),
                "regime": int(regime),
                "macd": float(macd)
            }
            
            conn.execute(
                text("""
                    INSERT INTO signals (id, asset_id, timestamp, signal_type, confidence, source_service, metadata)
                    VALUES (:id, :asset_id, :timestamp, :signal_type, :confidence, :source, :metadata)
                """),
                {
                    "id": signal_id,
                    "asset_id": asset_id,
                    "timestamp": timestamp,
                    "signal_type": sig,
                    "confidence": float(sig_conf),
                    "source": "Ensemble Consensus Engine",
                    "metadata": json.dumps(metadata)
                }
            )
            
        # 4. Publish to Kafka
        payload = {
            "signal_id": signal_id,
            "symbol": symbol,
            "timestamp": timestamp.isoformat(),
            "signal_type": sig,
            "confidence": float(sig_conf),
            "metadata": metadata
        }
        send_signal_event(symbol, payload)
        logger.info(f"Generated and persisted {sig} signal for {symbol} with confidence {sig_conf:.2f}")

    except Exception as e:
        logger.error(f"Error processing features for signal generation: {e}")

# Background Consumer
consumer_running = False

def kafka_features_consumer_worker():
    global consumer_running
    consumer_running = True
    
    try:
        consumer = KafkaConsumer(
            FEATURES_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            group_id='signals-generator-group'
        )
        logger.info(f"Kafka Consumer started on topic {FEATURES_TOPIC}")
        
        for message in consumer:
            if not consumer_running:
                break
            msg_val = message.value
            process_features_message(msg_val)
            
    except KafkaError as e:
        logger.warning(f"Kafka consumer connection error: {e}. Running in HTTP backup mode.")
    except Exception as e:
        logger.error(f"Kafka consumer thread error: {e}")

@app.on_event("startup")
def startup():
    threading.Thread(target=kafka_features_consumer_worker, daemon=True).start()

@app.on_event("shutdown")
def shutdown():
    global consumer_running
    consumer_running = False
    if producer and not mock_producer:
        producer.flush()
        producer.close()

@app.get("/health")
def health():
    return {"status": "ok", "service": "QuantX Signal Service"}

@app.post("/mock-trigger")
def mock_trigger(features_data: Dict[str, Any]):
    """
    HTTP backup endpoint to trigger signal generation manually for testing.
    """
    process_features_message(features_data)
    return {"status": "success", "message": "Signal processing completed."}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8003, reload=True)
