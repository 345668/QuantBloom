import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { formatPrice, formatPct } from '../utils/format.js';

export default function TickerBar() {
  const { state, dispatch } = useDashboard();
  const { data: quotes } = usePolling('/api/v1/ticker?limit=120', 30000);

  const items = Array.isArray(quotes) ? quotes : [];

  // The track is rendered twice so the marquee can loop seamlessly: when the
  // first copy has fully scrolled past, the second is in exactly its place.
  const track = items.length ? [...items, ...items] : [];

  return (
    <div className="ticker-bar">
      {items.length === 0 ? (
        <span className="ticker-loading">Loading S&P 500 quotes...</span>
      ) : (
        <div className="ticker-track" style={{ animationDuration: `${items.length * 1.6}s` }}>
          {track.map((q, i) => (
            <button
              key={`${q.symbol}-${i}`}
              className={`ticker-item ${q.symbol === state.activeSymbol ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_SYMBOL', payload: q.symbol })}
              title={q.sector || q.symbol}
            >
              <span className="ticker-symbol">{q.symbol}</span>
              <span className="ticker-price">{formatPrice(q.price)}</span>
              <span className={`ticker-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                {q.changePercent >= 0 ? '▲' : '▼'} {formatPct(q.changePercent)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
