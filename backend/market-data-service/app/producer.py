import json
import logging
from typing import Any, Dict
from kafka import KafkaProducer
from kafka.errors import KafkaError

logger = logging.getLogger("market-data-service.producer")

class MarketDataProducer:
    def __init__(self, bootstrap_servers: str = "localhost:9092"):
        self.bootstrap_servers = bootstrap_servers
        self.producer = None
        self.mock_mode = False
        
        try:
            # We use json serializer
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                retries=5,
                acks='all'
            )
            logger.info(f"Kafka Producer connected to {self.bootstrap_servers}")
        except KafkaError as e:
            logger.warning(f"Failed to connect to Kafka at {self.bootstrap_servers}. Running in Mock/Logging mode. Error: {e}")
            self.mock_mode = True
        except Exception as e:
            logger.warning(f"Could not initialize Kafka Producer. Running in Mock/Logging mode. Error: {e}")
            self.mock_mode = True

    def send_market_data(self, symbol: str, data: Dict[str, Any]):
        topic = "market.raw.ohlcv"
        if self.mock_mode:
            logger.debug(f"[MOCK KAFKA -> {topic}] Key: {symbol}, Value: {data}")
            return
            
        try:
            future = self.producer.send(topic, key=symbol, value=data)
            # Asynchronous send, but we can register callbacks
            def on_send_success(record_metadata):
                logger.debug(f"Message sent to {record_metadata.topic} partition {record_metadata.partition} offset {record_metadata.offset}")

            def on_send_error(excp):
                logger.error(f"Error publishing market data to Kafka: {excp}")

            future.add_callback(on_send_success)
            future.add_errback(on_send_error)
            
        except Exception as e:
            logger.error(f"Exception when sending to Kafka: {e}")

    def close(self):
        if self.producer and not self.mock_mode:
            self.producer.flush()
            self.producer.close()
            logger.info("Kafka producer closed.")
