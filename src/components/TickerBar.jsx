import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { formatPrice, formatPct } from '../utils/format.js';

export default function TickerBar() {
  const { state, dispatch } = useDashboard();
  const symbolsParam = state.watchlist.join(',');
  const { data: quotes } = usePolling(`/api/v1/quotes?symbols=${symbolsParam}`, 10000);

  const items = Array.isArray(quotes) ? quotes : [];

  return (
    <div className="ticker-bar">
      <div className="ticker-scroll">
        {items.map((q) => (
          <button
            key={q.symbol}
            className={`ticker-item ${q.symbol === state.activeSymbol ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SYMBOL', payload: q.symbol })}
          >
            <span className="ticker-symbol">{q.symbol}</span>
            <span className="ticker-price">{formatPrice(q.price)}</span>
            <span className={`ticker-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
              {formatPct(q.changePercent)}
            </span>
          </button>
        ))}
        {items.length === 0 && (
          <span className="ticker-loading">Loading quotes...</span>
        )}
      </div>
    </div>
  );
}
