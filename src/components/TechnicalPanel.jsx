import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

export default function TechnicalPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const { data, loading } = usePolling(`/api/v1/technical?symbol=${symbol}`, 60000);

  const ta = data?.technicalAnalysis || {};
  const trend = data?.trend || {};

  const signal = ta.signal || trend.adx?.signal || 'neutral';
  const signalClass = signal === 'buy' ? 'positive' : signal === 'sell' ? 'negative' : '';

  const indicators = [
    { name: 'RSI (14)', value: ta.rsi?.value, signal: ta.rsi?.signal },
    { name: 'MACD', value: ta.macd?.value, signal: ta.macd?.signal },
    { name: 'Stochastic', value: ta.stoch?.value, signal: ta.stoch?.signal },
    { name: 'CCI (20)', value: ta.cci?.value, signal: ta.cci?.signal },
    { name: 'ADX', value: trend.adx?.value, signal: trend.adx?.signal },
    { name: 'Williams %R', value: ta.willr?.value, signal: ta.willr?.signal },
  ].filter(ind => ind.value != null);

  return (
    <div className="panel">
      <h3 className="panel-title">Technical Analysis <span className="panel-badge">{symbol}</span></h3>
      {loading && !data ? <p className="panel-empty">Loading...</p> : (
        <>
          <div className="ta-signal-box">
            <span className="ta-signal-label">Overall Signal</span>
            <span className={`ta-signal-value ${signalClass}`}>{signal.toUpperCase()}</span>
          </div>
          {data?.support && (
            <div className="ta-levels">
              <div className="ta-level"><span>Support</span><span className="negative">{fmtPrice(data.support)}</span></div>
              <div className="ta-level"><span>Resistance</span><span className="positive">{fmtPrice(data.resistance)}</span></div>
            </div>
          )}
          {indicators.length > 0 && (
            <div className="ta-indicators">
              {indicators.map(ind => (
                <div key={ind.name} className="ta-indicator-row">
                  <span className="ta-ind-name">{ind.name}</span>
                  <span className="ta-ind-value">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}</span>
                  <span className={`ta-ind-signal ${ind.signal === 'buy' ? 'positive' : ind.signal === 'sell' ? 'negative' : ''}`}>
                    {(ind.signal || 'neutral').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
