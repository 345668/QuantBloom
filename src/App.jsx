import { useState, useEffect } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext.jsx';
import TickerBar from './components/TickerBar.jsx';
import WatchlistModal from './components/WatchlistModal.jsx';
import ChartPanel from './components/ChartPanel.jsx';
import NewsFeedPanel from './components/NewsFeedPanel.jsx';
import HeatmapPanel from './components/HeatmapPanel.jsx';
import CalendarPanel from './components/CalendarPanel.jsx';
import FredPanel from './components/FredPanel.jsx';

function Dashboard() {
  const { state, dispatch } = useDashboard();
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/New_York', hour12: false
      }) + ' EST');
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="terminal">
      {/* Nav Bar */}
      <nav className="nav-bar">
        <div className="nav-left">
          <span className="terminal-logo">TERMINAL</span>
          <button
            className="nav-btn watchlist-btn"
            onClick={() => setShowWatchlist(true)}
          >
            WATCHLIST
          </button>
        </div>
        <div className="nav-right">
          <button
            className="theme-toggle"
            onClick={() => dispatch({
              type: 'SET_THEME',
              payload: state.theme === 'dark' ? 'light' : 'dark'
            })}
          >
            {state.theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
          </button>
          <span className="nav-clock">{clock}</span>
        </div>
      </nav>

      {/* Ticker Bar */}
      <TickerBar />

      {/* Main Grid */}
      <div className="dashboard-grid">
        <div className="grid-left">
          <ChartPanel />
        </div>
        <div className="grid-right">
          <NewsFeedPanel />
          <HeatmapPanel />
        </div>
      </div>

      {/* Bottom Row: FRED + Calendar side by side */}
      <div className="bottom-grid">
        <FredPanel />
        <CalendarPanel />
      </div>

      {/* Watchlist Modal */}
      {showWatchlist && (
        <WatchlistModal onClose={() => setShowWatchlist(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  );
}
