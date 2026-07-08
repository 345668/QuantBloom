import { createContext, useContext, useState, useCallback } from "react";

interface TerminalContextType {
  // Navigation state
  activePanel: string | null;
  setActivePanel: (panel: string | null) => void;
  
  // Search functionality
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
  
  // Symbol focus
  currentSymbol: string;
  setCurrentSymbol: (symbol: string) => void;
  
  // Command mode
  commandMode: boolean;
  setCommandMode: (mode: boolean) => void;
  
  // Panel management
  panels: string[];
  addPanel: (panel: string) => void;
  removePanel: (panel: string) => void;
  
  // Layout management
  layout: any[];
  setLayout: (layout: any[]) => void;
  
  // Quick actions
  openQuote: (symbol: string) => void;
  openChart: (symbol: string) => void;
  openNews: (symbol?: string) => void;
  openPortfolio: () => void;
  openWatchlist: () => void;
  refreshData: () => void;
}

const TerminalContext = createContext<TerminalContextType | null>(null);

interface TerminalProviderProps {
  children: React.ReactNode;
}

export function TerminalProvider({ children }: TerminalProviderProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [currentSymbol, setCurrentSymbol] = useState("AAPL");
  const [commandMode, setCommandMode] = useState(false);
  const [panels, setPanels] = useState<string[]>([]);
  const [layout, setLayout] = useState<any[]>([]);

  const addPanel = useCallback((panel: string) => {
    setPanels(prev => {
      if (!prev.includes(panel)) {
        return [...prev, panel];
      }
      return prev;
    });
  }, []);

  const removePanel = useCallback((panel: string) => {
    setPanels(prev => prev.filter(p => p !== panel));
    if (activePanel === panel) {
      setActivePanel(null);
    }
  }, [activePanel]);

  // Quick action handlers
  const openQuote = useCallback((symbol: string) => {
    setCurrentSymbol(symbol);
    setActivePanel('quote');
    addPanel('quote');
  }, [addPanel]);

  const openChart = useCallback((symbol: string) => {
    setCurrentSymbol(symbol);
    setActivePanel('chart');
    addPanel('chart');
  }, [addPanel]);

  const openNews = useCallback((symbol?: string) => {
    if (symbol) {
      setCurrentSymbol(symbol);
    }
    setActivePanel('news');
    addPanel('news');
  }, [addPanel]);

  const openPortfolio = useCallback(() => {
    setActivePanel('portfolio');
    addPanel('portfolio');
  }, [addPanel]);

  const openWatchlist = useCallback(() => {
    setActivePanel('watchlist');
    addPanel('watchlist');
  }, [addPanel]);

  const refreshData = useCallback(() => {
    // Trigger data refresh
    window.dispatchEvent(new CustomEvent('terminal:refresh'));
  }, []);

  const value = {
    activePanel,
    setActivePanel,
    globalSearch,
    setGlobalSearch,
    currentSymbol,
    setCurrentSymbol,
    commandMode,
    setCommandMode,
    panels,
    addPanel,
    removePanel,
    layout,
    setLayout,
    openQuote,
    openChart,
    openNews,
    openPortfolio,
    openWatchlist,
    refreshData,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}