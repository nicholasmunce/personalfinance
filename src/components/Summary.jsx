import React, { useMemo } from 'react';
import { fmt } from '../utils/format.js';

const CARDS = ["Chase Sapphire", "Capital One"];

function buildSummary(transactions) {
  const result = {};
  CARDS.forEach(card => {
    const txns = transactions.filter(t => t.card === card);
    result[card] = {
      C: txns.filter(t => t.owner === "C").reduce((s, t) => s + t.amount, 0),
      N: txns.filter(t => t.owner === "N").reduce((s, t) => s + t.amount, 0),
      M: txns.filter(t => t.owner === "M").reduce((s, t) => s + t.amount, 0),
      X: txns.filter(t => t.owner === "X").reduce((s, t) => s + t.amount, 0),
    };
  });
  result["Combined"] = {
    C: CARDS.reduce((s, c) => s + (result[c]?.C || 0), 0),
    N: CARDS.reduce((s, c) => s + (result[c]?.N || 0), 0),
    M: CARDS.reduce((s, c) => s + (result[c]?.M || 0), 0),
    X: CARDS.reduce((s, c) => s + (result[c]?.X || 0), 0),
  };
  return result;
}

export default function Summary({ transactions }) {
  const summary = useMemo(() => buildSummary(transactions), [transactions]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {[...CARDS, "Combined"].map(card => {
        const d = summary[card] || {};
        const total = (d.C || 0) + (d.N || 0) + (d.M || 0) + (d.X || 0);
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
                <span className="pill pill-c">Checking</span>
                <span style={{ fontSize: 12, color: "#555" }}>→ paid from checking</span>
              </div>
              <span style={{ fontWeight: 500, color: "#4ade80" }}>{fmt(d.C || 0)}</span>
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
            <div className="summary-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="pill pill-x">Non-Checking</span>
                <span style={{ fontSize: 12, color: "#555" }}>→ paid from other</span>
              </div>
              <span style={{ fontWeight: 500, color: "#fb923c" }}>{fmt(d.X || 0)}</span>
            </div>
            {isCombo && (
              <div style={{ marginTop: 20, padding: "14px 18px", background: "#0d0f14", borderRadius: 10, border: "1px solid #1a1c23" }}>
                <div style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>Payment due from checking</div>
                <div style={{ display: "flex", gap: 24 }}>
                  {CARDS.map(c => (
                    <div key={c}>
                      <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{c}</div>
                      <div style={{ fontSize: 18, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#4ade80" }}>{fmt(summary[c]?.C || 0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
