import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

export default function CryptoPanel() {
  const { data, loading } = usePolling('/api/v1/crypto', 30000);

  return (
    <div className="panel">
      <h3 className="panel-title">Crypto <span className="panel-badge">LIVE</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !data?.length ? <p className="panel-empty">No data</p> : (
        <div className="crypto-list">
          {data.map((c, i) => (
            <div key={c.symbol} className="crypto-row">
              <span className="crypto-rank">{i + 1}</span>
              <span className="crypto-symbol">{c.symbol}</span>
              <span className="crypto-name">{c.name}</span>
              <span className="crypto-price">{fmtPrice(c.price)}</span>
              <span className={`crypto-change ${c.changePercent >= 0 ? 'positive' : 'negative'}`}>
                {c.changePercent >= 0 ? '+' : ''}{c.changePercent?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
