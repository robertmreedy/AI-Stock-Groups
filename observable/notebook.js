// ─────────────────────────────────────────────────────────────
// AI Stock Groups — Observable notebook
// Each "// ── cell ──" block is one cell. Paste them in order.
// Only change: dataUrl (your GitHub user/repo).
// ─────────────────────────────────────────────────────────────

// ── cell: dataUrl ──
dataUrl = "https://raw.githubusercontent.com/robertmreedy/AI-Stock-Groups/main/data/ai_stocks.csv"

// ── cell: raw ──
raw = d3.csv(dataUrl, d3.autoType)

// ── cell: palette ──
palette = new Map([
  ["Big Tech", "#f24e2a"],
  ["AI semis", "#e5b50a"],
  ["AI cloud & data-center", "#008c68"],
  ["S&P 500", "#6b6b6b"]
])

// ── cell: groups ──
groups = ["Big Tech", "AI semis", "AI cloud & data-center"]

// ── cell: lastDate ──
lastDate = d3.max(raw, d => d.Date)

// ── cell: firstDate ──
firstDate = d3.min(raw, d => d.Date)

// ── cell: fmt ──
fmt = d3.format("+.1%")

// ── cell: preset (date adjuster) ──
viewof preset = Inputs.radio(
  new Map([["1W", 7], ["1M", 30], ["3M", 90], ["6M", 180], ["YTD", "ytd"], ["1Y", 365], ["Custom", "custom"]]),
  {label: "Window", value: 7}
)

// ── cell: customRange (only used when Window = Custom) ──
viewof customRange = Inputs.form([
  Inputs.date({label: "Start", value: d3.utcDay.offset(lastDate, -30), min: firstDate, max: lastDate}),
  Inputs.date({label: "End", value: lastDate, min: firstDate, max: lastDate})
])

// ── cell: win ──
win = {
  const custom = preset === "custom";
  const end = custom ? customRange[1] : lastDate;
  const start = custom ? customRange[0]
    : preset === "ytd" ? new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1))
    : d3.utcDay.offset(lastDate, -preset);
  return {start, end};
}

// ── cell: rebase ──
// Base = last close on or before the window start (so 1W = prior-Friday close to latest close).
rebase = (data, start, end) => {
  const bisect = d3.bisector(d => d.Date);
  const out = [];
  for (const [, rows] of d3.group(data, d => d.ticker)) {
    rows.sort((a, b) => a.Date - b.Date);
    const upto = rows.filter(d => d.Date <= end);
    if (!upto.length) continue;
    let i = bisect.right(upto, start) - 1;
    if (i < 0) i = 0;
    const base = upto[i].close;
    for (const r of upto.slice(i)) out.push({...r, ret: r.close / base - 1, idx: 100 * r.close / base});
  }
  return out;
}

// ── cell: stocks ──
stocks = rebase(raw, win.start, win.end)

// ── cell: latest ──
latest = Array.from(d3.group(stocks, d => d.ticker).values(), v => d3.greatest(v, d => d.Date))

// ── cell: spyRet ──
spyRet = latest.find(d => d.ticker === "SPY")?.ret ?? 0

// ── cell: groupSeries (equal-weight average of member returns, by day) ──
groupSeries = {
  const members = stocks.filter(d => d.group !== "S&P 500");
  const avg = Array.from(
    d3.rollup(members, v => d3.mean(v, d => d.ret), d => d.group, d => +d.Date),
    ([group, m]) => Array.from(m, ([t, ret]) => ({group, Date: new Date(t), ret, idx: 100 * (1 + ret)}))
  ).flat();
  const spy = stocks.filter(d => d.group === "S&P 500")
    .map(d => ({group: "S&P 500", Date: d.Date, ret: d.ret, idx: d.idx}));
  return [...avg, ...spy];
}

// ── cell: returnsChart (recreates the screenshot: "The AI divide") ──
returnsChart = {
  const members = latest.filter(d => d.group !== "S&P 500");
  const lo = Math.min(0, d3.min(members, d => d.ret), spyRet);
  const hi = Math.max(0, d3.max(members, d => d.ret), spyRet);
  const pad = (hi - lo) * 0.14;
  const domain = [lo - pad, hi + pad];
  const rowH = 30;
  const dateFmt = d3.utcFormat("%b %-d, %Y");

  const panel = (group, first, last) => {
    const rows = members.filter(d => d.group === group).sort((a, b) => d3.descending(a.ret, b.ret));
    const color = palette.get(group);
    return Plot.plot({
      width: 900,
      height: rows.length * rowH + 30 + (last ? 40 : 6),
      marginLeft: 120, marginRight: 20, marginTop: 30, marginBottom: last ? 40 : 6,
      style: {fontSize: "14px", background: "transparent", color: "#1a1a1a"},
      x: {domain, grid: true, label: null, tickFormat: d3.format(".0%"), axis: last ? "bottom" : null},
      y: {domain: rows.map(d => d.name), label: null, padding: 0.25},
      marks: [
        Plot.barX(rows, {y: "name", x: "ret", fill: color}),
        Plot.ruleX([0]),
        Plot.ruleX([spyRet], {stroke: "#777", strokeDasharray: "4,3"}),
        Plot.text(rows.filter(d => d.ret >= 0), {y: "name", x: "ret", text: d => fmt(d.ret), textAnchor: "start", dx: 6}),
        Plot.text(rows.filter(d => d.ret < 0), {y: "name", x: "ret", text: d => fmt(d.ret), textAnchor: "end", dx: -6}),
        Plot.text([group], {frameAnchor: "top-left", dx: -120, dy: -18, fontWeight: "bold", fontSize: 15, fill: "#1a1a1a"}),
        first ? Plot.text([`S&P 500  ${fmt(spyRet)}`], {x: spyRet, frameAnchor: "top", dy: -14, fill: "#666", fontSize: 12}) : null
      ]
    });
  };

  return html`<div style="background:#fff;color:#1a1a1a;padding:24px;max-width:900px;font-family:system-ui,sans-serif">
    <h2 style="margin:0 0 6px;font-size:34px;font-weight:800">The AI divide</h2>
    <div style="color:#555;margin-bottom:8px">Selected AI-related stock returns | ${dateFmt(d3.min(stocks, d => d.Date))} – ${dateFmt(win.end)}</div>
    ${groups.map((g, i) => panel(g, i === 0, i === groups.length - 1))}
    <div style="color:#666;font-size:12px;margin-top:8px">Adjusted-close returns, base close to latest close. Dashed line = S&P 500 (SPY). Selected stocks; groups are illustrative.</div>
  </div>`;
}

