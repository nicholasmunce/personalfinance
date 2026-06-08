import React from 'react';

export default function Upload({ onFile, dragOver, setDragOver }) {
  const handleDrop = (e) => {
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
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 24, lineHeight: 1.7 }}>
        Drop a Chase Sapphire or Capital One CSV to import new transactions.
        Duplicates are detected automatically before committing.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {["Chase Sapphire", "Capital One"].map((card) => (
          <div key={card}>
            <div style={{ fontSize: 12, color: "#555", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{card}</div>
            <div
              className={`drop-zone${dragOver === card ? " over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(card); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={handleDrop}
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
          </div>
        ))}
      </div>
    </div>
  );
}
