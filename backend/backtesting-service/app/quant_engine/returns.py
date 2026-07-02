import numpy as np
import pandas as pd
from typing import Union

def annualized_return(returns: pd.Series, periods_per_year: int = 252) -> float:
    """
    Calculate the arithmetic annualized return.
    
    Args:
        returns: Pandas Series of periodic returns.
        periods_per_year: Number of periods in a year (default 252 for daily trading).
        
    Returns:
        Annualized return as a float.
    """
    if len(returns) == 0:
        return 0.0
    return float(returns.mean() * periods_per_year)

def cagr(returns: pd.Series, periods_per_year: int = 252) -> float:
    """
    Calculate the Compound Annual Growth Rate (CAGR) based on daily returns.
    
    Args:
        returns: Pandas Series of periodic returns.
        periods_per_year: Number of periods in a year.
        
    Returns:
        CAGR as a float.
    """
    if len(returns) == 0:
        return 0.0
    
    # Calculate cumulative product of returns (total value multiplier)
    total_multiplier = (1.0 + returns).prod()
    
    # Calculate number of years
    years = len(returns) / periods_per_year
    if years <= 0:
        return 0.0
        
    return float((total_multiplier ** (1.0 / years)) - 1.0)

def annualized_volatility(returns: pd.Series, periods_per_year: int = 252) -> float:
    """
    Calculate the annualized volatility (standard deviation).
    
    Args:
        returns: Pandas Series of periodic returns.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Annualized volatility as a float.
    """
    if len(returns) < 2:
        return 0.0
    return float(returns.std(ddof=1) * np.sqrt(periods_per_year))

def downside_volatility(returns: pd.Series, periods_per_year: int = 252) -> float:
    """
    Calculate the annualized downside volatility (standard deviation of negative returns).
    
    Args:
        returns: Pandas Series of periodic returns.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Downside volatility as a float.
    """
    if len(returns) < 2:
        return 0.0
    
    # Only keep negative returns, others are replaced with 0 or ignored depending on Sortino definition.
    # Standard Sortino definition uses returns below a minimum acceptable return (MAR).
    # Here we assume MAR is 0.0.
    negative_returns = returns[returns < 0.0]
    if len(negative_returns) < 2:
        return 0.0
        
    # Sortino uses sum of squared negative deviations divided by N
    # equivalent to root-mean-square of negative returns.
    return float(np.sqrt(np.mean(negative_returns ** 2) * periods_per_year))

def sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.0, periods_per_year: int = 252) -> float:
    """
    Calculate the Sharpe Ratio.
    
    Args:
        returns: Pandas Series of periodic returns.
        risk_free_rate: Annualized risk-free rate.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Sharpe ratio as a float.
    """
    vol = annualized_volatility(returns, periods_per_year)
    if vol == 0.0:
        return 0.0
        
    daily_rf = risk_free_rate / periods_per_year
    excess_returns = returns - daily_rf
    ann_excess_return = excess_returns.mean() * periods_per_year
    
    return float(ann_excess_return / vol)

def sortino_ratio(returns: pd.Series, risk_free_rate: float = 0.0, periods_per_year: int = 252) -> float:
    """
    Calculate the Sortino Ratio.
    
    Args:
        returns: Pandas Series of periodic returns.
        risk_free_rate: Annualized risk-free rate.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Sortino ratio as a float.
    """
    down_vol = downside_volatility(returns, periods_per_year)
    if down_vol == 0.0:
        return 0.0
        
    daily_rf = risk_free_rate / periods_per_year
    excess_returns = returns - daily_rf
    ann_excess_return = excess_returns.mean() * periods_per_year
    
    return float(ann_excess_return / down_vol)

def max_drawdown(returns: pd.Series) -> float:
    """
    Calculate the maximum drawdown from returns.
    
    Args:
        returns: Pandas Series of periodic returns.
        
    Returns:
        Maximum drawdown (as a positive float, e.g. 0.15 for 15% drawdown).
    """
    if len(returns) == 0:
        return 0.0
    
    # Reconstruct equity curve
    equity_curve = (1.0 + returns).cumprod()
    
    # Calculate peak running maximum
    running_max = equity_curve.cummax()
    
    # Calculate drawdowns
    drawdowns = (running_max - equity_curve) / running_max
    
    return float(drawdowns.max())

def calmar_ratio(returns: pd.Series, periods_per_year: int = 252) -> float:
    """
    Calculate the Calmar Ratio.
    
    Args:
        returns: Pandas Series of periodic returns.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Calmar ratio as a float.
    """
    max_dd = max_drawdown(returns)
    if max_dd == 0.0:
        return 0.0
        
    ann_ret = cagr(returns, periods_per_year)
    return float(ann_ret / max_dd)
