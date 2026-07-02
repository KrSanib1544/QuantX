import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
import os
import matplotlib.pyplot as plt
from typing import Tuple, Dict, Any

from ml.forecasting.models import LSTMForecaster, GRUForecaster, TransformerForecaster

# Set seed
torch.manual_seed(42)
np.random.seed(42)

class TimeSeriesDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

def create_rolling_windows(data: np.ndarray, target: np.ndarray, lookback: int = 60) -> Tuple[np.ndarray, np.ndarray]:
    """
    Creates sequences of shape (N - lookback, lookback, features) and targets of shape (N - lookback, 1)
    """
    X, y = [], []
    for i in range(len(data) - lookback):
        X.append(data[i : i + lookback])
        y.append(target[i + lookback])
    return np.array(X), np.array(y).reshape(-1, 1)

def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Compute regression and directional classification metrics.
    """
    mae = np.mean(np.abs(y_true - y_pred))
    rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
    
    # MAPE avoiding division by zero
    epsilon = 1e-5
    mape = np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + epsilon)))
    
    # Directional accuracy: sign of actual return matches sign of predicted return
    same_sign = (np.sign(y_true) == np.sign(y_pred))
    dir_acc = np.mean(same_sign)
    
    # Precision, Recall for positive direction (returns > 0)
    actual_pos = (y_true > 0)
    pred_pos = (y_pred > 0)
    
    tp = np.sum(actual_pos & pred_pos)
    fp = np.sum(~actual_pos & pred_pos)
    fn = np.sum(actual_pos & ~pred_pos)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    
    return {
        "MAE": float(mae),
        "RMSE": float(rmse),
        "MAPE": float(mape),
        "Directional_Accuracy": float(dir_acc),
        "Precision": float(precision),
        "Recall": float(recall)
    }

def train_forecaster(
    df: pd.DataFrame,
    feature_cols: list,
    target_col: str,
    model_type: str = "lstm",
    lookback: int = 60,
    epochs: int = 15,
    batch_size: int = 32,
    lr: float = 0.001
) -> Tuple[nn.Module, StandardScaler, Dict[str, float]]:
    
    # 1. Temporal chronological split (Train 70%, Val 15%, Test 15%)
    n = len(df)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    
    df_train = df.iloc[:train_end]
    df_val = df.iloc[train_end:val_end]
    df_test = df.iloc[val_end:]
    
    # 2. Scale features independently (fit on train, transform on val/test to prevent leakage)
    scaler = StandardScaler()
    
    X_train_raw = df_train[feature_cols].values
    X_val_raw = df_val[feature_cols].values
    X_test_raw = df_test[feature_cols].values
    
    X_train_scaled = scaler.fit_transform(X_train_raw)
    X_val_scaled = scaler.transform(X_val_raw)
    X_test_scaled = scaler.transform(X_test_raw)
    
    y_train_raw = df_train[target_col].values
    y_val_raw = df_val[target_col].values
    y_test_raw = df_test[target_col].values
    
    # 3. Create rolling window sequences
    X_train, y_train = create_rolling_windows(X_train_scaled, y_train_raw, lookback)
    X_val, y_val = create_rolling_windows(X_val_scaled, y_val_raw, lookback)
    X_test, y_test = create_rolling_windows(X_test_scaled, y_test_raw, lookback)
    
    # Create DataLoaders
    train_dataset = TimeSeriesDataset(X_train, y_train)
    val_dataset = TimeSeriesDataset(X_val, y_val)
    test_dataset = TimeSeriesDataset(X_test, y_test)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    
    # 4. Model instantiation
    input_dim = len(feature_cols)
    if model_type.lower() == "lstm":
        model = LSTMForecaster(input_dim=input_dim)
    elif model_type.lower() == "gru":
        model = GRUForecaster(input_dim=input_dim)
    elif model_type.lower() == "transformer":
        model = TransformerForecaster(input_dim=input_dim)
    else:
        raise ValueError(f"Unknown model type: {model_type}")
        
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    # 5. Training loop
    model.train()
    for epoch in range(epochs):
        epoch_loss = 0.0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            pred = model(batch_x)
            loss = criterion(pred, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * batch_x.size(0)
            
        epoch_loss /= len(train_loader.dataset)
        print(f"Epoch {epoch+1}/{epochs} Loss: {epoch_loss:.6f}")
        
    # 6. Evaluation on test set
    model.eval()
    with torch.no_grad():
        test_inputs = torch.tensor(X_test, dtype=torch.float32)
        test_preds = model(test_inputs).numpy().flatten()
        
    metrics = evaluate_predictions(y_test.flatten(), test_preds)
    print(f"\n--- {model_type.upper()} Test Performance ---")
    for k, v in metrics.items():
        print(f"{k}: {v:.6f}")
        
    # Save the model weights
    os.makedirs("ml/forecasting/registry", exist_ok=True)
    torch.save(model.state_dict(), f"ml/forecasting/registry/{model_type.lower()}_forecaster.pt")
    
    return model, scaler, metrics

if __name__ == "__main__":
    # Generate some dummy data to test the pipeline
    import datetime
    start_date = datetime.date(2024, 1, 1)
    dates = [start_date + datetime.timedelta(days=i) for i in range(1000)]
    # 5 features
    data = np.random.randn(1000, 5)
    # Target return is a combination of features plus noise
    target = 0.1 * data[:, 0] - 0.2 * data[:, 1] + 0.05 * np.random.randn(1000)
    
    df = pd.DataFrame(data, columns=[f"feat_{i}" for i in range(5)], index=dates)
    df["target_return"] = target
    
    features = [f"feat_{i}" for i in range(5)]
    
    print("Training LSTM Forecaster...")
    train_forecaster(df, features, "target_return", "lstm", epochs=2)
    
    print("\nTraining GRU Forecaster...")
    train_forecaster(df, features, "target_return", "gru", epochs=2)
    
    print("\nTraining Transformer Forecaster...")
    train_forecaster(df, features, "target_return", "transformer", epochs=2)
