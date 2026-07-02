import pandas as pd
import numpy as np
import pandas_ta as ta
from typing import Dict, Any, List

class FeaturePipeline:
    def __init__(self, version: str = "v1"):
        self.version = version

    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute 100+ technical and statistical features for a given OHLCV DataFrame.
        df requires: [open, high, low, close, volume]
        """
        # Ensure we work on a copy and columns are lowercase
        df = df.copy()
        df.columns = [c.lower() for c in df.columns]
        
        # Guard clause for empty or small dataframes
        if len(df) < 50:
            return df
            
        # 1. Simple returns and lags (15 features)
        for lag in range(1, 11):
            df[f'return_lag_{lag}'] = df['close'].pct_change(periods=lag)
            df[f'close_lag_{lag}'] = df['close'].shift(lag)
            
        # 2. Moving Averages (18 features)
        windows = [5, 10, 20, 50, 100, 200]
        for w in windows:
            df[f'sma_{w}'] = ta.sma(df['close'], length=w)
            df[f'ema_{w}'] = ta.ema(df['close'], length=w)
            # Distance from price to MA
            df[f'dist_sma_{w}'] = (df['close'] - df[f'sma_{w}']) / df[f'sma_{w}']
            df[f'dist_ema_{w}'] = (df['close'] - df[f'ema_{w}']) / df[f'ema_{w}']

        # 3. Momentum indicators (15 features)
        for w in [9, 14, 21]:
            df[f'rsi_{w}'] = ta.rsi(df['close'], length=w)
            
        macd_df = ta.macd(df['close'])
        if macd_df is not None:
            df = pd.concat([df, macd_df], axis=1)
            
        # CCI, CMO, ROC, STOCH
        df['cci_14'] = ta.cci(df['high'], df['low'], df['close'], length=14)
        df['cmo_14'] = ta.cmo(df['close'], length=14)
        df['roc_10'] = ta.roc(df['close'], length=10)
        
        stoch_df = ta.stoch(df['high'], df['low'], df['close'])
        if stoch_df is not None:
            df = pd.concat([df, stoch_df], axis=1)

        # 4. Volatility & Band indicators (15 features)
        for w in [10, 20, 50]:
            df[f'atr_{w}'] = ta.atr(df['high'], df['low'], df['close'], length=w)
            df[f'std_{w}'] = df['close'].rolling(window=w).std()
            df[f'volatility_{w}'] = df[f'return_lag_1'].rolling(window=w).std() * np.sqrt(252)
            
        bbands = ta.bbands(df['close'], length=20, std=2)
        if bbands is not None:
            df = pd.concat([df, bbands], axis=1)

        # 5. Volume Indicators (10 features)
        df['obv'] = ta.obv(df['close'], df['volume'])
        df['ad'] = ta.ad(df['high'], df['low'], df['close'], df['volume'])
        
        # VWAP (if datetime index is set, we can compute it. If not, default fallback)
        try:
            df['vwap'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'])
        except Exception:
            df['vwap'] = (df['volume'] * (df['high'] + df['low'] + df['close']) / 3).cumsum() / df['volume'].cumsum()
            
        df['volume_sma_20'] = ta.sma(df['volume'], length=20)
        df['volume_ratio'] = df['volume'] / df['volume_sma_20']

        # 6. Trend and Directional Strength (10 features)
        adx_df = ta.adx(df['high'], df['low'], df['close'], length=14)
        if adx_df is not None:
            df = pd.concat([df, adx_df], axis=1)
            
        # 7. Statistical moments & rolling metrics (15 features)
        for w in [10, 30]:
            df[f'skew_{w}'] = df['return_lag_1'].rolling(window=w).skew()
            df[f'kurt_{w}'] = df['return_lag_1'].rolling(window=w).kurt()
            df[f'max_{w}'] = df['high'].rolling(window=w).max()
            df[f'min_{w}'] = df['low'].rolling(window=w).min()
            # Rolling Max Drawdown within window
            # simple calculation
            roll_max = df['close'].rolling(window=w, min_periods=1).max()
            df[f'roll_drawdown_{w}'] = (roll_max - df['close']) / roll_max

        # 8. Regime & Market regimes (5 features)
        # Regime: 1 = Bull Market (Fast MA > Slow MA and low vol), -1 = Bear Market (Fast MA < Slow MA), 0 = Sideways
        # We define Bull if EMA_20 > EMA_50 and ATR_20 / close < mean(ATR)
        atr_ratio = df['atr_20'] / df['close']
        avg_atr_ratio = atr_ratio.rolling(50).mean()
        
        df['regime'] = 0
        df.loc[(df['ema_20'] > df['ema_50']) & (atr_ratio < avg_atr_ratio), 'regime'] = 1
        df.loc[(df['ema_20'] < df['ema_50']), 'regime'] = -1
        
        # Fill missing values
        df = df.bfill().ffill()
        
        # Return only calculated features along with ohlcv
        return df

    def get_feature_metadata(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Generate feature definitions and descriptions.
        """
        metadata = []
        for col in df.columns:
            metadata.append({
                "feature_name": col,
                "type": str(df[col].dtype),
                "has_nans": bool(df[col].isna().any()),
                "version": self.version
            })
        return metadata
