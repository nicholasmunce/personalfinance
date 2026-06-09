import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { fmt } from '../utils/format.js';

const CAT_COLORS = [
  "#4ade80","#60a5fa","#f472b6","#fbbf24","#a78bfa",
  "#34d399","#fb923c","#e879f9","#38bdf8","#f87171",
  "#94a3b8","#84cc16","#2dd4bf","#c084fc","#fdba74",
];

const OWNER_COLORS = { C: "#4ade80", N: "#60a5fa", M: "#f472b6", X: "#fb923c" };
const OWNER_LABELS = { C: "Checking", N: "Nick", M: "Madeline", X: "Non-Chk" };

// ─── Natural language query parser ───────────────────────────────────────────
const MONTH_MAP = {
  jan:1, january:1, feb:2, february:2, mar:3, march:3,
  apr:4, april:4, may:5, jun:6, june:6, jul:7, july:7,
  aug:8, august:8, sep:9, sept:9, september:9, oct:10, october:10,
  nov:11, november:11, dec:12, december:12,
};

const COMMON_MERCHANTS = {
  costco: "COSTCO", uber: "UBER", amazon: "AMAZON", starbucks: "STARBUCKS",
  seatgeek: "SEATGEEK", airbnb: "AIRBNB", target: "TARGET", lyft: "LYFT",
  netflix: "NETFLIX", spotify: "SPOTIFY", gym: "GYM", geico: "GEICO",
  united: "UNITED", hyatt: "HYATT", ventra: "VENTRA", walgreens: "WALGREENS",
};

function parseQuery(q, transactions) {
  const lower = q.toLowerCase().trim();
  if (!lower) return null;
  const debits = transactions.filter(t => t.type !== "payment");
  const allCats = [...new Set(debits.map(t => t.custom_category || t.category))];

  let subset = [...debits];
  const tags = [];

  // Card
  if (lower.includes("chase")) { subset = subset.filter(t => t.card === "Chase Sapphire"); tags.push("Chase"); }
  else if (lower.includes("capital one") || lower.includes("cap one")) { subset = subset.filter(t => t.card === "Capital One"); tags.push("Capital One"); }

  // Owner
  if (lower.includes("nick")) { subset = subset.filter(t => t.owner === "N"); tags.push("Nick"); }
  else if (lower.includes("madeline")) { subset = subset.filter(t => t.owner === "M"); tags.push("Madeline"); }
  else if (lower.includes("checking") && !lower.includes("non")) { subset = subset.filter(t => t.owner === "C"); tags.push("Checking"); }
  else if (lower.includes("non-checking") || lower.includes("non checking")) { subset = subset.filter(t => t.owner === "X"); tags.push("Non-Checking"); }

  // Month
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (lower.includes(name)) {
      const yearMatch = lower.match(/20\d\d/);
      const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
      const monthStr = String(num).padStart(2, "0");
      subset = subset.filter(t => t.date.startsWith(`${year}-${monthStr}`));
      tags.push(`${name.charAt(0).toUpperCase() + name.slice(1)} ${year}`);
      break;
    }
  }

  // Category
  const matchedCat = allCats.find(c => lower.includes(c.toLowerCase()));
  if (matchedCat) { subset = subset.filter(t => (t.custom_category || t.category) === matchedCat); tags.push(matchedCat); }

  // Common merchant keywords
  let merchantTag = null;
  for (const [key, val] of Object.entries(COMMON_MERCHANTS)) {
    if (lower.includes(key)) {
      subset = subset.filter(t => t.description.toUpperCase().includes(val));
      merchantTag = key.charAt(0).toUpperCase() + key.slice(1);
      tags.push(merchantTag);
      break;
    }
  }

  // "biggest" / "top" / "largest" intent
  const wantsBiggest = /big|largest|top|expensive|most/.test(lower);
  const total = subset.reduce((s, t) => s + t.amount, 0);
  const sorted = [...subset].sort((a, b) => b.amount - a.amount);

  // Build a sentence answer
  let answer = "";
  if (subset.length === 0) {
    answer = "No transactions found for that query.";
  } else if (tags.length === 0) {
    answer = `${subset.length} transactions, ${fmt(total)} total.`;
  } else {
    const totalStr = fmt(total);
    const pct = total / debits.reduce((s,t) => s+t.amount, 0) * 100;
    answer = `${totalStr} across ${subset.length} transaction${subset.length !== 1 ? "s" : ""}`;
    if (pct > 0 && pct < 100) answer += ` (${pct.toFixed(1)}% of loaded spend)`;
    answer += ".";
    if (wantsBiggest && sorted[0]) answer += ` Biggest: ${sorted[0].description} — ${fmt(sorted[0].amount)}.`;
  }

  return { tags, total, count: subset.length, answer, topTxns: sorted.slice(0, 10), wantsBiggest };
}

