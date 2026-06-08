import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../constants.js';
import { fmt } from '../utils/format.js';

export default function Charts({ summary, categoryData, ownerPieData }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card-block">
          <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 20 }}>Spend by owner</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ownerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                {ownerPieData.map((entry, i) => (
                  <Cell key={i} fill={COLORS[entry.name === "Nick" ? "N" : entry.name === "Madeline" ? "M" : "Joint"]} />
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
              { name: "Chase", Joint: summary["Chase Sapphire"]?.Joint || 0, Nick: summary["Chase Sapphire"]?.N || 0, Madeline: summary["Chase Sapphire"]?.M || 0 },
              { name: "Cap One", Joint: summary["Capital One"]?.Joint || 0, Nick: summary["Capital One"]?.N || 0, Madeline: summary["Capital One"]?.M || 0 },
            ]} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#13151c", border: "1px solid #2a2d36", borderRadius: 8, fontFamily: "DM Mono, monospace", fontSize: 12 }} />
              <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#888" }}>{v}</span>} />
              <Bar dataKey="Joint" fill={COLORS.Joint} radius={[4,4,0,0]} />
              <Bar dataKey="Nick" fill={COLORS.N} radius={[4,4,0,0]} />
              <Bar dataKey="Madeline" fill={COLORS.M} radius={[4,4,0,0]} />
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
            <Bar dataKey="Joint" fill={COLORS.Joint} stackId="a" />
            <Bar dataKey="N" name="Nick" fill={COLORS.N} stackId="a" />
            <Bar dataKey="M" name="Madeline" fill={COLORS.M} stackId="a" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
