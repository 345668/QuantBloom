// Pure simulation for the "market field" — a regime-coloured node cloud of the
// tradeable universe with same-sector "capital route" edges. Deterministic
// (seeded) so the layout is stable between polls; the component animates a
// gentle drift on top.

// Small deterministic PRNG so node positions don't jump every render.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable 32-bit hash of a string, for per-symbol seeds.
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Node colour: amber when calm, greener as it rallies, redder as it sells off.
// Returns an [r,g,b] triple.
export function fieldColor(changePercent) {
  const c = changePercent || 0;
  if (c >= 0) {
    const t = Math.min(1, c / 3);            // 0 -> amber, +3% -> green
    return [Math.round(255 - t * 120), Math.round(140 + t * 90), Math.round(20 + t * 40)];
  }
  const t = Math.min(1, -c / 3);             // 0 -> amber, -3% -> red
  return [Math.round(255 - t * 20), Math.round(140 - t * 120), Math.round(20)];
}

export function rgb([r, g, b], a = 1) {
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

// Overall stress of the field: mean absolute drawdown-weighted move, 0..1.
export function fieldRegime(nodes) {
  if (!nodes.length) return { stress: 0, label: 'idle' };
  const downMag = nodes.reduce((s, n) => s + Math.max(0, -n.change), 0) / nodes.length;
  const stress = Math.min(1, downMag / 2);
  const label = stress > 0.66 ? 'stress' : stress > 0.33 ? 'caution' : 'calm';
  return { stress, label };
}

// Build nodes + edges from the heatmap payload { sector: [ {symbol, changePercent} ] }.
// Sectors are placed on a ring; constituents cluster around their sector anchor.
// Node radius scales with |change|. Edges link each node to its sector's centroid
// neighbours (the "capital routes").
export function buildField(sectors, { width = 900, height = 460, maxNodes = 120 } = {}) {
  const entries = Object.entries(sectors || {});
  if (!entries.length) return { nodes: [], edges: [], width, height };

  const cx = width / 2, cy = height / 2;
  const ringR = Math.min(width, height) * 0.34;
  const nodes = [];
  const sectorAnchors = {};

  entries.forEach(([sector, stocks], si) => {
    const ang = (si / entries.length) * Math.PI * 2;
    const ax = cx + Math.cos(ang) * ringR;
    const ay = cy + Math.sin(ang) * ringR;
    sectorAnchors[sector] = { x: ax, y: ay };
    const rnd = mulberry32(hashStr(sector));
    (stocks || []).forEach(stk => {
      const jitter = 0.9;
      const a2 = rnd() * Math.PI * 2;
      const rad = (0.3 + rnd() * 0.7) * ringR * 0.55 * jitter;
      const change = stk.changePercent ?? 0;
      nodes.push({
        symbol: stk.symbol, sector,
        x: ax + Math.cos(a2) * rad,
        y: ay + Math.sin(a2) * rad,
        r: 2.5 + Math.min(9, Math.abs(change) * 2.2),
        change,
        color: fieldColor(change),
        phase: hashStr(stk.symbol) % 1000 / 1000,   // drift phase
      });
    });
  });

  if (nodes.length > maxNodes) {
    nodes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    nodes.length = maxNodes;
  }

  // Edges: connect each node to the two biggest movers in its own sector.
  const bySector = {};
  for (const n of nodes) (bySector[n.sector] ||= []).push(n);
  const edges = [];
  for (const list of Object.values(bySector)) {
    const sorted = [...list].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const hub = sorted[0];
    for (const n of sorted.slice(1)) {
      edges.push({ a: hub.symbol, b: n.symbol, w: Math.min(1, (Math.abs(hub.change) + Math.abs(n.change)) / 6) });
    }
  }

  return { nodes, edges, width, height, sectorAnchors };
}

// The n nodes with the largest absolute move — the ones worth labelling.
export function topMovers(nodes, n = 10) {
  return [...nodes].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, n);
}

// Gentle drift for a node at time t (seconds). Pure — same inputs, same output.
export function driftPos(node, t) {
  const w = 0.4 + node.phase * 0.5;
  return {
    x: node.x + Math.sin(t * w + node.phase * 6.28) * 3,
    y: node.y + Math.cos(t * w * 0.9 + node.phase * 6.28) * 3,
  };
}
