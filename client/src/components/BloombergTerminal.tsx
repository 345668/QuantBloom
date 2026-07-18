import { useState, useMemo } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { useQuery } from "@tanstack/react-query";
import { StockQuote } from "@shared/schema";
import TerminalHeader from "./TerminalHeader";
import StockQuoteCard from "./StockQuoteCard";
import TradingChart from "./TradingChart";
import WatchlistPanel from "./WatchlistPanel";
import NewsPanel from "./NewsPanel";
import PortfolioPanel from "./PortfolioPanel";
import MarketOverview from "./MarketOverview";
import StockScreener from "./StockScreener";
import CryptoMarketPanel from "./CryptoMarketPanel";
import { EconomicCalendar } from "./EconomicCalendar";
import { CompanyFundamentalsPanel } from "./CompanyFundamentals";
import OptionsChain from "./OptionsChain";
import EarningsCalendar from "./EarningsCalendar";
import IPOCalendar from "./IPOCalendar";
import ForexPanel from "./ForexPanel";
import CompanyProfile from "./CompanyProfile";
import AnalystRecommendations from "./AnalystRecommendations";
import FinnhubMarketNews from "./FinnhubMarketNews";
import { FredEconomicData } from "./FredEconomicData";
import MarketHeatMap from "./MarketHeatMap";
import TechnicalAnalysis from "./TechnicalAnalysis";
import RiskAnalytics from "./RiskAnalytics";
import SectorAnalysis from "./SectorAnalysis";
import AlertsPanel from "./AlertsPanel";
import KeyboardShortcutsPanel from "./KeyboardShortcutsPanel";
import OrderEntryPanel from "./trading/OrderEntryPanel";
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { useMarketData, useNewsData, useChartData } from "@/hooks/useDataOrchestration";
import { useTerminal } from "@/contexts/TerminalContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function BloomTerminal() {
  const [layouts, setLayouts] = useState({});
  const [alertSymbol, setAlertSymbol] = useState<string | undefined>();
  const { 
    currentSymbol, 
    setCurrentSymbol, 
    openQuote, 
    openChart, 
    openNews, 
    openPortfolio, 
    openWatchlist, 
    refreshData, 
    setCommandMode,
    setActivePanel 
  } = useTerminal();
  const { isAuthenticated } = useAuth();

  // Real-time data fetching using DataOrchestrator
  const { data: currentQuoteData, isLoading: quoteLoading, error: quoteError } = useQuery<StockQuote>({
    queryKey: ['/api/quote', currentSymbol],
    enabled: !!currentSymbol
  });
  
  const { data: marketData, isLoading: marketLoading } = useMarketData(currentSymbol, {
    enableRealTime: true,
    refreshInterval: 15000
  });

  const { data: chartData, isLoading: chartLoading } = useChartData(currentSymbol, '1D', {
    enableRealTime: true,
    refreshInterval: 30000
  });

  const { data: watchlistData, isLoading: watchlistLoading } = useQuery({
    queryKey: ['/api/watchlist'],
    refetchInterval: 30000
  });

  const { data: newsData, isLoading: newsLoading } = useNewsData(currentSymbol, {
    enableRealTime: true,
    refreshInterval: 60000
  });

  const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
    queryKey: ['/api/portfolio'],
    refetchInterval: 30000
  });

  const { data: marketIndices, isLoading: indicesLoading } = useQuery({
    queryKey: ['/api/market/indices'],
    refetchInterval: 15000
  });

  const { data: screenerResults, isLoading: screenerLoading } = useQuery({
    queryKey: ['/api/screener'],
    refetchInterval: 60000
  });

  const defaultLayouts = {
    lg: [
      { i: "quote", x: 0, y: 0, w: 6, h: 4, minW: 4, minH: 3 },
      { i: "chart", x: 6, y: 0, w: 12, h: 8, minW: 8, minH: 6 },
      { i: "watchlist", x: 18, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "news", x: 0, y: 4, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "portfolio", x: 6, y: 8, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "market", x: 12, y: 8, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "crypto", x: 18, y: 8, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "technical", x: 0, y: 12, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "risk", x: 8, y: 12, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "sector", x: 16, y: 12, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "alerts", x: 0, y: 22, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "options", x: 8, y: 22, w: 8, h: 8, minW: 8, minH: 6 },
      { i: "heatmap", x: 16, y: 22, w: 8, h: 8, minW: 8, minH: 6 },
      { i: "calendar", x: 0, y: 32, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "fundamentals", x: 6, y: 32, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "screener", x: 12, y: 32, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "earnings", x: 0, y: 40, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "ipo", x: 8, y: 40, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "forex", x: 16, y: 40, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "company-profile", x: 0, y: 50, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "analyst-recs", x: 8, y: 50, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "finnhub-news", x: 16, y: 50, w: 8, h: 10, minW: 6, minH: 8 },
      { i: "fred-data", x: 0, y: 60, w: 8, h: 10, minW: 6, minH: 8 }
    ],
    md: [
      { i: "quote", x: 0, y: 0, w: 5, h: 4, minW: 4, minH: 3 },
      { i: "chart", x: 5, y: 0, w: 10, h: 6, minW: 6, minH: 4 },
      { i: "watchlist", x: 15, y: 0, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "news", x: 0, y: 4, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "portfolio", x: 5, y: 6, w: 5, h: 4, minW: 4, minH: 3 },
      { i: "market", x: 10, y: 6, w: 5, h: 4, minW: 4, minH: 3 },
      { i: "crypto", x: 15, y: 6, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "alerts", x: 0, y: 10, w: 10, h: 8, minW: 6, minH: 6 },
      { i: "options", x: 10, y: 10, w: 10, h: 6, minW: 6, minH: 4 },
      { i: "heatmap", x: 0, y: 18, w: 10, h: 6, minW: 6, minH: 4 },
      { i: "calendar", x: 10, y: 16, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "fundamentals", x: 15, y: 16, w: 5, h: 6, minW: 4, minH: 4 },
      { i: "screener", x: 0, y: 24, w: 20, h: 8, minW: 6, minH: 6 },
      { i: "earnings", x: 0, y: 32, w: 7, h: 8, minW: 6, minH: 6 },
      { i: "ipo", x: 7, y: 32, w: 7, h: 8, minW: 6, minH: 6 },
      { i: "forex", x: 14, y: 32, w: 6, h: 8, minW: 6, minH: 6 },
      { i: "company-profile", x: 0, y: 40, w: 7, h: 8, minW: 6, minH: 6 },
      { i: "analyst-recs", x: 7, y: 40, w: 7, h: 8, minW: 6, minH: 6 },
      { i: "finnhub-news", x: 14, y: 40, w: 6, h: 8, minW: 6, minH: 6 },
      { i: "fred-data", x: 0, y: 48, w: 10, h: 8, minW: 6, minH: 6 }
    ],
    sm: [
      { i: "quote", x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
      { i: "chart", x: 0, y: 4, w: 12, h: 6, minW: 6, minH: 4 },
      { i: "watchlist", x: 0, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "news", x: 6, y: 10, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "portfolio", x: 0, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
      { i: "market", x: 6, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
      { i: "crypto", x: 0, y: 20, w: 12, h: 6, minW: 6, minH: 4 },
      { i: "alerts", x: 0, y: 26, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "technical", x: 0, y: 34, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "risk", x: 0, y: 42, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "options", x: 0, y: 50, w: 12, h: 6, minW: 6, minH: 4 },
      { i: "heatmap", x: 0, y: 56, w: 12, h: 6, minW: 6, minH: 4 },
      { i: "calendar", x: 0, y: 62, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "fundamentals", x: 6, y: 62, w: 6, h: 6, minW: 4, minH: 4 },
      { i: "screener", x: 0, y: 68, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "earnings", x: 0, y: 76, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "ipo", x: 0, y: 84, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "forex", x: 0, y: 92, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "company-profile", x: 0, y: 100, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "analyst-recs", x: 0, y: 108, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "finnhub-news", x: 0, y: 116, w: 12, h: 8, minW: 6, minH: 6 },
      { i: "fred-data", x: 0, y: 124, w: 12, h: 8, minW: 6, minH: 6 }
    ]
  };

  const handleSymbolSearch = (symbol: string) => {
    setCurrentSymbol(symbol);
    console.log("Symbol searched:", symbol);
  };

  const handleSymbolClick = (symbol: string) => {
    setCurrentSymbol(symbol);
    console.log("Symbol clicked:", symbol);
  };

  const handleCreateAlert = (symbol: string) => {
    setAlertSymbol(symbol);
    console.log("Create alert requested for:", symbol);
  };

  const handleAlertCreated = () => {
    // Reset the prefilled symbol after alert creation
    setAlertSymbol(undefined);
  };

  // Define Bloomberg-style keyboard shortcuts
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(() => [
    // Navigation shortcuts
    { key: 'q', ctrl: true, description: 'Open Stock Quote', category: 'Navigation', action: () => openQuote(currentSymbol) },
    { key: 'c', ctrl: true, description: 'Open Chart', category: 'Navigation', action: () => openChart(currentSymbol) },
    { key: 'n', ctrl: true, description: 'Open News', category: 'Navigation', action: () => openNews() },
    { key: 'p', ctrl: true, description: 'Open Portfolio', category: 'Navigation', action: () => openPortfolio() },
    { key: 'w', ctrl: true, description: 'Open Watchlist', category: 'Navigation', action: () => openWatchlist() },
    
    // Search shortcuts
    { key: 'f', ctrl: true, description: 'Focus Search Bar', category: 'Search', action: () => {
      const input = document.querySelector('[data-testid="input-symbol-search"]') as HTMLInputElement;
      input?.focus();
    }},
    { key: 'k', ctrl: true, description: 'Command Mode', category: 'Search', action: () => setCommandMode(true) },
    
    // Data shortcuts
    { key: 'r', ctrl: true, description: 'Refresh All Data', category: 'Data', action: () => refreshData() },
    { key: 'F5', description: 'Refresh Data', category: 'Data', action: () => refreshData() },
    
    // Panel shortcuts
    { key: '1', ctrl: true, description: 'Focus Chart Panel', category: 'Navigation', action: () => setActivePanel('chart') },
    { key: '2', ctrl: true, description: 'Focus News Panel', category: 'Navigation', action: () => setActivePanel('news') },
    { key: '3', ctrl: true, description: 'Focus Portfolio Panel', category: 'Navigation', action: () => setActivePanel('portfolio') },
    { key: '4', ctrl: true, description: 'Focus Watchlist Panel', category: 'Navigation', action: () => setActivePanel('watchlist') },
    
    // Bloomberg-style shortcuts
    { key: 'g', ctrl: true, shift: true, description: 'Go to Symbol', category: 'Search', action: () => {
      const input = document.querySelector('[data-testid="input-symbol-search"]') as HTMLInputElement;
      input?.focus();
      input?.select();
    }},
    { key: '?', description: 'Show Keyboard Shortcuts', category: 'System', action: () => {} },
    { key: 'Escape', description: 'Exit Command Mode', category: 'System', action: () => setCommandMode(false) },
    
    // Quick symbol shortcuts
    { key: 'a', alt: true, description: 'Load AAPL', category: 'Search', action: () => { setCurrentSymbol('AAPL'); openQuote('AAPL'); } },
    { key: 'g', alt: true, description: 'Load GOOGL', category: 'Search', action: () => { setCurrentSymbol('GOOGL'); openQuote('GOOGL'); } },
    { key: 'm', alt: true, description: 'Load MSFT', category: 'Search', action: () => { setCurrentSymbol('MSFT'); openQuote('MSFT'); } },
    { key: 't', alt: true, description: 'Load TSLA', category: 'Search', action: () => { setCurrentSymbol('TSLA'); openQuote('TSLA'); } },
  ], [currentSymbol, openQuote, openChart, openNews, openPortfolio, openWatchlist, refreshData, setActivePanel, setCommandMode, setCurrentSymbol]);

  // Initialize keyboard shortcuts
  const { groupedShortcuts, getShortcutDisplay } = useKeyboardShortcuts({
    shortcuts: keyboardShortcuts,
    enabled: isAuthenticated
  });

  // Use real quote data with fallback for loading states
  const fallbackQuote: StockQuote = {
    symbol: currentSymbol || 'AAPL',
    name: currentSymbol === 'AAPL' ? 'Apple Inc.' : `${currentSymbol || 'AAPL'} Corp.`,
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    lastUpdated: new Date()
  };

  const currentQuote: StockQuote = currentQuoteData || fallbackQuote;

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden">
      <TerminalHeader onSymbolSearch={handleSymbolSearch} />
      
      <div className="h-[calc(100vh-60px)] overflow-auto">
        <ResponsiveGridLayout
          className="layout"
          layouts={Object.keys(layouts).length > 0 ? layouts : defaultLayouts}
          onLayoutChange={(layout, layouts) => setLayouts(layouts)}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 }}
          rowHeight={30}
          margin={[8, 8]}
          containerPadding={[8, 8]}
          isDraggable={true}
          isResizable={true}
        >
          <div key="quote" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              {quoteLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : quoteError ? (
                <div className="text-red-500 p-4">Error loading quote data</div>
              ) : (
                <StockQuoteCard 
                  symbol={currentQuote.symbol}
                  name={currentQuote.name}
                  price={currentQuote.price}
                  change={currentQuote.change}
                  changePercent={currentQuote.changePercent}
                  volume={currentQuote.volume}
                />
              )}
            </div>
          </div>

          <div key="chart" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <TradingChart 
                symbol={currentSymbol}
              />
            </div>
          </div>

          <div key="watchlist" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <WatchlistPanel
                onSymbolClick={handleSymbolClick}
                onCreateAlert={handleCreateAlert}
              />
            </div>
          </div>

          <div key="news" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <NewsPanel />
            </div>
          </div>

          <div key="portfolio" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <PortfolioPanel
                onPositionClick={handleSymbolClick}
              />
            </div>
          </div>

          <div key="market" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              {indicesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <MarketOverview
                  indices={Array.isArray(marketIndices) ? marketIndices : []}
                  marketStatus="OPEN"
                />
              )}
            </div>
          </div>

          <div key="crypto" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <CryptoMarketPanel
                onCryptoClick={handleSymbolClick}
              />
            </div>
          </div>

          <div key="calendar" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <EconomicCalendar />
            </div>
          </div>

          <div key="fundamentals" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <CompanyFundamentalsPanel symbol={currentSymbol} />
            </div>
          </div>

          <div key="screener" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <StockScreener
                results={Array.isArray(screenerResults) ? screenerResults : []}
                onStockClick={handleSymbolClick}
              />
            </div>
          </div>

          <div key="options" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <OptionsChain 
                symbol={currentSymbol}
              />
            </div>
          </div>

          <div key="heatmap" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <MarketHeatMap 
                onSymbolClick={handleSymbolClick}
              />
            </div>
          </div>

          <div key="technical" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <TechnicalAnalysis 
                symbol={currentSymbol}
              />
            </div>
          </div>

          <div key="risk" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <RiskAnalytics />
            </div>
          </div>

          <div key="sector" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <SectorAnalysis />
            </div>
          </div>

          <div key="alerts" className="bg-card border border-card-border rounded-md overflow-hidden">
            <AlertsPanel 
              prefilledSymbol={alertSymbol}
              onAlertCreate={handleAlertCreated}
            />
          </div>

          <div key="earnings" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <EarningsCalendar onSymbolClick={handleSymbolClick} />
            </div>
          </div>

          <div key="ipo" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <IPOCalendar onSymbolClick={handleSymbolClick} />
            </div>
          </div>

          <div key="forex" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <ForexPanel />
            </div>
          </div>

          <div key="company-profile" className="bg-card border border-card-border rounded-md overflow-hidden">
            <CompanyProfile symbol={currentSymbol} />
          </div>

          <div key="analyst-recs" className="bg-card border border-card-border rounded-md overflow-hidden">
            <AnalystRecommendations symbol={currentSymbol} />
          </div>

          <div key="finnhub-news" className="bg-card border border-card-border rounded-md overflow-hidden">
            <FinnhubMarketNews />
          </div>

          <div key="fred-data" className="bg-card border border-card-border rounded-md overflow-hidden">
            <div className="p-4 h-full overflow-auto">
              <FredEconomicData />
            </div>
          </div>
        </ResponsiveGridLayout>
      </div>
      
      {/* Keyboard Shortcuts Panel */}
      <div className="fixed bottom-4 right-4 z-50">
        <KeyboardShortcutsPanel 
          shortcuts={keyboardShortcuts} 
          getShortcutDisplay={getShortcutDisplay}
        >
          <Button
            data-testid="button-keyboard-shortcuts"
            size="sm"
            variant="outline"
            className="bg-card border-card-border hover-elevate font-mono shadow-lg"
          >
            <Keyboard className="w-4 h-4 mr-1" />
            <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">
              ?
            </Badge>
          </Button>
        </KeyboardShortcutsPanel>
      </div>
    </div>
  );
}