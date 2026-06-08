import React, { useState, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

// ── helpers ────────────────────────────────────────────────────────────────
function parseChase(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0].toLowerCase();
  if (!header.includes("transaction date")) return null;
  return lines.slice(1).map((line) => {
    const cols = splitCSV(line);
    const amount = parseFloat(cols[5]) || 0;
    return {
      date: cols[0]?.trim(),
      description: cols[2]?.trim(),
      category: cols[3]?.trim() || "Uncategorized",
      amount: Math.abs(amount),
      type: amount < 0 ? "debit" : "credit",
      card: "Chase Sapphire",
      owner: "Joint",
    };
  }).filter(r => r.amount > 0 && r.type === "debit");
}

function parseCapitalOne(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const headerRaw = splitCSV(lines[0]);
  const header = headerRaw.map(c => c.trim().toLowerCase());

  // Must have debit or credit column to be Capital One format
  if (!header.some(c => c.includes("debit") || c.includes("credit"))) return null;

  // Dynamically find column indices from header
  const idx = {
    date: header.findIndex(c => c.includes("transaction")),
    description: header.findIndex(c => c.includes("description")),
    category: header.findIndex(c => c.includes("category")),
    debit: header.findIndex(c => c.includes("debit")),
    credit: header.findIndex(c => c.includes("credit")),
  };

  // Fallback to positional defaults if headers not matched
  if (idx.date === -1) idx.date = 0;
  if (idx.description === -1) idx.description = 3;
  if (idx.category === -1) idx.category = 4;
  if (idx.debit === -1) idx.debit = 5;
  if (idx.credit === -1) idx.credit = 6;

  return lines.slice(1).map((line) => {
    const cols = splitCSV(line);
    const debit = parseFloat((cols[idx.debit] || "").replace(/[$,]/g, "")) || 0;
    if (debit === 0) return null; // skip payments/credits (credit-only rows)
    return {
      date: cols[idx.date]?.trim(),
      description: cols[idx.description]?.trim(),
      category: cols[idx.category]?.trim() || "Uncategorized",
      amount: debit,
      type: "debit",
      card: "Capital One",
      owner: "Joint",
    };
  }).filter(Boolean);
}

