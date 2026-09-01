import { useState, useRef } from 'react';
import usePolling from '../hooks/usePolling.js';
import { dealerQuote, splitBigFig, tickDir } from '../lib/fxquote.js';

// Bloomberg FXGO-style dealer grid: bid/ask tiles that flash on tick.
export default function FxGridPanel() {
  const [tab, setTab] = useState('majors');
  const { data, loading } = usePolling('/api/v1/forex', 15000);
  const prevMids = useRef({}); // pair -> last mid, for tick direction

  const rows = tab === 'majors' ? (data?.forex || []) : (data?.emerging || []);

  return (
    <div className="panel">
      <h3 className="panel-title">FX Dealer Grid <span className="panel-code">FXGO</span></h3>
      <div className="panel-tabs">
        <button className={`tab-btn ${tab === 'majors' ? 'active' : ''}`} onClick={() => setTab('majors')}>Majors</button>
        <button className={`tab-btn ${tab === 'emerging' ? 'active' : ''}`} onClick={() => setTab('emerging')}>Emerging</button>
      </div>
      {loading && !data ? <p className="panel-empty">Loading...</p> : !rows.length ? <p className="panel-empty">No data</p> : (
        <div className="fxgrid">
          {rows.map(r => {
            const pair = r.name;
            const q = dealerQuote(pair, r.price);
            if (!q) return null;
            const dir = tickDir(prevMids.current[pair], q.mid);
            prevMids.current[pair] = q.mid;
            const [bidBig, bidPip] = splitBigFig(q.bid, q.digits);
            const [askBig, askPip] = splitBigFig(q.ask, q.digits);
            const up = r.changePercent >= 0;
            return (
              <div key={pair} className={`fx-tile tick-${dir === 1 ? 'up' : dir === -1 ? 'down' : 'flat'}`}>
                <div className="fx-tile-head">
                  <span className="fx-pair">{pair}</span>
                  <span className={`fx-chg ${up ? 'positive' : 'negative'}`}>
                    {up ? '▲' : '▼'} {Math.abs(r.changePercent ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="fx-quotes">
                  <div className="fx-side fx-bid">
                    <span className="fx-side-label">BID</span>
                    <span className="fx-px">{bidBig}<span className="fx-pip">{bidPip}</span></span>
                  </div>
                  <div className="fx-side fx-ask">
                    <span className="fx-side-label">ASK</span>
                    <span className="fx-px">{askBig}<span className="fx-pip">{askPip}</span></span>
                  </div>
                </div>
                <div className="fx-tile-foot">spread {q.spread} pip{q.spread === 1 ? '' : 's'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
