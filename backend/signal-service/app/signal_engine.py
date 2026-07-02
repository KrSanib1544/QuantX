import numpy as np
from typing import Dict, List, Any, Tuple

class SignalEngine:
    def __init__(self, buy_threshold: float = 0.01, sell_threshold: float = -0.01):
        """
        Initialize the Signal Engine.
        
        Args:
            buy_threshold: Predicted return threshold to trigger a BUY signal.
            sell_threshold: Predicted return threshold to trigger a SELL signal.
        """
        self.buy_threshold = buy_threshold
        self.sell_threshold = sell_threshold

    def generate_single_signal(self, predicted_return: float, confidence_score: float = 1.0) -> Tuple[str, float]:
        """
        Generate a trading signal based on a single model prediction.
        
        Returns:
            Tuple of (Signal, Confidence Score)
        """
        if predicted_return >= self.buy_threshold:
            return "BUY", float(confidence_score)
        elif predicted_return <= self.sell_threshold:
            return "SELL", float(confidence_score)
        else:
            return "HOLD", 1.0 - float(abs(predicted_return) / max(self.buy_threshold, 1e-5))

    def generate_ensemble_signal(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate an ensemble signal from multiple model predictions.
        
        predictions: List of dicts, e.g. [{"model_name": "lstm", "predicted_return": 0.015, "confidence_score": 0.8}, ...]
        """
        if not predictions:
            return {"signal": "HOLD", "confidence": 1.0, "details": "No predictions provided"}
            
        votes = {"BUY": 0.0, "SELL": 0.0, "HOLD": 0.0}
        total_weight = 0.0
        
        # Aggregate predictions using model confidence as voting weights
        for pred in predictions:
            model_name = pred["model_name"]
            pred_return = pred["predicted_return"]
            conf = pred.get("confidence_score", 1.0)
            
            sig, sig_conf = self.generate_single_signal(pred_return, conf)
            
            # Vote weighted by the confidence score
            votes[sig] += sig_conf
            total_weight += sig_conf
            
        if total_weight == 0.0:
            return {"signal": "HOLD", "confidence": 1.0, "details": "Zero voting weight"}
            
        # Determine the winning signal
        winning_signal = max(votes, key=votes.get)
        winning_confidence = votes[winning_signal] / total_weight
        
        # Calculate ensemble average return
        avg_predicted_return = np.mean([p["predicted_return"] for p in predictions])
        
        return {
            "signal": winning_signal,
            "confidence": float(winning_confidence),
            "average_predicted_return": float(avg_predicted_return),
            "vote_distribution": {k: float(v / total_weight) for k, v in votes.items()}
        }
