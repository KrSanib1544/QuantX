import uvicorn
import logging
import asyncio
import json
from typing import Dict, List, Any
from fastapi import FastAPI, HTTPException, Depends
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
import threading
import pandas as pd

from .pipeline import FeaturePipeline
from .store import FeatureStore
from .monitoring import FeatureMonitor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("feature-service")

app = FastAPI(title="QuantX Feature Engineering Service", version="1.0.0")

# In-memory rolling window buffer for OHLCV bars: symbol -> List[Dict]
# We need at least 250 bars to calculate SMA200
ohlcv_buffers: Dict[str, List[Dict[str, Any]]] = {}
buffer_lock = threading.Lock()

pipeline = FeaturePipeline()
store = FeatureStore(redis_host="localhost", redis_port=6379)
monitor = FeatureMonitor()

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
RAW_TOPIC = "market.raw.ohlcv"
FEATURES_TOPIC = "market.features"

# Kafka Producer to send features
producer = None
mock_producer = False

try:
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        key_serializer=lambda k: k.encode('utf-8') if k else None,
        retries=5
    )
    logger.info("Kafka Feature Producer initialized.")
except Exception as e:
    logger.warning(f"Could not connect Kafka Producer. Running in mock. Error: {e}")
    mock_producer = True

def send_feature_event(symbol: str, data: Dict[str, Any]):
    if mock_producer:
        logger.debug(f"[MOCK KAFKA -> {FEATURES_TOPIC}] Key: {symbol}, Value: {data}")
        return
    try:
        producer.send(FEATURES_TOPIC, key=symbol, value=data)
    except Exception as e:
        logger.error(f"Error publishing features to Kafka: {e}")

def process_bar(bar_msg: Dict[str, Any]):
    """
    Process incoming OHLCV bar, calculate features, and save/publish them.
    """
    symbol = bar_msg["symbol"]
    timestamp = bar_msg["timestamp"]
    
    with buffer_lock:
        if symbol not in ohlcv_buffers:
            ohlcv_buffers[symbol] = []
            
        # Append new bar
        ohlcv_buffers[symbol].append(bar_msg)
        
        # Keep last 300 bars
        if len(ohlcv_buffers[symbol]) > 300:
            ohlcv_buffers[symbol].pop(0)
            
        buffer_len = len(ohlcv_buffers[symbol])
        
    logger.info(f"Buffered {buffer_len} bars for {symbol}")
    
    # We need enough bars to calculate indicators (at least 50 bars)
    if buffer_len < 50:
        logger.info(f"Not enough data for {symbol} to calculate features ({buffer_len}/50)")
        return
        
    # Convert buffer to DataFrame
    with buffer_lock:
        df = pd.DataFrame(ohlcv_buffers[symbol])
        
    # Set timestamp index
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Run pipeline
    try:
        features_df = pipeline.compute_features(df)
        # Extract the latest calculated features row
        latest_row = features_df.iloc[-1]
        
        # Convert row to dict
        features_dict = latest_row.to_dict()
        # Clean datetime for JSON serialization
        features_dict["timestamp"] = str(features_dict["timestamp"])
        
        # Run Data Quality and Drift Monitoring
        monitor.process_and_monitor(symbol, features_dict)
        
        # Store in Redis Feature Store
        store.store_latest_features(symbol, features_dict)
        store.store_historical_features(symbol, timestamp, features_dict)
        
        # Publish to Kafka
        send_feature_event(symbol, features_dict)
        logger.info(f"Successfully engineered and published features for {symbol} at {timestamp}")
        
    except Exception as e:
        logger.error(f"Failed to calculate features for {symbol}: {e}")

# Background consumer thread
consumer_running = False

def kafka_consumer_worker():
    global consumer_running
    consumer_running = True
    
    try:
        consumer = KafkaConsumer(
            RAW_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            group_id='feature-engineering-group'
        )
        logger.info(f"Kafka Consumer started on topic {RAW_TOPIC}")
        
        for message in consumer:
            if not consumer_running:
                break
            bar_msg = message.value
            process_bar(bar_msg)
            
    except KafkaError as e:
        logger.warning(f"Kafka Consumer connection error: {e}. Ingestion will run via HTTP mocks.")
    except Exception as e:
        logger.error(f"Kafka Consumer Exception: {e}")

@app.on_event("startup")
def startup():
    # Start Kafka consumer thread
    threading.Thread(target=kafka_consumer_worker, daemon=True).start()

@app.on_event("shutdown")
def shutdown():
    global consumer_running
    consumer_running = False
    store.close()
    if producer and not mock_producer:
        producer.flush()
        producer.close()

@app.get("/features/{symbol}")
def get_features(symbol: str):
    symbol = symbol.upper()
    features = store.get_latest_features(symbol)
    if not features:
        raise HTTPException(status_code=404, detail=f"Features not found for asset {symbol}")
    return features

@app.post("/mock-ingest")
def mock_ingest(bar_data: Dict[str, Any]):
    """
    HTTP backup to ingest data directly without Kafka for easy testing.
    """
    process_bar(bar_data)
    return {"status": "success", "message": "Processed bar and calculated features."}
