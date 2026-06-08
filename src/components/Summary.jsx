import React, { useMemo } from 'react';
import { fmt } from '../utils/format.js';

const CARDS = ["Chase Sapphire", "Capital One"];

function buildSummary(transactions) {
  const result = {};
  CARDS.forEach(card => {
    const debits = transactions.filter(t => t.card === card && t.type !== "payment");
    const payments = transactions.filter(t => t.card === card && t.type === "payment");
    result[card] = {
      C: debits.filter(t => t.owner === "C").reduce((s, t) => s + t.amount, 0),
      N: debits.filter(t => t.owner === "N").reduce((s, t) => s + t.amount, 0),
      M: debits.filter(t => t.owner === "M").reduce((s, t) => s + t.amount, 0),
      X: debits.filter(t => t.owner === "X").reduce((s, t) => s + t.amount, 0),
      payments: payments.reduce((s, t) => s + t.amount, 0),
      paymentCount: payments.length,
    };
  });
  result["Combined"] = {
    C: CARDS.reduce((s, c) => s + (result[c]?.C || 0), 0),
    N: CARDS.reduce((s, c) => s + (result[c]?.N || 0), 0),
    M: CARDS.reduce((s, c) => s + (result[c]?.M || 0), 0),
    X: CARDS.reduce((s, c) => s + (result[c]?.X || 0), 0),
    payments: CARDS.reduce((s, c) => s + (result[c]?.payments || 0), 0),
    paymentCount: CARDS.reduce((s, c) => s + (result[c]?.paymentCount || 0), 0),
  };
  return result;
}

export default function Summary({ transactions }) {
  const summary = useMemo(() => buildSummary(transactions), [transactions]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {[...CARDS, "Combined"].map(card => {
        const d = summary[card] || {};
        const charges = (d.C || 0) + (d.N || 0) + (d.M || 0) + (d.X || 0);
        const balance = charges - (d.payments || 0);
        const isCombo = card === "Combined";

        return (
          <div key={card} className="card-block" style={isCombo ? { gridColumn: "1/-1", borderColor: "#2a2d36" } : {}}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: isCombo ? 20 : 17, fontWeight: 600, color: "#fff" }}>{card}</div>
                {isCombo && <div style={{ fontSize: 11, color: "#444", marginTop: 2, letterSpacing: ".06em", textTransform: "uppercase" }}>All cards combined</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#4ade80" }}>{fmt(charges)}</div>
                {d.payments > 0 && (
                  <div style={{ fontSize: 11, color: balance > 0 ? "#f87171" : "#4ade80", marginTop: 3 }}>
                    {fmt(d.payments)} paid → <span style={{ fontWeight: 600 }}>{fmt(balance)} balance</span>
                  </div>
                )}
              </div>
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

            {d.payments > 0 && (
              <div className="summary-row" style={{ opacity: 0.7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#555" }}>
                    {d.paymentCount} payment{d.paymentCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <span style={{ fontWeight: 500, color: "#555" }}>−{fmt(d.payments || 0)}</span>
              </div>
            )}

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
