import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { fmt } from "../utils/format.js";
import { getPeriodForDate, formatPeriod } from "../utils/statementPeriod.js";

const COLORS = ["#4ade80","#60a5fa","#f472b6","#fbbf24","#a78bfa","#34d399","#fb923c","#e879f9","#38bdf8","#f87171","#94a3b8","#84cc16"];

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [url]);
  return { data, loading };
}

// Group raw transactions into period→category→total rows
function groupTransactions(transactions, periodMode, statementDates) {
  const rows = [];
  for (const tx of transactions) {
    let period;
    if (periodMode === "statement") {
      const dates = statementDates?.[tx.card] || [];
      const p = getPeriodForDate(tx.date, dates);
      if (!p) continue;
      period = { id: p.sortKey, label: p.label };
    } else {
      period = { id: tx.date.slice(0, 7), label: tx.date.slice(0, 7) };
    }
    rows.push({ period, cat: tx.custom_category || tx.category, total: tx.amount });
  }
  return rows;
}

function buildChartData(rows) {
  const periodSet = new Set();
  const catSet = new Set();
  const map = {};
  for (const row of rows) {
    periodSet.add(JSON.stringify({ id: row.period.id, label: row.period.label }));
    catSet.add(row.cat);
    if (!map[row.period.id]) map[row.period.id] = { period: row.period.label };
    map[row.period.id][row.cat] = (map[row.period.id][row.cat] || 0) + row.total;
  }
  const periods = [...periodSet].map(s => JSON.parse(s)).sort((a, b) => a.id.localeCompare(b.id));
  const categories = [...catSet];
  const chartData = periods.map(p => map[p.id] || { period: p.label });
  return { periods, categories, chartData };
}

