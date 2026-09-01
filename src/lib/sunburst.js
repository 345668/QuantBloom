// Pure geometry + colour helpers for the IMAP-style radial market map.

// Point on a circle. Angles in degrees, 0 = 12 o'clock, clockwise positive.
export function polarToXY(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// SVG path for an annular sector (a ring wedge) between two radii and angles.
export function arcPath(cx, cy, rInner, rOuter, startDeg, endDeg) {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const o0 = polarToXY(cx, cy, rOuter, startDeg);
  const o1 = polarToXY(cx, cy, rOuter, endDeg);
  const i1 = polarToXY(cx, cy, rInner, endDeg);
  const i0 = polarToXY(cx, cy, rInner, startDeg);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

// Map an intraday return (%) to a red↔grey↔green colour, saturating at ±cap%.
export function returnColor(pct, cap = 3) {
  const t = Math.max(-1, Math.min(1, (pct || 0) / cap));
  if (t >= 0) {
    // grey -> green
    const g = Math.round(90 + t * 120);
    const r = Math.round(90 - t * 60);
    return `rgb(${r},${g},${Math.round(60 - t * 30)})`;
  }
  // grey -> red
  const a = -t;
  const r = Math.round(90 + a * 130);
  const g = Math.round(90 - a * 70);
  return `rgb(${r},${g},${Math.round(60 - a * 40)})`;
}

// Build ring wedges from grouped data.
// groups: [{ label, weight, value, children:[{label, weight, value}] }]
// Returns { inner:[{...wedge}], outer:[{...wedge}] } with start/end degrees and
// colour, laid out proportionally to weight around the full circle.
export function buildRings(groups, { cx, cy, r0, r1, r2 }) {
  const total = groups.reduce((s, g) => s + Math.max(0, g.weight), 0) || 1;
  const inner = [];
  const outer = [];
  let angle = 0;
  for (const g of groups) {
    const span = (Math.max(0, g.weight) / total) * 360;
    const gStart = angle;
    const gEnd = angle + span;
    inner.push({
      key: g.label, label: g.label, value: g.value,
      start: gStart, end: gEnd,
      path: arcPath(cx, cy, r0, r1, gStart, gEnd),
      color: returnColor(g.value),
      mid: (gStart + gEnd) / 2,
    });
    const kids = g.children || [];
    const kTotal = kids.reduce((s, k) => s + Math.max(0, k.weight), 0) || 1;
    let ka = gStart;
    for (const k of kids) {
      const kSpan = (Math.max(0, k.weight) / kTotal) * span;
      outer.push({
        key: `${g.label}/${k.label}`, label: k.label, value: k.value,
        start: ka, end: ka + kSpan,
        path: arcPath(cx, cy, r1, r2, ka, ka + kSpan),
        color: returnColor(k.value),
        mid: ka + kSpan / 2,
      });
      ka += kSpan;
    }
    angle = gEnd;
  }
  return { inner, outer };
}
