import usePolling from '../hooks/usePolling.js';

export default function IndicesPanel() {
  const { data, loading } = usePolling('/api/v1/indices', 30000);

  return (
    <div className="panel">
      <h3 className="panel-title">Market Indices <span className="panel-badge">LIVE</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !data?.length ? <p className="panel-empty">No data</p> : (
        <div className="indices-list">
          {data.map(idx => (
            <div key={idx.symbol} className="index-row">
              <span className="index-short">{idx.short}</span>
              <span className="index-name">{idx.name}</span>
              <span className="index-price">{idx.price != null ? idx.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</span>
              <span className={`index-change ${idx.changePercent >= 0 ? 'positive' : 'negative'}`}>
                {idx.changePercent != null ? `${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent.toFixed(2)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
