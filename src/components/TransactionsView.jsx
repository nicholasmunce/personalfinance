import React, { useState, useMemo } from 'react';
import { OWNERS } from '../constants.js';
import { fmt } from '../utils/format.js';

const OWNER_LABELS = { C: "Checking", N: "Nick", M: "Madeline", X: "Non-Chk" };
const OWNER_COLORS = { C: "#4ade80", N: "#60a5fa", M: "#f472b6", X: "#fb923c" };

const CARDS = ["Chase Sapphire", "Capital One"];

function StatsGrid({ transactions }) {
  const debits = transactions.filter(t => t.type !== "payment");
  const stats = useMemo(() => {
    const grid = {};
    for (const card of CARDS) {
      grid[card] = {};
      for (const o of ["C", "N", "M", "X"]) {
        grid[card][o] = debits.filter(t => t.card === card && t.owner === o).reduce((s, t) => s + t.amount, 0);
      }
      grid[card].total = Object.values(grid[card]).reduce((s, v) => s + v, 0);
    }
    grid.Total = {};
    for (const o of ["C", "N", "M", "X"]) {
      grid.Total[o] = CARDS.reduce((s, c) => s + (grid[c][o] || 0), 0);
    }
    grid.Total.total = CARDS.reduce((s, c) => s + (grid[c].total || 0), 0);
    return grid;
  }, [debits]);

  const cols = ["C", "N", "M", "X", "total"];
  const colLabels = { C: "Checking", N: "Nick", M: "Madeline", X: "Non-Chk", total: "Total" };
  const colColors = { C: "#4ade80", N: "#60a5fa", M: "#f472b6", X: "#fb923c", total: "#e8e8e0" };
  const rows = [...CARDS, "Total"];

  const cell = (val, isTotal) => (
    <div style={{ textAlign: "right", fontSize: isTotal ? 13 : 12, fontWeight: isTotal ? 600 : 400, color: isTotal ? "#e8e8e0" : "#888" }}>
      {val > 0 ? fmt(val) : <span style={{ color: "#2a2d36" }}>—</span>}
    </div>
  );

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${cols.length}, 1fr)`, gap: "10px 16px", alignItems: "center" }}>
        <div />
        {cols.map(c => (
          <div key={c} style={{ textAlign: "right", fontSize: 10, color: colColors[c], letterSpacing: ".08em", textTransform: "uppercase", opacity: c === "total" ? 0.5 : 1 }}>{colLabels[c]}</div>
        ))}
        {rows.map((row, ri) => (
          <React.Fragment key={row}>
            <div style={{ fontSize: 11, color: ri === rows.length - 1 ? "#888" : "#555", letterSpacing: ".04em", borderTop: ri === rows.length - 1 ? "1px solid #1e2029" : "none", paddingTop: ri === rows.length - 1 ? 8 : 0, marginTop: ri === rows.length - 1 ? 2 : 0 }}>
              {row === "Chase Sapphire" ? "Chase" : row === "Capital One" ? "Cap One" : row}
            </div>
            {cols.map(c => (
              <div key={c} style={{ borderTop: ri === rows.length - 1 ? "1px solid #1e2029" : "none", paddingTop: ri === rows.length - 1 ? 8 : 0, marginTop: ri === rows.length - 1 ? 2 : 0 }}>
                {cell(stats[row]?.[c] || 0, c === "total" || ri === rows.length - 1)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function TransactionsView({ transactions, onOwnerChange, onDelete }) {
  const [cardFilter, setCardFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => transactions.filter(t => {
    if (t.type === "payment") return false;
    if (cardFilter !== "All" && t.card !== cardFilter) return false;
    if (ownerFilter !== "All" && t.owner !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.description.toLowerCase().includes(q) && !(t.custom_category || t.category).toLowerCase().includes(q)) return false;
    }
    return true;
  }), [transactions, cardFilter, ownerFilter, search]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);

  async function handleOwner(id, owner) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner }),
    });
    onOwnerChange(id, owner);
  }

  async function handleDelete(id) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    onDelete(id);
    setConfirmDelete(null);
  }

  async function bulkTag(owner) {
    await Promise.all(filtered.map(t => handleOwner(t.id, owner)));
  }

  return (
    <div>
      <StatsGrid transactions={filtered} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search description or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 6, padding: "6px 12px", color: "#e8e8e0", fontFamily: "inherit", fontSize: 12, outline: "none", width: 240 }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {["All", "Chase Sapphire", "Capital One"].map(f => (
            <button key={f} className={`filter-btn${cardFilter === f ? " active" : ""}`} onClick={() => setCardFilter(f)}>
              {f === "All" ? "All cards" : f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["All", "C", "N", "M", "X"].map(f => (
            <button key={f} className={`filter-btn${ownerFilter === f ? " active" : ""}`} onClick={() => setOwnerFilter(f)}>
              {f === "All" ? "All owners" : OWNER_LABELS[f]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#444" }}>Bulk tag:</span>
          {OWNERS.map(o => (
            <button key={o} className={`owner-btn active-${o}`} onClick={() => bulkTag(o)}>
              {OWNER_LABELS[o]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>
        {filtered.length} of {transactions.length} transactions
        {filtered.length > 0 && <span style={{ color: "#4ade80", marginLeft: 12 }}>{fmt(total)}</span>}
      </div>

      <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 140px 100px 80px 260px 36px" }}>
          {["Date", "Description", "Category", "Amount", "Card", "Owner", ""].map(h => (
            <div key={h} style={{ padding: "12px 14px", fontSize: 10, color: "#444", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid #1a1c23", background: "#0d0f14" }}>{h}</div>
          ))}
          {filtered.map(t => (
            <React.Fragment key={t.id}>
              <div style={{ padding: "11px 14px", fontSize: 12, color: "#666", borderBottom: "1px solid #141618" }}>{t.date}</div>
              <div style={{ padding: "11px 14px", fontSize: 12, color: "#ccc", borderBottom: "1px solid #141618", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
              <div style={{ padding: "11px 14px", fontSize: 11, color: "#666", borderBottom: "1px solid #141618" }}>{t.custom_category || t.category}</div>
              <div style={{ padding: "11px 14px", fontSize: 12, fontWeight: 500, color: "#e8e8e0", borderBottom: "1px solid #141618" }}>{fmt(t.amount)}</div>
              <div style={{ padding: "11px 14px", fontSize: 10, color: "#555", borderBottom: "1px solid #141618", letterSpacing: ".04em" }}>{t.card === "Chase Sapphire" ? "Chase" : "Cap One"}</div>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #141618", display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap" }}>
                {OWNERS.map(o => {
                  const isActive = t.owner === o;
                  const color = OWNER_COLORS[o];
                  return (
                    <button key={o} onClick={() => handleOwner(t.id, o)} style={{
                      border: `1px solid ${isActive ? color : "#2a2d36"}`,
                      background: isActive ? `${color}22` : "transparent",
                      color: isActive ? color : "#555",
                      borderRadius: 4, padding: "4px 8px",
                      fontFamily: "inherit", fontSize: 11, cursor: "pointer",
                      letterSpacing: ".04em", whiteSpace: "nowrap", transition: "all .15s",
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {OWNER_LABELS[o]}
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: "8px 6px", borderBottom: "1px solid #141618", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {confirmDelete === t.id ? (
                  <button onClick={() => handleDelete(t.id)} style={{
                    background: "rgba(248,113,113,.15)", border: "1px solid #f87171", color: "#f87171",
                    borderRadius: 4, padding: "3px 7px", fontFamily: "inherit", fontSize: 10, cursor: "pointer",
                  }}>del</button>
                ) : (
                  <button onClick={() => setConfirmDelete(t.id)} style={{
                    background: "none", border: "none", color: "#333", fontSize: 14, cursor: "pointer", lineHeight: 1,
                  }} title="Delete">×</button>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#333", fontSize: 13 }}>No transactions match.</div>
        )}
      </div>
    </div>
  );
}
