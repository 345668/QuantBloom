import { useMemo, useState } from 'react';
import usePolling from '../hooks/usePolling.js';
import { buildRings, returnColor, polarToXY } from '../lib/sunburst.js';

// Bloomberg IMAP-style radial market map: inner ring = sector (avg intraday
// return), outer ring = constituents. Wedge angle = weight, colour = return.
// Sector labels ride the outer edge; hovering a wedge dims the rest.
export default function RegionMapPanel() {
  const { data, loading } = usePolling('/api/v1/heatmap', 60000);
  const [hover, setHover] = useState(null);

  const geom = { cx: 130, cy: 130, r0: 34, r1: 76, r2: 116 };

  const groups = useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .map(([sector, stocks]) => {
        const kids = (stocks || []).filter(s => s.changePercent != null);
        const avg = kids.length ? kids.reduce((s, k) => s + k.changePercent, 0) / kids.length : 0;
        return {
          label: sector,
          weight: kids.length || 1,
          value: avg,
          children: kids.map(k => ({ label: k.symbol, weight: 1, value: k.changePercent })),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const rings = useMemo(() => groups.length ? buildRings(groups, geom) : null, [groups]);

  // Abbreviate sector names for the ring labels.
  const abbr = s => ({
    'Information Technology': 'TECH', 'Health Care': 'HLTH', 'Financials': 'FINL',
    'Consumer Discretionary': 'DISC', 'Communication Services': 'COMM',
    'Consumer Staples': 'STPL', 'Industrials': 'INDU', 'Energy': 'ENGY',
    'Utilities': 'UTIL', 'Real Estate': 'REIT', 'Materials': 'MATL',
  }[s] || s.slice(0, 4).toUpperCase());

  const dimmed = key => hover && hover.key && hover.key !== key && !key.startsWith(hover.sectorKey || '\0');

  return (
    <div className="panel">
      <h3 className="panel-title">Intraday Return by Sector <span className="panel-code">IMAP</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !rings ? <p className="panel-empty">No data</p> : (
        <div className="imap-wrap">
          <svg viewBox="0 0 260 260" className="imap-svg" onMouseLeave={() => setHover(null)}>
            {/* tick ring */}
            <circle cx={geom.cx} cy={geom.cy} r={geom.r2 + 5} className="imap-tickring" />
            {Array.from({ length: 24 }, (_, i) => {
              const a = (i / 24) * 360;
              const p1 = polarToXY(geom.cx, geom.cy, geom.r2 + 4, a);
              const p2 = polarToXY(geom.cx, geom.cy, geom.r2 + (i % 6 === 0 ? 9 : 6), a);
              return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="imap-tick" />;
            })}

            {rings.outer.map(w => (
              <path key={w.key} d={w.path} fill={w.color} stroke="var(--bg-panel)" strokeWidth="0.4"
                className={dimmed(w.key) ? 'imap-dim' : ''}
                onMouseEnter={() => setHover({ key: w.key, sectorKey: w.key.split('/')[0], label: w.label, value: w.value, kind: 'stock' })} />
            ))}
            {rings.inner.map(w => (
              <path key={w.key} d={w.path} fill={w.color} stroke="var(--bg-panel)" strokeWidth="0.8"
                className={dimmed(w.key) ? 'imap-dim' : ''}
                onMouseEnter={() => setHover({ key: w.key, sectorKey: w.key, label: w.label, value: w.value, kind: 'sector' })} />
            ))}

            {/* sector labels on wedges wide enough to fit */}
            {rings.inner.filter(w => w.end - w.start > 14).map(w => {
              const p = polarToXY(geom.cx, geom.cy, (geom.r1 + geom.r2) / 2 + 8, w.mid);
              return (
                <text key={w.key} x={p.x} y={p.y} className="imap-sector-label" textAnchor="middle" dominantBaseline="middle"
                  transform={w.mid > 180 ? `rotate(${w.mid - 270} ${p.x} ${p.y})` : `rotate(${w.mid - 90} ${p.x} ${p.y})`}>
                  {abbr(w.label)}
                </text>
              );
            })}

            <circle cx={geom.cx} cy={geom.cy} r={geom.r0 - 2} fill="var(--bg-panel)" />
            {hover ? (
              <>
                <text x={geom.cx} y={geom.cy - 6} textAnchor="middle" className="imap-center-label">{hover.label}</text>
                <text x={geom.cx} y={geom.cy + 11} textAnchor="middle"
                  fill={returnColor(hover.value)} className="imap-center-val">
                  {hover.value >= 0 ? '+' : ''}{hover.value.toFixed(2)}%
                </text>
                <text x={geom.cx} y={geom.cy + 22} textAnchor="middle" className="imap-center-kind">{hover.kind}</text>
              </>
            ) : (
              <text x={geom.cx} y={geom.cy + 4} textAnchor="middle" className="imap-center-hint">S&P 500</text>
            )}
          </svg>
          <div className="imap-legend">
            <span className="imap-swatch" style={{ background: returnColor(-3) }} />−3%
            <span className="imap-swatch" style={{ background: returnColor(0) }} />0
            <span className="imap-swatch" style={{ background: returnColor(3) }} />+3%
          </div>
        </div>
      )}
    </div>
  );
}
