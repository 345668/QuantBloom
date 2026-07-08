import StockScreener from '../StockScreener';

export default function StockScreenerExample() {
  // todo: remove mock functionality
  const mockResults = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 178.85,
      change: 2.45,
      changePercent: 1.39,
      volume: 52400000,
      marketCap: 2800000000000,
      pe: 28.5,
      dividendYield: 0.44
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 125.30,
      change: -1.85,
      changePercent: -1.45,
      volume: 28900000,
      marketCap: 1600000000000,
      pe: 24.8,
      dividendYield: 0.0
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      price: 415.20,
      change: 8.75,
      changePercent: 2.15,
      volume: 31200000,
      marketCap: 3100000000000,
      pe: 32.1,
      dividendYield: 0.68
    },
    {
      symbol: "TSLA",
      name: "Tesla, Inc.",
      price: 248.42,
      change: -5.23,
      changePercent: -2.06,
      volume: 89200000,
      marketCap: 790000000000,
      pe: 65.2,
      dividendYield: 0.0
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      price: 892.50,
      change: 15.30,
      changePercent: 1.74,
      volume: 42100000,
      marketCap: 2200000000000,
      pe: 71.4,
      dividendYield: 0.03
    },
    {
      symbol: "META",
      name: "Meta Platforms, Inc.",
      price: 325.75,
      change: -3.22,
      changePercent: -0.98,
      volume: 18500000,
      marketCap: 850000000000,
      pe: 22.9,
      dividendYield: 0.37
    },
    {
      symbol: "AMZN",
      name: "Amazon.com, Inc.",
      price: 142.80,
      change: 1.95,
      changePercent: 1.38,
      volume: 37200000,
      marketCap: 1500000000000,
      pe: 45.6,
      dividendYield: 0.0
    },
    {
      symbol: "NFLX",
      name: "Netflix, Inc.",
      price: 485.30,
      change: 12.45,
      changePercent: 2.63,
      volume: 8900000,
      marketCap: 215000000000,
      pe: 41.2,
      dividendYield: 0.0
    }
  ];

  const handleFilter = (filters: any) => {
    console.log('Filter applied:', filters);
  };

  const handleStockClick = (symbol: string) => {
    console.log('Stock clicked from screener:', symbol);
  };

  return (
    <div className="p-4">
      <StockScreener 
        results={mockResults}
        onFilter={handleFilter}
        onStockClick={handleStockClick}
      />
    </div>
  );
}