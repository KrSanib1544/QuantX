import gymnasium as gym
import pandas as pd
import numpy as np
import os
from stable_baselines3 import PPO, DQN, A2C
from typing import Dict, Any

from ml.reinforcement_learning.trading_env import TradingEnvironment

def train_rl_agent(
    df: pd.DataFrame,
    feature_cols: list,
    algorithm: str = "PPO",
    total_timesteps: int = 10000,
    model_name: str = "trading_agent"
) -> str:
    """
    Train a Stable-Baselines3 RL Agent.
    """
    # Create Env
    env = TradingEnvironment(df, feature_cols)
    
    # Initialize algorithm
    if algorithm.upper() == "PPO":
        model = PPO("MlpPolicy", env, verbose=1, learning_rate=0.0003)
    elif algorithm.upper() == "DQN":
        model = DQN("MlpPolicy", env, verbose=1, learning_rate=0.0001)
    elif algorithm.upper() == "A2C":
        model = A2C("MlpPolicy", env, verbose=1, learning_rate=0.0007)
    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")
        
    print(f"Starting RL training using {algorithm} for {total_timesteps} timesteps...")
    model.learn(total_timesteps=total_timesteps)
    
    # Save the model
    os.makedirs("ml/reinforcement_learning/registry", exist_ok=True)
    save_path = f"ml/reinforcement_learning/registry/{model_name}_{algorithm.lower()}"
    model.save(save_path)
    print(f"Model saved successfully to: {save_path}")
    
    return save_path

def evaluate_rl_agent(
    df: pd.DataFrame,
    feature_cols: list,
    model_path: str,
    algorithm: str = "PPO"
) -> Dict[str, Any]:
    """
    Evaluate a trained RL agent on a test dataset.
    """
    # Create Env
    env = TradingEnvironment(df, feature_cols)
    
    # Load Model
    if algorithm.upper() == "PPO":
        model = PPO.load(model_path, env=env)
    elif algorithm.upper() == "DQN":
        model = DQN.load(model_path, env=env)
    elif algorithm.upper() == "A2C":
        model = A2C.load(model_path, env=env)
    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")
        
    obs, info = env.reset()
    done = False
    
    while not done:
        action, _states = model.predict(obs, deterministic=True)
        # stable-baselines3 returns step output as: obs, reward, terminated, truncated, info
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated
        
    # Return metrics
    return {
        "final_value": env.portfolio_value,
        "total_return": (env.portfolio_value / env.initial_cash) - 1.0,
        "total_trades": len(env.trades_history),
        "history": env.portfolio_value_history
    }

if __name__ == "__main__":
    # Generate mock training dataset
    import datetime
    start_date = datetime.date(2024, 1, 1)
    dates = [start_date + datetime.timedelta(days=i) for i in range(500)]
    data = np.random.randn(500, 5)
    close = 100.0 + np.cumsum(0.1 * data[:, 0] + 0.05 * np.random.randn(500))
    
    df = pd.DataFrame(data, columns=[f"feat_{i}" for i in range(5)], index=dates)
    df["close"] = close
    
    features = [f"feat_{i}" for i in range(5)]
    
    # Train lightweight DQN/PPO
    print("Training PPO Agent...")
    model_path = train_rl_agent(df, features, algorithm="PPO", total_timesteps=1000)
    
    # Evaluate PPO Agent
    print("Evaluating PPO Agent...")
    results = evaluate_rl_agent(df, features, model_path, algorithm="PPO")
    print(f"Final portfolio value: {results['final_value']:.2f}")
    print(f"Total trades: {results['total_trades']}")
