import sys
import traceback
try:
    import yfinance as yf
    print("yfinance imported.")
    ticker = yf.Ticker("AAPL")
    print("Ticker created.")
    df = ticker.history(period="1d")
    print("History downloaded:")
    print(df)
except BaseException as e:
    print(f"Exception caught: {type(e).__name__}: {e}")
    traceback.print_exc()
