import numpy as np
import pandas as pd
import logging
from typing import Dict, Any, List

logger = logging.getLogger("feature-service.monitoring")

class FeatureMonitor:
    def __init__(self, baseline_windows: int = 50, z_score_threshold: float = 3.0):
        self.baseline_windows = baseline_windows
        self.z_score_threshold = z_score_threshold
        # Stores rolling histories: symbol -> { feature_name -> List[float] }
        self.history: Dict[str, Dict[str, List[float]]] = {}

    def check_data_quality(self, symbol: str, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate incoming engineered features for basic data quality issues.
        """
        nans = []
        infs = []
        
        for k, v in features.items():
            if k in ["timestamp", "symbol", "id", "asset_id", "interval_type", "version"]:
                continue
            
            # Check for missing/none values
            if v is None or (isinstance(v, float) and np.isnan(v)):
                nans.append(k)
            # Check for infinity
            elif isinstance(v, float) and np.isinf(v):
                infs.append(k)
 
        status = "OK"
        if nans or infs:
            status = "WARNING"
            logger.warning(
                f"[QUALITY ALERT] [{symbol}] Found {len(nans)} NaNs and {len(infs)} Infs. "
                f"NaNs in: {nans[:5]}, Infs in: {infs[:5]}"
            )
            # Send Slack Alert
            self.send_slack_alert(symbol, "DATA QUALITY WARNING", {
                "nan_count": len(nans),
                "inf_count": len(infs),
                "nan_fields": nans[:10],
                "inf_fields": infs[:10]
            })
 
        return {
            "status": status,
            "nan_count": len(nans),
            "inf_count": len(infs),
            "nan_fields": nans,
            "inf_fields": infs
        }
 
    def check_feature_drift(self, symbol: str, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if features have drifted significantly from their rolling historical averages.
        """
        drifted_features = {}
        
        if symbol not in self.history:
            self.history[symbol] = {}
 
        for k, v in features.items():
            if k in ["timestamp", "symbol", "id", "asset_id", "interval_type", "version"]:
                continue
                
            if not isinstance(v, (int, float)) or isinstance(v, bool) or np.isnan(v) or np.isinf(v):
                continue
                
            # Initialize history list for this feature
            if k not in self.history[symbol]:
                self.history[symbol][k] = []
                
            feature_history = self.history[symbol][k]
            
            # If we have enough baseline history, calculate Z-score
            if len(feature_history) >= self.baseline_windows:
                mean_val = np.mean(feature_history)
                std_val = np.std(feature_history)
                
                if std_val > 1e-6:
                    z_score = abs(v - mean_val) / std_val
                    if z_score > self.z_score_threshold:
                        drifted_features[k] = {
                            "current_value": float(v),
                            "rolling_mean": float(mean_val),
                            "rolling_std": float(std_val),
                            "z_score": float(z_score)
                        }
                        logger.warning(
                            f"[DRIFT DETECTED] [{symbol}] Feature '{k}' drifted. "
                            f"Value={v:.4f}, Mean={mean_val:.4f}, Std={std_val:.4f} (Z-Score={z_score:.2f})"
                        )
            
            # Update history and keep window bounded
            feature_history.append(v)
            if len(feature_history) > self.baseline_windows * 2:
                feature_history.pop(0)
                
        if drifted_features:
            self.send_slack_alert(symbol, "FEATURE DRIFT DETECTED", drifted_features)
            
        return {
            "drift_detected": len(drifted_features) > 0,
            "drifted_count": len(drifted_features),
            "details": drifted_features
        }
 
    def send_slack_alert(self, symbol: str, alert_type: str, details: Dict[str, Any]):
        """
        Send a real-time webhook alert to Slack when drift or quality issues are found.
        """
        import os
        import requests
        webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        if not webhook_url:
            logger.info("Slack Webhook URL not configured. Skipping alert.")
            return
            
        payload = {
            "text": f"🚨 *QuantX Alert* | {alert_type} for *{symbol}*",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"🚨 *QuantX Alert* | {alert_type} for *{symbol}*"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Symbol:* {symbol}"},
                        {"type": "mrkdwn", "text": f"*Type:* {alert_type}"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"```\n{details}\n```"
                    }
                }
            ]
        }
        try:
            res = requests.post(webhook_url, json=payload, timeout=2)
            if res.status_code != 200:
                logger.error(f"Failed to send Slack alert (Status {res.status_code}): {res.text}")
        except Exception as e:
            logger.error(f"Error sending Slack alert: {e}")

    def process_and_monitor(self, symbol: str, features: Dict[str, Any]) -> Dict[str, Any]:
        quality = self.check_data_quality(symbol, features)
        drift = self.check_feature_drift(symbol, features)
        return {
            "quality": quality,
            "drift": drift
        }
