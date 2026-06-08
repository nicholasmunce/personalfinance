import React, { useState } from 'react';
import Summary from './Summary.jsx';
import Charts from './Charts.jsx';
import GroceryVsDining from './GroceryVsDining.jsx';
import HistoryView from './HistoryView.jsx';

const SUB_TABS = [
  ["summary", "Summary"],
  ["charts", "Charts"],
  ["grocery", "Grocery vs Dining"],
  ["history", "History"],
];

export default function AnalyticsView({ transactions, periodMode, statementDates }) {
  const [sub, setSub] = useState("summary");

  if (!transactions.length) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0", color: "#444" }}>
        <div style={{ fontSize: 32, marginBottom: 16, opacity: .3 }}>◎</div>
        <div style={{ fontSize: 14 }}>No transactions in this range.</div>
        <div style={{ fontSize: 12, marginTop: 8, color: "#333" }}>Adjust the date range or import data first.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #1a1c23", marginBottom: 28 }}>
        {SUB_TABS.map(([id, label]) => (
          <button key={id} onClick={() => setSub(id)} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, padding: "8px 16px", color: sub === id ? "#4ade80" : "#555",
            borderBottom: `2px solid ${sub === id ? "#4ade80" : "transparent"}`,
            letterSpacing: ".06em", textTransform: "uppercase", transition: "all .2s"
          }}>{label}</button>
        ))}
      </div>
      {sub === "summary" && <Summary transactions={transactions} periodMode={periodMode} statementDates={statementDates} />}
      {sub === "charts" && <Charts transactions={transactions} periodMode={periodMode} statementDates={statementDates} />}
      {sub === "grocery" && <GroceryVsDining transactions={transactions} />}
      {sub === "history" && <HistoryView transactions={transactions} periodMode={periodMode} statementDates={statementDates} />}
    </div>
  );
}
