import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { formatPrice, formatPct, formatVolume } from '../utils/format.js';

function getHeatColor(pct) {
  if (pct == null || isNaN(pct)) return '#333';
  const intensity = Math.min(Math.abs(pct) / 5, 1);
  if (pct >= 0) {
    const g = Math.floor(40 + intensity * 160);
    return `rgb(0, ${g}, ${Math.floor(intensity * 30)})`;
  }
  const r = Math.floor(40 + intensity * 180);
  return `rgb(${r}, 0, 0)`;
}

export default function HeatmapPanel() {
  const { dispatch } = useDashboard();
  const { data: sectors, loading } = usePolling('/api/v1/heatmap', 60000);
  const [hoveredStock, setHoveredStock] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  function handleHover(stock, e) {
    setHoveredStock(stock);
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ x: rect.left, y: rect.bottom + 4 });
  }

  function viewChart(sym) {
    dispatch({ type: 'SET_SYMBOL', payload: sym });
    setHoveredStock(null);
  }

  if (loading && !sectors) {
    return (
      <div className="heatmap-panel">
        <div className="panel-header-row">
          <span className="panel-label">SECTOR HEATMAP</span>
          <span className="panel-sublabel">S&P 500</span>
        </div>
        <div className="panel-loading">Loading heatmap...</div>
      </div>
    );
  }

  const sectorEntries = sectors ? Object.entries(sectors) : [];

  return (
    <div className="heatmap-panel">
      <div className="panel-header-row">
        <span className="panel-label">SECTOR HEATMAP</span>
        <span className="panel-sublabel">S&P 500</span>
      </div>
      <div className="heatmap-grid">
        {sectorEntries.map(([sectorName, stocks]) => (
          <div key={sectorName} className="heatmap-sector">
            <div className="sector-label">{sectorName}</div>
            <div className="sector-cells">
              {stocks.map(stock => (
                <button
                  key={stock.symbol}
                  className="heatmap-cell"
                  style={{ backgroundColor: getHeatColor(stock.changePercent) }}
                  onMouseEnter={e => handleHover(stock, e)}
                  onMouseLeave={() => setHoveredStock(null)}
                  onClick={() => viewChart(stock.symbol)}
                  title={stock.symbol}
                >
                  <span className="cell-symbol">{stock.symbol}</span>
                  <span className="cell-pct">{formatPct(stock.changePercent)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hoveredStock && (
        <div
          className="heatmap-popover"
          style={{ position: 'fixed', left: popoverPos.x, top: popoverPos.y, zIndex: 999 }}
        >
          <div className="pop-symbol">{hoveredStock.symbol}</div>
          <div className="pop-name">{hoveredStock.name}</div>
          <div className="pop-row">
            <span>Price</span>
            <span className="pop-val">${formatPrice(hoveredStock.price)}</span>
          </div>
          <div className="pop-row">
            <span>Change</span>
            <span className={`pop-val ${hoveredStock.changePercent >= 0 ? 'up' : 'down'}`}>
              {formatPct(hoveredStock.changePercent)}
            </span>
          </div>
          <div className="pop-row">
            <span>Volume</span>
            <span className="pop-val">{formatVolume(hoveredStock.volume)}</span>
          </div>
          <button className="pop-view-btn" onClick={() => viewChart(hoveredStock.symbol)}>
            VIEW CHART
          </button>
        </div>
      )}
    </div>
  );
}
