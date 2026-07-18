import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { formatPrice, formatPct } from '../utils/format.js';
import { usePolling } from '../hooks/usePolling.js';

export default function WatchlistModal({ onClose }) {
  const { state, dispatch } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const symbolsParam = state.watchlist.join(',');
  const { data: quotes } = usePolling(`/api/v1/quotes?symbols=${symbolsParam}`, 10000);
  const items = Array.isArray(quotes) ? quotes : [];

  useEffect(() => {
    inputRef.current?.focus();
    function handleClick(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/v1/search?q=${searchTerm}`);
        const data = await resp.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  function addSymbol(sym) {
    dispatch({ type: 'ADD_TO_WATCHLIST', payload: sym });
    setSearchTerm('');
    setSearchResults([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && searchTerm.trim()) {
      addSymbol(searchTerm.trim().toUpperCase());
    }
  }

  return (
    <div className="watchlist-overlay">
      <div className="watchlist-modal" ref={modalRef}>
        <div className="watchlist-header">
          <span className="panel-label">WATCHLIST</span>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="watchlist-items">
          {items.map(q => (
            <div key={q.symbol} className="watchlist-row">
              <span className="wl-symbol">{q.symbol}</span>
              <span className="wl-price">{formatPrice(q.price)}</span>
              <span className={`wl-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                {formatPct(q.changePercent)}
              </span>
              <button
                className="wl-remove"
                onClick={() => dispatch({ type: 'REMOVE_FROM_WATCHLIST', payload: q.symbol })}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <div className="watchlist-search">
          <span className="add-label">ADD SYMBOL</span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Type ticker..."
            className="wl-input"
          />
          {searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map(r => (
                <button key={r.symbol} className="search-result" onClick={() => addSymbol(r.symbol)}>
                  <span className="sr-symbol">{r.symbol}</span>
                  <span className="sr-name">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
