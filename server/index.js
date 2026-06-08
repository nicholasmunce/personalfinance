import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "../finance.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    card TEXT NOT NULL,
    owner TEXT NOT NULL,
    custom_category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
`);

export function makeId(tx) {
  return createHash("sha256")
    .update(`${tx.date}|${tx.description}|${tx.amount}|${tx.card}`)
    .digest("hex")
    .slice(0, 16);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Check which of a list of candidate IDs already exist
app.post("/api/transactions/check-duplicates", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.json({ existing: [] });
  const placeholders = ids.map(() => "?").join(",");
  const existing = db
    .prepare(`SELECT id FROM transactions WHERE id IN (${placeholders})`)
    .all(...ids)
    .map((r) => r.id);
  res.json({ existing });
});

// Commit a batch of transactions (already de-duped by caller)
app.post("/api/transactions/import", (req, res) => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0)
    return res.json({ inserted: 0 });

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions (id, date, description, category, amount, type, card, owner)
    VALUES (@id, @date, @description, @category, @amount, @type, @card, @owner)
  `);

  const importMany = db.transaction((txs) => {
    let inserted = 0;
    for (const tx of txs) {
      const result = insert.run(tx);
      inserted += result.changes;
    }
    return inserted;
  });

  const inserted = importMany(transactions);
  res.json({ inserted });
});

// All transactions with optional filters
app.get("/api/transactions", (req, res) => {
  const { from, to, search, category } = req.query;
  let sql = "SELECT * FROM transactions WHERE 1=1";
  const params = [];

  if (from) { sql += " AND date >= ?"; params.push(from); }
  if (to) { sql += " AND date <= ?"; params.push(to); }
  if (search) { sql += " AND (description LIKE ? OR category LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  if (category) { sql += " AND (custom_category = ? OR (custom_category IS NULL AND category = ?))"; params.push(category, category); }
  sql += " ORDER BY date DESC";

  res.json(db.prepare(sql).all(...params));
});

// Monthly aggregates
app.get("/api/analytics/monthly", (req, res) => {
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', date) AS month,
      COALESCE(custom_category, category) AS cat,
      SUM(amount) AS total
    FROM transactions
    WHERE type = 'debit'
    GROUP BY month, cat
    ORDER BY month ASC
  `).all();
  res.json(rows);
});

// YTD summary
app.get("/api/analytics/ytd", (req, res) => {
  const year = new Date().getFullYear().toString();
  const rows = db.prepare(`
    SELECT
      COALESCE(custom_category, category) AS cat,
      SUM(amount) AS total
    FROM transactions
    WHERE type = 'debit' AND strftime('%Y', date) = ?
    GROUP BY cat
    ORDER BY total DESC
  `).all(year);
  res.json(rows);
});

// Update custom category
app.patch("/api/transactions/:id", (req, res) => {
  const { custom_category } = req.body;
  db.prepare("UPDATE transactions SET custom_category = ? WHERE id = ?")
    .run(custom_category, req.params.id);
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Finance API running on :${PORT}`));