// ── cell: groupChart (group averages vs S&P over the window) ──
groupChart = Plot.plot({
  width: 900, height: 460, marginRight: 190,
  style: {fontSize: "13px"},
  x: {type: "utc", label: null},
  y: {grid: true, label: "Indexed (100 = window start)"},
  color: {legend: true, domain: [...palette.keys()], range: [...palette.values()]},
  marks: [
    Plot.ruleY([100]),
    Plot.lineY(groupSeries.filter(d => d.group !== "S&P 500"), {x: "Date", y: "idx", stroke: "group", strokeWidth: 2.5}),
    Plot.lineY(groupSeries.filter(d => d.group === "S&P 500"), {x: "Date", y: "idx", stroke: "group", strokeWidth: 2, strokeDasharray: "5,4"}),
    Plot.text(groupSeries, Plot.selectLast({
      x: "Date", y: "idx", z: "group", fill: "group",
      text: d => `${d.group}  ${fmt(d.ret)}`, textAnchor: "start", dx: 8
    })),
    Plot.tip(groupSeries, Plot.pointerX({
      x: "Date", y: "idx", z: "group",
      title: d => `${d.group}\n${fmt(d.ret)}`
    }))
  ]
})

// ── cell: stockChart (every stock, faceted by group) ──
stockChart = {
  const members = stocks.filter(d => d.group !== "S&P 500");
  return Plot.plot({
    width: 900, height: 820, marginRight: 60,
    style: {fontSize: "12px"},
    x: {type: "utc", label: null},
    y: {grid: true, label: "Indexed (100 = window start)"},
    fy: {domain: groups, axis: null},
    color: {domain: [...palette.keys()], range: [...palette.values()]},
    marks: [
      Plot.ruleY([100]),
      Plot.lineY(members, {x: "Date", y: "idx", z: "ticker", fy: "group", stroke: "group", strokeWidth: 1.5}),
      Plot.text(members, Plot.selectLast({x: "Date", y: "idx", z: "ticker", fy: "group", text: "ticker", fill: "group", textAnchor: "start", dx: 6})),
      Plot.text(groups, {fy: d => d, frameAnchor: "top-left", dx: 6, dy: 6, text: d => d, fontWeight: "bold", fontSize: 14}),
      Plot.tip(members, Plot.pointer({x: "Date", y: "idx", fy: "group", title: d => `${d.name}\n${fmt(d.ret)}`}))
    ]
  });
}

// ── cell: returnsTable (all windows at once, ignores the selector) ──
returnsTable = {
  const periods = [["1W", 7], ["1M", 30], ["3M", 90], ["6M", 180], ["YTD", "ytd"], ["1Y", 365]];
  const end = lastDate;
  const startFor = p => p === "ytd" ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1)) : d3.utcDay.offset(end, -p);
  const byPeriod = periods.map(([label, p]) => [
    label,
    new Map(Array.from(d3.group(rebase(raw, startFor(p), end), d => d.ticker), ([t, v]) => [t, v.at(-1).ret]))
  ]);
  const meta = d3.groups(raw, d => d.ticker).map(([, v]) => v[0]);
  const rows = meta.map(m => ({
    Ticker: m.ticker, Name: m.name, Group: m.group,
    ...Object.fromEntries(byPeriod.map(([l, mp]) => [l, mp.get(m.ticker)]))
  }));
  const avgRows = [...groups, "S&P 500"].map(g => ({
    Ticker: g === "S&P 500" ? "SPY" : "AVG",
    Name: g === "S&P 500" ? "S&P 500 (SPY)" : `${g} (equal-weight avg)`,
    Group: g,
    ...Object.fromEntries(byPeriod.map(([l]) => [l, d3.mean(rows.filter(r => r.Group === g), r => r[l])]))
  }));
  const sorted = [...avgRows.filter(r => r.Ticker === "AVG"), ...rows.filter(r => r.Group !== "S&P 500")];
  const color = x => x >= 0 ? "#008c68" : "#d33";
  return Inputs.table(sorted, {
    format: Object.fromEntries(periods.map(([l]) => [l,
      x => x == null ? "" : html`<span style="color:${color(x)}">${fmt(x)}</span>`])),
    rows: 25
  });
}
