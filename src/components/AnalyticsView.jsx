import React, { useState, useMemo, useRef } from 'react';
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

  // Most visited merchant
  const merchantCount = {};
  const merchantTotal = {};
  for (const t of debits) {
    const key = t.description.slice(0, 20).trim();
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
  if (biggest) insights.push(`Largest single purchase: **${biggest.description}** — ${fmt(biggest.amount)}.`);
  if (total > 0) insights.push(`${(checking/total*100).toFixed(0)}% of spend (${fmt(checking)}) goes through the **joint checking** account.`);

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

  const checkingPct = useMemo(() => {
    if (!total) return 0;
    return debits.filter(t => t.owner === "C").reduce((s, t) => s + t.amount, 0) / total * 100;
  }, [debits, total]);

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
        <KPICard label="Joint checking" value={`${checkingPct.toFixed(0)}%`} sub={fmt(debits.filter(t => t.owner === "C").reduce((s,t) => s+t.amount, 0))} color="#60a5fa" />
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

      {/* Owner split */}
      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 16 }}>Spend by owner</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {["C","N","M","X"].map(o => {
            const amt = debits.filter(t => t.owner === o).reduce((s,t) => s+t.amount, 0);
            const pct = total ? (amt/total*100).toFixed(1) : 0;
            return (
              <div key={o}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: OWNER_COLORS[o] }}>{OWNER_LABELS[o]}</span>
                  <span style={{ fontSize: 11, color: "#444" }}>{pct}%</span>
                </div>
                <div style={{ background: "#0d0f14", borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: OWNER_COLORS[o], borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 13, color: "#e8e8e0", marginTop: 6, fontFamily: "'Fraunces', serif", fontWeight: 700 }}>{fmt(amt)}</div>
              </div>
            );
          })}
        </div>
      </div>

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
