import React, { useState, useMemo } from 'react';
import { OWNERS } from '../constants.js';
import { fmt } from '../utils/format.js';

export default function StagingTable({ transactions, setOwner }) {
  const [cardFilter, setCardFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => transactions.map((t, i) => ({ ...t, _idx: i })).filter(t => {
    if (cardFilter !== "All" && t.card !== cardFilter) return false;
    if (ownerFilter !== "All" && t.owner !== ownerFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [transactions, cardFilter, ownerFilter, search]);

  const bulkTag = (owner) => filtered.forEach(t => setOwner(t._idx, owner));

  return (
    <div>
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

      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 90px 240px", gap: 0 }}>
          {["Date","Description","Category","Amount","Card","Owner"].map(h => (
            <div key={h} style={{ padding: "12px 14px", fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid #1a1c23", background: "#0d0f14" }}>{h}</div>
          ))}
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
