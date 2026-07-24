import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { formatPrice, formatPct, formatVolume } from '../utils/format.js';
import ChartDrawings, { TOOLS } from './ChartDrawings.jsx';
import { CHART_TYPES, transformForType } from '../../charting/chart-types.js';
import { INDICATORS } from '../../charting/indicators.js';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1D', '1W', '1M', '1Y', '5Y'];
const OVERLAYS = ['MA', 'BB', 'RSI', 'MACD'];

function computeMA(candles, period = 20) {
  return candles.reduce((acc, c, i) => {
    if (i < period - 1) return acc;
    const slice = candles.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / period;
    acc.push({ time: c.time, value: avg });
    return acc;
  }, []);
}

function computeBB(candles, period = 20, mult = 2) {
  const upper = [], lower = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / period;
    const variance = slice.reduce((s, x) => s + (x.close - avg) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push({ time: candles[i].time, value: avg + mult * std });
    lower.push({ time: candles[i].time, value: avg - mult * std });
  }
  return { upper, lower };
}

function computeRSI(candles, period = 14) {
  const rsi = [];
  let gainSum = 0, lossSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (i <= period) {
      if (diff > 0) gainSum += diff; else lossSum -= diff;
      if (i === period) {
        const avgGain = gainSum / period;
        const avgLoss = lossSum / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
      }
    } else {
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      gainSum = (gainSum * (period - 1) + gain) / period;
      lossSum = (lossSum * (period - 1) + loss) / period;
      const rs = lossSum === 0 ? 100 : gainSum / lossSum;
      rsi.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
    }
  }
  return rsi;
}

function computeMACD(candles) {
  function ema(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }
  const closes = candles.map(c => c.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macdLine, 9);
  return candles.slice(25).map((c, i) => ({
    time: c.time,
    macd: macdLine[i + 25],
    signal: signal[i + 25],
    histogram: macdLine[i + 25] - signal[i + 25],
  }));
}

