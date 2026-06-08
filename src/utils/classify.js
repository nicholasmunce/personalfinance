export const GROCERY_MERCHANTS = ["aldi", "mariano", "trader joe", "costco", "edgewater produce", "whole foods", "la colombe"];
export const DINING_KEYWORDS = ["dining", "restaurant", "cafe", "coffee", "bar ", "grill", "pizza", "sushi", "taco", "burger", "kitchen", "eatery", "bistro", "tavern", "pub", "diner", "bbq", "steakhouse", "brewery", "wok", "noodle", "ramen", "brasserie"];

export function classifyTxn(t) {
  const desc = (t.description || "").toLowerCase();
  const cat = (t.category || "").toLowerCase();
  if (GROCERY_MERCHANTS.some(m => desc.includes(m))) return "grocery";
  if (cat.includes("grocer") || cat.includes("supermarket")) return "grocery";
  if (cat.includes("dining") || cat.includes("restaurant") || cat.includes("food & drink")) return "dining";
  if (DINING_KEYWORDS.some(k => desc.includes(k))) return "dining";
  return null;
}

export function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-W${String(Math.ceil((mon.getDate()) / 7)).padStart(2,"0")} (${(mon.getMonth()+1)}/${mon.getDate()})`;
}

export function getMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

export function getQuarterKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()} Q${q}`;
}
