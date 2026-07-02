import redis
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("feature-service.store")

class FeatureStore:
    def __init__(self, redis_host: str = "localhost", redis_port: int = 6379, db: int = 0):
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.redis_db = db
        self.client = None
        self.mock_mode = False
        
        try:
            self.client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                decode_responses=True,
                socket_timeout=5
            )
            self.client.ping()
            logger.info(f"Connected to Redis Feature Store at {self.redis_host}:{self.redis_port}")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis at {self.redis_host}:{self.redis_port}. Running in Mock memory mode. Error: {e}")
            self.mock_mode = True
            self.mock_db: Dict[str, str] = {}

    def store_latest_features(self, symbol: str, features: Dict[str, Any]):
        """
        Store the latest feature state for a symbol.
        """
        key = f"features:latest:{symbol.upper()}"
        data_str = json.dumps(features)
        
        if self.mock_mode:
            self.mock_db[key] = data_str
            logger.debug(f"[MOCK REDIS STORE] Key: {key}")
            return
            
        try:
            self.client.set(key, data_str)
        except Exception as e:
            logger.error(f"Error saving features to Redis: {e}")

    def get_latest_features(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve the latest feature state for a symbol.
        """
        key = f"features:latest:{symbol.upper()}"
        
        if self.mock_mode:
            data_str = self.mock_db.get(key)
            return json.loads(data_str) if data_str else None
            
        try:
            data_str = self.client.get(key)
            return json.loads(data_str) if data_str else None
        except Exception as e:
            logger.error(f"Error fetching features from Redis: {e}")
            return None
            
    def store_historical_features(self, symbol: str, timestamp: str, features: Dict[str, Any]):
        """
        Store feature snapshot with timestamp.
        """
        key = f"features:history:{symbol.upper()}:{timestamp}"
        data_str = json.dumps(features)
        
        if self.mock_mode:
            self.mock_db[key] = data_str
            return
            
        try:
            # Set with 3 days expiration to conserve Redis space
            self.client.setex(key, 259200, data_str)
        except Exception as e:
            logger.error(f"Error saving historical features to Redis: {e}")
            
    def close(self):
        if self.client and not self.mock_mode:
            self.client.close()
