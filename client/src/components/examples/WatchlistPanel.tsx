import WatchlistPanel from '../WatchlistPanel';

export default function WatchlistPanelExample() {
  // todo: remove mock functionality
  const mockWatchlist = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 178.85,
      change: 2.45,
      changePercent: 1.39,
      volume: 52400000
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 125.30,
      change: -1.85,
      changePercent: -1.45,
      volume: 28900000
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      price: 415.20,
      change: 8.75,
      changePercent: 2.15,
      volume: 31200000
    },
    {
      symbol: "TSLA",
      name: "Tesla, Inc.",
      price: 248.42,
      change: -5.23,
      changePercent: -2.06,
      volume: 89200000
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      price: 892.50,
      change: 15.30,
      changePercent: 1.74,
      volume: 42100000
    }
  ];

  const handleAddSymbol = (symbol: string) => {
    console.log('Add symbol triggered:', symbol);
  };

  const handleRemoveSymbol = (symbol: string) => {
    console.log('Remove symbol triggered:', symbol);
  };

  const handleSymbolClick = (symbol: string) => {
    console.log('Symbol clicked:', symbol);
  };

  return (
    <div className="p-4">
      <WatchlistPanel 
        watchlist={mockWatchlist}
        onAddSymbol={handleAddSymbol}
        onRemoveSymbol={handleRemoveSymbol}
        onSymbolClick={handleSymbolClick}
      />
    </div>
  );
}