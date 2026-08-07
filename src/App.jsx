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
import PortfolioPanel from './components/PortfolioPanel.jsx';
import FinancialsPanel from './components/FinancialsPanel.jsx';
import CorrelationPanel from './components/CorrelationPanel.jsx';
import YieldCurvePanel from './components/YieldCurvePanel.jsx';
import CompsPanel from './components/CompsPanel.jsx';
import BreadthPanel from './components/BreadthPanel.jsx';
import MarketsPanel from './components/MarketsPanel.jsx';
import ComparePanel from './components/ComparePanel.jsx';
import VaRPanel from './components/VaRPanel.jsx';
import FactorPanel from './components/FactorPanel.jsx';
import OptimizerPanel from './components/OptimizerPanel.jsx';
import AttributionPanel from './components/AttributionPanel.jsx';
import DCFPanel from './components/DCFPanel.jsx';
import StressTestPanel from './components/StressTestPanel.jsx';
import StrategyBuilder from './components/StrategyBuilder.jsx';
import BotPanel from './components/BotPanel.jsx';
import BacktestPanel from './components/BacktestPanel.jsx';
import MultiChartPanel from './components/MultiChartPanel.jsx';
import CustomIndicatorPanel from './components/CustomIndicatorPanel.jsx';
import TVMPanel from './components/TVMPanel.jsx';
import ModelLabPanel from './components/ModelLabPanel.jsx';
import PanelMaximizer from './components/PanelMaximizer.jsx';
import PowerDeskPanel from './components/PowerDeskPanel.jsx';

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
          <span className="terminal-logo">QUANTBLOOM TERMINAL</span>
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

      {/* Row 1b: Multi-chart grid */}
      <div className="dashboard-row row-1col">
        <MultiChartPanel />
      </div>

      {/* Row 2: Bot + Backtest + Markets board */}
      <div className="dashboard-row row-3col">
        <BotPanel />
        <BacktestPanel />
        <MarketsPanel />
      </div>

      {/* Row 2a: Model Lab + Portfolio + Attribution */}
      <div className="dashboard-row row-3col">
        <ModelLabPanel />
        <PortfolioPanel />
        <AttributionPanel />
      </div>

      {/* Row 2a2: Compare */}
      <div className="dashboard-row row-3col">
        <ComparePanel />
        <RiskPanel />
        <CorrelationPanel />
      </div>

      {/* Row 2b: Indices */}
      <div className="dashboard-row row-3col">
        <IndicesPanel />
        <ForexPanel />
        <CryptoPanel />
      </div>

      {/* Row 3: News + Heatmap */}
      <div className="dashboard-row row-2col">
        <NewsFeedPanel />
        <HeatmapPanel />
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

      {/* Row 6: Breadth + Yield Curve + Comps */}
      <div className="dashboard-row row-3col">
        <BreadthPanel />
        <YieldCurvePanel />
        <CompsPanel />
      </div>

      {/* Row 6b: Alerts */}
      <div className="dashboard-row row-2col">
        <AlertsPanel />
      </div>

      {/* Row 7: Quantitative risk */}
      <div className="dashboard-row row-4col">
        <VaRPanel />
        <StressTestPanel />
        <FactorPanel />
        <StrategyBuilder />
      </div>

      {/* Row 8: Attribution + Optimiser + DCF */}
      <div className="dashboard-row row-3col">
        <OptimizerPanel />
        <DCFPanel />
        <TVMPanel />
      </div>

      {/* Row 8a: Power markets desk */}
      <div className="dashboard-row row-2col">
        <PowerDeskPanel />
      </div>

      {/* Row 8b: Custom indicator editor */}
      <div className="dashboard-row row-2col">
        <CustomIndicatorPanel />
      </div>

      {/* Row 9: Financials + Options */}
      <div className="dashboard-row row-2col">
        <FinancialsPanel />
        <OptionsPanel />
      </div>

      {/* Watchlist Modal */}
      {showWatchlist && <WatchlistModal onClose={() => setShowWatchlist(false)} />}

      {/* Global panel pop-out (Ctrl+Shift+M) */}
      <PanelMaximizer />
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
