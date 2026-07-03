import os
import sys
import torch
import numpy as np
import pandas as pd
import logging
from typing import Dict, Any, List, Tuple
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text

# Adjust paths to import from ml
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from ml.forecasting.models import LSTMForecaster, GRUForecaster, TransformerForecaster

# Dynamically import FeaturePipeline from feature-service to prevent app package namespace collision
import importlib.util
_pipeline_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../feature-service/app/pipeline.py'))
_spec = importlib.util.spec_from_file_location("feature_service_pipeline", _pipeline_path)
_pipeline_mod = importlib.util.module_from_spec(_spec)
sys.modules["feature_service_pipeline"] = _pipeline_mod
_spec.loader.exec_module(_pipeline_mod)
FeaturePipeline = _pipeline_mod.FeaturePipeline
sys.path.pop(0)

from .database import engine

logger = logging.getLogger("ai-prediction-service.predictor")

ACTIVE_FEATURES = ["return_lag_1", "rsi_14", "regime", "MACDh_12_26_9", "atr_20"]

class AIPredictor:
    def __init__(self, model_dir: str = None, lookback: int = 60):
        self.lookback = lookback
        if not model_dir:
            # Default path relative to project root
            model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../ml/forecasting/registry"))
        self.model_dir = model_dir
        
        self.models: Dict[str, torch.nn.Module] = {}
        self.ppo_model = None
        self.active_versions: Dict[str, str] = {
            "lstm": "v1.0",
            "gru": "v1.0",
            "transformer": "v1.0",
            "ppo": "v1.0"
        }
        self.load_models()

    def load_models(self):
        """
        Dynamically instantiate and load models from weights registry.
        """
        input_dim = len(ACTIVE_FEATURES)
        
        # 1. LSTM
        lstm_path = os.path.join(self.model_dir, "lstm_forecaster.pt")
        if os.path.exists(lstm_path):
            try:
                model = LSTMForecaster(input_dim=input_dim)
                model.load_state_dict(torch.load(lstm_path, map_location=torch.device('cpu')))
                model.eval()
                self.models["lstm"] = model
                logger.info(f"Loaded LSTM Forecaster from {lstm_path}")
            except Exception as e:
                logger.error(f"Failed to load LSTM weights: {e}")
                
        # 2. GRU
        gru_path = os.path.join(self.model_dir, "gru_forecaster.pt")
        if os.path.exists(gru_path):
            try:
                model = GRUForecaster(input_dim=input_dim)
                model.load_state_dict(torch.load(gru_path, map_location=torch.device('cpu')))
                model.eval()
                self.models["gru"] = model
                logger.info(f"Loaded GRU Forecaster from {gru_path}")
            except Exception as e:
                logger.error(f"Failed to load GRU weights: {e}")
                
        # 3. Transformer
        transformer_path = os.path.join(self.model_dir, "transformer_forecaster.pt")
        if os.path.exists(transformer_path):
            try:
                model = TransformerForecaster(input_dim=input_dim)
                model.load_state_dict(torch.load(transformer_path, map_location=torch.device('cpu')))
                model.eval()
                self.models["transformer"] = model
                logger.info(f"Loaded Transformer Forecaster from {transformer_path}")
            except Exception as e:
                logger.error(f"Failed to load Transformer weights: {e}")

        # 4. PPO RL Agent
        ppo_path = os.path.abspath(os.path.join(self.model_dir, "../../reinforcement_learning/registry/trading_agent_ppo"))
        if os.path.exists(ppo_path + ".zip"):
            try:
                from stable_baselines3 import PPO
                self.ppo_model = PPO.load(ppo_path)
                logger.info(f"Loaded PPO RL Agent from {ppo_path}.zip")
            except Exception as e:
                logger.error(f"Failed to load PPO RL Agent weights: {e}")

    def fetch_sequence_features(self, symbol: str) -> pd.DataFrame:
        """
        Query historical prices from the DB and engineer features for sequence input.
        We need lookback + 100 extra prices to calculate indicators like SMA200/EMA200.
        """
        query = """
            SELECT p.timestamp, p.open, p.high, p.low, p.close, p.volume
            FROM prices p
            JOIN assets a ON p.asset_id = a.id
            WHERE a.symbol = :symbol
            ORDER BY p.timestamp DESC
            LIMIT :limit
        """
        # Fetch lookback + 200 bars to guarantee indicators don't return NaN
        limit_count = self.lookback + 200
        
        with engine.connect() as conn:
            result = conn.execute(text(query), {"symbol": symbol.upper(), "limit": limit_count})
            rows = [dict(row._mapping) for row in result]
            
        if len(rows) < self.lookback + 50:
            logger.warning(f"Not enough prices in database to generate prediction for {symbol} (got {len(rows)})")
            raise ValueError(f"Insufficient price history for {symbol}.")
            
        # Reverse rows to be in chronological order
        rows.reverse()
        df = pd.DataFrame(rows)
        
        # Calculate technical indicators
        pipeline = FeaturePipeline()
        features_df = pipeline.compute_features(df)
        
        # Return the last 'lookback' steps
        return features_df.tail(self.lookback)

    def predict_return(self, symbol: str) -> Tuple[float, float, Dict[str, float]]:
        """
        Run the ensemble prediction and return (predicted_return, confidence_score, model_breakdown).
        """
        if not self.models:
            raise ValueError("No forecasting models loaded in predictor.")
            
        # Fetch sequence
        seq_df = self.fetch_sequence_features(symbol)
        
        # Select active features and handle missing values
        features_data = seq_df[ACTIVE_FEATURES].fillna(0.0).values
        
        # Standardize features (mean=0, std=1)
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(features_data)
        
        # Reshape to (1, seq_len, input_dim) for inference
        input_tensor = torch.tensor(scaled_data, dtype=torch.float32).unsqueeze(0)
        
        predictions = {}
        model_breakdown = {}
        
        with torch.no_grad():
            for name, model in self.models.items():
                pred = model(input_tensor).item()
                # Clip predicted returns to realistic daily bounds (-5% to +5%)
                pred = max(min(pred, 0.05), -0.05)
                predictions[name] = pred
                model_breakdown[name] = float(pred)
                
        # Ensemble Consensus: Weighted Average (1/3 each by default)
        ensemble_pred = float(np.mean(list(predictions.values())))
        
        # Confidence Score: 1.0 minus standard deviation of predictions
        # A smaller variance between models means higher consensus / confidence
        pred_vals = list(predictions.values())
        std_dev = float(np.std(pred_vals))
        # Map std_dev 0.0 -> confidence 1.0, std_dev 0.02+ -> confidence 0.2
        confidence = float(max(min(1.0 - (std_dev * 40.0), 1.0), 0.1))
        
        # Save prediction record to DB
        self.save_prediction_to_db(symbol, ensemble_pred, confidence)
        
        return ensemble_pred, confidence, model_breakdown

    def save_prediction_to_db(self, symbol: str, predicted_return: float, confidence: float):
        """
        Persist prediction to the database predictions table.
        """
        try:
            with engine.begin() as conn:
                asset = conn.execute(
                    text("SELECT id FROM assets WHERE symbol = :symbol"),
                    {"symbol": symbol.upper()}
                ).fetchone()
                
                if not asset:
                    return
                asset_id = asset[0]
                import datetime
                conn.execute(
                    text("""
                        INSERT INTO predictions (id, asset_id, timestamp, model_name, predicted_return, confidence_score, horizon)
                        VALUES (:id, :asset_id, :timestamp, 'Ensemble Forecaster', :predicted_return, :confidence, '1d')
                    """),
                    {
                        "id": str(torch.randint(0, 1000000, (1,)).item()), # simple uuid equivalent, or string uuid
                        "asset_id": asset_id,
                        "timestamp": datetime.datetime.utcnow(),
                        "predicted_return": predicted_return,
                        "confidence": confidence
                    }
                )
        except Exception as e:
            logger.error(f"Error saving prediction to DB: {e}")

    def get_feature_explanation(self, symbol: str) -> Dict[str, float]:
        """
        Calculate feature importance via input perturbation:
        Slightly perturb each feature value and measure how much the prediction changes.
        """
        seq_df = self.fetch_sequence_features(symbol)
        features_data = seq_df[ACTIVE_FEATURES].fillna(0.0).values
        
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(features_data)
        input_tensor = torch.tensor(scaled_data, dtype=torch.float32).unsqueeze(0)
        
        # Base prediction
        base_preds = []
        with torch.no_grad():
            for model in self.models.values():
                base_preds.append(model(input_tensor).item())
        base_val = np.mean(base_preds)
        
        attributions = {}
        
        # Perturb each feature column and measure impact
        for i, feature_name in enumerate(ACTIVE_FEATURES):
            perturbed_tensor = input_tensor.clone()
            # Add small perturbation to the last sequence step
            perturbed_tensor[0, -1, i] += 0.1
            
            perturbed_preds = []
            with torch.no_grad():
                for model in self.models.values():
                    perturbed_preds.append(model(perturbed_tensor).item())
            perturbed_val = np.mean(perturbed_preds)
            
            # Sensitivity is the absolute change in prediction
            sensitivity = abs(perturbed_val - base_val)
            attributions[feature_name] = float(sensitivity)
            
        # Normalize to sum to 100%
        total = sum(attributions.values())
        if total > 0:
            for k in attributions:
                attributions[k] = round((attributions[k] / total) * 100, 1)
        else:
            # fallback equal weight
            for k in attributions:
                attributions[k] = 20.0
                
        return attributions

    def predict_rl_action(
        self, 
        symbol: str, 
        cash: float = 100000.0, 
        position_qty: float = 0.0, 
        average_entry_price: float = 0.0
    ) -> Tuple[str, List[float], Dict[str, float]]:
        """
        Evaluate PPO RL agent policy for the current symbol and account state.
        Returns: (action, observation_list, account_state_details)
        """
        try:
            seq_df = self.fetch_sequence_features(symbol)
            features_data = seq_df[ACTIVE_FEATURES].fillna(0.0).iloc[-1].values.astype(np.float32)
            close_price = float(seq_df.iloc[-1]["close"])
        except Exception as e:
            logger.warning(f"Error fetching features for RL action: {e}. Using mock features.")
            features_data = np.array([0.0005, 50.0, 0.0, 0.0, 1.5], dtype=np.float32)
            close_price = 180.0

        # Construct account state:
        # [norm_cash, norm_position, norm_entry, unrealized_pnl]
        initial_cash = 100000.0
        norm_cash = cash / initial_cash
        norm_position = position_qty
        norm_entry = (average_entry_price / close_price) if close_price > 0 else 0.0
        
        unrealized_pnl = 0.0
        if position_qty > 0 and average_entry_price > 0:
            unrealized_pnl = (close_price - average_entry_price) / average_entry_price
            
        account_state = np.array([norm_cash, norm_position, norm_entry, unrealized_pnl], dtype=np.float32)
        
        # Concatenate features and account state to match shape (9,)
        obs = np.concatenate([features_data, account_state])
        
        if self.ppo_model:
            try:
                action, _states = self.ppo_model.predict(obs, deterministic=True)
                action = int(action)
            except Exception as e:
                logger.error(f"PPO inference failed: {e}")
                action = 0
        else:
            # Fallback heuristic
            rsi = features_data[1] if len(features_data) > 1 else 50.0
            if rsi < 35:
                action = 1 # BUY
            elif rsi > 65:
                action = 2 # SELL
            else:
                action = 0 # HOLD

        action_map = {0: "HOLD", 1: "BUY", 2: "SELL"}
        action_name = action_map.get(action, "HOLD")
        
        details = {
            "norm_cash": float(norm_cash),
            "norm_position": float(norm_position),
            "norm_entry": float(norm_entry),
            "unrealized_pnl": float(unrealized_pnl),
            "close_price": float(close_price)
        }
        
        return action_name, obs.tolist(), details
