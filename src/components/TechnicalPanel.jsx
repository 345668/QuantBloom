import { useDashboard } from '../context/DashboardContext.jsx';
import usePolling from '../hooks/usePolling.js';
import { fmtPrice } from '../utils/format.js';

function SignalPill({ signal }) {
  const cls = signal === 'buy' ? 'positive' : signal === 'sell' ? 'negative' : 'neutral-sig';
  return <span className={`ta-pill ${cls}`}>{signal.toUpperCase()}</span>;
}

function Gauge({ summary }) {
  const total = summary.buy + summary.sell + summary.neutral || 1;
  const buyPct = (summary.buy / total) * 100;
  const sellPct = (summary.sell / total) * 100;
  const neuPct = (summary.neutral / total) * 100;
  const overallClass = summary.overall.includes('BUY') ? 'positive' : summary.overall.includes('SELL') ? 'negative' : 'neutral-sig';
  return (
    <div className="ta-gauge">
      <div className="ta-gauge-head">
        <span className="ta-gauge-label">Summary</span>
        <span className={`ta-gauge-verdict ${overallClass}`}>{summary.overall}</span>
      </div>
      <div className="ta-gauge-bar">
        <div className="gseg positive" style={{ width: `${buyPct}%` }} />
        <div className="gseg neutral-bg" style={{ width: `${neuPct}%` }} />
        <div className="gseg negative" style={{ width: `${sellPct}%` }} />
      </div>
      <div className="ta-gauge-counts">
        <span className="positive">Buy {summary.buy}</span>
        <span className="neutral-sig">Neutral {summary.neutral}</span>
        <span className="negative">Sell {summary.sell}</span>
      </div>
    </div>
  );
}

export default function TechnicalPanel() {
  const { state } = useDashboard();
  const symbol = state.activeSymbol || 'AAPL';
  const { data, loading } = usePolling(`/api/v1/technical?symbol=${symbol}`, 60000);

  if (loading && !data) return <div className="panel"><h3 className="panel-title">Technical Analysis <span className="panel-badge">{symbol}</span></h3><p className="panel-empty">Loading...</p></div>;
  if (!data || data.available === false) return <div className="panel"><h3 className="panel-title">Technical Analysis <span className="panel-badge">{symbol}</span></h3><p className="panel-empty">{data?.message || 'No data'}</p></div>;

  const o = data.oscillators || {};
  const ma = data.movingAverages || {};

  return (
    <div className="panel ta-panel">
      <h3 className="panel-title">Technical Analysis <span className="panel-badge">{symbol}</span></h3>

      <Gauge summary={data.summary} />

      {/* 52-week range position */}
      {data.range52w && (
        <div className="ta-range">
          <div className="ta-range-labels">
            <span className="negative">{fmtPrice(data.range52w.low)}</span>
            <span className="ta-range-title">52W Range · {data.range52w.position}%</span>
            <span className="positive">{fmtPrice(data.range52w.high)}</span>
          </div>
          <div className="ta-range-track"><div className="ta-range-marker" style={{ left: `${data.range52w.position}%` }} /></div>
        </div>
      )}

      {/* Oscillators */}
      <h4 className="sub-title">Oscillators</h4>
      <div className="ta-osc-grid">
        {o.rsi14 != null && <div className="ta-osc"><span>RSI (14)</span><span className={o.rsi14 > 70 ? 'negative' : o.rsi14 < 30 ? 'positive' : ''}>{o.rsi14}</span></div>}
        {o.stochastic && <div className="ta-osc"><span>Stoch %K</span><span className={o.stochastic.k > 80 ? 'negative' : o.stochastic.k < 20 ? 'positive' : ''}>{o.stochastic.k}</span></div>}
        {o.cci20 != null && <div className="ta-osc"><span>CCI (20)</span><span className={o.cci20 > 100 ? 'negative' : o.cci20 < -100 ? 'positive' : ''}>{o.cci20}</span></div>}
        {o.williamsR != null && <div className="ta-osc"><span>Williams %R</span><span>{o.williamsR}</span></div>}
        {o.macd && <div className="ta-osc"><span>MACD Hist</span><span className={o.macd.histogram > 0 ? 'positive' : 'negative'}>{o.macd.histogram}</span></div>}
        {o.adx && <div className="ta-osc"><span>ADX (14)</span><span>{o.adx.adx}</span></div>}
        {o.atr14 != null && <div className="ta-osc"><span>ATR (14)</span><span>{o.atr14}</span></div>}
        {data.volume?.ratio != null && <div className="ta-osc"><span>Vol Ratio</span><span className={data.volume.ratio > 1.5 ? 'positive' : ''}>{data.volume.ratio}x</span></div>}
      </div>

      {/* Moving averages */}
      <h4 className="sub-title">Moving Averages {ma.cross && <span className={ma.cross.includes('Golden') ? 'positive' : 'negative'}>· {ma.cross}</span>}</h4>
      <div className="ta-ma-grid">
        {['sma20', 'sma50', 'sma100', 'sma200', 'ema12', 'ema26', 'ema50'].map(key => ma[key] != null && (
          <div key={key} className="ta-ma">
            <span className="ta-ma-name">{key.replace('sma', 'SMA ').replace('ema', 'EMA ')}</span>
            <span className={`ta-ma-val ${data.price > ma[key] ? 'positive' : 'negative'}`}>{fmtPrice(ma[key])}</span>
          </div>
        ))}
      </div>

      {/* Bollinger + Pivots */}
      <div className="ta-two-col">
        {data.bollinger && (
          <div>
            <h4 className="sub-title">Bollinger (20,2)</h4>
            <div className="ta-kv"><span>Upper</span><span className="positive">{fmtPrice(data.bollinger.upper)}</span></div>
            <div className="ta-kv"><span>Mid</span><span>{fmtPrice(data.bollinger.middle)}</span></div>
            <div className="ta-kv"><span>Lower</span><span className="negative">{fmtPrice(data.bollinger.lower)}</span></div>
            <div className="ta-kv"><span>Width</span><span>{data.bollinger.bandwidth}%</span></div>
          </div>
        )}
        {data.pivots && (
          <div>
            <h4 className="sub-title">Pivot Points</h4>
            <div className="ta-kv"><span>R2</span><span className="positive">{fmtPrice(data.pivots.r2)}</span></div>
            <div className="ta-kv"><span>R1</span><span className="positive">{fmtPrice(data.pivots.r1)}</span></div>
            <div className="ta-kv"><span>P</span><span className="neutral-sig">{fmtPrice(data.pivots.pivot)}</span></div>
            <div className="ta-kv"><span>S1</span><span className="negative">{fmtPrice(data.pivots.s1)}</span></div>
            <div className="ta-kv"><span>S2</span><span className="negative">{fmtPrice(data.pivots.s2)}</span></div>
          </div>
        )}
      </div>

      {/* Full signal table */}
      <h4 className="sub-title">Indicator Signals</h4>
      <div className="ta-signals">
        {data.signals.map(s => (
          <div key={s.name} className="ta-sig-row">
            <span className="ta-sig-name">{s.name}</span>
            <span className="ta-sig-val">{s.value}</span>
            <SignalPill signal={s.signal} />
          </div>
        ))}
      </div>
    </div>
  );
}
