// ─────────────────────────────────────────────────────────────
// AI Stock Groups — Observable Notebooks 2.0 (plain JavaScript cells)
// Each "// ── cell ──" block is one JavaScript cell. Paste them in order.
// d3, Plot, Inputs, html are built in. Only change: dataUrl.
// ─────────────────────────────────────────────────────────────

// ── cell: data ──
const dataUrl = "https://raw.githubusercontent.com/robertmreedy/AI-Stock-Groups/main/data/ai_stocks.csv";
const raw = await d3.csv(dataUrl, d3.autoType);

// ── cell: constants ──
const palette = new Map([
  ["Big Tech", "#f24e2a"],
  ["AI semis", "#e5b50a"],
  ["AI cloud & data-center", "#008c68"],
  ["S&P 500", "#6b6b6b"]
]);
const groups = ["Big Tech", "AI semis", "AI cloud & data-center"];
const lastDate = d3.max(raw, d => d.Date);
const firstDate = d3.min(raw, d => d.Date);
const fmt = d3.format("+.1%");

// ── cell: date adjuster ──
const preset = view(Inputs.radio(
  new Map([["1W", 7], ["1M", 30], ["3M", 90], ["6M", 180], ["YTD", "ytd"], ["1Y", 365], ["Custom", "custom"]]),
  {label: "Window", value: 7}
));

// ── cell: custom range (only used when Window = Custom) ──
const customRange = view(Inputs.form([
  Inputs.date({label: "Start", value: d3.utcDay.offset(lastDate, -30), min: firstDate, max: lastDate}),
  Inputs.date({label: "End", value: lastDate, min: firstDate, max: lastDate})
]));

// ── cell: window + rebase logic ──
const win = (() => {
  const custom = preset === "custom";
  const end = custom ? customRange[1] : lastDate;
  const start = custom ? customRange[0]
    : preset === "ytd" ? new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1))
    : d3.utcDay.offset(lastDate, -preset);
  return {start, end};
})();

