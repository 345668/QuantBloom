import { createContext, useContext, useReducer, useEffect } from 'react';
import { getItem, setItem, DEFAULTS } from '../utils/storage.js';

const DashboardContext = createContext();

function init() {
  return {
    watchlist: getItem('watchlist') || DEFAULTS.watchlist,
    activeSymbol: getItem('activeSymbol') || DEFAULTS.activeSymbol,
    activeTimeframe: getItem('activeTimeframe') || DEFAULTS.activeTimeframe,
    activeOverlays: getItem('activeOverlays') || DEFAULTS.activeOverlays,
    theme: getItem('theme') || DEFAULTS.theme,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SYMBOL':
      setItem('activeSymbol', action.payload);
      return { ...state, activeSymbol: action.payload };
    case 'SET_TIMEFRAME':
      setItem('activeTimeframe', action.payload);
      return { ...state, activeTimeframe: action.payload };
    case 'TOGGLE_OVERLAY': {
      const overlays = state.activeOverlays.includes(action.payload)
        ? state.activeOverlays.filter(o => o !== action.payload)
        : [...state.activeOverlays, action.payload];
      setItem('activeOverlays', overlays);
      return { ...state, activeOverlays: overlays };
    }
    case 'ADD_TO_WATCHLIST':
      if (state.watchlist.includes(action.payload)) return state;
      const newList = [...state.watchlist, action.payload];
      setItem('watchlist', newList);
      return { ...state, watchlist: newList };
    case 'REMOVE_FROM_WATCHLIST': {
      const filtered = state.watchlist.filter(s => s !== action.payload);
      setItem('watchlist', filtered);
      return { ...state, watchlist: filtered };
    }
    case 'SET_THEME':
      setItem('theme', action.payload);
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

export function DashboardProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, init);

  useEffect(() => {
    document.body.className = `theme-${state.theme}`;
  }, [state.theme]);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}
