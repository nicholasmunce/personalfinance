import React from 'react';

export default function Upload({ transactions, onFile, dragOver, setDragOver }) {
  const handleDrop = (e, card) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleInput = (e) => {
    onFile(e.target.files[0]);
    e.target.value = "";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {["Chase Sapphire", "Capital One"].map((card) => (
        <div key={card}>
          <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{card}</div>
          <div
            className={`drop-zone${dragOver === card ? " over" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOver(card); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, card)}
          >
            <input type="file" accept=".csv" onChange={handleInput} />
            <div style={{ fontSize: 28, marginBottom: 12, opacity: .4 }}>⬆</div>
            <div style={{ fontSize: 13, color: "#888" }}>Drop CSV or click to browse</div>
            <div style={{ fontSize: 11, color: "#444", marginTop: 6 }}>
              {card === "Chase Sapphire"
                ? "Transaction Date, Post Date, Description, Category, Type, Amount, Memo"
                : "Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit"}
            </div>
          </div>
          {transactions.filter(t => t.card === card).length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#4ade80" }}>
              ✓ {transactions.filter(t => t.card === card).length} transactions loaded
            </div>
          )}
        </div>
      ))}
      <div style={{ gridColumn: "1/-1" }}>
        <div className="card-block" style={{ opacity: .7 }}>
          <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>How it works</div>
          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
            1. Upload both CSVs above — they'll be normalized into a unified staging table.<br/>
            2. In Staging, each transaction defaults to <span className="pill pill-c">Checking</span>. Tag personal ones as <span className="pill pill-n">Nick</span> or <span className="pill pill-m">Madeline</span>, or <span className="pill pill-x">Non-Checking</span> for other sources.<br/>
            3. Summary shows totals per card and combined — Checking paid from joint checking, personal from individual accounts.<br/>
            4. Charts break down spending by category.
          </div>
        </div>
      </div>
    </div>
  );
}
