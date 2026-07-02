import numpy as np
import pandas as pd
# pyrefly: ignore [missing-import]
from scipy.optimize import minimize
from typing import Dict, Any, Tuple, List

class PortfolioOptimizer:
    def __init__(self, risk_free_rate: float = 0.0):
        self.risk_free_rate = risk_free_rate

    def mean_variance_optimization(self, returns_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Perform Mean-Variance Optimization to maximize the Sharpe ratio.
        """
        mean_returns = returns_df.mean() * 252
        cov_matrix = returns_df.cov() * 252
        num_assets = len(mean_returns)
        
        # Define objective function: negative Sharpe ratio
        def negative_sharpe(weights):
            p_return = np.sum(mean_returns * weights)
            p_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            if p_volatility == 0.0:
                return 0.0
            return -(p_return - self.risk_free_rate) / p_volatility

        # Constraints: weights sum to 1
        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1.0})
        
        # Bounds: long-only (0 to 1)
        bounds = tuple((0.0, 1.0) for _ in range(num_assets))
        
        # Initial guess
        initial_weights = np.array(num_assets * [1.0 / num_assets])
        
        result = minimize(
            negative_sharpe, 
            initial_weights, 
            method='SLSQP', 
            bounds=bounds, 
            constraints=constraints
        )
        
        if not result.success:
            # Fallback to equal weight
            weights = initial_weights
        else:
            weights = result.x
            
        opt_return = np.sum(mean_returns * weights)
        opt_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        opt_sharpe = (opt_return - self.risk_free_rate) / opt_volatility if opt_volatility > 0.0 else 0.0
        
        return {
            "weights": {returns_df.columns[i]: float(weights[i]) for i in range(num_assets)},
            "expected_return": float(opt_return),
            "expected_volatility": float(opt_volatility),
            "sharpe_ratio": float(opt_sharpe)
        }

    def risk_parity_optimization(self, returns_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Perform Risk Parity Optimization so that each asset contributes equally to risk.
        """
        cov_matrix = returns_df.cov() * 252
        num_assets = len(cov_matrix)
        
        # Objective: minimize squared differences between asset risk contributions
        def risk_parity_objective(weights):
            portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            if portfolio_vol == 0.0:
                return 0.0
            # Marginal risk contribution
            mrc = np.dot(cov_matrix, weights) / portfolio_vol
            # Risk contribution
            rc = weights * mrc
            # Sum of squared differences of risk contributions
            diffs = rc[:, np.newaxis] - rc[np.newaxis, :]
            return np.sum(diffs ** 2)

        # Constraints: weights sum to 1
        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1.0})
        # Bounds: long-only (0 to 1)
        bounds = tuple((0.0, 1.0) for _ in range(num_assets))
        # Initial guess: equal weight
        initial_weights = np.array(num_assets * [1.0 / num_assets])
        
        result = minimize(
            risk_parity_objective, 
            initial_weights, 
            method='SLSQP', 
            bounds=bounds, 
            constraints=constraints
        )
        
        if not result.success:
            weights = initial_weights
        else:
            weights = result.x
            
        # Compute final portfolio metrics
        mean_returns = returns_df.mean() * 252
        opt_return = np.sum(mean_returns * weights)
        opt_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        opt_sharpe = (opt_return - self.risk_free_rate) / opt_volatility if opt_volatility > 0.0 else 0.0

        return {
            "weights": {returns_df.columns[i]: float(weights[i]) for i in range(num_assets)},
            "expected_return": float(opt_return),
            "expected_volatility": float(opt_volatility),
            "sharpe_ratio": float(opt_sharpe)
        }

    def black_litterman_optimization(
        self, 
        returns_df: pd.DataFrame, 
        market_weights: np.ndarray, 
        views: np.ndarray, 
        view_link_matrix: np.ndarray,
        view_omega: np.ndarray,
        tau: float = 0.05
    ) -> Dict[str, Any]:
        """
        Perform Black-Litterman allocation.
        """
        cov_matrix = returns_df.cov().values * 252
        mean_returns = returns_df.mean().values * 252
        num_assets = len(mean_returns)
        
        # If arrays don't match, return equal weight
        if len(market_weights) != num_assets or len(views) != len(view_link_matrix):
            initial_weights = np.array(num_assets * [1.0 / num_assets])
            return {
                "weights": {returns_df.columns[i]: float(initial_weights[i]) for i in range(num_assets)},
                "expected_return": float(np.mean(mean_returns)),
                "expected_volatility": 0.0,
                "sharpe_ratio": 0.0
            }
            
        # Risk aversion parameter (lambda)
        # Assuming lambda = 2.5
        delta = 2.5
        
        # Equilibrium excess returns (pi = delta * Sigma * w_m)
        pi = delta * np.dot(cov_matrix, market_weights)
        
        # Black-Litterman formula for posterior returns
        # E(R) = pi + tau * Sigma * P^T * (P * tau * Sigma * P^T + Omega)^-1 * (Q - P * pi)
        P = view_link_matrix
        Q = views
        Omega = view_omega
        
        sigma_p_t = np.dot(cov_matrix, P.T)
        middle_inv = np.linalg.inv(np.dot(P, np.dot(tau * cov_matrix, P.T)) + Omega)
        bl_returns = pi + tau * np.dot(sigma_p_t, np.dot(middle_inv, Q - np.dot(P, pi)))
        
        # Calculate optimal weights based on posterior returns bl_returns
        # We can use MVO maximizing posterior returns
        def negative_posterior_utility(weights):
            p_return = np.sum(bl_returns * weights)
            p_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
            if p_volatility == 0.0:
                return 0.0
            return -(p_return / p_volatility)

        constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - 1.0})
        bounds = tuple((0.0, 1.0) for _ in range(num_assets))
        initial_weights = np.array(num_assets * [1.0 / num_assets])
        
        result = minimize(
            negative_posterior_utility, 
            initial_weights, 
            method='SLSQP', 
            bounds=bounds, 
            constraints=constraints
        )
        
        if not result.success:
            weights = initial_weights
        else:
            weights = result.x
            
        opt_return = np.sum(mean_returns * weights)
        opt_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        opt_sharpe = (opt_return - self.risk_free_rate) / opt_volatility if opt_volatility > 0.0 else 0.0

        return {
            "weights": {returns_df.columns[i]: float(weights[i]) for i in range(num_assets)},
            "expected_return": float(opt_return),
            "expected_volatility": float(opt_volatility),
            "sharpe_ratio": float(opt_sharpe)
        }
