import React from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { classifyTxn, getWeekKey, getMonthKey, getQuarterKey, GROCERY_MERCHANTS } from '../utils/classify.js';
import { fmt } from '../utils/format.js';

export default function GroceryVsDining({ transactions }) {
  const [period, setPeriod] = React.useState("month");
  const [metric, setMetric] = React.useState("spend");
  const [excludedDining, setExcludedDining] = React.useState([]);
  const [listLimit, setListLimit] = React.useState(5);

  const classified = React.useMemo(() => transactions.map(t => ({
    ...t,
    foodType: classifyTxn(t),
  })).filter(t => t.foodType !== null), [transactions]);

  const getKey = period === "week" ? getWeekKey : period === "month" ? getMonthKey : getQuarterKey;

  const trendData = React.useMemo(() => {
    const map = {};
    classified.filter(t => !(t.foodType === "dining" && excludedDining.includes(t.description))).forEach(t => {
      const key = getKey(t.date);
      if (!key) return;
      if (!map[key]) map[key] = { period: key, grocerySpend: 0, diningSpend: 0, groceryVisits: 0, diningVisits: 0 };
      if (t.foodType === "grocery") { map[key].grocerySpend += t.amount; map[key].groceryVisits += 1; }
      if (t.foodType === "dining")  { map[key].diningSpend += t.amount;  map[key].diningVisits += 1; }
    });
    return Object.values(map)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(d => ({
        ...d,
        ratio: d.diningSpend > 0 ? parseFloat((d.grocerySpend / d.diningSpend).toFixed(2)) : null,
        label: period === "month"
          ? new Date(d.period + "-01").toLocaleString("default", { month: "short", year: "2-digit" })
          : d.period,
      }));
  }, [classified, period, getKey, excludedDining]);

  const totalGrocery = classified.filter(t => t.foodType === "grocery").reduce((s,t) => s + t.amount, 0);
  const totalDining  = classified.filter(t => t.foodType === "dining" && !excludedDining.includes(t.description)).reduce((s,t) => s + t.amount, 0);
  const groceryVisits = classified.filter(t => t.foodType === "grocery").length;
  const diningVisits  = classified.filter(t => t.foodType === "dining" && !excludedDining.includes(t.description)).length;
  const ratio = totalDining > 0 ? (totalGrocery / totalDining).toFixed(2) : "—";

  const groceryMerchants = React.useMemo(() => {
    const m = {};
    classified.filter(t => t.foodType === "grocery").forEach(t => {
      const k = t.description;
      if (!m[k]) m[k] = { name: k, spend: 0, visits: 0 };
      m[k].spend += t.amount; m[k].visits += 1;
    });
    return Object.values(m).sort((a,b) => b.spend - a.spend);
  }, [classified]);

  const diningMerchants = React.useMemo(() => {
    const m = {};
    classified.filter(t => t.foodType === "dining").forEach(t => {
      const k = t.description;
      if (!m[k]) m[k] = { name: k, spend: 0, visits: 0 };
      m[k].spend += t.amount; m[k].visits += 1;
    });
    return Object.values(m).sort((a,b) => b.spend - a.spend);
  }, [classified]);

  const activeDiningFull = React.useMemo(() =>
    diningMerchants.filter(m => !excludedDining.includes(m.name)),
  [diningMerchants, excludedDining]);

  const tooltipStyle = { background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 };

  if (classified.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#333", fontSize: 13 }}>
        No grocery or dining transactions detected yet.<br/>
        <span style={{ fontSize: 11, color: "#2a2d36", marginTop: 8, display: "block" }}>
          Grocery: {GROCERY_MERCHANTS.join(", ")}<br/>
          Dining: detected by category or merchant keywords
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Grocery spend", value: fmt(totalGrocery), color: "#4ade80" },
          { label: "Grocery trips", value: groceryVisits, color: "#4ade80" },
          { label: "Dining spend", value: fmt(totalDining), color: "#fb923c" },
          { label: "Dining visits", value: diningVisits, color: "#fb923c" },
          { label: "Grocery:Dining ratio", value: `${ratio}×`, color: totalDining > totalGrocery ? "#f87171" : "#4ade80", sub: totalDining > totalGrocery ? "dining-heavy" : "grocery-heavy" },
        ].map(s => (
          <div key={s.label} style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginRight: 4 }}>View by</span>
        {["week","month","quarter"].map(p => (
          <button key={p} className={`filter-btn${period === p ? " active" : ""}`} onClick={() => setPeriod(p)}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
        ))}
        <span style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginLeft: 16, marginRight: 4 }}>Show</span>
        {[["spend","$ Spend"],["visits","# Visits"],["ratio","G:D Ratio"]].map(([v,l]) => (
          <button key={v} className={`filter-btn${metric === v ? " active" : ""}`} onClick={() => setMetric(v)}>{l}</button>
        ))}
      </div>

      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>
          {metric === "spend" ? "Spend over time" : metric === "visits" ? "Visits over time" : "Grocery-to-dining ratio over time"}
        </div>
        {metric === "ratio" ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1c23" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}×`} />
              <Tooltip formatter={(v) => `${v}×`} contentStyle={tooltipStyle} />
              <ReferenceLine y={1} stroke="#555" strokeDasharray="4 4" label={{ value: "1:1", fill: "#555", fontSize: 10 }} />
              <Line type="monotone" dataKey="ratio" stroke="#facc15" strokeWidth={2.5} dot={{ fill: "#facc15", r: 4 }} name="G:D Ratio" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData} margin={{ left: 10, right: 20 }}>
              <defs>
                <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="dGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1c23" />
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => metric === "spend" ? `$${v}` : v} />
              <Tooltip formatter={(v) => metric === "spend" ? fmt(v) : v} contentStyle={tooltipStyle} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
              <Area type="monotone" dataKey={metric === "spend" ? "grocerySpend" : "groceryVisits"}
                name="Grocery" stroke="#4ade80" strokeWidth={2} fill="url(#gGrad)" dot={{ fill: "#4ade80", r: 3 }} />
              <Area type="monotone" dataKey={metric === "spend" ? "diningSpend" : "diningVisits"}
                name="Dining" stroke="#fb923c" strokeWidth={2} fill="url(#dGrad)" dot={{ fill: "#fb923c", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>🛒 Top grocery merchants</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[5,10,25].map(n => (
                <button key={n} onClick={() => setListLimit(n)} style={{ background: listLimit === n ? "rgba(74,222,128,.1)" : "none", border: `1px solid ${listLimit === n ? "#4ade80" : "#2a2d36"}`, color: listLimit === n ? "#4ade80" : "#555", borderRadius: 4, padding: "2px 8px", fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}>{n}</button>
              ))}
            </div>
          </div>
          {groceryMerchants.length === 0
            ? <div style={{ color: "#333", fontSize: 12 }}>None detected</div>
            : groceryMerchants.slice(0, listLimit).map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #141618" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#ccc", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{m.visits} visit{m.visits !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{fmt(m.spend)}</div>
              </div>
            ))
          }
        </div>

        <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>🍽 Top dining spots</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {excludedDining.length > 0 && (
                <button onClick={() => setExcludedDining([])} style={{ background: "none", border: "1px solid #2a2d36", color: "#555", borderRadius: 5, padding: "3px 10px", fontFamily: "inherit", fontSize: 10, cursor: "pointer", letterSpacing: ".06em" }}>
                  restore {excludedDining.length}
                </button>
              )}
              <div style={{ display: "flex", gap: 4 }}>
                {[5,10,25].map(n => (
                  <button key={n} onClick={() => setListLimit(n)} style={{ background: listLimit === n ? "rgba(251,146,60,.1)" : "none", border: `1px solid ${listLimit === n ? "#fb923c" : "#2a2d36"}`, color: listLimit === n ? "#fb923c" : "#555", borderRadius: 4, padding: "2px 8px", fontFamily: "inherit", fontSize: 10, cursor: "pointer" }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          {diningMerchants.length === 0
            ? <div style={{ color: "#333", fontSize: 12 }}>None detected</div>
            : <>
              {activeDiningFull.slice(0, listLimit).map((m) => (
                <div key={m.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #141618" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "#ccc", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{m.visits} visit{m.visits !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 700, color: "#fb923c" }}>{fmt(m.spend)}</div>
                    <button
                      onClick={() => setExcludedDining(prev => [...prev, m.name])}
                      title="Exclude from analysis"
                      style={{ background: "none", border: "1px solid #3a2020", color: "#f87171", borderRadius: 4, width: 24, height: 24, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >✕</button>
                  </div>
                </div>
              ))}
              {excludedDining.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #1e2029" }}>
                  <div style={{ fontSize: 10, color: "#333", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Excluded</div>
                  {diningMerchants.filter(m => excludedDining.includes(m.name)).map(m => (
                    <div key={m.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", opacity: 0.4 }}>
                      <div style={{ fontSize: 11, color: "#555", textDecoration: "line-through", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{m.name}</div>
                      <button
                        onClick={() => setExcludedDining(prev => prev.filter(n => n !== m.name))}
                        title="Restore"
                        style={{ background: "none", border: "1px solid #2a2d36", color: "#555", borderRadius: 4, width: 22, height: 22, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >↩</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          }
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#2a2d36", lineHeight: 1.7 }}>
        Grocery detected from: {GROCERY_MERCHANTS.join(", ")} · Dining detected from category or merchant keywords
      </div>
    </div>
  );
}
