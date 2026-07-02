import numpy as np
import logging
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("risk-service.manager")

class RiskManager:
    def __init__(
        self,
        max_portfolio_drawdown: float = 0.20, # 20% Max Drawdown limit
        max_asset_exposure: float = 0.25,     # 25% max exposure per asset
        var_limit_95: float = 0.05,            # 5% daily VaR limit
        default_stop_loss: float = 0.02,       # 2% standard stop loss
        default_trailing_stop: float = 0.05    # 5% trailing stop
    ):
        self.max_portfolio_drawdown = max_portfolio_drawdown
        self.max_asset_exposure = max_asset_exposure
        self.var_limit_95 = var_limit_95
        self.default_stop_loss = default_stop_loss
        self.default_trailing_stop = default_trailing_stop

    def size_position_kelly(self, win_probability: float, win_loss_ratio: float, leverage_scale: float = 0.5) -> float:
        """
        Calculate position sizing using the Kelly Criterion with a fractional scale (half-Kelly).
        
        Formula: f* = p - (1-p)/b
        where p is win probability, b is win/loss ratio, and we apply a scaling factor.
        """
        if win_loss_ratio <= 0.0:
            return 0.0
            
        f_star = win_probability - (1.0 - win_probability) / win_loss_ratio
        
        # Clip to positive values (no short selling size here) and apply scaling
        fractional_kelly = max(0.0, f_star) * leverage_scale
        
        # Limit by max exposure
        return float(min(fractional_kelly, self.max_asset_exposure))

    def size_position_volatility(self, target_portfolio_risk: float, asset_volatility: float) -> float:
        """
        Size position based on Volatility Targeting.
        Allocation = Target Risk / Asset Volatility
        """
        if asset_volatility <= 0.0:
            return 0.0
            
        allocation = target_portfolio_risk / asset_volatility
        return float(min(allocation, self.max_asset_exposure))

    def validate_trade_limits(
        self, 
        symbol: str, 
        order_qty: float, 
        current_price: float, 
        portfolio_equity: float,
        current_position_value: float = 0.0
    ) -> Tuple[bool, str]:
        """
        Validate trade against risk limits: asset exposure cap.
        """
        trade_value = order_qty * current_price
        new_exposure = (current_position_value + trade_value) / portfolio_equity
        
        if new_exposure > self.max_asset_exposure:
            return False, f"Trade exceeds max asset exposure limit of {self.max_asset_exposure*100}% (requested: {new_exposure*100:.2f}%)"
            
        return True, "Approved"

    def process_stops(
        self, 
        current_price: float, 
        entry_price: float, 
        highest_price: float,
        stop_type: str = "stop_loss"
    ) -> Tuple[bool, float]:
        """
        Check if stop triggers have been hit.
        Returns: (is_stop_triggered, exit_price)
        """
        if stop_type == "stop_loss":
            stop_price = entry_price * (1.0 - self.default_stop_loss)
            if current_price <= stop_price:
                return True, float(stop_price)
                
        elif stop_type == "trailing_stop":
            stop_price = highest_price * (1.0 - self.default_trailing_stop)
            if current_price <= stop_price:
                return True, float(stop_price)
                
        return False, 0.0
