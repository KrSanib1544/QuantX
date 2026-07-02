import numpy as np
import pandas as pd
from scipy.stats import norm
from typing import Union
from .returns import cagr, annualized_return, max_drawdown

def beta(returns: pd.Series, benchmark_returns: pd.Series) -> float:
    """
    Calculate the Beta coefficient of the returns relative to a benchmark.
    
    Args:
        returns: Pandas Series of strategy returns.
        benchmark_returns: Pandas Series of benchmark returns.
        
    Returns:
        Beta value as a float.
    """
    # Align the returns on indices
    combined = pd.concat([returns, benchmark_returns], axis=1).dropna()
    if len(combined) < 2:
        return 1.0
        
    strategy_aligned = combined.iloc[:, 0]
    benchmark_aligned = combined.iloc[:, 1]
    
    covariance = np.cov(strategy_aligned, benchmark_aligned)[0][1]
    benchmark_variance = np.var(benchmark_aligned, ddof=1)
    
    if benchmark_variance == 0.0:
        return 1.0
        
    return float(covariance / benchmark_variance)

def alpha(returns: pd.Series, benchmark_returns: pd.Series, risk_free_rate: float = 0.0, periods_per_year: int = 252) -> float:
    """
    Calculate the Jensen's Alpha of the returns relative to a benchmark.
    
    Args:
        returns: Pandas Series of strategy returns.
        benchmark_returns: Pandas Series of benchmark returns.
        risk_free_rate: Annualized risk-free rate.
        periods_per_year: Number of periods in a year.
        
    Returns:
        Annualized Alpha as a float.
    """
    # Align returns
    combined = pd.concat([returns, benchmark_returns], axis=1).dropna()
    if len(combined) < 2:
        return 0.0
        
    strategy_aligned = combined.iloc[:, 0]
    benchmark_aligned = combined.iloc[:, 1]
    
    # Calculate Beta
    b = beta(strategy_aligned, benchmark_aligned)
    
    # Calculate annualized returns
    r_strategy = cagr(strategy_aligned, periods_per_year)
    r_benchmark = cagr(benchmark_aligned, periods_per_year)
    
    # Jensen's Alpha = R_s - [R_f + Beta * (R_m - R_f)]
    return float(r_strategy - (risk_free_rate + b * (r_benchmark - risk_free_rate)))

def value_at_risk(returns: pd.Series, confidence_level: float = 0.95, method: str = "historical") -> float:
    """
    Calculate Value at Risk (VaR).
    Note: Returns VaR as a positive float, e.g. 0.02 means a 2% maximum loss 
    at the specified confidence level.
    
    Args:
        returns: Pandas Series of periodic returns.
        confidence_level: Confidence level (e.g. 0.95 or 0.99).
        method: "historical" or "parametric" (Gaussian).
        
    Returns:
        VaR as a positive float.
    """
    if len(returns) == 0:
        return 0.0
        
    alpha = 1.0 - confidence_level
    
    if method == "historical":
        # Calculate percentile of returns
        var_val = np.percentile(returns, alpha * 100)
        return float(-var_val)
        
    elif method == "parametric":
        mean = returns.mean()
        std = returns.std(ddof=1)
        if np.isnan(std) or std == 0.0:
            return 0.0
        # Calculate standard normal distribution Z-score for alpha
        z_score = norm.ppf(alpha)
        var_val = mean + z_score * std
        return float(-var_val)
        
    else:
        raise ValueError(f"Unknown VaR method: {method}. Use 'historical' or 'parametric'.")

def conditional_value_at_risk(returns: pd.Series, confidence_level: float = 0.95, method: str = "historical") -> float:
    """
    Calculate Conditional Value at Risk (CVaR / Expected Shortfall).
    Note: Returns CVaR as a positive float.
    
    Args:
        returns: Pandas Series of periodic returns.
        confidence_level: Confidence level (e.g. 0.95 or 0.99).
        method: "historical" or "parametric" (Gaussian).
        
    Returns:
        CVaR as a positive float.
    """
    if len(returns) == 0:
        return 0.0
        
    alpha = 1.0 - confidence_level
    
    if method == "historical":
        # First calculate historical VaR
        var_val = value_at_risk(returns, confidence_level, method="historical")
        # CVaR is the mean of all returns that are worse than -VaR
        tail_returns = returns[returns <= -var_val]
        if len(tail_returns) == 0:
            return float(var_val)
        return float(-tail_returns.mean())
        
    elif method == "parametric":
        mean = returns.mean()
        std = returns.std(ddof=1)
        if np.isnan(std) or std == 0.0:
            return 0.0
        # Formula for parametric CVaR of normal distribution
        # CVaR = -mean + std * (phi(z_alpha) / alpha)
        # where phi is standard normal PDF, z_alpha is standard normal PPF
        z_score = norm.ppf(alpha)
        pdf_val = norm.pdf(z_score)
        cvar_val = -mean + std * (pdf_val / alpha)
        return float(cvar_val)
        
    else:
        raise ValueError(f"Unknown CVaR method: {method}. Use 'historical' or 'parametric'.")
