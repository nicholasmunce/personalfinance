import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../constants.js';
import { fmt } from '../utils/format.js';
import { getPeriodForDate } from '../utils/statementPeriod.js';

const CARD_LIST = ["Chase Sapphire", "Capital One"];
const PIE_KEY_MAP = { Checking: "C", Nick: "N", Madeline: "M", "Non-Checking": "X" };

function filterToCurrentPeriod(transactions, statementDates) {
  const today = new Date().toISOString().slice(0, 10);
  return transactions.filter(tx => {
    const dates = statementDates[tx.card] || [];
    const period = getPeriodForDate(today, dates);
    if (!period) return false;
    const start = period.start || "0000-00-00";
    const end = period.end || "9999-99-99";
    return tx.date >= start && tx.date <= end;
  });
}

function buildSummary(txns) {
  const result = {};
  CARD_LIST.forEach(card => {
    const t = txns.filter(x => x.card === card);
    result[card] = {
      C: t.filter(x => x.owner === "C").reduce((s, x) => s + x.amount, 0),
      N: t.filter(x => x.owner === "N").reduce((s, x) => s + x.amount, 0),
      M: t.filter(x => x.owner === "M").reduce((s, x) => s + x.amount, 0),
      X: t.filter(x => x.owner === "X").reduce((s, x) => s + x.amount, 0),
    };
  });
  return result;
}

function buildCategoryData(txns) {
  const map = {};
  txns.forEach(t => {
    const cat = t.category || "Uncategorized";
    if (!map[cat]) map[cat] = { name: cat, C: 0, N: 0, M: 0, X: 0, total: 0 };
    map[cat][t.owner] = (map[cat][t.owner] || 0) + t.amount;
    map[cat].total += t.amount;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export default function Charts({ transactions, periodMode, statementDates }) {
  const activeTxns = useMemo(() => (
    periodMode === "statement" ? filterToCurrentPeriod(transactions, statementDates) : transactions
  ), [transactions, periodMode, statementDates]);

  const summary = useMemo(() => buildSummary(activeTxns), [activeTxns]);
  const categoryData = useMemo(() => buildCategoryData(activeTxns), [activeTxns]);

  const ownerPieData = useMemo(() => {
    const combined = {
      Checking: CARD_LIST.reduce((s, c) => s + (summary[c]?.C || 0), 0),
      Nick: CARD_LIST.reduce((s, c) => s + (summary[c]?.N || 0), 0),
      Madeline: CARD_LIST.reduce((s, c) => s + (summary[c]?.M || 0), 0),
      "Non-Checking": CARD_LIST.reduce((s, c) => s + (summary[c]?.X || 0), 0),
    };
    return Object.entries(combined).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [summary]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card-block">
          <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Spend by owner</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ownerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {ownerPieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[PIE_KEY_MAP[entry.name]]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card-block">
          <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Per card breakdown</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[
              { name: "Chase", Checking: summary["Chase Sapphire"]?.C || 0, Nick: summary["Chase Sapphire"]?.N || 0, Madeline: summary["Chase Sapphire"]?.M || 0, "Non-Checking": summary["Chase Sapphire"]?.X || 0 },
              { name: "Cap One", Checking: summary["Capital One"]?.C || 0, Nick: summary["Capital One"]?.N || 0, Madeline: summary["Capital One"]?.M || 0, "Non-Checking": summary["Capital One"]?.X || 0 },
            ]} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
              <Bar dataKey="Checking" fill={COLORS.C} radius={[4,4,0,0]} />
              <Bar dataKey="Nick" fill={COLORS.N} radius={[4,4,0,0]} />
              <Bar dataKey="Madeline" fill={COLORS.M} radius={[4,4,0,0]} />
              <Bar dataKey="Non-Checking" fill={COLORS.X} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-block">
        <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Spend by category</div>
        <ResponsiveContainer width="100%" height={Math.max(260, categoryData.length * 36)}>
          <BarChart data={categoryData} layout="vertical" barSize={14} margin={{ left: 20, right: 20 }}>
            <XAxis type="number" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
            <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
            <Bar dataKey="C" name="Checking" fill={COLORS.C} stackId="a" />
            <Bar dataKey="N" name="Nick" fill={COLORS.N} stackId="a" />
            <Bar dataKey="M" name="Madeline" fill={COLORS.M} stackId="a" />
            <Bar dataKey="X" name="Non-Checking" fill={COLORS.X} stackId="a" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