// ─── Monthly / Statement trends ───────────────────────────────────────────────
function TrendsChart({ periodMode, statementDates }) {
  const { data: rawData, loading: rawLoading } = useFetch("/api/transactions/all");
  const { data: calData, loading: calLoading } = useFetch("/api/analytics/monthly");

  const loading = periodMode === "statement" ? rawLoading : calLoading;

  const { categories, chartData } = useMemo(() => {
    if (periodMode === "statement") {
      if (!rawData) return { categories: [], chartData: [] };
      const rows = groupTransactions(rawData, "statement", statementDates);
      return buildChartData(rows);
    } else {
      if (!calData) return { categories: [], chartData: [] };
      const rows = calData.map(r => ({ period: { id: r.month, label: r.month }, cat: r.cat, total: r.total }));
      return buildChartData(rows);
    }
  }, [rawData, calData, periodMode, statementDates]);

  const [visibleCats, setVisibleCats] = useState(null);
  const shown = visibleCats || categories.slice(0, 8);

  if (loading) return <Loader />;
  if (chartData.length === 0) return <Empty />;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {categories.map((cat, i) => (
          <button key={cat} onClick={() => setVisibleCats(prev => {
            const cur = prev || categories.slice(0, 8);
            return cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat];
          })} style={{
            background: shown.includes(cat) ? `${COLORS[i % COLORS.length]}22` : "none",
            border: `1px solid ${shown.includes(cat) ? COLORS[i % COLORS.length] : "#2a2d36"}`,
            color: shown.includes(cat) ? COLORS[i % COLORS.length] : "#555",
            borderRadius: 6, padding: "3px 10px", fontFamily: "inherit", fontSize: 11, cursor: "pointer"
          }}>{cat}</button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#1a1c23" />
          <XAxis dataKey="period" tick={{ fill: "#555", fontSize: 11 }} />
          <YAxis tick={{ fill: "#555", fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
          <Tooltip contentStyle={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 8 }} formatter={v => fmt(v)} />
          {shown.map((cat, i) => (
            <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[categories.indexOf(cat) % COLORS.length]} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Rolling 3-period averages ────────────────────────────────────────────────
function RollingAverages({ periodMode, statementDates }) {
  const { data: rawData, loading: rawLoading } = useFetch("/api/transactions/all");
  const { data: calData, loading: calLoading } = useFetch("/api/analytics/monthly");

  const loading = periodMode === "statement" ? rawLoading : calLoading;

  const { chartData, topCats } = useMemo(() => {
    let rows;
    if (periodMode === "statement") {
      if (!rawData) return { chartData: [], topCats: [] };
      rows = groupTransactions(rawData, "statement", statementDates);
    } else {
      if (!calData) return { chartData: [], topCats: [] };
      rows = calData.map(r => ({ period: { id: r.month, label: r.month }, cat: r.cat, total: r.total }));
    }

    const periodMap = {};
    const catSums = {};
    for (const row of rows) {
      if (!periodMap[row.period.id]) periodMap[row.period.id] = { label: row.period.label };
      periodMap[row.period.id][row.cat] = (periodMap[row.period.id][row.cat] || 0) + row.total;
      catSums[row.cat] = (catSums[row.cat] || 0) + row.total;
    }
    const periods = Object.keys(periodMap).sort();
    const top = Object.entries(catSums).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);

    const cd = periods.map((pid, idx) => {
      const window = periods.slice(Math.max(0, idx - 2), idx + 1);
      const totals = {};
      for (const w of window) for (const [cat, val] of Object.entries(periodMap[w])) {
        if (cat !== "label") totals[cat] = (totals[cat] || 0) + val;
      }
      const avg = {};
      for (const [cat, total] of Object.entries(totals)) avg[cat] = total / window.length;
      return { period: periodMap[pid].label, ...avg };
    });
    return { chartData: cd, topCats: top };
  }, [rawData, calData, periodMode, statementDates]);

  if (loading) return <Loader />;
  if (chartData.length === 0) return <Empty />;

  return (
    <div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>3-period rolling average spend by top 6 categories</div>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#1a1c23" />
          <XAxis dataKey="period" tick={{ fill: "#555", fontSize: 11 }} />
          <YAxis tick={{ fill: "#555", fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
          <Tooltip contentStyle={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 8 }} formatter={v => fmt(v)} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#888" }} />
          {topCats.map((cat, i) => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Year-to-date / Period-to-date summary ────────────────────────────────────
function YTD({ periodMode, statementDates }) {
  const year = new Date().getFullYear();
  const { data: rawData, loading: rawLoading } = useFetch("/api/transactions/all");
  const { data: ytdData, loading: ytdLoading } = useFetch(`/api/analytics/ytd`);

  const loading = periodMode === "statement" ? rawLoading : ytdLoading;

  const { data, label } = useMemo(() => {
    if (periodMode === "statement") {
      if (!rawData) return { data: [], label: "Current statement" };
      const today = new Date().toISOString().slice(0, 10);
      const filtered = rawData.filter(tx => {
        const dates = statementDates?.[tx.card] || [];
        const p = getPeriodForDate(today, dates);
        if (!p) return false;
        const start = p.start || "0000-00-00";
        const end = p.end || "9999-99-99";
        return tx.date >= start && tx.date <= end;
      });
      const catMap = {};
      for (const tx of filtered) {
        const cat = tx.custom_category || tx.category;
        catMap[cat] = (catMap[cat] || 0) + tx.amount;
      }
      const d = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, total }));
      const chaseDates = statementDates?.["Chase Sapphire"] || [];
      const p = getPeriodForDate(today, chaseDates);
      return { data: d, label: p ? `Current statement: ${p.label}` : "Current statement" };
    } else {
      return { data: ytdData || [], label: `${year} year-to-date` };
    }
  }, [rawData, ytdData, periodMode, statementDates, year]);

  if (loading) return <Loader />;
  if (!data || data.length === 0) return <Empty />;

  const total = data.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
        {label} — <span style={{ color: "#4ade80" }}>{fmt(total)} total</span>
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 340px" }}>
          {data.map((row, i) => (
            <div key={row.cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1a1c23" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                <span style={{ fontSize: 13, color: "#ccc" }}>{row.cat}</span>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "#555" }}>{((row.total / total) * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 13, color: "#e8e8e0", minWidth: 80, textAlign: "right" }}>{fmt(row.total)}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
              <XAxis type="number" tick={{ fill: "#555", fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
              <YAxis type="category" dataKey="cat" tick={{ fill: "#888", fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 8 }} formatter={v => fmt(v)} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Search / all transactions ────────────────────────────────────────────────
function SearchAll() {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);

  async function run() {
    setLoading(true);
    setQueried(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const data = await fetch(`/api/transactions?${params}`).then(r => r.json());
    setTxns(data);
    setLoading(false);
  }

  function handleKey(e) { if (e.key === "Enter") run(); }

  const total = txns.reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Search description or category…"
          value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKey}
          style={{ flex: 1, minWidth: 200, background: "#0d0f14", border: "1px solid #2a2d36", borderRadius: 8, padding: "9px 14px", color: "#e8e8e0", fontFamily: "inherit", fontSize: 12 }}
        />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ background: "#0d0f14", border: "1px solid #2a2d36", borderRadius: 8, padding: "9px 14px", color: "#888", fontFamily: "inherit", fontSize: 12 }}
        />
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ background: "#0d0f14", border: "1px solid #2a2d36", borderRadius: 8, padding: "9px 14px", color: "#888", fontFamily: "inherit", fontSize: 12 }}
        />
        <button onClick={run} style={{ background: "#4ade80", border: "none", borderRadius: 8, padding: "9px 20px", color: "#0d0f14", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Search
        </button>
      </div>

      {loading && <Loader />}

      {!loading && queried && (
        <>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
            {txns.length} result{txns.length !== 1 ? "s" : ""}
            {txns.length > 0 && <span style={{ color: "#4ade80", marginLeft: 12 }}>{fmt(total)} total</span>}
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #1e2029", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0d0f14" }}>
                  {["Date", "Description", "Category", "Amount", "Card"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#555", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid #1e2029", fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #1a1c23" }}>
                    <td style={{ padding: "9px 14px", color: "#666" }}>{tx.date}</td>
                    <td style={{ padding: "9px 14px", color: "#ccc", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</td>
                    <td style={{ padding: "9px 14px", color: "#888" }}>{tx.custom_category || tx.category}</td>
                    <td style={{ padding: "9px 14px", color: "#4ade80" }}>{fmt(tx.amount)}</td>
                    <td style={{ padding: "9px 14px", color: "#555" }}>{tx.card}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Loader() {
  return <div style={{ color: "#555", fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading…</div>;
}
function Empty() {
  return <div style={{ color: "#555", fontSize: 13, padding: "40px 0", textAlign: "center" }}>No data yet — import some transactions to see history.</div>;
}

// ─── Main HistoryView ─────────────────────────────────────────────────────────
const HISTORY_TABS = [
  ["trends", "Trends"],
  ["rolling", "Rolling averages"],
  ["ytd", "Period summary"],
  ["search", "Search all"],
];

export default function HistoryView({ periodMode, statementDates }) {
  const [sub, setSub] = useState("trends");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1a1c23", marginBottom: 28 }}>
        {HISTORY_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, padding: "8px 16px", color: sub === id ? "#4ade80" : "#555",
            borderBottom: `2px solid ${sub === id ? "#4ade80" : "transparent"}`,
            letterSpacing: ".06em", textTransform: "uppercase", transition: "all .2s"
          }}>{label}</button>
        ))}
      </div>
      {sub === "trends" && <TrendsChart periodMode={periodMode} statementDates={statementDates} />}
      {sub === "rolling" && <RollingAverages periodMode={periodMode} statementDates={statementDates} />}
      {sub === "ytd" && <YTD periodMode={periodMode} statementDates={statementDates} />}
      {sub === "search" && <SearchAll />}
    </div>
  );
}
