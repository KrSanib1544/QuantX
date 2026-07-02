import numpy as np
import pandas as pd
from .returns import sharpe_ratio

def portfolio_returns(weights: np.ndarray, asset_returns: pd.DataFrame) -> pd.Series:
    """
    Calculate the periodic returns of a weighted portfolio.
    
    Args:
        weights: Numpy array of asset weights. Must sum to 1.
        asset_returns: Pandas DataFrame of returns, where columns represent assets.
        
    Returns:
        Pandas Series of portfolio returns.
    """
    if len(weights) != asset_returns.shape[1]:
        raise ValueError("Weights length must match number of assets (columns) in DataFrame.")
    
    # Calculate weighted returns
    return asset_returns.dot(weights)

def portfolio_variance(weights: np.ndarray, cov_matrix: pd.DataFrame) -> float:
    """
    Calculate the variance of a portfolio.
    
    Args:
        weights: Numpy array of asset weights.
        cov_matrix: Covariance matrix of asset returns.
        
    Returns:
        Portfolio variance as a float.
    """
    return float(np.dot(weights.T, np.dot(cov_matrix, weights)))

def portfolio_volatility(weights: np.ndarray, cov_matrix: pd.DataFrame, periods_per_year: int = 252) -> float:
    """
    Calculate the annualized volatility of a portfolio.
    
    Args:
        weights: Numpy array of asset weights.
        cov_matrix: Covariance matrix of asset returns.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Annualized portfolio volatility as a float.
    """
    p_variance = portfolio_variance(weights, cov_matrix)
    # Annualize variance and take square root
    return float(np.sqrt(p_variance * periods_per_year))

def portfolio_sharpe(
    weights: np.ndarray, 
    asset_returns: pd.DataFrame, 
    risk_free_rate: float = 0.0, 
    periods_per_year: int = 252
) -> float:
    """
    Calculate the Sharpe Ratio of a portfolio.
    
    Args:
        weights: Numpy array of asset weights.
        asset_returns: Pandas DataFrame of asset returns.
        risk_free_rate: Annualized risk-free rate.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Portfolio Sharpe ratio as a float.
    """
    p_returns = portfolio_returns(weights, asset_returns)
    return sharpe_ratio(p_returns, risk_free_rate, periods_per_year)
