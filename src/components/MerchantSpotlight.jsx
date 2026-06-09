import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { fmt } from '../utils/format.js';

function norm(desc) {
  return desc.replace(/\s+[\d*#]+$/, "").replace(/\s{2,}/g, " ").trim();
}

export default function MerchantSpotlight({ transactions }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const debits = useMemo(() => transactions.filter(t => t.type !== "payment"), [transactions]);

  // Build ranked merchant list
  const merchants = useMemo(() => {
    const map = {};
    for (const t of debits) {
      const key = norm(t.description);
      if (!map[key]) map[key] = { name: key, total: 0, count: 0, txns: [] };
      map[key].total += t.amount;
      map[key].count++;
      map[key].txns.push(t);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [debits]);

  const filtered = useMemo(() =>
    search ? merchants.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : merchants.slice(0, 20),
    [merchants, search]
  );

  // Timeline data for selected merchant
  const timeline = useMemo(() => {
    if (!selected) return [];
    const monthMap = {};
    for (const t of selected.txns) {
      const m = t.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { month: m, total: 0, count: 0, txns: [] };
      monthMap[m].total += t.amount;
      monthMap[m].count++;
      monthMap[m].txns.push(t);
    }
    return Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [selected]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "#1a1c23", border: "1px solid #2a2d36", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <div style={{ color: "#888", marginBottom: 4 }}>{d.month}</div>
        <div style={{ color: "#4ade80", fontWeight: 600 }}>{fmt(d.total)}</div>
        <div style={{ color: "#555", marginTop: 2 }}>{d.count} visit{d.count !== 1 ? "s" : ""}</div>
      </div>
    );
  };

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
      <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 18 }}>
        Merchant spotlight
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "260px 1fr" : "1fr", gap: 20 }}>

        {/* Left: merchant list */}
        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search merchants…"
            style={{
              width: "100%", background: "#0d0f14", border: "1px solid #1e2029",
              borderRadius: 6, padding: "7px 12px", color: "#e8e8e0",
              fontFamily: "inherit", fontSize: 12, outline: "none", marginBottom: 10,
            }}
            onFocus={e => e.target.style.borderColor = "#4ade80"}
            onBlur={e => e.target.style.borderColor = "#1e2029"}
          />
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((m, i) => {
              const isActive = selected?.name === m.name;
              return (
                <div
                  key={m.name}
                  onClick={() => setSelected(isActive ? null : m)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                    background: isActive ? "rgba(74,222,128,.08)" : "transparent",
                    border: isActive ? "1px solid rgba(74,222,128,.2)" : "1px solid transparent",
                    marginBottom: 4, transition: "all .15s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,.03)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 10, color: "#333", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: isActive ? "#4ade80" : "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </span>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 10, textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: isActive ? "#4ade80" : "#888" }}>{fmt(m.total)}</div>
                    <div style={{ fontSize: 10, color: "#444" }}>{m.count}×</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: timeline drill-in */}
        {selected && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, color: "#e8e8e0", fontFamily: "'Fraunces', serif", fontWeight: 700 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>
                  {selected.count} visits · {fmt(selected.total)} total · {fmt(selected.total / selected.count)} avg
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: "none", border: "none", color: "#444", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
              >×</button>
            </div>

            {timeline.length > 1 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={timeline} barCategoryGap="25%">
                    <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={m => m.slice(5)} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {timeline.map((_, i) => (
                        <Cell key={i} fill={i === timeline.length - 1 ? "#4ade80" : "#60a5fa"} opacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "#333", marginBottom: 16 }}>monthly spend · most recent highlighted</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#444", marginBottom: 16 }}>Only 1 month of data</div>
            )}

            {/* Individual transactions */}
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {[...selected.txns].sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #1a1c23" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888" }}>{t.date}</div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>{t.custom_category || t.category} · {t.card === "Chase Sapphire" ? "Chase" : "Cap One"}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#e8e8e0", fontFamily: "'Fraunces', serif", fontWeight: 600 }}>{fmt(t.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
