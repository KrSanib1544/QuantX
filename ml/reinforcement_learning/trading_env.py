import gymnasium as gym
from gymnasium import spaces
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, Optional

class TradingEnvironment(gym.Env):
    """
    A custom Gymnasium environment for reinforcement learning trading.
    Compatible with Stable-Baselines3.
    """
    metadata = {'render.modes': ['human']}

    def __init__(
        self,
        df: pd.DataFrame,
        feature_cols: list,
        initial_cash: float = 100000.0,
        commission_rate: float = 0.001,
        slippage_rate: float = 0.0005
    ):
        super().__init__()
        self.df = df.copy().reset_index(drop=True)
        self.feature_cols = feature_cols
        self.initial_cash = initial_cash
        self.commission_rate = commission_rate
        self.slippage_rate = slippage_rate
        
        # Dimensions
        self.n_steps = len(self.df)
        self.n_features = len(feature_cols)
        
        # Action Space: 0 = HOLD, 1 = BUY, 2 = SELL
        self.action_space = spaces.Discrete(3)
        
        # Observation Space:
        # Features from df + [cash/initial_cash, position_qty, average_entry_price/price, current_pnl]
        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(self.n_features + 4,),
            dtype=np.float32
        )
        
        self.reset()

    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None) -> Tuple[np.ndarray, dict]:
        super().reset(seed=seed)
        
        self.current_step = 0
        self.cash = self.initial_cash
        self.position = 0.0  # Held quantity
        self.average_entry_price = 0.0
        self.portfolio_value = self.initial_cash
        
        # Track history
        self.portfolio_value_history = [self.portfolio_value]
        self.trades_history = []
        
        obs = self._get_observation()
        info = self._get_info()
        return obs, info

    def _get_observation(self) -> np.ndarray:
        row = self.df.iloc[self.current_step]
        features = row[self.feature_cols].values.astype(np.float32)
        
        close_price = row['close']
        
        # Normalize account state features
        norm_cash = self.cash / self.initial_cash
        norm_position = self.position
        norm_entry = (self.average_entry_price / close_price) if close_price > 0 else 0.0
        
        unrealized_pnl = 0.0
        if self.position > 0:
            unrealized_pnl = (close_price - self.average_entry_price) / self.average_entry_price
            
        account_state = np.array([norm_cash, norm_position, norm_entry, unrealized_pnl], dtype=np.float32)
        
        return np.concatenate([features, account_state])

    def _get_info(self) -> dict:
        return {
            "step": self.current_step,
            "cash": self.cash,
            "position": self.position,
            "portfolio_value": self.portfolio_value,
            "average_entry_price": self.average_entry_price
        }

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, dict]:
        # Get current bar info
        row = self.df.iloc[self.current_step]
        close_price = row['close']
        
        reward = 0.0
        trade_executed = False
        
        # Calculate old portfolio value
        old_portfolio_value = self.portfolio_value
        
        # 1. Execute action
        # BUY (1): Allocate 100% of cash to buy
        if action == 1 and self.cash > 10.0:
            execution_price = close_price * (1.0 + self.slippage_rate)
            cost = self.cash
            commission = cost * self.commission_rate
            
            qty = (cost - commission) / execution_price
            if qty > 0:
                self.cash -= cost
                
                # Update average entry price
                total_qty = self.position + qty
                self.average_entry_price = ((self.position * self.average_entry_price) + (qty * execution_price)) / total_qty
                self.position = total_qty
                
                trade_executed = True
                self.trades_history.append({"step": self.current_step, "type": "BUY", "qty": qty, "price": execution_price})

        # SELL (2): Liquidate position
        elif action == 2 and self.position > 0:
            execution_price = close_price * (1.0 - self.slippage_rate)
            proceeds = self.position * execution_price
            commission = proceeds * self.commission_rate
            
            self.cash += (proceeds - commission)
            self.position = 0.0
            self.average_entry_price = 0.0
            
            trade_executed = True
            self.trades_history.append({"step": self.current_step, "type": "SELL", "qty": self.position, "price": execution_price})
            
        # 2. Update portfolio value
        self.portfolio_value = self.cash + (self.position * close_price)
        self.portfolio_value_history.append(self.portfolio_value)
        
        # 3. Calculate Reward
        # Reward is the risk-adjusted period return (change in portfolio value / initial value)
        step_return = (self.portfolio_value - old_portfolio_value) / old_portfolio_value
        
        # Add risk-adjusted modifier (Sharpe reward):
        # penalize high drawdown or high standard deviation of historical portfolio values
        reward = step_return
        
        # Drawdown penalty
        peak = max(self.portfolio_value_history)
        drawdown = (peak - self.portfolio_value) / peak
        if drawdown > 0.05:
            reward -= 0.1 * drawdown  # Penalize drawdowns > 5%
            
        # Move step
        self.current_step += 1
        
        # 4. Terminated & Truncated conditions
        terminated = self.current_step >= self.n_steps - 1
        truncated = False
        
        # If we went broke
        if self.portfolio_value < self.initial_cash * 0.5:
            terminated = True
            reward -= 1.0  # Large penalty for blowing up portfolio
            
        obs = self._get_observation() if not terminated else np.zeros(self.observation_space.shape, dtype=np.float32)
        info = self._get_info()
        
        return obs, float(reward), terminated, truncated, info

    def render(self, mode='human'):
        print(f"Step: {self.current_step}, Portfolio Value: {self.portfolio_value:.2f}, Cash: {self.cash:.2f}, Pos: {self.position:.4f}")
