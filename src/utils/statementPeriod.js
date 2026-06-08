// closeDates: sorted array of YYYY-MM-DD close date strings for a card
// Returns { start, end, label, sortKey } for the period containing dateStr,
// or null if dateStr is outside all known periods.
export function getPeriodForDate(dateStr, closeDates) {
  if (!closeDates || closeDates.length === 0) return null;
  const sorted = [...closeDates].sort();

  // A transaction on close_date itself belongs to the period that closes on that date.
  // Period i: (sorted[i-1], sorted[i]] — exclusive start, inclusive end.
  // Before the first close date: no period.
  // After the last close date: open/current period.

  for (let i = 0; i < sorted.length; i++) {
    if (dateStr <= sorted[i]) {
      // Falls in period that closes on sorted[i]
      const start = i === 0 ? null : nextDay(sorted[i - 1]);
      const end = sorted[i];
      return makePeriod(start, end);
    }
  }

  // After last close date — open current period
  const start = nextDay(sorted[sorted.length - 1]);
  return makePeriod(start, null);
}

// Build a display-ready period object
function makePeriod(start, end) {
  const label = end
    ? formatPeriod(start, end)
    : `${start ? fmtDate(start) : "?"} – now`;

  // Sort key: use end date (or far-future sentinel for open period)
  const sortKey = end || "9999-99-99";

  return { start, end, label, sortKey };
}

// Given a list of { card, close_date } rows and statementDates map,
// group transactions into period buckets.
// statementDates: { "Chase Sapphire": ["2025-01-24", ...], "Capital One": [...] }
export function groupByStatementPeriod(transactions, statementDates) {
  const map = new Map();
  for (const tx of transactions) {
    const dates = statementDates[tx.card] || [];
    const period = getPeriodForDate(tx.date, dates);
    if (!period) continue;
    if (!map.has(period.sortKey)) map.set(period.sortKey, { ...period, transactions: [] });
    map.get(period.sortKey).transactions.push(tx);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export function formatPeriod(start, end) {
  if (!start && !end) return "Unknown period";
  const fmt = (s) => {
    if (!s) return "?";
    const d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const startYear = start ? new Date(start + "T12:00:00").getFullYear() : null;
  const endYear = end ? new Date(end + "T12:00:00").getFullYear() : null;
  if (startYear && endYear && startYear !== endYear) {
    return `${fmt(start)} '${String(startYear).slice(2)} – ${fmt(end)} '${String(endYear).slice(2)}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtDate(s) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function nextDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
