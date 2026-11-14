# AI Stock Groups

Tracks three illustrative AI-related stock groups (Big Tech, AI semis, AI cloud & data-center) against the S&P 500 (SPY).

```
AI-Stock-Groups/
├── .github/workflows/update.yml   # weekday cron: runs the script, commits the CSV
├── scripts/fetch_data.py          # yfinance -> long-format CSV
├── data/ai_stocks.csv             # Date, ticker, name, group, close (adjusted)
├── observable/notebook.js         # Observable notebook cells (paste in order)
├── requirements.txt
└── README.md
```

Repo must be public so Observable can read the raw CSV.