// ─── Auto-insights ────────────────────────────────────────────────────────────
function generateInsights(transactions) {
  const debits = transactions.filter(t => t.type !== "payment");
  if (!debits.length) return [];
  const total = debits.reduce((s, t) => s + t.amount, 0);

  // Top category
  const catMap = {};
  for (const t of debits) {
    const c = t.custom_category || t.category;
    catMap[c] = (catMap[c] || 0) + t.amount;
  }
  const topCat = Object.entries(catMap).sort((a,b) => b[1]-a[1])[0];

  // Most visited merchant (normalize away trailing codes)
  function norm(desc) { return desc.replace(/\s+[\d*#]+$/, "").replace(/\s{2,}/g, " ").trim(); }
  const merchantCount = {};
  const merchantTotal = {};
  for (const t of debits) {
    const key = norm(t.description);
    merchantCount[key] = (merchantCount[key] || 0) + 1;
    merchantTotal[key] = (merchantTotal[key] || 0) + t.amount;
  }
  const topByVisit = Object.entries(merchantCount).sort((a,b) => b[1]-a[1])[0];
  const topBySpend = Object.entries(merchantTotal).sort((a,b) => b[1]-a[1])[0];

  // Monthly breakdown
  const monthMap = {};
  for (const t of debits) {
    const m = t.date.slice(0,7);
    monthMap[m] = (monthMap[m] || 0) + t.amount;
  }
  const months = Object.entries(monthMap).sort();
  const avgMonth = months.length ? months.reduce((s,[,v]) => s+v, 0) / months.length : 0;
  const peakMonth = months.sort((a,b) => b[1]-a[1])[0];

  // Checking split
  const checking = debits.filter(t => t.owner === "C").reduce((s,t) => s+t.amount, 0);
  const personal = debits.filter(t => t.owner !== "C").reduce((s,t) => s+t.amount, 0);

  // Biggest single purchase
  const biggest = [...debits].sort((a,b) => b.amount-a.amount)[0];

  const insights = [];
  if (topCat) insights.push(`**${topCat[0]}** is your top category — ${fmt(topCat[1])} (${(topCat[1]/total*100).toFixed(0)}% of spend).`);
  if (topByVisit && topByVisit[1] > 2) insights.push(`You visited **${topByVisit[0]}** ${topByVisit[1]}× in this period.`);
  if (topBySpend) insights.push(`Most spent at **${topBySpend[0]}** — ${fmt(topBySpend[1])} total.`);
  if (peakMonth) insights.push(`Biggest month was **${peakMonth[0]}** at ${fmt(peakMonth[1])}.`);
  if (avgMonth > 0 && months.length > 1) insights.push(`Average monthly spend: **${fmt(avgMonth)}**.`);
  if (biggest) insights.push(`Largest single purchase: **${norm(biggest.description)}** — ${fmt(biggest.amount)}.`);
  if (total > 0 && checking > 0) insights.push(`${(checking/total*100).toFixed(0)}% of spend (${fmt(checking)}) is tagged **Checking**.`);

  return insights;
}

// ─── Components ──────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color = "#e8e8e0" }) {
  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function Top3Card({ transactions }) {
  const top3 = useMemo(() => {
    return transactions
      .filter(t => t.type !== "payment")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [transactions]);

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>Top 3 transactions</div>
      {top3.map((t, i) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < top3.length - 1 ? 8 : 0, marginBottom: i < top3.length - 1 ? 8 : 0, borderBottom: i < top3.length - 1 ? "1px solid #1a1c23" : "none" }}>
          <div>
            <div style={{ fontSize: 12, color: "#ccc", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{t.date}</div>
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: "#f87171", whiteSpace: "nowrap", marginLeft: 8 }}>{fmt(t.amount)}</div>
        </div>
      ))}
      {top3.length === 0 && <div style={{ color: "#444", fontSize: 12 }}>No data</div>}
    </div>
  );
}

