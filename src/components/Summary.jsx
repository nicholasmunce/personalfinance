import React from 'react';
import { fmt } from '../utils/format.js';

export default function Summary({ summary }) {
  return (
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
  );
}
