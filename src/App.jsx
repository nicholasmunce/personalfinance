import React, { useState, useCallback, useMemo } from 'react';
import { autoDetectAndParse } from './utils/parsers.js';
import Upload from './components/Upload.jsx';
import StagingTable from './components/StagingTable.jsx';
import Summary from './components/Summary.jsx';
import Charts from './components/Charts.jsx';
import GroceryVsDining from './components/GroceryVsDining.jsx';

const GLOBAL_STYLES = `
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
`;

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [tab, setTab] = useState("upload");
  const [dragOver, setDragOver] = useState(null);
  const [errors, setErrors] = useState([]);

  const ingest = useCallback((text, filename) => {
    const { parsed } = autoDetectAndParse(text, filename);
    if (!parsed || parsed.length === 0) {
      setErrors(e => [...e, `Could not parse "${filename}". Make sure it's a Chase or Capital One CSV export.`]);
      return;
    }
    setTransactions(prev => [...prev, ...parsed]);
    setTab("staging");
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => ingest(e.target.result, file.name);
    reader.readAsText(file);
  }, [ingest]);

  const setOwner = (idx, owner) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, owner } : t));
  };

  const clearAll = () => { setTransactions([]); setTab("upload"); setErrors([]); };

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

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8e8e0", fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{GLOBAL_STYLES}</style>

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

      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {errors.map((e, i) => (
          <div key={i} className="error-bar">⚠ {e} <span style={{ cursor: "pointer", float: "right" }} onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))}>✕</span></div>
        ))}

        {tab === "upload" && <Upload transactions={transactions} onFile={handleFile} dragOver={dragOver} setDragOver={setDragOver} />}
        {tab === "staging" && hasData && <StagingTable transactions={transactions} setOwner={setOwner} />}
        {tab === "summary" && hasData && <Summary summary={summary} />}
        {tab === "charts" && hasData && <Charts summary={summary} categoryData={categoryData} ownerPieData={ownerPieData} />}
        {tab === "grocery" && hasData && <GroceryVsDining transactions={transactions} />}
      </div>
    </div>
  );
}
