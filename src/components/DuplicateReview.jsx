import React, { useState } from "react";
import { fmt } from "../utils/format.js";

export default function DuplicateReview({ newTxns, dupTxns, onConfirm, onCancel }) {
  const [showDups, setShowDups] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleConfirm() {
    setImporting(true);
    await onConfirm(newTxns);
    setImporting(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 16, padding: 32, width: 560, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>Import preview</div>

        <div style={{ display: "flex", gap: 16, margin: "20px 0" }}>
          <div style={{ flex: 1, background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.2)", borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#4ade80" }}>{newTxns.length}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4, letterSpacing: ".08em", textTransform: "uppercase" }}>New transactions</div>
          </div>
          <div style={{ flex: 1, background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.15)", borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f87171" }}>{dupTxns.length}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4, letterSpacing: ".08em", textTransform: "uppercase" }}>Already in database</div>
          </div>
        </div>

        {dupTxns.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowDups(v => !v)}
              style={{ background: "none", border: "1px solid #2a2d36", color: "#888", borderRadius: 6, padding: "5px 14px", fontFamily: "inherit", fontSize: 11, cursor: "pointer", letterSpacing: ".05em" }}
            >
              {showDups ? "Hide" : "Show"} duplicates
            </button>

            {showDups && (
              <div style={{ marginTop: 12, maxHeight: 220, overflow: "auto", border: "1px solid #1e2029", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#0d0f14" }}>
                      {["Date", "Description", "Amount", "Card"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#555", letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid #1e2029" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dupTxns.map(tx => (
                      <tr key={tx.id} style={{ borderBottom: "1px solid #1a1c23" }}>
                        <td style={{ padding: "7px 12px", color: "#666" }}>{tx.date}</td>
                        <td style={{ padding: "7px 12px", color: "#aaa", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</td>
                        <td style={{ padding: "7px 12px", color: "#f87171" }}>{fmt(tx.amount)}</td>
                        <td style={{ padding: "7px 12px", color: "#555" }}>{tx.card}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {newTxns.length === 0 ? (
          <div style={{ color: "#666", fontSize: 13, marginBottom: 20 }}>Nothing new to import — all transactions already exist in the database.</div>
        ) : null}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ background: "none", border: "1px solid #2a2d36", color: "#666", borderRadius: 8, padding: "9px 20px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
            Cancel
          </button>
          {newTxns.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={importing}
              style={{ background: "#4ade80", border: "none", color: "#0d0f14", borderRadius: 8, padding: "9px 20px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.7 : 1 }}
            >
              {importing ? "Saving…" : `Save ${newTxns.length} transaction${newTxns.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
