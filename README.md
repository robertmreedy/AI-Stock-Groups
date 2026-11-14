# AI-Stock-Groups

Tracks three illustrative groups of AI-related stocks against the S&P 500 and visualizes returns over any window (1W to 1Y or a custom range) in an Observable notebook. Data refreshes automatically every weekday after the US market close.

## Groups

| Group | Tickers |
|---|---|
| Big Tech | AMZN, GOOGL, MSFT, AAPL, META |
| AI semis | NVDA, AVGO, AMD, MU, MRVL |
| AI cloud & data-center | IREN, CORZ, APLD, CRWV, NBIS |
| Benchmark | SPY (S&P 500 proxy) |

Groups are illustrative, not an official classification.

## How it works

```
yfinance → scripts/fetch_data.py → data/ai_stocks.csv → GitHub raw URL → Observable notebook
              ▲
   GitHub Action (weekdays, 22:30 UTC)
```

1. A GitHub Action runs `scripts/fetch_data.py` after the close.
2. The script downloads ~400 days of dividend-adjusted closes and writes a long-format CSV.
3. The Action commits the CSV if it changed.
4. The Observable notebook reads the CSV from `raw.githubusercontent.com`, rebases to the selected window, and renders the charts.

## Data schema

`data/ai_stocks.csv`, one row per ticker per trading day:

| Column | Description |
|---|---|
| `Date` | Trading date, `YYYY-MM-DD` |
| `ticker` | Symbol |
| `name` | Display name |
| `group` | Group label (matches the notebook palette) |
| `close` | Dividend- and split-adjusted close |

The CSV stores raw adjusted closes, not indexed values. The notebook rebases to the selected window, so changing the date range never requires regenerating data.

## Caveats

- Newly listed tickers have shorter histories. Their windows start at first available data.
- yfinance is an unofficial Yahoo Finance wrapper and can break or return gaps. The script prints a warning when a ticker returns no data.
- For tracking and visualization only. Not investment advice.