function CategoryTrends({ transactions }) {
  const [prevTxns, setPrevTxns] = useState([]);

  // Derive current period bounds from the transactions
  const { curFrom, curTo, prevFrom, prevTo } = useMemo(() => {
    const debits = transactions.filter(t => t.type !== "payment");
    if (!debits.length) return {};
    const dates = debits.map(t => t.date).sort();
    const curFrom = dates[0];
    const curTo = dates[dates.length - 1];
    const days = Math.round((new Date(curTo) - new Date(curFrom)) / 86400000) + 1;
    const prevToDate = new Date(new Date(curFrom) - 86400000);
    const prevFromDate = new Date(prevToDate - (days - 1) * 86400000);
    const fmt2 = d => d.toISOString().slice(0, 10);
    return { curFrom, curTo, prevFrom: fmt2(prevFromDate), prevTo: fmt2(prevToDate) };
  }, [transactions]);

  useEffect(() => {
    if (!prevFrom || !prevTo) return;
    const params = new URLSearchParams({ from: prevFrom, to: prevTo });
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(rows => setPrevTxns(rows.filter(t => t.type !== "payment")))
      .catch(() => {});
  }, [prevFrom, prevTo]);

  const buildCatMap = (txns) => {
    const map = {};
    for (const t of txns) {
      const c = t.custom_category || t.category;
      map[c] = (map[c] || 0) + t.amount;
    }
    return map;
  };

  const { curMap, prevMap, categories } = useMemo(() => {
    const curMap = buildCatMap(transactions.filter(t => t.type !== "payment"));
    const prevMap = buildCatMap(prevTxns);
    const allCats = new Set([...Object.keys(curMap), ...Object.keys(prevMap)]);
    // Sort by current period spend desc
    const categories = [...allCats].sort((a, b) => (curMap[b] || 0) - (curMap[a] || 0)).slice(0, 8);
    return { curMap, prevMap, categories };
  }, [transactions, prevTxns]);

  const maxVal = Math.max(...categories.map(c => Math.max(curMap[c] || 0, prevMap[c] || 0)), 1);

  const periodLabel = prevFrom ? `${prevFrom} – ${prevTo}` : "";

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>Category trends</div>
        {periodLabel && <div style={{ fontSize: 10, color: "#333" }}>vs {periodLabel}</div>}
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#4ade80" }} />
          <span style={{ fontSize: 10, color: "#555" }}>This period</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "#2a2d36" }} />
          <span style={{ fontSize: 10, color: "#555" }}>Prior period</span>
        </div>
      </div>
      {categories.map((cat, i) => {
        const cur = curMap[cat] || 0;
        const prev = prevMap[cat] || 0;
        const delta = cur - prev;
        const deltaColor = delta > 0 ? "#f87171" : "#4ade80";
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "#ccc" }}>{cat}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#888" }}>{fmt(cur)}</span>
                {prev > 0 && (
                  <span style={{ fontSize: 10, color: deltaColor }}>
                    {delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta))}
                  </span>
                )}
                {prev === 0 && cur > 0 && <span style={{ fontSize: 10, color: "#555" }}>new</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, flexDirection: "column" }}>
              {/* Current bar */}
              <div style={{ background: "#0d0f14", borderRadius: 3, height: 5, overflow: "hidden" }}>
                <div style={{ width: `${(cur / maxVal) * 100}%`, height: "100%", background: "#4ade80", borderRadius: 3, transition: "width .4s" }} />
              </div>
              {/* Prior bar */}
              <div style={{ background: "#0d0f14", borderRadius: 3, height: 5, overflow: "hidden" }}>
                <div style={{ width: `${(prev / maxVal) * 100}%`, height: "100%", background: "#2a2d36", borderRadius: 3, transition: "width .4s" }} />
              </div>
            </div>
          </div>
        );
      })}
      {categories.length === 0 && <div style={{ color: "#444", fontSize: 12 }}>No data</div>}
    </div>
  );
}

