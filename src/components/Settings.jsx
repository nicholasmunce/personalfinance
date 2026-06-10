import React, { useState, useEffect, useRef } from "react";

const CARDS = [
  { key: "Chase Sapphire", label: "Chase Sapphire", color: "#f59e0b" },
  { key: "Capital One", label: "Capital One", color: "#a78bfa" },
];

export default function Settings({ onSettingsChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState({ "Chase Sapphire": "", "Capital One": "" });

  // Budget state
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({}); // { category -> { id, monthly_budget } }
  const [budgetInputs, setBudgetInputs] = useState({}); // { category -> string value in input }
  const [savedFlags, setSavedFlags] = useState({}); // { category -> bool } for "Saved" flash
  const savedTimers = useRef({});

  async function load() {
    const data = await fetch("/api/statement-dates").then(r => r.json());
    setRows(data);
    setLoading(false);
    onSettingsChange?.(toMap(data));
  }

  async function loadBudgets() {
    const [budgetData, txData] = await Promise.all([
      fetch("/api/budgets").then(r => r.json()),
      fetch("/api/transactions/all").then(r => r.json()),
    ]);

    // Unique categories from transactions
    const cats = [...new Set(
      txData
        .map(t => t.custom_category || t.category)
        .filter(c => c && c.trim())
    )].sort();
    setCategories(cats);

    // Build budgets map
    const budgetMap = {};
    const inputMap = {};
    for (const b of budgetData) {
      budgetMap[b.category] = { id: b.id, monthly_budget: b.monthly_budget };
      inputMap[b.category] = String(b.monthly_budget);
    }
    setBudgets(budgetMap);
    setBudgetInputs(prev => {
      const merged = { ...inputMap };
      // Keep any user edits that haven't been saved yet for categories not in budgetMap
      for (const cat of cats) {
        if (!(cat in merged)) merged[cat] = prev[cat] ?? "";
      }
      return merged;
    });
  }

  useEffect(() => { load(); loadBudgets(); }, []);

  async function saveBudget(cat) {
    const val = parseFloat(budgetInputs[cat]);
    if (isNaN(val) || val < 0) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, monthly_budget: val }),
    });
    await loadBudgets();
    // Show "Saved" flash
    setSavedFlags(prev => ({ ...prev, [cat]: true }));
    clearTimeout(savedTimers.current[cat]);
    savedTimers.current[cat] = setTimeout(() => {
      setSavedFlags(prev => ({ ...prev, [cat]: false }));
    }, 2000);
  }

  function toMap(data) {
    const map = {};
    for (const r of data) {
      if (!map[r.card]) map[r.card] = [];
      map[r.card].push(r.close_date);
    }
    return map;
  }

  async function addDate(card) {
    const date = newDate[card];
    if (!date) return;
    await fetch("/api/statement-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card, close_date: date }),
    });
    setNewDate(prev => ({ ...prev, [card]: "" }));
    await load();
  }

  async function removeDate(id) {
    await fetch(`/api/statement-dates/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div style={{ color: "#555", fontSize: 13 }}>Loading…</div>;

  const byCard = {};
  for (const r of rows) {
    if (!byCard[r.card]) byCard[r.card] = [];
    byCard[r.card].push(r);
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Settings</div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 28, lineHeight: 1.7 }}>
        Add the actual close dates for each card. Statement periods are the gaps between consecutive close dates — just like your credit card statement works.
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        {CARDS.map(({ key, label, color }) => {
          const cardRows = (byCard[key] || []).sort((a, b) => b.close_date.localeCompare(a.close_date));
          return (
            <div key={key} className="card-block">
              <div style={{ fontSize: 13, color, fontWeight: 600, letterSpacing: ".04em", marginBottom: 14 }}>{label}</div>

              {/* Add new date */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <input
                  type="date"
                  value={newDate[key]}
                  onChange={e => setNewDate(prev => ({ ...prev, [key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") addDate(key); }}
                  style={{
                    flex: 1,
                    background: "#0d0f14",
                    border: `1px solid ${color}44`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "#e8e8e0",
                    fontFamily: "inherit",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => addDate(key)}
                  disabled={!newDate[key]}
                  style={{
                    background: newDate[key] ? color : "transparent",
                    border: `1px solid ${color}44`,
                    borderRadius: 8,
                    padding: "8px 16px",
                    color: newDate[key] ? "#0d0f14" : color,
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: newDate[key] ? "pointer" : "not-allowed",
                    transition: "all .15s",
                    opacity: newDate[key] ? 1 : 0.5,
                  }}
                >
                  Add close date
                </button>
              </div>

              {/* Date list */}
              {cardRows.length === 0 ? (
                <div style={{ fontSize: 12, color: "#333", fontStyle: "italic" }}>No close dates added yet.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cardRows.map(r => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: `${color}11`, border: `1px solid ${color}33`,
                      borderRadius: 6, padding: "4px 10px",
                    }}>
                      <span style={{ fontSize: 12, color }}>{r.close_date}</span>
                      <button
                        onClick={() => removeDate(r.id)}
                        style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 28, padding: "16px 20px", background: "#13151c", border: "1px solid #1e2029", borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: "#444", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>How it works</div>
        <div style={{ fontSize: 12, color: "#555", lineHeight: 1.8 }}>
          Add each statement close date as it happens. A period runs from the day after the previous close date up to and including the next close date — matching exactly how your credit card billing cycles work.<br />
          Toggle <strong style={{ color: "#888" }}>Calendar / Statement</strong> in the header to switch all views.
        </div>
      </div>

      {/* Monthly Budgets */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Monthly Budgets</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 20, lineHeight: 1.7 }}>
          Set a monthly spending limit per category. Progress bars will appear in the Analytics view.
        </div>

        {categories.length === 0 ? (
          <div style={{ fontSize: 12, color: "#333", fontStyle: "italic" }}>No categories found. Import transactions first.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {categories.map(cat => (
              <div key={cat} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#13151c", border: "1px solid #1e2029",
                borderRadius: 8, padding: "10px 14px",
              }}>
                <span style={{ fontSize: 12, color: "#ccc", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#555" }}>$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="—"
                    value={budgetInputs[cat] ?? ""}
                    onChange={e => setBudgetInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") saveBudget(cat); }}
                    style={{
                      width: 90,
                      background: "#0d0f14",
                      border: "1px solid #2a2d36",
                      borderRadius: 6,
                      padding: "6px 10px",
                      color: "#e8e8e0",
                      fontFamily: "inherit",
                      fontSize: 12,
                      outline: "none",
                      textAlign: "right",
                    }}
                    onFocus={e => e.target.style.borderColor = "#4ade80"}
                    onBlur={e => e.target.style.borderColor = "#2a2d36"}
                  />
                  <button
                    onClick={() => saveBudget(cat)}
                    disabled={!budgetInputs[cat] || isNaN(parseFloat(budgetInputs[cat]))}
                    style={{
                      background: (budgetInputs[cat] && !isNaN(parseFloat(budgetInputs[cat]))) ? "#4ade80" : "transparent",
                      border: "1px solid #4ade8044",
                      borderRadius: 6,
                      padding: "6px 12px",
                      color: (budgetInputs[cat] && !isNaN(parseFloat(budgetInputs[cat]))) ? "#0d0f14" : "#4ade80",
                      fontFamily: "inherit",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: (budgetInputs[cat] && !isNaN(parseFloat(budgetInputs[cat]))) ? "pointer" : "not-allowed",
                      opacity: (budgetInputs[cat] && !isNaN(parseFloat(budgetInputs[cat]))) ? 1 : 0.4,
                      transition: "all .15s",
                    }}
                  >
                    Save
                  </button>
                  {savedFlags[cat] && (
                    <span style={{ fontSize: 11, color: "#4ade80", minWidth: 36 }}>Saved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