// Base = last close on or before the window start (1W = prior-Friday close to latest close).
function rebase(data, start, end) {
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

// ── cell: derived data ──
const stocks = rebase(raw, win.start, win.end);
const latest = Array.from(d3.group(stocks, d => d.ticker).values(), v => d3.greatest(v, d => d.Date));
const spyRet = latest.find(d => d.ticker === "SPY")?.ret ?? 0;

// Equal-weight average of member returns, by day
const groupSeries = (() => {
  const members = stocks.filter(d => d.group !== "S&P 500");
  const avg = Array.from(
    d3.rollup(members, v => d3.mean(v, d => d.ret), d => d.group, d => +d.Date),
    ([group, m]) => Array.from(m, ([t, ret]) => ({group, Date: new Date(t), ret, idx: 100 * (1 + ret)}))
  ).flat();
  const spy = stocks.filter(d => d.group === "S&P 500")
    .map(d => ({group: "S&P 500", Date: d.Date, ret: d.ret, idx: d.idx}));
  return [...avg, ...spy];
})();

// ── cell: "The AI divide" bar chart (responsive) ──
display((() => {
  const members = latest.filter(d => d.group !== "S&P 500");
  const dateFmt = d3.utcFormat("%b %-d, %Y");
  const lo = Math.min(0, d3.min(members, d => d.ret), spyRet);
  const hi = Math.max(0, d3.max(members, d => d.ret), spyRet);

  const render = w => {
    const mobile = w < 600;
    const outer = Math.min(900, w);
    const padPx = mobile ? 14 : 24;
    const inner = outer - 2 * padPx;
    const ml = mobile ? 108 : 120, mr = mobile ? 64 : 20;
    const rowH = mobile ? 38 : 30;
    const pad = (hi - lo) * (mobile ? 0.04 : 0.14);
    const domain = [lo - pad, hi + pad];

    const panel = (group, first, last) => {
      const rows = members.filter(d => d.group === group).sort((a, b) => d3.descending(a.ret, b.ret));
      const valueMarks = mobile
        ? [Plot.text(rows, {y: "name", text: d => fmt(d.ret), frameAnchor: "right", textAnchor: "start", dx: 10, fontSize: 14, fontWeight: 600})]
        : [
            Plot.text(rows.filter(d => d.ret >= 0), {y: "name", x: "ret", text: d => fmt(d.ret), textAnchor: "start", dx: 6}),
            Plot.text(rows.filter(d => d.ret < 0), {y: "name", x: "ret", text: d => fmt(d.ret), textAnchor: "end", dx: -6})
          ];
      return Plot.plot({
        width: inner,
        height: rows.length * rowH + 34 + (last ? 40 : 6),
        marginLeft: ml, marginRight: mr, marginTop: 34, marginBottom: last ? 40 : 6,
        style: {fontSize: mobile ? "13px" : "14px", background: "transparent", color: "#1a1a1a"},
        x: {domain, grid: true, label: null, ticks: mobile ? 4 : 8, tickFormat: d3.format(".0%"), axis: last ? "bottom" : null},
        y: {domain: rows.map(d => d.name), label: null, padding: 0.25},
        marks: [
          Plot.barX(rows, {y: "name", x: "ret", fill: palette.get(group)}),
          Plot.ruleX([0]),
          Plot.ruleX([spyRet], {stroke: "#777", strokeDasharray: "4,3"}),
          ...valueMarks,
          Plot.text([group], {frameAnchor: "top-left", lineAnchor: "bottom", dx: -ml, dy: -8, fontWeight: "bold", fontSize: mobile ? 16 : 15, fill: "#1a1a1a"}),
          first ? Plot.text([`S&P 500  ${fmt(spyRet)}`], {x: spyRet, frameAnchor: "top", lineAnchor: "bottom", dy: -8, fill: "#555", fontSize: 12}) : null
        ]
      });
    };

    return html`<div style="background:#fff;color:#1a1a1a;padding:${padPx}px;width:${outer}px;box-sizing:border-box;font-family:system-ui,sans-serif">
      <h2 style="margin:0 0 6px;font-size:${mobile ? 26 : 34}px;font-weight:800;line-height:1.15">The AI divide</h2>
      <div style="color:#555;margin-bottom:8px;font-size:${mobile ? 14 : 16}px">Selected AI-related stock returns | ${dateFmt(d3.min(stocks, d => d.Date))} – ${dateFmt(win.end)}</div>
      ${groups.map((g, i) => panel(g, i === 0, i === groups.length - 1))}
      <div style="color:#666;font-size:12px;margin-top:8px">Adjusted-close returns, base close to latest close. Dashed line = S&P 500 (SPY). Selected stocks; groups are illustrative.</div>
    </div>`;
  };

  const box = html`<div style="width:100%"></div>`;
  let last = 0;
  new ResizeObserver(() => {
    const w = Math.floor(box.clientWidth);
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    box.replaceChildren(render(w));
  }).observe(box);
  return box;
})());

// ── cell: group averages vs S&P 500 (responsive) ──
display((() => {
  const render = w => {
    const mobile = w < 600;
    return Plot.plot({
      width: Math.min(w, 960),
      height: mobile ? Math.max(440, Math.round(w * 1.2)) : 460,
      marginLeft: mobile ? 46 : 50,
      marginRight: mobile ? 64 : 190,
      marginTop: 20,
      style: {fontSize: mobile ? "13px" : "13px"},
      x: {type: "utc", label: null, ticks: mobile ? 4 : 8},
      y: {grid: true, label: mobile ? "Index (100 = start)" : "Indexed (100 = window start)"},
      color: {legend: true, domain: [...palette.keys()], range: [...palette.values()]},
      marks: [
        Plot.ruleY([100]),
        Plot.lineY(groupSeries.filter(d => d.group !== "S&P 500"), {x: "Date", y: "idx", stroke: "group", strokeWidth: 2.5}),
        Plot.lineY(groupSeries.filter(d => d.group === "S&P 500"), {x: "Date", y: "idx", stroke: "group", strokeWidth: 2, strokeDasharray: "5,4"}),
        Plot.text(groupSeries, Plot.selectLast({
          x: "Date", y: "idx", z: "group", fill: "group",
          text: d => mobile ? fmt(d.ret) : `${d.group}  ${fmt(d.ret)}`,
          textAnchor: "start", dx: 6, fontWeight: 700, fontSize: mobile ? 14 : 13
        })),
        Plot.tip(groupSeries, Plot.pointerX({
          x: "Date", y: "idx", z: "group",
          title: d => `${d.group}\n${fmt(d.ret)}`
        }))
      ]
    });
  };

  const box = html`<div style="width:100%"></div>`;
  let last = 0;
  new ResizeObserver(() => {
    const w = Math.floor(box.clientWidth);
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    box.replaceChildren(render(w));
  }).observe(box);
  return box;
})());

// ── cell: every stock, faceted by group (hover on desktop, tap/click to lock a highlight; responsive) ──
display((() => {
  const members = stocks.filter(d => d.group !== "S&P 500");
  const xDomain = d3.extent(members, d => d.Date);
  let selected = null; // ticker locked by click/tap; survives resizes

  const render = w => {
    const mobile = w < 600;
    const panelH = mobile ? 280 : 250;
    const width = Math.min(w, 960);

    // One chart per group, so each group gets its own y-axis min/max.
    const panel = group => Plot.plot({
      width,
      height: panelH + 30 + 34,
      marginTop: 30, marginBottom: 34,
      marginLeft: mobile ? 42 : 50,
      marginRight: mobile ? 56 : 60,
      style: {fontSize: mobile ? "13px" : "12px"},
      x: {type: "utc", domain: xDomain, label: null, ticks: mobile ? 4 : 8},
      y: {grid: true, nice: true, label: mobile ? "Index (100 = start)" : "Indexed (100 = window start)"},
      color: {domain: [...palette.keys()], range: [...palette.values()]},
      marks: [
        Plot.ruleY([100]),
        Plot.lineY(members.filter(d => d.group === group), {x: "Date", y: "idx", z: "ticker", stroke: "group", strokeWidth: 1.5, title: "ticker"}),
        Plot.text(members.filter(d => d.group === group), Plot.selectLast({x: "Date", y: "idx", z: "ticker", text: "ticker", fill: "group", textAnchor: "start", dx: 5, fontWeight: 600})),
        Plot.text([group], {frameAnchor: "top-left", dx: 6, dy: 6, fontWeight: "bold", fontSize: mobile ? 15 : 14}),
        Plot.tip(members.filter(d => d.group === group), Plot.pointer({x: "Date", y: "idx", title: d => `${d.name}\n${fmt(d.ret)}`}))
      ]
    });

    const wrap = html`<div>
      <div style="color:#666;font-size:${mobile ? 13 : 12}px;margin:0 0 4px 4px">${mobile ? "Tap" : "Hover or click"} a line or ticker to highlight it. ${mobile ? "Tap" : "Click"} it again or empty space to clear.</div>
      ${groups.map(g => panel(g))}
    </div>`;

    // Focus: highlighted stock keeps its color; everything else (in every panel) turns gray and semi-transparent.
    const lines = [...wrap.querySelectorAll('g[aria-label="line"] path')];
    const labels = [...wrap.querySelectorAll('g[aria-label="text"] text')].filter(l => !groups.includes(l.textContent));

    const focus = ticker => {
      for (const p of lines) {
        const on = ticker == null || p.dataset.ticker === ticker;
        p.setAttribute("stroke", on ? p.dataset.stroke : "#9a9a9a");
        p.setAttribute("stroke-opacity", ticker == null || on ? 1 : 0.3);
        p.setAttribute("stroke-width", ticker != null && on ? 3 : 1.5);
        if (ticker != null && on) p.parentNode.appendChild(p); // bring to front
      }
      for (const l of labels) {
        const on = ticker == null || l.textContent === ticker;
        l.style.fill = on ? "" : "#9a9a9a";
        l.style.opacity = ticker == null || on ? 1 : 0.3;
        l.style.fontWeight = ticker != null && on ? "800" : "600";
      }
    };

    for (const p of lines) {
      const t = p.querySelector("title");
      p.dataset.ticker = t ? t.textContent : "";
      t?.remove(); // avoid the native browser tooltip
      p.dataset.stroke = p.getAttribute("stroke");
      p.style.pointerEvents = "none";
      // wide invisible copy so thin lines are easy to hover or tap
      const hit = p.cloneNode(false);
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", mobile ? 22 : 14);
      hit.setAttribute("fill", "none");
      hit.dataset.hit = "1";
      hit.dataset.ticker = p.dataset.ticker;
      hit.style.pointerEvents = "stroke";
      hit.style.cursor = "pointer";
      // mouse hover previews; touch is handled by click only (touch "leave" would otherwise reset it)
      hit.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") focus(p.dataset.ticker); });
      p.after(hit);
    }
    for (const l of labels) { l.style.pointerEvents = "all"; l.style.cursor = "pointer"; }

    wrap.addEventListener("pointerleave", e => { if (e.pointerType !== "touch") focus(selected); });
    wrap.addEventListener("click", e => {
      const t = e.target?.dataset?.hit ? e.target.dataset.ticker
        : labels.includes(e.target) ? e.target.textContent
        : null;
      selected = t == null || t === selected ? null : t; // tap same stock or empty space to clear
      focus(selected);
    });

    focus(selected);
    return wrap;
  };

  const box = html`<div style="width:100%"></div>`;
  let last = 0;
  new ResizeObserver(() => {
    const w = Math.floor(box.clientWidth);
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    box.replaceChildren(render(w));
  }).observe(box);
  return box;
})());

// ── cell: returns table (self-contained: needs only `raw`; responsive) ──
(() => {
  const colors = {"Big Tech": "#f24e2a", "AI semis": "#e5b50a", "AI cloud & data-center": "#008c68", "S&P 500": "#6b6b6b"};
  const groupNames = ["Big Tech", "AI semis", "AI cloud & data-center"];
  const pct = d3.format("+.1%");
  const end = d3.max(raw, d => d.Date);
  const periods = [["1W", 7], ["1M", 30], ["3M", 90], ["6M", 180], ["YTD", "ytd"], ["1Y", 365]];
  const startFor = p => p === "ytd" ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1)) : d3.utcDay.offset(end, -p);

  // Return per ticker for one window: latest close vs. last close on or before the start.
  const periodReturns = start => {
    const bisect = d3.bisector(d => d.Date);
    const m = new Map();
    for (const [t, all] of d3.group(raw, d => d.ticker)) {
      const rows = all.filter(d => d.Date <= end).sort((a, b) => a.Date - b.Date);
      if (!rows.length) continue;
      const i = Math.max(0, bisect.right(rows, start) - 1);
      m.set(t, rows.at(-1).close / rows[i].close - 1);
    }
    return m;
  };

  const byPeriod = periods.map(([label, p]) => [label, periodReturns(startFor(p))]);
  const meta = d3.groups(raw, d => d.ticker).map(([, v]) => v[0]);
  const rows = meta.map(m => ({
    ticker: m.ticker, name: m.name, group: m.group,
    vals: byPeriod.map(([, mp]) => mp.get(m.ticker))
  }));
  const avgOf = g => periods.map((_, i) => d3.mean(rows.filter(r => r.group === g), r => r.vals[i]));

  const num = x => x == null
    ? html`<td class="aiq-n"></td>`
    : html`<td class="aiq-n" style="color:${x >= 0 ? "#008c68" : "#d33"}">${pct(x)}</td>`;
  const dataRow = (r, cls = "") => html`<tr class="${cls}">
    <td class="aiq-sticky">${r.ticker}</td><td class="aiq-name">${r.name}</td>${r.vals.map(num)}</tr>`;

  const spy = rows.find(r => r.ticker === "SPY");
  const body = [
    spy && dataRow({...spy, ticker: "SPY", name: "S&P 500 (benchmark)"}, "aiq-avg"),
    ...groupNames.flatMap(g => [
      html`<tr class="aiq-grp"><td colspan="${2 + periods.length}" style="border-left:6px solid ${colors[g]}">${g}</td></tr>`,
      dataRow({ticker: "AVG", name: "Equal-weight average", vals: avgOf(g)}, "aiq-avg"),
      ...rows.filter(r => r.group === g).map(r => dataRow(r))
    ])
  ];

  return display(html`<div class="aiq-wrap">
    <style>
      .aiq-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; font-family: system-ui, sans-serif; color: #1a1a1a; }
      .aiq-wrap table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 15px; font-variant-numeric: tabular-nums; }
      .aiq-wrap th, .aiq-wrap td { padding: 10px 12px; white-space: nowrap; border-bottom: 1px solid #eee; background: #fff; }
      .aiq-wrap th { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #666; text-align: left; }
      .aiq-n { text-align: right; font-weight: 600; }
      .aiq-sticky { position: sticky; left: 0; z-index: 1; font-weight: 700; }
      .aiq-grp td { font-weight: 800; font-size: 14px; padding-top: 18px; background: #fff; }
      .aiq-avg td { font-weight: 700; background: #f6f6f6; }
      @media (max-width: 600px) {
        .aiq-wrap table { font-size: 16px; }
        .aiq-wrap th, .aiq-wrap td { padding: 12px 10px; }
        .aiq-name { display: none; }
      }
    </style>
    <table>
      <thead><tr><th class="aiq-sticky">Ticker</th><th class="aiq-name">Name</th>${periods.map(([l]) => html`<th class="aiq-n">${l}</th>`)}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`);
})();

