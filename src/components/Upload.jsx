import React, { useState, useEffect, useMemo } from 'react';
import { getPeriodForDate, formatPeriod } from '../utils/statementPeriod.js';

export default function Upload({ transactions, onFile, dragOver, setDragOver, periodMode, statementDates, onLoadFromDb }) {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/transactions/months').then(r => r.json()).then(setMonths).catch(() => {});
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleInput = (e) => {
    onFile(e.target.files[0]);
    e.target.value = "";
  };

  // Build period options depending on mode
  const periodOptions = useMemo(() => {
    if (periodMode === "statement") {
      // Derive statement periods from the months we have + the close dates
      const allDates = months.map(m => m.month + "-15"); // rough midpoint to get the period
      const seen = new Map();
      for (const m of months) {
        // Use first day of month as a representative date to find period
        const repDate = m.month + "-15";
        for (const card of ["Chase Sapphire", "Capital One"]) {
          const dates = statementDates?.[card] || [];
          if (!dates.length) continue;
          const p = getPeriodForDate(repDate, dates);
          if (p && !seen.has(p.sortKey)) {
            seen.set(p.sortKey, { ...p, count: m.count });
          }
        }
      }
      return [...seen.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    }
    // Calendar mode — one entry per month
    return months.map(m => {
      const [y, mo] = m.month.split("-");
      const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
      return { label, from: `${m.month}-01`, to: `${m.month}-31`, count: m.count, key: m.month };
    });
  }, [months, periodMode, statementDates]);

  async function handleLoad(opt) {
    setLoading(true);
    const from = opt.start || opt.from;
    const to = opt.end || opt.to;
    await onLoadFromDb(from, to);
    setLoading(false);
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Upload section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {["Chase Sapphire", "Capital One"].map((card) => (
          <div key={card}>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{card}</div>
            <div
              className={`drop-zone${dragOver === card ? " over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(card); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={handleDrop}
            >
              <input type="file" accept=".csv" onChange={handleInput} />
              <div style={{ fontSize: 28, marginBottom: 12, opacity: .4 }}>⬆</div>
              <div style={{ fontSize: 13, color: "#888" }}>Drop CSV or click to browse</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
                {card === "Chase Sapphire"
                  ? "Transaction Date, Post Date, Description, Category, Type, Amount, Memo"
                  : "Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit"}
              </div>
            </div>
            {transactions.filter(t => t.card === card).length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#4ade80" }}>
                ✓ {transactions.filter(t => t.card === card).length} transactions loaded
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load from DB section */}
      {periodOptions.length > 0 && (
        <div className="card-block">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>
                Load from database
              </div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 3 }}>
                {periodMode === "statement" ? "Statement periods" : "Calendar months"} with existing data
              </div>
            </div>
            {loading && <span style={{ fontSize: 11, color: "#555" }}>Loading…</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {periodOptions.map((opt) => (
              <button
                key={opt.key || opt.sortKey}
                onClick={() => handleLoad(opt)}
                disabled={loading}
                style={{
                  background: "#0d0f14",
                  border: "1px solid #2a2d36",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontFamily: "inherit",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "border-color .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#4ade80"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2d36"}
              >
                <div style={{ fontSize: 13, color: "#e8e8e0" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{opt.count} transactions</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card-block" style={{ opacity: .7 }}>
        <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>How it works</div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
          1. Upload both CSVs above — they'll be normalized into a unified staging table.<br/>
          2. In Staging, each transaction defaults to <span className="pill pill-c">Checking</span>. Tag personal ones as <span className="pill pill-n">Nick</span> or <span className="pill pill-m">Madeline</span>, or <span className="pill pill-x">Non-Checking</span> for other sources.<br/>
          3. Summary shows totals per card and combined — Checking paid from joint checking, personal from individual accounts.<br/>
          4. Charts break down spending by category.
        </div>
      </div>
    </div>
  );
}
