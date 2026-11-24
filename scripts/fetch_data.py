import os
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

# group -> {ticker: display name}. Groups are illustrative; edit freely.
GROUPS = {
    "Big Tech": {
        "AMZN": "Amazon", "GOOGL": "Alphabet", "MSFT": "Microsoft",
        "AAPL": "Apple", "META": "Meta",
    },
    "AI semis": {
        "NVDA": "Nvidia", "AVGO": "Broadcom", "AMD": "AMD",
        "MU": "Micron", "MRVL": "Marvell", "TSM": "TSMC",
},
    "AI power": {
        "VRT": "Vertiv", "GEV": "GE Vernova", "CEG": "Constellation",
        "VST": "Vistra", "ETN": "Eaton",
},
    "AI cloud & data-center": {
        "IREN": "IREN", "CORZ": "Core Scientific", "APLD": "Applied Digital",
        "CRWV": "CoreWeave", "NBIS": "Nebius",
    },
    "S&P 500": {"SPY": "S&P 500 (SPY)"},  # benchmark, dividend-adjusted proxy
}

META = pd.DataFrame(
    [(t, n, g) for g, members in GROUPS.items() for t, n in members.items()],
    columns=["ticker", "name", "group"],
)

# ~400 days so a full 1Y window still has a base close before its start date
end = datetime.today() + timedelta(days=1)
start = end - timedelta(days=400)

tickers = META["ticker"].tolist()
raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)["Close"]

missing = [t for t in tickers if t not in raw.columns or raw[t].dropna().empty]
if missing:
    print(f"WARNING: no data returned for {missing}")

raw.index.name = "Date"
long_df = (
    raw.reset_index()
    .melt(id_vars="Date", var_name="ticker", value_name="close")
    .dropna()
    .merge(META, on="ticker", how="left")
)
long_df["Date"] = pd.to_datetime(long_df["Date"]).dt.strftime("%Y-%m-%d")
long_df["close"] = long_df["close"].round(4)
long_df = long_df[["Date", "ticker", "name", "group", "close"]].sort_values(["Date", "ticker"])

os.makedirs("data", exist_ok=True)
long_df.to_csv("data/ai_stocks.csv", index=False)
print(f"Done — {len(long_df)} rows written to data/ai_stocks.csv "
      f"({long_df['Date'].min()} to {long_df['Date'].max()})")