// ── cell: correlation analysis (responsive; needs only `raw`) ──
display((() => {
  const order = ["Big Tech", "AI semis", "AI cloud & data-center", "S&P 500"];
  const short = {"Big Tech": "Big Tech", "AI semis": "AI semis", "AI cloud & data-center": "AI cloud", "S&P 500": "S&P 500"};
  const labels = order.map(g => short[g]);
  const WINDOW = 30; // trading days for the rolling view

  // Daily return per ticker, then equal-weight average per group per day.
  const dayRet = [];
  for (const [, rows] of d3.group(raw, d => d.ticker)) {
    rows.sort((a, b) => a.Date - b.Date);
    for (let i = 1; i < rows.length; i++)
      dayRet.push({ts: +rows[i].Date, group: rows[i].group, r: rows[i].close / rows[i - 1].close - 1});
  }
  const byDate = d3.rollup(dayRet, v => d3.mean(v, d => d.r), d => d.ts, d => d.group);
  const daily = Array.from(byDate, ([ts, m]) => ({ts, vals: order.map(g => m.get(g))}))
    .filter(d => d.vals.every(v => v != null))
    .sort((a, b) => a.ts - b.ts);

  const corr = (x, y) => {
    const mx = d3.mean(x), my = d3.mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxy / Math.sqrt(sxx * syy);
  };
  const col = i => daily.map(d => d.vals[i]);

  const matrix = order.flatMap((a, i) => order.map((b, j) => ({a: labels[i], b: labels[j], r: corr(col(i), col(j))})));
  const pairs = [[0, 1], [0, 2], [1, 2]];
  const pairName = ([i, j]) => `${labels[i]} / ${labels[j]}`;
  const rolling = pairs.flatMap(p => {
    const out = [];
    for (let k = WINDOW - 1; k < daily.length; k++) {
      const s = daily.slice(k - WINDOW + 1, k + 1);
      out.push({Date: new Date(daily[k].ts), pair: pairName(p), r: corr(s.map(d => d.vals[p[0]]), s.map(d => d.vals[p[1]]))});
    }
    return out;
  });

  const pairR = pairs.map(p => ({name: pairName(p), r: corr(col(p[0]), col(p[1]))})).sort((a, b) => b.r - a.r);
  const dateFmt = d3.utcFormat("%b %-d, %Y");
  const pairColors = ["#4e79a7", "#f28e2b", "#59a14f"];

  const render = w => {
    const mobile = w < 600;
    const outer = Math.min(w, 900);
    const cell = mobile ? Math.floor((outer - 28 - 80) / 4) : 100;
    const ml = mobile ? 72 : 90;

    const heat = Plot.plot({
      width: ml + 4 * cell + 10,
      height: 4 * cell + 44,
      marginLeft: ml, marginTop: 34, marginRight: 10, marginBottom: 10,
      style: {fontSize: mobile ? "13px" : "14px", background: "transparent"},
      x: {domain: labels, axis: "top", label: null},
      y: {domain: labels, label: null},
      color: {type: "diverging", scheme: "rdbu", domain: [-1, 1]},
      marks: [
        Plot.cell(matrix, {x: "b", y: "a", fill: "r", inset: 1}),
        Plot.text(matrix, {x: "b", y: "a", text: d => d.r.toFixed(2), fill: d => Math.abs(d.r) > 0.6 ? "#fff" : "#1a1a1a", fontSize: mobile ? 14 : 16, fontWeight: 700})
      ]
    });

    const lo = Math.min(0, Math.floor(d3.min(rolling, d => d.r) * 10) / 10);
    const roll = Plot.plot({
      width: outer - 28,
      height: mobile ? 340 : 360,
      marginLeft: mobile ? 40 : 46, marginRight: 50, marginTop: 20,
      style: {fontSize: "13px", background: "transparent"},
      x: {type: "utc", label: null, ticks: mobile ? 4 : 8},
      y: {grid: true, domain: [lo, 1], label: `${WINDOW}-day correlation`},
      color: {legend: true, domain: pairs.map(pairName), range: pairColors},
      marks: [
        Plot.ruleY([0]),
        Plot.lineY(rolling, {x: "Date", y: "r", stroke: "pair", strokeWidth: 2}),
        Plot.text(rolling, Plot.selectLast({x: "Date", y: "r", z: "pair", text: d => d.r.toFixed(2), fill: "pair", textAnchor: "start", dx: 6, fontWeight: 700})),
        Plot.tip(rolling, Plot.pointerX({x: "Date", y: "r", z: "pair", title: d => `${d.pair}\n${d.r.toFixed(2)}`}))
      ]
    });

    const hi = pairR[0], low = pairR.at(-1);
    return html`<div style="background:#fff;color:#1a1a1a;padding:14px;width:${outer}px;box-sizing:border-box;font-family:system-ui,sans-serif">
      <h2 style="margin:0 0 6px;font-size:${mobile ? 22 : 28}px;font-weight:800;line-height:1.15">How tightly do the groups move together?</h2>
      <div style="color:#555;margin-bottom:12px;font-size:${mobile ? 13 : 14}px">Correlation of daily returns (equal-weight group averages), ${dateFmt(new Date(daily[0].ts))} – ${dateFmt(new Date(daily.at(-1).ts))}. 1.00 = move in lockstep, 0 = unrelated.</div>
      <div style="overflow-x:auto">${heat}</div>
      <div style="margin:10px 0 18px;font-size:${mobile ? 14 : 15}px;line-height:1.4">
        Most correlated: <b>${hi.name}</b> (${hi.r.toFixed(2)}). Least correlated: <b>${low.name}</b> (${low.r.toFixed(2)}).
      </div>
      <h3 style="margin:0 0 4px;font-size:${mobile ? 16 : 18}px">Rolling ${WINDOW}-day correlation</h3>
      <div style="color:#555;margin-bottom:6px;font-size:${mobile ? 13 : 14}px">Correlations tend to rise in sell-offs, so a jump here signals the groups trading as one theme.</div>
      ${roll}
    </div>`;
  };

  const box = html`<div style="width:100%"></div>`;
  let last = 0;
  new ResizeObserver(() => {
    const w = Math.floor(box.clientWidth);
    if (!w || Math.abs(w - last) < 2) return;
    last = w;
    box.replaceChildren(render(w));
  }).observe(box);
  return box;
})());
