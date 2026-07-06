import os
import datetime
import numpy as np
import pandas as pd

def test_parse():
    workspace_root = r"c:\KrSanib\Resume Projects\QuantX"
    nifty_csv = os.path.join(workspace_root, "Nifty50_Stocks", "nifty50_historical_data.csv")
    df_nifty = pd.read_csv(nifty_csv)
    df_nifty["Date_Parsed"] = pd.to_datetime(df_nifty["Date"].apply(lambda x: x.split("+")[0]))
    unique_dates = sorted(df_nifty["Date_Parsed"].unique())
    print(f"Unique dates from Nifty: {len(unique_dates)}, from {unique_dates[0]} to {unique_dates[-1]}")
    
    symbol = "AAPL"
    csv_path = os.path.join(workspace_root, "Nasdaq_Stocks", "stocks", f"{symbol}.csv")
    print(f"Reading {symbol} from {csv_path}...")
    df_global = pd.read_csv(csv_path)
    df_global["Date_Parsed"] = pd.to_datetime(df_global["Date"])
    print(f"Loaded {len(df_global)} rows of {symbol}. Min Date: {df_global['Date_Parsed'].min()}, Max Date: {df_global['Date_Parsed'].max()}")
    
    # Filter 1999 onwards
    df_global = df_global[df_global["Date_Parsed"] >= "1999-01-01"]
    print(f"After filtering 1999+: {len(df_global)} rows")
    
    # Create date-to-row map
    price_map = {}
    for _, row in df_global.iterrows():
        dt_str = row["Date_Parsed"].strftime("%Y-%m-%d")
        price_map[dt_str] = {
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": float(row["Volume"])
        }
        
    # Check max date in global csv
    max_csv_date = df_global["Date_Parsed"].max()
    print(f"Max CSV Date: {max_csv_date}")
    
    # We will align with unique_dates
    aligned_prices = []
    last_price = 100.0
    
    # Grab the last row for starting the simulation
    if len(df_global) > 0:
        last_row = df_global.iloc[-1]
        last_price = float(last_row["Close"])
        
    vol = 0.02
    drift = 0.0005
    
    for dt in unique_dates:
        dt_str = dt.strftime("%Y-%m-%d")
        if dt_str in price_map:
            row_data = price_map[dt_str]
            aligned_prices.append({
                "date": dt,
                "open": row_data["open"],
                "high": row_data["high"],
                "low": row_data["low"],
                "close": row_data["close"],
                "volume": row_data["volume"]
            })
            last_price = row_data["close"]
        else:
            # Generate simulated step starting from last_price
            change = np.random.normal(drift, vol)
            close_px = last_price * np.exp(change)
            open_px = last_price
            high_px = max(open_px, close_px) * (1.0 + abs(np.random.normal(0, vol/4)))
            low_px = min(open_px, close_px) * (1.0 - abs(np.random.normal(0, vol/4)))
            volume = float(np.random.randint(1000000, 20000000))
            
            aligned_prices.append({
                "date": dt,
                "open": open_px,
                "high": high_px,
                "low": low_px,
                "close": close_px,
                "volume": volume
            })
            last_price = close_px
            
    print(f"Aligned prices length: {len(aligned_prices)}")
    print(f"Final aligned price on {aligned_prices[-1]['date']}: {aligned_prices[-1]['close']}")

if __name__ == "__main__":
    test_parse()
