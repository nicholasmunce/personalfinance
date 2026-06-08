import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "../finance.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS statement_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card TEXT NOT NULL,
    close_date TEXT NOT NULL,
    UNIQUE(card, close_date)
  );

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

// Migrate any MM/DD/YYYY dates to YYYY-MM-DD
const badDates = db.prepare("SELECT id, date FROM transactions WHERE date LIKE '__/__/____'").all();
if (badDates.length > 0) {
  const fix = db.prepare("UPDATE transactions SET date = ? WHERE id = ?");
  const migrate = db.transaction(() => {
    for (const row of badDates) {
      const [m, d, y] = row.date.split("/");
      fix.run(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`, row.id);
    }
  });
  migrate();
  console.log(`Migrated ${badDates.length} dates to ISO format`);
}

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

// Statement dates
app.get("/api/statement-dates", (req, res) => {
  const rows = db.prepare("SELECT * FROM statement_dates ORDER BY card, close_date ASC").all();
  res.json(rows);
});

app.post("/api/statement-dates", (req, res) => {
  const { card, close_date } = req.body;
  if (!card || !close_date) return res.status(400).json({ error: "card and close_date required" });
  try {
    const result = db.prepare("INSERT OR IGNORE INTO statement_dates (card, close_date) VALUES (?, ?)").run(card, close_date);
    const row = db.prepare("SELECT * FROM statement_dates WHERE card = ? AND close_date = ?").get(card, close_date);
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/statement-dates/:id", (req, res) => {
  db.prepare("DELETE FROM statement_dates WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Available calendar months in the DB
app.get("/api/transactions/months", (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', date) AS month, COUNT(*) AS count
    FROM transactions
    WHERE type = 'debit'
    GROUP BY month
    ORDER BY month DESC
  `).all();
  res.json(rows);
});

// All raw transactions for client-side grouping (history view)
app.get("/api/transactions/all", (req, res) => {
  res.json(db.prepare("SELECT * FROM transactions WHERE type = 'debit' ORDER BY date ASC").all());
});

// Update custom category
app.patch("/api/transactions/:id", (req, res) => {
  const { custom_category, owner } = req.body;
  if (custom_category !== undefined) {
    db.prepare("UPDATE transactions SET custom_category = ? WHERE id = ?").run(custom_category, req.params.id);
  }
  if (owner !== undefined) {
    db.prepare("UPDATE transactions SET owner = ? WHERE id = ?").run(owner, req.params.id);
  }
  res.json({ ok: true });
});

app.delete("/api/transactions/:id", (req, res) => {
  db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Current balance per card: charges since last payment
app.get("/api/balance", (req, res) => {
  const cards = ["Chase Sapphire", "Capital One"];
  const result = {};
  for (const card of cards) {
    const lastPayment = db.prepare(`
      SELECT date, amount FROM transactions
      WHERE card = ? AND type = 'payment'
      ORDER BY date DESC, created_at DESC
      LIMIT 1
    `).get(card);

    if (!lastPayment) {
      const total = db.prepare(`
        SELECT SUM(amount) AS total FROM transactions WHERE card = ? AND type = 'debit'
      `).get(card);
      result[card] = { balance: total?.total || 0, lastPaymentDate: null, lastPaymentAmount: null };
    } else {
      const charges = db.prepare(`
        SELECT SUM(amount) AS total FROM transactions
        WHERE card = ? AND type = 'debit' AND date > ?
      `).get(card, lastPayment.date);
      result[card] = {
        balance: charges?.total || 0,
        lastPaymentDate: lastPayment.date,
        lastPaymentAmount: lastPayment.amount,
      };
    }
  }
  res.json(result);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Finance API running on :${PORT}`));
