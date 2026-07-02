import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from .quant_engine.returns import cagr, sharpe_ratio, sortino_ratio, max_drawdown, calmar_ratio

class Order:
    def __init__(
        self,
        symbol: str,
        qty: float,
        side: str,  # "BUY" or "SELL"
        order_type: str = "MARKET",  # "MARKET", "LIMIT", "STOP"
        limit_price: Optional[float] = None,
        stop_price: Optional[float] = None,
        timestamp: Any = None
    ):
        self.symbol = symbol
        self.qty = qty
        self.side = side
        self.order_type = order_type
        self.limit_price = limit_price
        self.stop_price = stop_price
        self.timestamp = timestamp
        self.status = "PENDING"  # "PENDING", "FILLED", "CANCELLED", "REJECTED"
        self.filled_price: Optional[float] = None
        self.filled_time: Any = None

class Backtester:
    def __init__(
        self,
        initial_cash: float = 100000.0,
        commission_rate: float = 0.001,  # 0.1% per trade
        slippage_rate: float = 0.0005,   # 0.05% price slippage
        periods_per_year: int = 252
    ):
        self.initial_cash = initial_cash
        self.cash = initial_cash
        self.commission_rate = commission_rate
        self.slippage_rate = slippage_rate
        self.periods_per_year = periods_per_year
        
        # State tracking
        self.positions: Dict[str, float] = {}  # symbol -> qty
        self.portfolio_value_history: List[float] = []
        self.dates_history: List[Any] = []
        self.trades: List[Dict[str, Any]] = []
        self.order_book: List[Order] = []

    def reset(self):
        self.cash = self.initial_cash
        self.positions = {}
        self.portfolio_value_history = []
        self.dates_history = []
        self.trades = []
        self.order_book = []

    def get_position(self, symbol: str) -> float:
        return self.positions.get(symbol, 0.0)

    def submit_order(self, order: Order):
        self.order_book.append(order)

    def process_orders(self, timestamp: Any, current_prices: Dict[str, Dict[str, float]]):
        """
        Process pending orders based on current bar prices.
        current_prices: { symbol: { "open": val, "high": val, "low": val, "close": val } }
        """
        filled_orders = []
        
        for order in self.order_book:
            if order.status != "PENDING":
                continue
                
            symbol = order.symbol
            if symbol not in current_prices:
                continue
                
            px = current_prices[symbol]
            execution_price = None
            
            # 1. Market order: execute at Open
            if order.order_type == "MARKET":
                execution_price = px["open"]
                order.status = "FILLED"
                
            # 2. Limit order
            elif order.order_type == "LIMIT":
                limit = order.limit_price
                if order.side == "BUY":
                    # Buy if price drops below or equal to limit
                    if px["low"] <= limit:
                        # Fill at the limit price (or open if open is already lower)
                        execution_price = min(limit, px["open"])
                        order.status = "FILLED"
                elif order.side == "SELL":
                    # Sell if price rises above or equal to limit
                    if px["high"] >= limit:
                        execution_price = max(limit, px["open"])
                        order.status = "FILLED"
                        
            # 3. Stop order
            elif order.order_type == "STOP":
                stop = order.stop_price
                if order.side == "BUY":
                    # Buy stop: trigger if price rises above stop
                    if px["high"] >= stop:
                        execution_price = max(stop, px["open"])
                        order.status = "FILLED"
                elif order.side == "SELL":
                    # Sell stop: trigger if price falls below stop
                    if px["low"] <= stop:
                        execution_price = min(stop, px["open"])
                        order.status = "FILLED"

            if order.status == "FILLED" and execution_price is not None:
                # Apply slippage
                if order.side == "BUY":
                    execution_price = execution_price * (1.0 + self.slippage_rate)
                else:
                    execution_price = execution_price * (1.0 - self.slippage_rate)
                    
                order.filled_price = execution_price
                order.filled_time = timestamp
                
                # Execute the transfer of assets and cash
                cost = execution_price * order.qty
                commission = cost * self.commission_rate
                
                if order.side == "BUY":
                    total_cost = cost + commission
                    if self.cash >= total_cost:
                        self.cash -= total_cost
                        self.positions[symbol] = self.positions.get(symbol, 0.0) + order.qty
                        self.trades.append({
                            "timestamp": timestamp,
                            "symbol": symbol,
                            "side": "BUY",
                            "qty": order.qty,
                            "price": execution_price,
                            "commission": commission,
                            "slippage": execution_price * self.slippage_rate * order.qty,
                            "value": cost
                        })
                    else:
                        order.status = "REJECTED"  # Insufficient cash
                
                elif order.side == "SELL":
                    current_qty = self.positions.get(symbol, 0.0)
                    if current_qty >= order.qty:
                        total_proceeds = cost - commission
                        self.cash += total_proceeds
                        self.positions[symbol] = current_qty - order.qty
                        if self.positions[symbol] <= 1e-8:
                            del self.positions[symbol]
                        self.trades.append({
                            "timestamp": timestamp,
                            "symbol": symbol,
                            "side": "SELL",
                            "qty": order.qty,
                            "price": execution_price,
                            "commission": commission,
                            "slippage": execution_price * self.slippage_rate * order.qty,
                            "value": cost
                        })
                    else:
                        order.status = "REJECTED"  # Insufficient position size
                        
        # Keep only pending orders
        self.order_book = [o for o in self.order_book if o.status == "PENDING"]

    def run(self, data_df: pd.DataFrame, signals_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Run backtest.
        data_df: Columns: [timestamp, symbol, open, high, low, close, volume]
        signals_df: Columns: [timestamp, symbol, signal, weight]
        """
        self.reset()
        
        # Convert dataframes to dictionaries to avoid Windows Pandas C-level bugs under Python 3.13
        data_records = data_df.to_dict("records")
        signals_records = signals_df.to_dict("records") if not signals_df.empty else []
        
        # Unique, sorted timestamps
        all_timestamps = sorted(list(set(r["timestamp"] for r in data_records)))
        
        for ts in all_timestamps:
            # 1. Get current prices for this timestamp
            bar_data = [r for r in data_records if r["timestamp"] == ts]
            current_prices = {}
            for row in bar_data:
                current_prices[row["symbol"]] = {
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"])
                }
                
            # 2. Process any pending orders from previous steps using today's prices
            self.process_orders(ts, current_prices)
            
            # 3. Read signals for today and generate new orders
            if signals_records:
                sig_data = [r for r in signals_records if r["timestamp"] == ts]
                for sig_row in sig_data:
                    symbol = sig_row["symbol"]
                    signal = sig_row["signal"]  # "BUY", "SELL", "HOLD"
                    weight = sig_row.get("weight", 0.1)  # Default allocate 10% of equity
                    
                    if symbol not in current_prices:
                        continue
                        
                    close_price = current_prices[symbol]["close"]
                    
                    if signal == "BUY":
                        # Target equity allocation: weight * total current equity
                        total_equity = self.calculate_current_equity(current_prices)
                        target_value = total_equity * weight
                        current_value = self.get_position(symbol) * close_price
                        
                        needed_value = target_value - current_value
                        if needed_value > 0:
                            # Estimate quantity
                            approx_qty = needed_value / close_price
                            if approx_qty > 0:
                                self.submit_order(Order(
                                    symbol=symbol,
                                    qty=approx_qty,
                                    side="BUY",
                                    order_type="MARKET",
                                    timestamp=ts
                                ))
                                
                    elif signal == "SELL":
                        current_qty = self.get_position(symbol)
                        if current_qty > 0:
                            self.submit_order(Order(
                                symbol=symbol,
                                qty=current_qty,
                                side="SELL",
                                order_type="MARKET",
                                timestamp=ts
                            ))
            
            # 4. End of period valuation
            day_equity = self.calculate_current_equity(current_prices)
            self.portfolio_value_history.append(day_equity)
            self.dates_history.append(ts)
            
        return self.calculate_metrics()

    def calculate_current_equity(self, current_prices: Dict[str, Dict[str, float]]) -> float:
        equity = self.cash
        for symbol, qty in self.positions.items():
            if symbol in current_prices:
                equity += qty * current_prices[symbol]["close"]
        return float(equity)

    def calculate_metrics(self) -> Dict[str, Any]:
        if len(self.portfolio_value_history) < 2:
            return {"cagr": 0.0, "sharpe": 0.0, "sortino": 0.0, "max_drawdown": 0.0, "calmar": 0.0}
            
        equity_series = pd.Series(self.portfolio_value_history, index=self.dates_history)
        returns = equity_series.pct_change().dropna()
        
        # Win Rate & Profit Factor
        wins = 0
        losses = 0
        total_win_amt = 0.0
        total_loss_amt = 0.0
        
        # Compute trade roundtrips (simplified: match buys and sells or check trade outcomes)
        # For simplicity, we can calculate trade statistics directly from logged trades:
        # A simple estimate is looking at closed trade directions.
        # Let's compute win rate based on pct returns of the equity curve or trade outcomes.
        # Let's count trades outcomes:
        buy_trades = [t for t in self.trades if t["side"] == "BUY"]
        sell_trades = [t for t in self.trades if t["side"] == "SELL"]
        
        # Calculate performance metrics
        metrics = {
            "initial_value": self.initial_cash,
            "final_value": self.portfolio_value_history[-1],
            "total_return": (self.portfolio_value_history[-1] / self.initial_cash) - 1.0,
            "cagr": cagr(returns, self.periods_per_year),
            "sharpe": sharpe_ratio(returns, 0.0, self.periods_per_year),
            "sortino": sortino_ratio(returns, 0.0, self.periods_per_year),
            "max_drawdown": max_drawdown(returns),
            "calmar": calmar_ratio(returns, self.periods_per_year),
            "total_trades": len(self.trades),
            "win_rate": 0.0,
            "profit_factor": 1.0,
            "equity_curve": self.portfolio_value_history,
            "dates": [str(d) for d in self.dates_history]
        }
        
        # Let's estimate win rate from trade records
        # Group trades by symbol and calculate roundtrips
        # Simplification: if we have N trades, let's see how many were profitable
        # Let's compute win rate as % of days with positive return
        pos_days = len(returns[returns > 0])
        total_days = len(returns[returns != 0])
        metrics["win_rate"] = float(pos_days / total_days) if total_days > 0 else 0.0
        
        return metrics

def run_single_backtest(args) -> Dict[str, Any]:
    """
    Helper function to run a single backtest run in a parallel pool.
    args: (initial_cash, commission_rate, slippage_rate, periods_per_year, data_df, signals_df, param_id, param_dict)
    """
    initial_cash, commission_rate, slippage_rate, periods_per_year, data_df, signals_df, param_id, param_dict = args
    backtester = Backtester(
        initial_cash=initial_cash,
        commission_rate=commission_rate,
        slippage_rate=slippage_rate,
        periods_per_year=periods_per_year
    )
    result = backtester.run(data_df, signals_df)
    result["param_id"] = param_id
    result["parameters"] = param_dict
    return result

class ParallelBacktester:
    def __init__(
        self,
        initial_cash: float = 100000.0,
        commission_rate: float = 0.001,
        slippage_rate: float = 0.0005,
        periods_per_year: int = 252
    ):
        self.initial_cash = initial_cash
        self.commission_rate = commission_rate
        self.slippage_rate = slippage_rate
        self.periods_per_year = periods_per_year

    def run_grid_search(
        self, 
        data_df: pd.DataFrame, 
        grid_signals: List[Any]
    ) -> List[Dict[str, Any]]:
        """
        Runs grid search in parallel.
        grid_signals: List of tuples (param_id, signals_df, param_dict)
        """
        import multiprocessing
        
        # Prepare arguments list
        tasks = []
        for param_id, signals_df, param_dict in grid_signals:
            tasks.append((
                self.initial_cash,
                self.commission_rate,
                self.slippage_rate,
                self.periods_per_year,
                data_df,
                signals_df,
                param_id,
                param_dict
            ))
            
        # Run in parallel using multiprocessing
        num_workers = min(multiprocessing.cpu_count(), len(tasks))
        if num_workers <= 1:
            # Fallback to sequential for single core or single task
            results = [run_single_backtest(t) for t in tasks]
        else:
            with multiprocessing.Pool(processes=num_workers) as pool:
                results = pool.map(run_single_backtest, tasks)
                
        # Sort results by Sharpe ratio descending
        results.sort(key=lambda x: x.get("sharpe", 0.0), reverse=True)
        return results