function CategoryBars({ transactions }) {
  const debits = transactions.filter(t => t.type !== "payment");
  const total = debits.reduce((s, t) => s + t.amount, 0);
  const catMap = {};
  for (const t of debits) {
    const c = t.custom_category || t.category;
    catMap[c] = (catMap[c] || 0) + t.amount;
  }
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = cats[0]?.[1] || 1;

  return (
    <div>
      {cats.map(([cat, amt], i) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: "#ccc" }}>{cat}</span>
            <span style={{ fontSize: 12, color: "#888" }}>
              {fmt(amt)} <span style={{ color: "#444", marginLeft: 6 }}>{(amt/total*100).toFixed(1)}%</span>
            </span>
          </div>
          <div style={{ background: "#0d0f14", borderRadius: 4, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${(amt/max)*100}%`, height: "100%", background: CAT_COLORS[i % CAT_COLORS.length], borderRadius: 4, transition: "width .4s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ transactions }) {
  const debits = transactions.filter(t => t.type !== "payment");
  const monthMap = {};
  for (const t of debits) {
    const m = t.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { month: m, total: 0 };
    monthMap[m].total += t.amount;
  }
  const data = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
    ...d,
    label: new Date(d.month + "-15").toLocaleDateString("en-US", { month: "short" }),
  }));
  const avg = data.length ? data.reduce((s, d) => s + d.total, 0) / data.length : 0;

  if (!data.length) return <div style={{ color: "#444", fontSize: 12, textAlign: "center", paddingTop: 40 }}>Not enough data</div>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 8, fontSize: 12 }}
          formatter={v => [fmt(v), "Spend"]}
        />
        <ReferenceLine y={avg} stroke="#2a2d36" strokeDasharray="4 2" />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={i === data.length - 1 ? "#4ade80" : "#1e2029"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopMerchants({ transactions }) {
  const debits = transactions.filter(t => t.type !== "payment");
  const map = {};
  for (const t of debits) {
    const key = t.description;
    if (!map[key]) map[key] = { name: t.description, total: 0, count: 0 };
    map[key].total += t.amount;
    map[key].count += 1;
  }
  const top = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);

  return (
    <div>
      {top.map((m, i) => (
        <div key={m.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #141618" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: "#333", width: 16, textAlign: "right" }}>{i + 1}</span>
            <span style={{ fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{m.name}</span>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "#444" }}>{m.count}×</span>
            <span style={{ fontSize: 12, color: "#e8e8e0", minWidth: 70, textAlign: "right" }}>{fmt(m.total)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BiggestPurchases({ transactions }) {
  const top = transactions.filter(t => t.type !== "payment").sort((a, b) => b.amount - a.amount).slice(0, 8);
  return (
    <div>
      {top.map(t => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #141618" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{t.description}</div>
            <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{t.date} · {t.card === "Chase Sapphire" ? "Chase" : "Cap One"}</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e8e8e0", flexShrink: 0, marginLeft: 16 }}>{fmt(t.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function InsightStrip({ insights }) {
  if (!insights.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {insights.map((text, i) => {
        const parts = text.split(/\*\*(.+?)\*\*/g);
        return (
          <div key={i} style={{ fontSize: 12, color: "#666", lineHeight: 1.6, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "#2a2d36", marginTop: 2 }}>◆</span>
            <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#aaa", fontWeight: 600 }}>{p}</strong> : p)}</span>
          </div>
        );
      })}
    </div>
  );
}

function QueryResults({ result, onClear }) {
  if (!result) return null;
  return (
    <div style={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {result.tags.map(tag => (
              <span key={tag} style={{ background: "#1e2029", border: "1px solid #2a2d36", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#888" }}>{tag}</span>
            ))}
          </div>
          <div style={{ fontSize: 14, color: "#e8e8e0", lineHeight: 1.6 }}>{result.answer}</div>
        </div>
        <button onClick={onClear} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16, marginLeft: 16 }}>×</button>
      </div>
      {result.topTxns.length > 0 && (
        <div style={{ borderTop: "1px solid #1a1c23", paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
            {result.wantsBiggest ? "Biggest" : "Transactions"} ({result.topTxns.length} shown of {result.count})
          </div>
          <div style={{ display: "grid", gap: 0 }}>
            {result.topTxns.map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #141618", fontSize: 12 }}>
                <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                  <span style={{ color: "#444", flexShrink: 0 }}>{t.date}</span>
                  <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</span>
                </div>
                <span style={{ color: "#4ade80", flexShrink: 0, marginLeft: 16 }}>{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DayOfWeekChart({ transactions }) {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAY_COLORS = ["#a78bfa","#60a5fa","#60a5fa","#60a5fa","#60a5fa","#4ade80","#a78bfa"];

  const data = useMemo(() => {
    const totals = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const t of transactions.filter(t => t.type !== "payment")) {
      // new Date(YYYY-MM-DD) parses as UTC midnight — add T12:00 to avoid timezone day-shift
      const d = new Date(t.date + "T12:00:00");
      const dow = d.getDay();
      totals[dow] += t.amount;
      counts[dow]++;
    }
    return DAYS.map((day, i) => ({
      day,
      total: totals[i],
      count: counts[i],
      avg: counts[i] ? totals[i] / counts[i] : 0,
    }));
  }, [transactions]);

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "#1a1c23", border: "1px solid #2a2d36", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ color: "#e8e8e0", fontWeight: 600, marginBottom: 4 }}>{d.day}</div>
        <div style={{ color: "#4ade80" }}>{fmt(d.total)} total</div>
        <div style={{ color: "#555", marginTop: 2 }}>{d.count} transactions</div>
        {d.count > 0 && <div style={{ color: "#888", marginTop: 2 }}>{fmt(d.avg)} avg per txn</div>}
      </div>
    );
  };

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
      <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>Spend by day of week</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap="20%">
          <XAxis dataKey="day" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={DAY_COLORS[i]} opacity={entry.total === maxTotal ? 1 : 0.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {data.map((d, i) => d.count > 0 && (
          <div key={d.day} style={{ fontSize: 11, color: "#444" }}>
            <span style={{ color: DAY_COLORS[i], opacity: d.total === maxTotal ? 1 : 0.6 }}>{d.day}</span>
            {" "}{fmt(d.total)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AnalyticsView({ transactions }) {
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const inputRef = useRef(null);

  const debits = useMemo(() => transactions.filter(t => t.type !== "payment"), [transactions]);
  const total = useMemo(() => debits.reduce((s, t) => s + t.amount, 0), [debits]);

  const topCat = useMemo(() => {
    const map = {};
    for (const t of debits) { const c = t.custom_category || t.category; map[c] = (map[c] || 0) + t.amount; }
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  }, [debits]);

  // Normalize merchant names — strip trailing numbers/codes (e.g. "STARBUCKS 8007827282" → "STARBUCKS")
  function normalizeMerchant(desc) {
    return desc.replace(/\s+[\d*#]+$/, "").replace(/\s{2,}/g, " ").trim();
  }

  const topMerchant = useMemo(() => {
    const map = {};
    for (const t of debits) {
      const key = normalizeMerchant(t.description);
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  }, [debits]);

  const insights = useMemo(() => generateInsights(transactions), [transactions]);

  function submitQuery(q) {
    const result = parseQuery(q, transactions);
    setQueryResult(result);
  }

  if (!debits.length) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "#444" }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: .3 }}>◎</div>
        <div style={{ fontSize: 14 }}>No transactions in this range.</div>
        <div style={{ fontSize: 12, marginTop: 8, color: "#333" }}>Adjust the date range or import data first.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* NL Query bar */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && query.trim()) submitQuery(query); if (e.key === "Escape") { setQuery(""); setQueryResult(null); } }}
          placeholder={`Ask anything — "how much on dining in May" · "costco" · "biggest purchases" · "nick's spending"`}
          style={{
            width: "100%", background: "#13151c", border: "1px solid #2a2d36",
            borderRadius: 10, padding: "14px 48px 14px 16px",
            color: "#e8e8e0", fontFamily: "inherit", fontSize: 13, outline: "none",
            transition: "border-color .15s",
          }}
          onFocus={e => e.target.style.borderColor = "#4ade80"}
          onBlur={e => e.target.style.borderColor = "#2a2d36"}
        />
        {query ? (
          <button onClick={() => { setQuery(""); setQueryResult(null); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>×</button>
        ) : (
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: .2 }}>⌕</span>
        )}
      </div>

      {/* Query results */}
      {queryResult && <QueryResults result={queryResult} onClear={() => { setQueryResult(null); setQuery(""); }} />}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <KPICard label="Total spend" value={fmt(total)} sub={`${debits.length} transactions`} color="#4ade80" />
        <KPICard label="Top category" value={topCat?.[0] || "—"} sub={topCat ? fmt(topCat[1]) : ""} color="#fbbf24" />
        <KPICard label="Most visited" value={topMerchant?.[0] || "—"} sub={topMerchant ? `${topMerchant[1]} visits` : ""} color="#a78bfa" />
        <Top3Card transactions={transactions} />
      </div>

      {/* Category + Trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>Spending by category</div>
          <CategoryBars transactions={transactions} />
        </div>
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>Monthly trend</div>
          <TrendChart transactions={transactions} />
          <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>— average · current month highlighted</div>
        </div>
      </div>

      {/* Category trends — current vs previous period */}
      <CategoryTrends transactions={transactions} />

      {/* Top merchants + Biggest purchases */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Top merchants</div>
          <TopMerchants transactions={transactions} />
        </div>
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Biggest purchases</div>
          <BiggestPurchases transactions={transactions} />
        </div>
      </div>

      {/* Day of week */}
      <DayOfWeekChart transactions={transactions} />

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Insights</div>
          <InsightStrip insights={insights} />
        </div>
      )}
    </div>
  );
}
