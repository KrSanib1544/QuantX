import os
import pandas as pd

nifty_path = r"c:\KrSanib\Resume Projects\QuantX\Nifty50_Stocks\nifty50_historical_data.csv"
if os.path.exists(nifty_path):
    df = pd.read_csv(nifty_path)
    null_counts = df.isnull().sum()
    if null_counts.sum() > 0:
        print("Nifty 50 CSV has null values:")
        print(null_counts)
        null_rows = df[df.isnull().any(axis=1)]
        print("First 5 null rows:")
        print(null_rows.head())
    else:
        print("Nifty 50 CSV has 0 null values.")
else:
    print("Nifty 50 CSV does not exist.")
