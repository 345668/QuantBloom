import { usePolling } from '../hooks/usePolling.js';

function formatVal(v, name) {
  if (v == null) return '—';
  if (name.includes('GDP')) return v.toLocaleString();
  if (name.includes('CPI') || name.includes('PCE')) return v.toFixed(1);
  return v.toFixed(2);
}

function ChangeIndicator({ change, suffix = '' }) {
  if (change == null) return null;
  const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
  return (
    <span className={`fred-change ${cls}`}>
      {change > 0 ? '+' : ''}{change.toFixed(2)}{suffix}
    </span>
  );
}

function RateRow({ id, item }) {
  if (!item) return null;
  return (
    <div className="fred-row">
      <span className="fred-name">{item.name}</span>
      <span className="fred-value">{formatVal(item.value, item.name)}%</span>
      <ChangeIndicator change={item.change} />
    </div>
  );
}

function MarketRow({ id, item }) {
  if (!item) return null;
  const unit = id.includes('OIL') || id === 'GOLDAMGBD228NLBM' ? '$' : '';
  return (
    <div className="fred-row">
      <span className="fred-name">{item.name}</span>
      <span className="fred-value">{unit}{formatVal(item.value, item.name)}</span>
      <ChangeIndicator change={item.change} />
      {item.changePercent != null && (
        <span className={`fred-pct ${item.changePercent >= 0 ? 'up' : 'down'}`}>
          ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

export default function FredPanel() {
  const { data: rates } = usePolling('/api/v1/fred/rates', 300000);
  const { data: market } = usePolling('/api/v1/fred/market', 300000);
  const { data: macro } = usePolling('/api/v1/fred/macro', 600000);

  const hasRates = rates && Object.keys(rates).length > 0;
  const hasMarket = market && Object.keys(market).length > 0;
  const hasMacro = macro && Object.keys(macro).length > 0;

  if (!hasRates && !hasMarket && !hasMacro) {
    return (
      <div className="fred-panel">
        <div className="panel-header-row">
          <span className="panel-label">ECONOMIC DATA</span>
          <span className="fred-source">FRED</span>
        </div>
        <div className="panel-loading">Loading FRED data...</div>
      </div>
    );
  }

  return (
    <div className="fred-panel">
      <div className="panel-header-row">
        <span className="panel-label">ECONOMIC DATA</span>
        <span className="fred-source">FRED</span>
      </div>

      <div className="fred-sections">
        {hasRates && (
          <div className="fred-section">
            <div className="fred-section-title">RATES & YIELD CURVE</div>
            {['DFF', 'DGS2', 'DGS10', 'DGS30', 'T10Y2Y', 'T10YFF'].map(id =>
              rates[id] ? <RateRow key={id} id={id} item={rates[id]} /> : null
            )}
          </div>
        )}

        {hasMarket && (
          <div className="fred-section">
            <div className="fred-section-title">MARKET INDICATORS</div>
            {['VIXCLS', 'DTWEXBGS', 'DCOILWTICO', 'DCOILBRENTEU', 'GOLDAMGBD228NLBM'].map(id =>
              market[id] ? <MarketRow key={id} id={id} item={market[id]} /> : null
            )}
          </div>
        )}

        {hasMacro && (
          <div className="fred-section">
            <div className="fred-section-title">MACRO INDICATORS</div>
            {['FEDFUNDS', 'UNRATE', 'UMCSENT', 'IC4WSA', 'BAMLH0A0HYM2'].map(id => {
              const item = macro[id];
              if (!item) return null;
              return (
                <div className="fred-row" key={id}>
                  <span className="fred-name">{item.name}</span>
                  <span className="fred-value">{formatVal(item.value, item.name)}</span>
                  <ChangeIndicator change={item.change} />
                  <span className="fred-date">{item.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
