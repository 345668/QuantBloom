// QuantBloom logo. The mark is a radial "bloom" of market bars — the same
// language as the Mission-Control market field — growing from a core, in the
// terminal's amber→red palette. `variant`:
//   'mark' → icon only
//   'full' → icon + wordmark (default)
//   'wordmark' → text only
export default function Logo({ variant = 'full', size = 28, className = '' }) {
  const showMark = variant === 'mark' || variant === 'full';
  const showText = variant === 'wordmark' || variant === 'full';

  return (
    <span className={`qb-logo ${className}`} style={{ '--qb-logo-size': `${size}px` }}>
      {showMark && <LogoMark size={size} />}
      {showText && (
        <span className="qb-wordmark" aria-label="QuantBloom">
          <span className="qb-quant">QUANT</span><span className="qb-bloom">BLOOM</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }) {
  // 12 petals radiating from a core, heights varying like a bar bloom.
  const heights = [10, 15, 12, 18, 13, 16, 11, 17, 12, 15, 10, 14];
  const cx = 24, cy = 24, coreR = 3.4, inner = 5.5, barW = 2.4;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="qb-mark" role="img" aria-label="QuantBloom">
      <defs>
        <linearGradient id="qb-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd166" />
          <stop offset="55%" stopColor="#ff8c00" />
          <stop offset="100%" stopColor="#e23c1e" />
        </linearGradient>
        <radialGradient id="qb-core" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="100%" stopColor="#ff8c00" />
        </radialGradient>
      </defs>
      {/* faint orbit ring, echoing the market-field grid */}
      <circle cx={cx} cy={cy} r="21" fill="none" stroke="url(#qb-grad)" strokeOpacity="0.18" strokeWidth="1" />
      <g>
        {heights.map((h, i) => {
          const ang = (i / heights.length) * 360;
          return (
            <rect
              key={i}
              x={cx - barW / 2}
              y={cy - inner - h}
              width={barW}
              height={h}
              rx={barW / 2}
              fill="url(#qb-grad)"
              transform={`rotate(${ang} ${cx} ${cy})`}
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={coreR} fill="url(#qb-core)" />
    </svg>
  );
}
