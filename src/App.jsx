import React, { useState, useCallback, useEffect } from 'react';
import { autoDetectAndParse } from './utils/parsers.js';
import Upload from './components/Upload.jsx';
import StagingTable from './components/StagingTable.jsx';
import AnalyticsView from './components/AnalyticsView.jsx';
import TransactionsView from './components/TransactionsView.jsx';
import DuplicateReview from './components/DuplicateReview.jsx';
import Settings from './components/Settings.jsx';

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
  .owner-btn.active-C { background: rgba(74,222,128,.15); border-color: #4ade80; color: #4ade80; }
  .owner-btn.active-N { background: rgba(96,165,250,.15); border-color: #60a5fa; color: #60a5fa; }
  .owner-btn.active-M { background: rgba(244,114,182,.15); border-color: #f472b6; color: #f472b6; }
  .owner-btn.active-X { background: rgba(251,146,60,.15); border-color: #fb923c; color: #fb923c; }
  .card-block { background: #13151c; border: 1px solid #1e2029; border-radius: 14px; padding: 28px; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1a1c23; }
  .summary-row:last-child { border-bottom: none; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
  .pill-c { background: rgba(74,222,128,.15); color: #4ade80; }
  .pill-n { background: rgba(96,165,250,.15); color: #60a5fa; }
  .pill-m { background: rgba(244,114,182,.15); color: #f472b6; }
  .pill-x { background: rgba(251,146,60,.15); color: #fb923c; }
  .error-bar { background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: 8px; padding: 10px 16px; font-size: 12px; color: #f87171; margin-bottom: 12px; }
  .clear-btn { background: none; border: 1px solid #2a2d36; color: #666; border-radius: 6px; padding: 6px 14px; font-family: inherit; font-size: 12px; cursor: pointer; transition: all .2s; }
  .clear-btn:hover { border-color: #f87171; color: #f87171; }
  .filter-btn { background: none; border: 1px solid #2a2d36; color: #888; border-radius: 6px; padding: 4px 12px; font-family: inherit; font-size: 11px; cursor: pointer; letter-spacing:.05em; transition: all .15s; }
  .filter-btn:hover { border-color: #555; color: #ddd; }
  .filter-btn.active { border-color: #4ade80; color: #4ade80; background: rgba(74,222,128,.08); }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
`;

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function App() {
  const defaults = defaultDateRange();
  const [tab, setTab] = useState("analytics");
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [errors, setErrors] = useState([]);
  const [pendingImport, setPendingImport] = useState(null);
  const [stagingTxns, setStagingTxns] = useState([]);
  const [periodMode, setPeriodMode] = useState(() => localStorage.getItem("periodMode") || "calendar");
  const [statementDates, setStatementDates] = useState({});

  useEffect(() => {
    fetch("/api/statement-dates")
      .then(r => r.json())
      .then(rows => {
        const map = {};
        for (const r of rows) {
          if (!map[r.card]) map[r.card] = [];
          map[r.card].push(r.close_date);
        }
        setStatementDates(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "import") return;
    loadRange(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  async function loadRange(from, to) {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    const rows = await fetch(`/api/transactions?${params}`).then(r => r.json()).catch(() => []);
    setTransactions(rows);
    setLoading(false);
  }

  function handlePeriodMode(mode) {
    setPeriodMode(mode);
    localStorage.setItem("periodMode", mode);
  }

  const ingest = useCallback(async (text, filename) => {
    const { parsed } = await autoDetectAndParse(text, filename);
    if (!parsed || parsed.length === 0) {
      setErrors(e => [...e, `Could not parse "${filename}". Make sure it's a Chase or Capital One CSV export.`]);
      return;
    }
    const ids = parsed.map(t => t.id);
    let existing = [];
    try {
      const res = await fetch("/api/transactions/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      existing = (await res.json()).existing;
    } catch {}

    const existingSet = new Set(existing);
    const newTxns = parsed.filter(t => !existingSet.has(t.id));
    const dupTxns = parsed.filter(t => existingSet.has(t.id));

    setStagingTxns(parsed);
    setPendingImport({ newTxns, dupTxns });
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => ingest(e.target.result, file.name);
    reader.readAsText(file);
  }, [ingest]);

  const setStagingOwner = (idx, owner) => {
    setStagingTxns(prev => prev.map((t, i) => i === idx ? { ...t, owner } : t));
  };

  async function commitImport(newTxns) {
    const ownerMap = {};
    stagingTxns.forEach(t => { ownerMap[t.id] = t.owner; });
    const withOwners = newTxns.map(t => ({ ...t, owner: ownerMap[t.id] || t.owner }));
    await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: withOwners }),
    });
    setPendingImport(null);
    setStagingTxns([]);
    await loadRange(dateFrom, dateTo);
    setTab("analytics");
  }

  function handleOwnerChange(id, owner) {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, owner } : t));
  }

  function handleDelete(id) {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  const TABS = [
    ["analytics", "Analytics"],
    ["transactions", "Transactions"],
    ["import", "Import"],
    ["settings", "Settings"],
  ];

  const showStaging = stagingTxns.length > 0 && !pendingImport;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8e8e0", fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{GLOBAL_STYLES}</style>

      {pendingImport && (
        <DuplicateReview
          newTxns={pendingImport.newTxns}
          dupTxns={pendingImport.dupTxns}
          onConfirm={commitImport}
          onCancel={() => { setPendingImport(null); setStagingTxns([]); }}
        />
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1c23", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, letterSpacing: "-.02em", color: "#fff" }}>
            ledger<span style={{ color: "#4ade80" }}>.</span>
          </div>
          <div style={{ fontSize: 11, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 2 }}>Chase Sapphire + Capital One</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Period mode toggle */}
          <div style={{ display: "flex", background: "#13151c", border: "1px solid #1e2029", borderRadius: 8, overflow: "hidden" }}>
            {["calendar", "statement"].map(mode => (
              <button key={mode} onClick={() => handlePeriodMode(mode)} style={{
                background: periodMode === mode ? "#1e2029" : "none",
                border: "none", color: periodMode === mode ? "#e8e8e0" : "#444",
                fontFamily: "inherit", fontSize: 11, padding: "5px 14px", cursor: "pointer",
                letterSpacing: ".06em", textTransform: "uppercase", transition: "all .15s",
              }}>{mode}</button>
            ))}
          </div>
          {/* Global date range */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 6, padding: "5px 10px", color: "#888", fontFamily: "inherit", fontSize: 11 }}
            />
            <span style={{ color: "#333", fontSize: 11 }}>→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 6, padding: "5px 10px", color: "#888", fontFamily: "inherit", fontSize: 11 }}
            />
          </div>
          {loading && <span style={{ fontSize: 11, color: "#444" }}>Loading…</span>}
          {!loading && transactions.length > 0 && (
            <span style={{ fontSize: 12, color: "#555" }}>{transactions.length} transactions</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: "1px solid #1a1c23", padding: "0 32px", display: "flex", gap: 4 }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab-btn${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {errors.map((e, i) => (
          <div key={i} className="error-bar">
            ⚠ {e}
            <span style={{ cursor: "pointer", float: "right" }} onClick={() => setErrors(prev => prev.filter((_, j) => j !== i))}>✕</span>
          </div>
        ))}

        {tab === "analytics" && (
          <AnalyticsView transactions={transactions} periodMode={periodMode} statementDates={statementDates} />
        )}

        {tab === "transactions" && (
          <TransactionsView
            transactions={transactions}
            onOwnerChange={handleOwnerChange}
            onDelete={handleDelete}
          />
        )}

        {tab === "import" && (
          <div>
            {showStaging ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "#555" }}>Review & tag before committing to DB</div>
                  <button className="clear-btn" onClick={() => setStagingTxns([])}>Cancel import</button>
                </div>
                <StagingTable
                  transactions={stagingTxns}
                  setOwner={setStagingOwner}
                  periodMode={periodMode}
                  statementDates={statementDates}
                />
                <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                  <button
                    onClick={async () => {
                      await fetch("/api/transactions/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ transactions: stagingTxns }),
                      });
                      setStagingTxns([]);
                      await loadRange(dateFrom, dateTo);
                      setTab("analytics");
                    }}
                    style={{ background: "#4ade80", border: "none", borderRadius: 8, padding: "10px 24px", color: "#0d0f14", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Commit {stagingTxns.length} transactions
                  </button>
                  <button className="clear-btn" onClick={() => setStagingTxns([])}>Cancel</button>
                </div>
              </div>
            ) : (
              <Upload onFile={handleFile} dragOver={dragOver} setDragOver={setDragOver} />
            )}
          </div>
        )}

        {tab === "settings" && <Settings onSettingsChange={setStatementDates} />}
      </div>
    </div>
  );
}
