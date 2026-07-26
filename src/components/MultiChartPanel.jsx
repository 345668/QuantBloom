import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { usePolling } from '../hooks/usePolling.js';

const TIMEFRAMES = ['15m', '1h', '1D', '1W', '1M'];
const LAYOUTS = [
  { key: 2, label: '2', cols: 2, cells: 2 },
  { key: 4, label: '4', cols: 2, cells: 4 },
];
const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'NVDA'];

/**
 * A single independent chart cell: its own symbol, timeframe, data and
 * lightweight-charts instance. Deliberately self-contained so several can live
 * in a grid without sharing state — the multi-pane workflow.
 */
function MiniChart({ initialSymbol }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [tf, setTf] = useState('1D');
  const [input, setInput] = useState('');
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const { data } = usePolling(
    `/api/v1/candles?symbol=${symbol}&resolution=${tf}`,
    tf.includes('m') || tf === '1h' ? 15000 : 60000,
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: '#0a0a0a' }, textColor: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 9 },
      grid: { vertLines: { color: '#151515' }, horzLines: { color: '#151515' } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a', timeVisible: tf.includes('m') || tf === '1h' },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addCandlestickSeries({
      upColor: '#00cc44', downColor: '#cc2200', borderUpColor: '#00cc44',
      borderDownColor: '#cc2200', wickUpColor: '#00cc44', wickDownColor: '#cc2200',
    });
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      chart.applyOptions({ width: r.width, height: r.height });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [symbol, tf]);

  useEffect(() => {
    if (data?.candles?.length && seriesRef.current) {
      seriesRef.current.setData(data.candles);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  const submit = () => {
    const s = input.trim().toUpperCase();
    if (s) { setSymbol(s); setInput(''); }
  };

  return (
    <div className="mc-cell">
      <div className="mc-cell-head">
        <input className="mc-symbol-input" placeholder={symbol} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <span className="mc-symbol">{symbol}</span>
        <span className="mc-price">{data?.candles?.length ? data.candles.at(-1).close.toFixed(2) : ''}</span>
        <div className="mc-tfs">
          {TIMEFRAMES.map(t => (
            <button key={t} className={`mc-tf ${tf === t ? 'active' : ''}`} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="mc-chart" ref={containerRef} />
    </div>
  );
}

export default function MultiChartPanel() {
  const [layout, setLayout] = useState(2);
  const spec = LAYOUTS.find(l => l.key === layout);

  return (
    <div className="panel mc-panel">
      <h3 className="panel-title">
        Multi-Chart <span className="panel-badge">{layout} panes</span>
        <span className="mc-layout-btns">
          {LAYOUTS.map(l => (
            <button key={l.key} className={`mc-layout-btn ${layout === l.key ? 'active' : ''}`}
              onClick={() => setLayout(l.key)} title={`${l.label} charts`}>{l.label}▦</button>
          ))}
        </span>
      </h3>
      <div className="mc-grid" style={{ gridTemplateColumns: `repeat(${spec.cols}, 1fr)` }}>
        {Array.from({ length: spec.cells }, (_, i) => (
          // key includes layout so cells remount cleanly when the grid changes.
          <MiniChart key={`${layout}-${i}`} initialSymbol={DEFAULT_SYMBOLS[i % DEFAULT_SYMBOLS.length]} />
        ))}
      </div>
    </div>
  );
}
