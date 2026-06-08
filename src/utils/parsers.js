// Deterministic ID so the same transaction never duplicates across imports
async function digestId(tx) {
  const raw = `${tx.date}|${tx.description}|${tx.amount}|${tx.card}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

async function attachIds(rows) {
  return Promise.all(rows.map(async (r) => ({ ...r, id: await digestId(r) })));
}

// Normalize MM/DD/YYYY → YYYY-MM-DD; pass through anything already ISO
function normalizeDate(str) {
  if (!str) return str;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return str;
}

function splitCSV(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { result.push(cur); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

export function parseChase(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const header = lines[0].toLowerCase();
  if (!header.includes("transaction date")) return null;
  return lines.slice(1).map((line) => {
    const cols = splitCSV(line);
    const amount = parseFloat(cols[5]) || 0;
    if (amount === 0) return null;
    const type = amount < 0 ? "debit" : "payment";
    return {
      date: normalizeDate(cols[0]?.trim()),
      description: cols[2]?.trim(),
      category: type === "payment" ? "Payment" : (cols[3]?.trim() || "Uncategorized"),
      amount: Math.abs(amount),
      type,
      card: "Chase Sapphire",
      owner: "C",
    };
  }).filter(Boolean);
}

export function parseCapitalOne(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const headerRaw = splitCSV(lines[0]);
  const header = headerRaw.map(c => c.trim().toLowerCase());

  if (!header.some(c => c.includes("debit") || c.includes("credit"))) return null;

  const idx = {
    date: header.findIndex(c => c.includes("transaction")),
    description: header.findIndex(c => c.includes("description")),
    category: header.findIndex(c => c.includes("category")),
    debit: header.findIndex(c => c.includes("debit")),
    credit: header.findIndex(c => c.includes("credit")),
  };

  if (idx.date === -1) idx.date = 0;
  if (idx.description === -1) idx.description = 3;
  if (idx.category === -1) idx.category = 4;
  if (idx.debit === -1) idx.debit = 5;
  if (idx.credit === -1) idx.credit = 6;

  return lines.slice(1).map((line) => {
    const cols = splitCSV(line);
    const debit = parseFloat((cols[idx.debit] || "").replace(/[$,]/g, "")) || 0;
    const credit = parseFloat((cols[idx.credit] || "").replace(/[$,]/g, "")) || 0;
    if (debit === 0 && credit === 0) return null;
    const type = debit > 0 ? "debit" : "payment";
    const amount = debit > 0 ? debit : credit;
    return {
      date: normalizeDate(cols[idx.date]?.trim()),
      description: cols[idx.description]?.trim(),
      category: type === "payment" ? "Payment" : (cols[idx.category]?.trim() || "Uncategorized"),
      amount,
      type,
      card: "Capital One",
      owner: "C",
    };
  }).filter(Boolean);
}

export async function autoDetectAndParse(text, filename) {
  const lower = filename.toLowerCase();

  let raw = null, card = null;
  if (lower.includes("chase")) {
    raw = parseChase(text); card = "Chase Sapphire";
  } else if (lower.includes("capital") || lower.includes("cap1") || lower.includes("capitalone")) {
    raw = parseCapitalOne(text); card = "Capital One";
  } else {
    const tryChase = parseChase(text) || [];
    const tryCap = parseCapitalOne(text) || [];
    if (tryCap.length >= tryChase.length && tryCap.length > 0) {
      raw = tryCap; card = "Capital One";
    } else if (tryChase.length > 0) {
      raw = tryChase; card = "Chase Sapphire";
    }
  }
  if (!raw) return { parsed: null, card: null };
  const parsed = await attachIds(raw);
  return { parsed, card };
}
