import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePortfolio, useBrokerPortfolio } from '../hooks/usePortfolio.js';

const money = (v) => v == null ? '—'
  : (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const sign = (v) => v == null ? '' : v >= 0 ? 'positive' : 'negative';

function Stat({ label, value, sub, cls }) {
  return (
    <div className="pf-stat">
      <span className="pf-stat-label">{label}</span>
      <span className={`pf-stat-value ${cls || ''}`}>{value}</span>
      {sub && <span className={`pf-stat-sub ${cls || ''}`}>{sub}</span>}
    </div>
  );
}

export default function PortfolioPanel() {
  const { dispatch } = useDashboard();
  const { addLot, removeLot, lots, positions: manualPositions, totals: manualTotals } = usePortfolio();
  const bot = useBrokerPortfolio();
  const [source, setSource] = useState('manual');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: '', side: 'BUY', quantity: '', price: '', date: '' });
  const [error, setError] = useState('');

  const submit = () => {
    if (!form.symbol.trim()) return setError('Symbol required');
    const qty = Number(form.quantity), px = Number(form.price);
    if (!qty || qty <= 0) return setError('Quantity must be greater than 0');
    if (!px || px <= 0) return setError('Price must be greater than 0');

    if (form.side === 'SELL') {
      // Always validate against the manual book — that is what addLot writes
      // to, regardless of which source the table is currently displaying.
      const held = manualPositions.find(p => p.symbol === form.symbol.toUpperCase())?.quantity || 0;
      if (qty > held) return setError(`Only ${held} share(s) of ${form.symbol.toUpperCase()} held`);
    }

    addLot(form);
    setForm({ symbol: '', side: 'BUY', quantity: '', price: '', date: '' });
    setError('');
    setShowForm(false);
  };

  // Combined view sums both books but keeps each position's own weighting
  // basis, so a symbol held in both accounts appears once per account.
  const combinedValue = manualTotals.marketValue + bot.totals.marketValue;
  const combined = [
    ...manualPositions.map(p => ({ ...p, source: 'manual' })),
    ...bot.positions,
  ].map(p => ({ ...p, weight: combinedValue ? (p.marketValue / combinedValue) * 100 : null }));

  const positions = source === 'manual' ? manualPositions
    : source === 'bot' ? bot.positions : combined;

  const totals = source === 'manual' ? manualTotals
    : source === 'bot' ? bot.totals
    : {
        marketValue: combinedValue,
        costBasis: manualTotals.costBasis + bot.totals.costBasis,
        unrealisedPnl: manualTotals.unrealisedPnl + bot.totals.unrealisedPnl,
        unrealisedPct: (manualTotals.costBasis + bot.totals.costBasis)
          ? ((manualTotals.unrealisedPnl + bot.totals.unrealisedPnl) / (manualTotals.costBasis + bot.totals.costBasis)) * 100 : 0,
        dayPnl: (manualTotals.dayPnl || 0) + (bot.totals.dayPnl || 0),
        realisedPnl: manualTotals.realisedPnl,
        positionCount: combined.length,
      };

  const readOnly = source === 'bot';

  return (
    <div className="panel pf-panel">
      <h3 className="panel-title">
        Portfolio {totals.positionCount > 0 && <span className="panel-badge">{totals.positionCount} positions</span>}
        {!readOnly && (
          <button className="pf-add-btn" onClick={() => { setShowForm(!showForm); setError(''); }}>
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        )}
      </h3>

      <div className="panel-tabs">
        <button className={`tab-btn ${source === 'manual' ? 'active' : ''}`} onClick={() => setSource('manual')}>
          Manual
        </button>
        <button className={`tab-btn ${source === 'bot' ? 'active' : ''}`} onClick={() => setSource('bot')}
          title={bot.connected ? 'Positions held in the Alpaca paper account' : 'Broker not connected'}>
          Bot{bot.connected && bot.totals.positionCount ? ` (${bot.totals.positionCount})` : ''}
        </button>
        <button className={`tab-btn ${source === 'combined' ? 'active' : ''}`} onClick={() => setSource('combined')}>
          Combined
        </button>
      </div>

      {source === 'bot' && (
        <div className="pf-source-note">
          {!bot.connected ? 'Broker not connected.'
            : <>Alpaca {bot.isPaper ? 'paper' : 'LIVE'} account · equity {money(bot.totals.equity)} · cash {money(bot.totals.cash)}
               {bot.botEnabled ? <span className="positive"> · bot armed</span> : <span className="text-dim"> · bot off</span>}</>}
        </div>
      )}

      {showForm && (
        <div className="pf-form">
          <div className="pf-form-row">
            <input className="pf-input" placeholder="Symbol" value={form.symbol}
              onChange={e => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
            <select className="pf-select" value={form.side} onChange={e => setForm({ ...form, side: e.target.value })}>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>
          <div className="pf-form-row">
            <input className="pf-input" type="number" placeholder="Qty" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <input className="pf-input" type="number" placeholder="Price" value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })} />
            <input className="pf-input" type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          {error && <div className="pf-error">{error}</div>}
          <button className="pf-submit" onClick={submit}>Record {form.side}</button>
        </div>
      )}

      {totals.positionCount === 0 ? (
        <p className="panel-empty">
          {source === 'bot'
            ? (bot.connected ? 'No positions in the bot account' : 'Broker not connected')
            : 'No open positions — add a trade to track P&L'}
        </p>
      ) : (
        <>
          <div className="pf-stats">
            <Stat label="Market Value" value={money(totals.marketValue)} />
            <Stat label="Day P&L" value={money(totals.dayPnl)}
              sub={source === 'bot' && totals.dayPnlPercent != null ? pct(totals.dayPnlPercent) : undefined}
              cls={sign(totals.dayPnl)} />
            <Stat label="Unrealised" value={money(totals.unrealisedPnl)} sub={pct(totals.unrealisedPct)} cls={sign(totals.unrealisedPnl)} />
            {source === 'bot'
              ? <Stat label="Account equity" value={money(totals.equity)} />
              : <Stat label="Realised" value={money(totals.realisedPnl)} cls={sign(totals.realisedPnl)} />}
          </div>

          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th>
                  <th>Mkt Val</th><th>Unreal P&L</th><th>Wgt</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  // Key by source too: the same symbol can be held in both books.
                  <tr key={`${p.source || 'manual'}-${p.symbol}`}
                      onClick={() => dispatch({ type: 'SET_SYMBOL', payload: p.symbol })}>
                    <td className="pf-symbol">
                      {p.symbol}
                      {source === 'combined' && (
                        <span className={`pf-src-tag ${p.source === 'broker' ? 'bot' : ''}`}>
                          {p.source === 'broker' ? 'BOT' : 'MAN'}
                        </span>
                      )}
                    </td>
                    <td>{p.quantity}</td>
                    <td>{money(p.avgPrice)}</td>
                    <td className={sign(p.dayChangePercent)}>{money(p.price)}</td>
                    <td>{money(p.marketValue)}</td>
                    <td className={sign(p.unrealisedPnl)}>
                      {money(p.unrealisedPnl)}
                      <span className="pf-pct"> {pct(p.unrealisedPct)}</span>
                    </td>
                    <td>{p.weight != null ? `${p.weight.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!readOnly && lots.length > 0 && (
        <details className="pf-lots">
          <summary>Trade history ({lots.length})</summary>
          {[...lots].reverse().map(l => (
            <div key={l.id} className="pf-lot-row">
              <span className={l.side === 'BUY' ? 'positive' : 'negative'}>{l.side}</span>
              <span className="pf-lot-sym">{l.symbol}</span>
              <span>{l.quantity} @ {money(l.price)}</span>
              <span className="pf-lot-date">{l.date}</span>
              <button className="pf-lot-del" onClick={() => removeLot(l.id)} title="Delete trade">×</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