function splitCSV(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { result.push(cur); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

const OWNERS = ["Joint", "N", "M"];
const OWNER_LABELS = { Joint: "Joint", N: "Nick", M: "Madeline" };
const COLORS = {
  Joint: "#4ade80",
  N: "#60a5fa",
  M: "#f472b6",
  Chase: "#f59e0b",
  CapitalOne: "#a78bfa",
};
const CAT_COLORS = ["#4ade80","#60a5fa","#f472b6","#fb923c","#34d399","#818cf8","#f87171","#facc15","#2dd4bf","#c084fc"];

const fmt = (n) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

// ── main component ─────────────────────────────────────────────────────────
export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [tab, setTab] = useState("upload"); // upload | staging | summary | charts
  const [dragOver, setDragOver] = useState(null);
  const [errors, setErrors] = useState([]);

  // ── ingestion ──────────────────────────────────────────────────────────
  const ingest = useCallback((text, filename) => {
    const lower = filename.toLowerCase();
    let parsed = null;
    let card = null;

    if (lower.includes("chase")) {
      parsed = parseChase(text);
      card = "Chase Sapphire";
    } else if (lower.includes("capital") || lower.includes("cap1") || lower.includes("capitalone")) {
      parsed = parseCapitalOne(text);
      card = "Capital One";
    } else {
      // Try both parsers, pick whichever returns more rows
      const tryChase = parseChase(text) || [];
      const tryCap = parseCapitalOne(text) || [];
      if (tryCap.length >= tryChase.length && tryCap.length > 0) {
        parsed = tryCap; card = "Capital One";
      } else if (tryChase.length > 0) {
        parsed = tryChase; card = "Chase Sapphire";
      }
    }

    if (!parsed || parsed.length === 0) {
      setErrors(e => [...e, `Could not parse "${filename}". Make sure it's a Chase or Capital One CSV export.`]);
      return;
    }
    setTransactions(prev => {
      const next = [...prev, ...parsed];
      return next;
    });
    setTab("staging");
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => ingest(e.target.result, file.name);
    reader.readAsText(file);
  }, [ingest]);

  const handleDrop = useCallback((e, zone) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInput = useCallback((e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  }, [handleFile]);

  const setOwner = (idx, owner) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, owner } : t));
  };

  const clearAll = () => { setTransactions([]); setTab("upload"); setErrors([]); };

  // ── derived data ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const cards = ["Chase Sapphire", "Capital One"];
    const result = {};
    cards.forEach(card => {
      const txns = transactions.filter(t => t.card === card);
      result[card] = {
        Joint: txns.filter(t => t.owner === "Joint").reduce((s, t) => s + t.amount, 0),
        N: txns.filter(t => t.owner === "N").reduce((s, t) => s + t.amount, 0),
        M: txns.filter(t => t.owner === "M").reduce((s, t) => s + t.amount, 0),
      };
    });
    // combined
    result["Combined"] = {
      Joint: cards.reduce((s, c) => s + (result[c]?.Joint || 0), 0),
      N: cards.reduce((s, c) => s + (result[c]?.N || 0), 0),
      M: cards.reduce((s, c) => s + (result[c]?.M || 0), 0),
    };
    return result;
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const cat = t.category || "Uncategorized";
      if (!map[cat]) map[cat] = { name: cat, Joint: 0, N: 0, M: 0, total: 0 };
      map[cat][t.owner] = (map[cat][t.owner] || 0) + t.amount;
      map[cat].total += t.amount;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const ownerPieData = useMemo(() => [
    { name: "Joint", value: summary.Combined?.Joint || 0 },
    { name: "Nick", value: summary.Combined?.N || 0 },
    { name: "Madeline", value: summary.Combined?.M || 0 },
  ].filter(d => d.value > 0), [summary]);

  const hasData = transactions.length > 0;

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0f14",
      color: "#e8e8e0",
      fontFamily: "'DM Mono', 'Courier New', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:wght@300;600;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d0f14; }
        ::-webkit-scrollbar-thumb { background: #2a2d36; border-radius: 3px; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; padding: 10px 20px; color: #666; letter-spacing: .08em; text-transform: uppercase; border-bottom: 2px solid transparent; transition: all .2s; }
        .tab-btn:hover { color: #e8e8e0; }
        .tab-btn.active { color: #4ade80; border-bottom-color: #4ade80; }
        .tab-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .drop-zone { border: 1.5px dashed #2a2d36; border-radius: 12px; padding: 48px 32px; text-align: center; cursor: pointer; transition: all .2s; position: relative; }
        .drop-zone:hover, .drop-zone.over { border-color: #4ade80; background: rgba(74,222,128,.04); }
        .drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .owner-btn { border: 1px solid #2a2d36; background: none; border-radius: 4px; padding: 3px 10px; font-family: inherit; font-size: 11px; cursor: pointer; letter-spacing: .05em; transition: all .15s; color: #888; }
        .owner-btn:hover { border-color: #555; color: #ddd; }
        .owner-btn.active-Joint { background: rgba(74,222,128,.15); border-color: #4ade80; color: #4ade80; }
        .owner-btn.active-N { background: rgba(96,165,250,.15); border-color: #60a5fa; color: #60a5fa; }
        .owner-btn.active-M { background: rgba(244,114,182,.15); border-color: #f472b6; color: #f472b6; }
        .card-block { background: #13151c; border: 1px solid #1e2029; border-radius: 14px; padding: 28px; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1a1c23; }
        .summary-row:last-child { border-bottom: none; }
        .pill { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
        .pill-joint { background: rgba(74,222,128,.15); color: #4ade80; }
        .pill-n { background: rgba(96,165,250,.15); color: #60a5fa; }
        .pill-m { background: rgba(244,114,182,.15); color: #f472b6; }
        .error-bar { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: 8px; padding: 10px 16px; font-size: 12px; color: #f87171; margin-bottom: 12px; }
        .clear-btn { background: none; border: 1px solid #2a2d36; color: #666; border-radius: 6px; padding: 6px 14px; font-family: inherit; font-size: 12px; cursor: pointer; transition: all .2s; }
        .clear-btn:hover { border-color: #f87171; color: #f87171; }
        .filter-btn { background: none; border: 1px solid #2a2d36; color: #888; border-radius: 6px; padding: 4px 12px; font-family: inherit; font-size: 11px; cursor: pointer; letter-spacing:.05em; transition: all .15s; }
        .filter-btn:hover { border-color: #555; color: #ddd; }
        .filter-btn.active { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,.08); }
        .tooltip-custom { background: #13151c !important; border: 1px solid #2a2d36 !important; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 12px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1c23", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, letterSpacing: "-.02em", color: "#fff" }}>
            ledger<span style={{ color: "#4ade80" }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 2 }}>Chase Sapphire + Capital One</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {hasData && <span style={{ fontSize: 12, color: "#555" }}>{transactions.length} transactions</span>}
          {hasData && <button className="clear-btn" onClick={clearAll}>Clear all</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #1a1c23", padding: "0 32px", display: "flex", gap: 4 }}>
        {[["upload","Upload"], ["staging","Staging"], ["summary","Summary"], ["charts","Charts"], ["grocery","Grocery vs Dining"]].map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
            disabled={id !== "upload" && !hasData}
          >{label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Errors */}
        {errors.map((e, i) => (
          <div key={i} className="error-bar">⚠ {e} <span style={{ cursor: "pointer", float: "right" }} onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))}>✕</span></div>
        ))}

        {/* ── UPLOAD ── */}
        {tab === "upload" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {["Chase Sapphire", "Capital One"].map((card) => (
              <div key={card}>
                <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{card}</div>
                <div
                  className={`drop-zone${dragOver === card ? " over" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(card); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(e, card)}
                >
                  <input type="file" accept=".csv" onChange={handleInput} />
                  <div style={{ fontSize: 28, marginBottom: 12, opacity: .4 }}>⬆</div>
                  <div style={{ fontSize: 13, color: "#888" }}>Drop CSV or click to browse</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
                    {card === "Chase Sapphire" ? "Transaction Date, Post Date, Description, Category, Type, Amount, Memo" : "Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit"}
                  </div>
                </div>
                {/* loaded indicator */}
                {transactions.filter(t => t.card === card).length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#4ade80" }}>
                    ✓ {transactions.filter(t => t.card === card).length} transactions loaded
                  </div>
                )}
              </div>
            ))}
            <div style={{ gridColumn: "1/-1" }}>
              <div className="card-block" style={{ opacity: .7 }}>
                <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>How it works</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
                  1. Upload both CSVs above — they'll be normalized into a unified staging table.<br/>
                  2. In Staging, each transaction defaults to <span className="pill pill-joint">Joint</span>. Tag personal ones as <span className="pill pill-n">N</span> (Nick) or <span className="pill pill-m">M</span> (Madeline).<br/>
                  3. Summary shows totals per card and combined — Joint paid from checking, personal from individual accounts.<br/>
                  4. Charts break down spending by category.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGING ── */}
        {tab === "staging" && hasData && <StagingTable transactions={transactions} setOwner={setOwner} />}

        {/* ── SUMMARY ── */}
        {tab === "summary" && hasData && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {["Chase Sapphire", "Capital One", "Combined"].map(card => {
              const d = summary[card] || {};
              const total = (d.Joint || 0) + (d.N || 0) + (d.M || 0);
              const isCombo = card === "Combined";
              return (
                <div key={card} className="card-block" style={isCombo ? { gridColumn: "1/-1", borderColor: "#2a2d36" } : {}}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: isCombo ? 20 : 17, fontWeight: 600, color: "#fff" }}>{card}</div>
                      {isCombo && <div style={{ fontSize: 11, color: "#444", marginTop: 2, letterSpacing: ".06em", textTransform: "uppercase" }}>All cards combined</div>}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{fmt(total)}</div>
                  </div>
                  <div className="summary-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="pill pill-joint">Joint</span>
                      <span style={{ fontSize: 12, color: "#555" }}>→ paid from checking</span>
                    </div>
                    <span style={{ fontWeight: 500, color: "#4ade80" }}>{fmt(d.Joint || 0)}</span>
                  </div>
                  <div className="summary-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="pill pill-n">Nick</span>
                      <span style={{ fontSize: 12, color: "#555" }}>→ paid from personal</span>
                    </div>
                    <span style={{ fontWeight: 500, color: "#60a5fa" }}>{fmt(d.N || 0)}</span>
                  </div>
                  <div className="summary-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="pill pill-m">Madeline</span>
                      <span style={{ fontSize: 12, color: "#555" }}>→ paid from personal</span>
                    </div>
                    <span style={{ fontWeight: 500, color: "#f472b6" }}>{fmt(d.M || 0)}</span>
                  </div>
                  {isCombo && (
                    <div style={{ marginTop: 20, padding: "14px 18px", background: "#0d0f14", borderRadius: 10, border: "1px solid #1a1c23" }}>
                      <div style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Payment due from joint checking</div>
                      <div style={{ display: "flex", gap: 24 }}>
                        {["Chase Sapphire", "Capital One"].map(c => (
                          <div key={c}>
                            <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{c}</div>
                            <div style={{ fontSize: 18, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#4ade80" }}>{fmt(summary[c]?.Joint || 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── GROCERY VS DINING ── */}
        {tab === "grocery" && hasData && <GroceryVsDining transactions={transactions} />}

        {/* ── CHARTS ── */}
        {tab === "charts" && hasData && (
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Owner pie */}
              <div className="card-block">
                <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Spend by owner</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ownerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                      {ownerPieData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[entry.name === "Nick" ? "N" : entry.name === "Madeline" ? "M" : "Joint"]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
                    <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Card bar */}
              <div className="card-block">
                <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Per card breakdown</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[
                    { name: "Chase", Joint: summary["Chase Sapphire"]?.Joint || 0, Nick: summary["Chase Sapphire"]?.N || 0, Madeline: summary["Chase Sapphire"]?.M || 0 },
                    { name: "Cap One", Joint: summary["Capital One"]?.Joint || 0, Nick: summary["Capital One"]?.N || 0, Madeline: summary["Capital One"]?.M || 0 },
                  ]} barSize={28}>
                    <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
                    <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
                    <Bar dataKey="Joint" fill={COLORS.Joint} radius={[4,4,0,0]} />
                    <Bar dataKey="Nick" fill={COLORS.N} radius={[4,4,0,0]} />
                    <Bar dataKey="Madeline" fill={COLORS.M} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category bar */}
            <div className="card-block">
              <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Spend by category</div>
              <ResponsiveContainer width="100%" height={Math.max(260, categoryData.length * 36)}>
                <BarChart data={categoryData} layout="vertical" barSize={14} margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
                  <Bar dataKey="Joint" fill={COLORS.Joint} stackId="a" />
                  <Bar dataKey="N" name="Nick" fill={COLORS.N} stackId="a" />
                  <Bar dataKey="M" name="Madeline" fill={COLORS.M} stackId="a" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Staging table ──────────────────────────────────────────────────────────
function StagingTable({ transactions, setOwner }) {
  const [cardFilter, setCardFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => transactions.map((t, i) => ({ ...t, _idx: i })).filter(t => {
    if (cardFilter !== "All" && t.card !== cardFilter) return false;
    if (ownerFilter !== "All" && t.owner !== ownerFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [transactions, cardFilter, ownerFilter, search]);

  const bulkTag = (owner) => {
    filtered.forEach(t => setOwner(t._idx, owner));
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search description or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 6, padding: "6px 12px", color: "#e8e8e0", fontFamily: "inherit", fontSize: 12, outline: "none", width: 240 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {["All", "Chase Sapphire", "Capital One"].map(f => (
            <button key={f} className={`filter-btn${cardFilter === f ? " active" : ""}`} onClick={() => setCardFilter(f)}>{f === "All" ? "All cards" : f}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["All", "Joint", "N", "M"].map(f => (
            <button key={f} className={`filter-btn${ownerFilter === f ? " active" : ""}`} onClick={() => setOwnerFilter(f)}>{f === "All" ? "All owners" : f === "N" ? "Nick" : f === "M" ? "Madeline" : "Joint"}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#444" }}>Bulk tag filtered:</span>
          {OWNERS.map(o => (
            <button key={o} className={`owner-btn active-${o}`} onClick={() => bulkTag(o)}>{o === "N" ? "Nick" : o === "M" ? "Madeline" : "Joint"}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 90px 240px", gap: 0 }}>
          {/* Header */}
          {["Date","Description","Category","Amount","Card","Owner"].map(h => (
            <div key={h} style={{ padding: "12px 14px", fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid #1a1c23", background: "#0d0f14" }}>{h}</div>
          ))}
          {/* Rows */}
          {filtered.map((t) => (
            <React.Fragment key={t._idx}>
              <div style={{ padding: "11px 14px", fontSize: 12, color: "#666", borderBottom: "1px solid #141618" }}>{t.date}</div>
              <div style={{ padding: "11px 14px", fontSize: 12, color: "#ccc", borderBottom: "1px solid #141618", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
              <div style={{ padding: "11px 14px", fontSize: 11, color: "#666", borderBottom: "1px solid #141618" }}>{t.category}</div>
              <div style={{ padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#e8e8e0", borderBottom: "1px solid #141618" }}>{fmt(t.amount)}</div>
              <div style={{ padding: "11px 14px", fontSize: 10, color: "#555", borderBottom: "1px solid #141618", letterSpacing: ".04em" }}>{t.card === "Chase Sapphire" ? "Chase" : "Cap One"}</div>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #141618", display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                {OWNERS.map(o => {
                  const isActive = t.owner === o;
                  const colors = { Joint: "#4ade80", N: "#60a5fa", M: "#f472b6" };
                  const color = colors[o];
                  return (
                    <button
                      key={o}
                      onClick={() => setOwner(t._idx, o)}
                      style={{
                        border: `1px solid ${isActive ? color : "#2a2d36"}`,
                        background: isActive ? `${color}22` : "transparent",
                        color: isActive ? color : "#555",
                        borderRadius: 4,
                        padding: "4px 10px",
                        fontFamily: "inherit",
                        fontSize: 11,
                        cursor: "pointer",
                        letterSpacing: ".04em",
                        whiteSpace: "nowrap",
                        transition: "all .15s",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {o === "N" ? "Nick" : o === "M" ? "Mad" : "Joint"}
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#333", fontSize: 13 }}>No transactions match current filters.</div>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#333" }}>Showing {filtered.length} of {transactions.length} transactions</div>
    </div>
  );
}

// ── Grocery vs Dining ─────────────────────────────────────────────────────
const GROCERY_MERCHANTS = ["aldi", "mariano", "trader joe", "costco", "edgewater produce", "whole foods", "la colombe"];
const DINING_KEYWORDS = ["dining", "restaurant", "cafe", "coffee", "bar ", "grill", "pizza", "sushi", "taco", "burger", "kitchen", "eatery", "bistro", "tavern", "pub", "diner", "bbq", "steakhouse", "brewery", "wok", "noodle", "ramen", "brasserie"];

function classifyTxn(t) {
  const desc = (t.description || "").toLowerCase();
  const cat = (t.category || "").toLowerCase();
  if (GROCERY_MERCHANTS.some(m => desc.includes(m))) return "grocery";
  if (cat.includes("grocer") || cat.includes("supermarket")) return "grocery";
  if (cat.includes("dining") || cat.includes("restaurant") || cat.includes("food & drink")) return "dining";
  if (DINING_KEYWORDS.some(k => desc.includes(k))) return "dining";
  return null;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-W${String(Math.ceil((mon.getDate()) / 7)).padStart(2,"0")} (${(mon.getMonth()+1)}/${mon.getDate()})`;
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function getQuarterKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()} Q${q}`;
}

function GroceryVsDining({ transactions }) {
  const [period, setPeriod] = React.useState("month");
  const [metric, setMetric] = React.useState("spend"); // spend | visits | ratio
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

  // summary stats (excluding manually excluded dining merchants)
  const totalGrocery = classified.filter(t => t.foodType === "grocery").reduce((s,t) => s + t.amount, 0);
  const totalDining  = classified.filter(t => t.foodType === "dining" && !excludedDining.includes(t.description)).reduce((s,t) => s + t.amount, 0);
  const groceryVisits = classified.filter(t => t.foodType === "grocery").length;
  const diningVisits  = classified.filter(t => t.foodType === "dining" && !excludedDining.includes(t.description)).length;
  const ratio = totalDining > 0 ? (totalGrocery / totalDining).toFixed(2) : "—";

  // top merchants
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

  // Active dining: fill top N from non-excluded pool
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

      {/* Stat cards */}
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

      {/* Controls */}
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

      {/* Main trend chart */}
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

      {/* Side-by-side bars + merchant tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Grocery merchants */}
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

        {/* Dining merchants */}
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
              {activeDiningFull.slice(0, listLimit).map((m, i) => (
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

      {/* Detection note */}
      <div style={{ fontSize: 11, color: "#2a2d36", lineHeight: 1.7 }}>
        Grocery detected from: {GROCERY_MERCHANTS.join(", ")} · Dining detected from category or merchant keywords
      </div>
    </div>
  );
}
