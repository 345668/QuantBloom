import { useState, useEffect } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext.jsx';
import TickerBar from './components/TickerBar.jsx';
import WatchlistModal from './components/WatchlistModal.jsx';
import ChartPanel from './components/ChartPanel.jsx';
import CompanyProfile from './components/CompanyProfile.jsx';
import AnalystPanel from './components/AnalystPanel.jsx';
import NewsFeedPanel from './components/NewsFeedPanel.jsx';
import HeatmapPanel from './components/HeatmapPanel.jsx';
import CalendarPanel from './components/CalendarPanel.jsx';
import FredPanel from './components/FredPanel.jsx';
import CryptoPanel from './components/CryptoPanel.jsx';
import ForexPanel from './components/ForexPanel.jsx';
import IndicesPanel from './components/IndicesPanel.jsx';
import FundamentalsPanel from './components/FundamentalsPanel.jsx';
import EarningsPanel from './components/EarningsPanel.jsx';
import IpoPanel from './components/IpoPanel.jsx';
import TechnicalPanel from './components/TechnicalPanel.jsx';
import ScreenerPanel from './components/ScreenerPanel.jsx';
import SectorPanel from './components/SectorPanel.jsx';
import RiskPanel from './components/RiskPanel.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import OptionsPanel from './components/OptionsPanel.jsx';

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
          <span className="terminal-logo">BLOOMBERG TERMINAL</span>
          <button className="nav-btn watchlist-btn" onClick={() => setShowWatchlist(true)}>WATCHLIST</button>
        </div>
        <div className="nav-right">
          <button
            className="theme-toggle"
            onClick={() => dispatch({ type: 'SET_THEME', payload: state.theme === 'dark' ? 'light' : 'dark' })}
          >
            {state.theme === 'dark' ? 'LIGHT' : 'DARK'}
          </button>
          <span className="nav-clock">{clock}</span>
        </div>
      </nav>

      {/* Ticker Bar */}
      <TickerBar />

      {/* Row 1: Chart + Profile + Analyst */}
      <div className="dashboard-row row-hero">
        <div className="col-wide"><ChartPanel /></div>
        <div className="col-side">
          <CompanyProfile />
          <AnalystPanel />
        </div>
      </div>

      {/* Row 2: News + Heatmap + Indices/Forex/Crypto */}
      <div className="dashboard-row row-3col">
        <NewsFeedPanel />
        <HeatmapPanel />
        <div className="col-stack">
          <IndicesPanel />
          <ForexPanel />
          <CryptoPanel />
        </div>
      </div>

      {/* Row 3: FRED + Calendar + Earnings + IPO */}
      <div className="dashboard-row row-4col">
        <FredPanel />
        <CalendarPanel />
        <EarningsPanel />
        <IpoPanel />
      </div>

      {/* Row 4: Technical + Fundamentals + Sector + Screener */}
      <div className="dashboard-row row-4col">
        <TechnicalPanel />
        <FundamentalsPanel />
        <SectorPanel />
        <ScreenerPanel />
      </div>

      {/* Row 5: Options + Risk + Alerts */}
      <div className="dashboard-row row-3col">
        <OptionsPanel />
        <RiskPanel />
        <AlertsPanel />
      </div>

      {/* Watchlist Modal */}
      {showWatchlist && <WatchlistModal onClose={() => setShowWatchlist(false)} />}
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
