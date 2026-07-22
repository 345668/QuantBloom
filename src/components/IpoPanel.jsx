import usePolling from '../hooks/usePolling.js';

export default function IpoPanel() {
  const { data, loading } = usePolling('/api/v1/ipo', 120000);

  return (
    <div className="panel">
      <h3 className="panel-title">IPO Calendar <span className="panel-badge">{data?.length || 0} upcoming</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !data?.length ? <p className="panel-empty">No upcoming IPOs</p> : (
        <div className="ipo-list">
          {data.slice(0, 10).map((ipo, i) => (
            <div key={i} className="ipo-row">
              <div className="ipo-main">
                <span className="ipo-name">{ipo.name || ipo.symbol || 'TBA'}</span>
                {ipo.symbol && <span className="ipo-symbol">{ipo.symbol}</span>}
              </div>
              <div className="ipo-details">
                <span className="ipo-date">{ipo.date}</span>
                {ipo.exchange && <span className="ipo-exchange">{ipo.exchange}</span>}
                {ipo.priceRangeLow && ipo.priceRangeHigh && (
                  <span className="ipo-price">${ipo.priceRangeLow}–${ipo.priceRangeHigh}</span>
                )}
                <span className={`ipo-status status-${ipo.status}`}>{ipo.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
