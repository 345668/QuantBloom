import usePolling from '../hooks/usePolling.js';

export default function EarningsPanel() {
  const { data, loading } = usePolling('/api/v1/earnings', 120000);

  const grouped = {};
  if (data) {
    for (const e of data) {
      const d = e.date || 'Unknown';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(e);
    }
  }

  const dates = Object.keys(grouped).sort();

  return (
    <div className="panel">
      <h3 className="panel-title">Earnings Calendar <span className="panel-badge">{data?.length || 0} upcoming</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !dates.length ? <p className="panel-empty">No upcoming earnings</p> : (
        <div className="earnings-list">
          {dates.slice(0, 5).map(date => (
            <div key={date} className="earnings-date-group">
              <div className="earnings-date-header">{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              {grouped[date].slice(0, 8).map((e, i) => (
                <div key={i} className="earnings-row">
                  <span className="earnings-symbol">{e.symbol}</span>
                  <span className="earnings-time">{e.hour === 'bmo' ? 'Pre' : e.hour === 'amc' ? 'Post' : e.hour || '—'}</span>
                  <span className="earnings-est">Est: {e.epsEstimate != null ? e.epsEstimate.toFixed(2) : '—'}</span>
                  {e.epsActual != null && (
                    <span className={`earnings-actual ${e.epsActual >= (e.epsEstimate || 0) ? 'positive' : 'negative'}`}>
                      Act: {e.epsActual.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
