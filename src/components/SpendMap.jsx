import React, { useState, useMemo, useEffect, useRef } from 'react';
import { fmt } from '../utils/format.js';

// Leaflet is loaded dynamically to avoid SSR/CSS issues
let L = null;

const CACHE_KEY = "ledger_geocache_v1";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

function norm(desc) {
  return desc.replace(/\s+[\d*#]+$/, "").replace(/\s{2,}/g, " ").trim();
}

// Strip chain-store suffixes to get clean search terms
function cleanForGeo(name) {
  return name
    .replace(/\s+(WHSE|#\d+|STORE|BRANCH|SUITE|\*\w+)$/i, "")
    .replace(/\s+\d+$/, "")
    .trim();
}

async function geocode(name) {
  const q = encodeURIComponent(cleanForGeo(name) + " USA");
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ledger-personal-finance-app/1.0" },
    });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

export default function SpendMap({ transactions }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [leafletReady, setLeafletReady] = useState(false);

  const debits = useMemo(() => transactions.filter(t => t.type !== "payment"), [transactions]);

  // Aggregate by normalized merchant name
  const merchantData = useMemo(() => {
    const map = {};
    for (const t of debits) {
      const key = norm(t.description);
      if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
      map[key].total += t.amount;
      map[key].count++;
    }
    // Top 40 by spend to keep geocoding manageable
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 40);
  }, [debits]);

  // Load Leaflet CSS + module lazily
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    import("leaflet").then(mod => {
      L = mod.default;
      // Fix default marker icon path issue with bundlers
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setLeafletReady(true);
    });
  }, []);

  async function buildMap() {
    if (!leafletReady || !mapRef.current) return;
    setStatus("loading");

    // Destroy previous map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const cache = loadCache();
    const now = Date.now();
    const points = [];

    setProgress({ done: 0, total: merchantData.length });

    for (let i = 0; i < merchantData.length; i++) {
      const m = merchantData[i];
      let coords = null;

      // Check cache
      const cached = cache[m.name];
      if (cached && (now - cached.ts) < CACHE_TTL) {
        coords = cached.coords;
      } else {
        // Rate-limit to 1 req/sec per Nominatim ToS
        if (i > 0) await new Promise(r => setTimeout(r, 1100));
        coords = await geocode(m.name);
        cache[m.name] = { coords, ts: now };
        saveCache(cache);
      }

      if (coords) {
        points.push({ ...m, ...coords });
      }
      setProgress({ done: i + 1, total: merchantData.length });
    }

    if (!points.length) { setStatus("error"); return; }

    // Init map
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const maxSpend = Math.max(...points.map(p => p.total));

    for (const p of points) {
      const radius = 6 + (p.total / maxSpend) * 28;
      const opacity = 0.4 + (p.total / maxSpend) * 0.5;
      const circle = L.circleMarker([p.lat, p.lon], {
        radius,
        fillColor: "#4ade80",
        fillOpacity: opacity,
        color: "#4ade80",
        weight: 1,
        opacity: 0.6,
      }).addTo(map);

      circle.bindPopup(`
        <div style="font-family: monospace; font-size: 12px; min-width: 140px">
          <div style="font-weight: 700; margin-bottom: 4px">${p.name}</div>
          <div style="color: #4ade80">${fmt(p.total)}</div>
          <div style="color: #888; margin-top: 2px">${p.count} transaction${p.count !== 1 ? "s" : ""}</div>
        </div>
      `);
    }

    // Fit bounds to all points
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });

    setStatus("ready");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ background: "#13151c", border: "1px solid #1e2029", borderRadius: 14, padding: "22px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: "#555", letterSpacing: ".08em", textTransform: "uppercase" }}>Spend map</div>
        {status !== "loading" && (
          <button
            onClick={buildMap}
            disabled={!leafletReady}
            style={{
              background: leafletReady ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.03)",
              border: `1px solid ${leafletReady ? "#4ade80" : "#2a2d36"}`,
              color: leafletReady ? "#4ade80" : "#444",
              borderRadius: 6, padding: "5px 14px", fontFamily: "inherit",
              fontSize: 11, cursor: leafletReady ? "pointer" : "default",
              letterSpacing: ".06em",
            }}
          >
            {status === "idle" ? "Generate map" : status === "ready" ? "Refresh" : "Error — retry"}
          </button>
        )}
      </div>

      {status === "idle" && (
        <div style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: .3 }}>🗺</div>
          <div>Geocodes your top 40 merchants and plots them on a map.</div>
          <div style={{ marginTop: 6, color: "#2a2d36" }}>Results are cached — subsequent loads are instant.</div>
        </div>
      )}

      {status === "loading" && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>
            Geocoding merchants… {progress.done}/{progress.total}
          </div>
          <div style={{ background: "#0d0f14", borderRadius: 4, height: 6, overflow: "hidden", maxWidth: 300, margin: "0 auto" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#4ade80", borderRadius: 4, transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>~1 sec per merchant (Nominatim rate limit)</div>
        </div>
      )}

      {status === "error" && (
        <div style={{ color: "#f87171", fontSize: 12, textAlign: "center", padding: "40px 0" }}>
          Could not geocode any merchants. Check your connection and try again.
        </div>
      )}

      {/* Map container — always rendered so ref is stable */}
      <div
        ref={mapRef}
        style={{
          height: 400,
          borderRadius: 10,
          overflow: "hidden",
          display: status === "ready" ? "block" : "none",
          border: "1px solid #1e2029",
        }}
      />

      {status === "ready" && (
        <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>
          Bubble size = total spend · Click any bubble for details · Data via OpenStreetMap Nominatim
        </div>
      )}
    </div>
  );
}