export default function ChartPanel() {
  const { state, dispatch } = useDashboard();
  const { activeSymbol, activeTimeframe, activeOverlays } = state;

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [quoteData, setQuoteData] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [chartType, setChartType] = useState('candles');
  // Indicators added via the manager (beyond the legacy MA/BB/RSI/MACD toggles).
  const [extraIndicators, setExtraIndicators] = useState([]);
  const [showIndPicker, setShowIndPicker] = useState(false);

  const addIndicator = (key) => {
    setExtraIndicators(list => [...list, { id: `${key}-${Date.now()}`, key }]);
    setShowIndPicker(false);
  };
  const removeIndicator = (id) => setExtraIndicators(list => list.filter(i => i.id !== id));

  const { data: candleData, loading } = usePolling(
    `/api/v1/candles?symbol=${activeSymbol}&resolution=${activeTimeframe}`,
    activeTimeframe.includes('m') || activeTimeframe === '1h' ? 15000 : 60000
  );

  useEffect(() => {
    async function fetchQuote() {
      try {
        const resp = await fetch(`/api/v1/quotes?symbols=${activeSymbol}`);
        const data = await resp.json();
        if (Array.isArray(data) && data[0]) setQuoteData(data[0]);
      } catch {}
    }
    fetchQuote();
    const interval = setInterval(fetchQuote, 10000);
    return () => clearInterval(interval);
  }, [activeSymbol]);

  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/v1/search?q=${searchTerm}`);
        const data = await resp.json();
        setSearchResults(Array.isArray(data) ? data.slice(0, 6) : []);
      } catch { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = {};
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#888',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#FF8C00', width: 1, style: 2 },
        horzLine: { color: '#FF8C00', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
    });
    chartRef.current = chart;

    // Build the base series according to the selected chart type.
    const spec = CHART_TYPES.find(t => t.key === chartType) || CHART_TYPES[0];
    const UP = '#00cc44', DOWN = '#cc2200';
    let baseSeries;
    if (spec.kind === 'line') {
      baseSeries = chart.addLineSeries({ color: '#FF8C00', lineWidth: 2, priceLineVisible: true });
    } else if (spec.kind === 'area') {
      baseSeries = chart.addAreaSeries({ lineColor: '#FF8C00', topColor: 'rgba(255,140,0,0.35)', bottomColor: 'rgba(255,140,0,0.02)', lineWidth: 2 });
    } else if (spec.kind === 'bar') {
      baseSeries = chart.addBarSeries({ upColor: UP, downColor: DOWN });
    } else {
      // candlestick family; hollow = transparent up body with coloured border.
      baseSeries = chart.addCandlestickSeries({
        upColor: spec.hollow ? 'rgba(0,0,0,0)' : UP,
        downColor: DOWN,
        borderUpColor: UP, borderDownColor: DOWN,
        wickUpColor: UP, wickDownColor: DOWN,
      });
    }
    seriesRef.current.candle = baseSeries;
    seriesRef.current.kind = spec.kind;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
  }, [activeSymbol, activeTimeframe, chartType]);

  // Update data
  useEffect(() => {
    if (!candleData?.candles?.length || !seriesRef.current.candle || !chartRef.current) return;

    const candles = candleData.candles;
    // Apply the chart-type transform (Heikin-Ashi / Renko / Line Break) or use
    // the raw candles; line/area want {time,value}, others want OHLC.
    const spec = CHART_TYPES.find(t => t.key === chartType) || CHART_TYPES[0];
    const shaped = transformForType(spec.transform, candles);
    if (spec.kind === 'line' || spec.kind === 'area') {
      seriesRef.current.candle.setData(shaped.map(c => ({ time: c.time, value: c.close })));
    } else {
      seriesRef.current.candle.setData(shaped);
    }

    ['ma', 'bbUpper', 'bbLower'].forEach(key => {
      if (seriesRef.current[key]) {
        try { chartRef.current.removeSeries(seriesRef.current[key]); } catch {}
        seriesRef.current[key] = null;
      }
    });

    if (activeOverlays.includes('MA')) {
      const maData = computeMA(candles);
      const maSeries = chartRef.current.addLineSeries({
        color: '#FFB800',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maSeries.setData(maData);
      seriesRef.current.ma = maSeries;
    }

    if (activeOverlays.includes('BB')) {
      const bb = computeBB(candles);
      const bbUp = chartRef.current.addLineSeries({
        color: 'rgba(110, 160, 255, 0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbUp.setData(bb.upper);
      seriesRef.current.bbUpper = bbUp;

      const bbLow = chartRef.current.addLineSeries({
        color: 'rgba(110, 160, 255, 0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      bbLow.setData(bb.lower);
      seriesRef.current.bbLower = bbLow;
    }

    chartRef.current.timeScale().fitContent();
  }, [candleData, activeOverlays, chartType]);

  // Sync price-pane indicators from the manager as line series.
  useEffect(() => {
    if (!candleData?.candles?.length || !chartRef.current) return;
    const chart = chartRef.current;
    // Remove any previously-drawn manager overlays.
    Object.keys(seriesRef.current).filter(k => k.startsWith('ind_')).forEach(k => {
      try { chart.removeSeries(seriesRef.current[k]); } catch {}
      delete seriesRef.current[k];
    });
    const candles = candleData.candles;
    for (const ind of extraIndicators) {
      const def = INDICATORS[ind.key];
      if (!def || def.pane !== 'price') continue;
      const data = def.fn(candles, def.params);
      if (def.multi) {
        for (const band of def.multi) {
          const s = chart.addLineSeries({ color: def.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          s.setData(data[band] || []);
          seriesRef.current[`ind_${ind.id}_${band}`] = s;
        }
      } else if (def.dots) {
        const s = chart.addLineSeries({ color: def.color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        seriesRef.current[`ind_${ind.id}`] = s;
      } else {
        const s = chart.addLineSeries({ color: def.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        s.setData(data);
        seriesRef.current[`ind_${ind.id}`] = s;
      }
    }
  }, [candleData, extraIndicators, chartType]);

  function selectSymbol(sym) {
    dispatch({ type: 'SET_SYMBOL', payload: sym });
    setSearchTerm('');
    setSearchResults([]);
  }

  function handleSearchKey(e) {
    if (e.key === 'Enter' && searchTerm.trim()) {
      selectSymbol(searchTerm.trim().toUpperCase());
    }
  }

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <div className="chart-title-row">
          <span className="panel-label">CHART</span>
          <span className="chart-symbol-label">{activeSymbol}</span>
          {quoteData && (
            <>
              <span className="chart-price">{formatPrice(quoteData.price)}</span>
              <span className={`chart-change ${quoteData.changePercent >= 0 ? 'up' : 'down'}`}>
                {quoteData.change >= 0 ? '+' : ''}{quoteData.change?.toFixed(2)} ({formatPct(quoteData.changePercent)})
              </span>
              <span className="chart-vol">Vol: {formatVolume(quoteData.volume)}</span>
            </>
          )}
        </div>
        <div className="chart-controls">
          <div className="chart-search-wrap">
            <input
              type="text"
              className="chart-search"
              placeholder="Search symbol..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value.toUpperCase())}
              onKeyDown={handleSearchKey}
            />
            {searchTerm && (
              <button className="chart-go-btn" onClick={() => selectSymbol(searchTerm.trim().toUpperCase())}>
                GO
              </button>
            )}
            <button
              className="chart-watch-btn"
              onClick={() => dispatch({ type: 'ADD_TO_WATCHLIST', payload: activeSymbol })}
              title="Add to watchlist"
            >
              + WATCH
            </button>
            {searchResults.length > 0 && (
              <div className="chart-search-dropdown">
                {searchResults.map(r => (
                  <button key={r.symbol} onClick={() => selectSymbol(r.symbol)}>
                    <span>{r.symbol}</span>
                    <span className="sr-name">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="timeframe-btns">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              className={`tf-btn ${activeTimeframe === tf ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_TIMEFRAME', payload: tf })}
            >
              {tf}
            </button>
          ))}
        </div>
        <select className="charttype-select" value={chartType}
          onChange={e => setChartType(e.target.value)} title="Chart type">
          {CHART_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <div className="overlay-btns">
          {OVERLAYS.map(ol => (
            <button
              key={ol}
              className={`ol-btn ${activeOverlays.includes(ol) ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'TOGGLE_OVERLAY', payload: ol })}
            >
              {ol}
            </button>
          ))}
        </div>
        <div className="indicator-manager">
          <button className="ind-add-btn" onClick={() => setShowIndPicker(v => !v)} title="Add indicator">
            + IND
          </button>
          {showIndPicker && (
            <div className="ind-picker">
              <div className="ind-picker-group">Overlays</div>
              {Object.entries(INDICATORS).filter(([, d]) => d.pane === 'price').map(([key, d]) => (
                <button key={key} className="ind-picker-item" onClick={() => addIndicator(key)}>{d.name}</button>
              ))}
              <div className="ind-picker-group">Oscillators</div>
              {Object.entries(INDICATORS).filter(([, d]) => d.pane === 'sub').map(([key, d]) => (
                <button key={key} className="ind-picker-item" onClick={() => addIndicator(key)}>{d.name}</button>
              ))}
            </div>
          )}
          {extraIndicators.map(ind => (
            <button key={ind.id} className="ind-chip" onClick={() => removeIndicator(ind.id)}
              title="Remove indicator">
              {INDICATORS[ind.key]?.name} <span className="ind-chip-x">×</span>
            </button>
          ))}
        </div>
        <div className="draw-btns">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`draw-btn ${activeTool === t.id ? 'active' : ''}`}
              onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
              title={`Draw ${t.label} — click ${t.points} point${t.points > 1 ? 's' : ''} on the chart`}
            >
              {t.label}
            </button>
          ))}
          <button className="draw-btn" title="Undo last drawing"
            onClick={() => chartContainerRef.current?.__drawings?.removeLast()}>Undo</button>
          <button className="draw-btn" title="Clear all drawings for this symbol"
            onClick={() => chartContainerRef.current?.__drawings?.clearAll()}>Clear</button>
        </div>
      </div>
      <div className="chart-container" ref={chartContainerRef}>
        {loading && !candleData && (
          <div className="chart-loading">Loading chart data...</div>
        )}
        <ChartDrawings
          chartRef={chartRef}
          seriesRef={seriesRef}
          containerRef={chartContainerRef}
          symbol={activeSymbol}
          tool={activeTool}
          onToolDone={() => setActiveTool(null)}
        />
      </div>
      {activeOverlays.includes('RSI') && candleData?.candles && (
        <RSISubChart candles={candleData.candles} />
      )}
      {activeOverlays.includes('MACD') && candleData?.candles && (
        <MACDSubChart candles={candleData.candles} />
      )}
      {candleData?.candles && extraIndicators
        .filter(ind => INDICATORS[ind.key]?.pane === 'sub')
        .map(ind => (
          <IndicatorSubChart key={ind.id} indKey={ind.key} candles={candleData.candles}
            onRemove={() => removeIndicator(ind.id)} />
        ))}
    </div>
  );
}

// Generalised oscillator sub-pane driven by the indicator registry.
function IndicatorSubChart({ indKey, candles, onRemove }) {
  const ref = useRef(null);
  const chartInst = useRef(null);
  const def = INDICATORS[indKey];

  useEffect(() => {
    if (!ref.current || !def) return;
    if (chartInst.current) { chartInst.current.remove(); chartInst.current = null; }
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth, height: 100,
      layout: { background: { color: '#0a0a0a' }, textColor: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { visible: false },
    });
    chartInst.current = chart;

    const data = def.fn(candles, def.params);
    if (def.histogram && data.macd) {
      chart.addLineSeries({ color: '#00aaff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(data.macd);
      chart.addLineSeries({ color: '#FF8C00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(data.signal);
      chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })
        .setData(data.histogram.map(d => ({ time: d.time, value: d.value, color: d.value >= 0 ? '#00cc44' : '#cc2200' })));
    } else if (def.multi && !Array.isArray(data)) {
      const colors = ['#b060ff', '#FF8C00'];
      def.multi.forEach((band, i) => {
        chart.addLineSeries({ color: colors[i % colors.length], lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(data[band] || []);
      });
    } else {
      chart.addLineSeries({ color: def.color || '#b060ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(data);
    }
    // Reference bands (e.g. RSI 30/70).
    if (def.bands && Array.isArray(data) === false) { /* multi handled above */ }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(entries => chart.applyOptions({ width: entries[0].contentRect.width }));
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null; };
  }, [indKey, candles]);

  return (
    <div className="subchart">
      <span className="subchart-label">
        {def?.name}
        <button className="subchart-remove" onClick={onRemove} title="Remove">×</button>
      </span>
      <div ref={ref} />
    </div>
  );
}

function RSISubChart({ candles }) {
  const ref = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (chartInst.current) { chartInst.current.remove(); chartInst.current = null; }
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 100,
      layout: { background: { color: '#0a0a0a' }, textColor: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { visible: false },
    });
    chartInst.current = chart;
    const rsiData = computeRSI(candles);
    const series = chart.addLineSeries({ color: '#b060ff', lineWidth: 1, priceLineVisible: false });
    series.setData(rsiData);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(entries => { chart.applyOptions({ width: entries[0].contentRect.width }); });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null; };
  }, [candles]);

  return (
    <div className="subchart">
      <span className="subchart-label">RSI(14)</span>
      <div ref={ref} />
    </div>
  );
}

function MACDSubChart({ candles }) {
  const ref = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (chartInst.current) { chartInst.current.remove(); chartInst.current = null; }
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 100,
      layout: { background: { color: '#0a0a0a' }, textColor: '#666', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { visible: false },
    });
    chartInst.current = chart;
    const macdData = computeMACD(candles);
    const macdLine = chart.addLineSeries({ color: '#00aaff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    macdLine.setData(macdData.map(d => ({ time: d.time, value: d.macd })));
    const sigLine = chart.addLineSeries({ color: '#FF8C00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    sigLine.setData(macdData.map(d => ({ time: d.time, value: d.signal })));
    const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    hist.setData(macdData.map(d => ({ time: d.time, value: d.histogram, color: d.histogram >= 0 ? '#00cc44' : '#cc2200' })));
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(entries => { chart.applyOptions({ width: entries[0].contentRect.width }); });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null; };
  }, [candles]);

  return (
    <div className="subchart">
      <span className="subchart-label">MACD(12,26,9)</span>
      <div ref={ref} />
    </div>
  );
}
