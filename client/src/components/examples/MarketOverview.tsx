import MarketOverview from '../MarketOverview';

export default function MarketOverviewExample() {
  // todo: remove mock functionality
  const mockIndices = [
    {
      name: "S&P 500",
      symbol: "SPX",
      value: 4567.89,
      change: 23.45,
      changePercent: 0.52
    },
    {
      name: "Dow Jones Industrial Average",
      symbol: "DJI",
      value: 35428.67,
      change: -89.23,
      changePercent: -0.25
    },
    {
      name: "NASDAQ Composite",
      symbol: "IXIC",
      value: 14258.49,
      change: 67.82,
      changePercent: 0.48
    },
    {
      name: "Russell 2000",
      symbol: "RUT",
      value: 1987.54,
      change: 12.34,
      changePercent: 0.63
    },
    {
      name: "VIX",
      symbol: "VIX",
      value: 18.76,
      change: -2.14,
      changePercent: -10.24
    }
  ];

  return (
    <div className="p-4">
      <MarketOverview 
        indices={mockIndices}
        marketStatus="OPEN"
      />
    </div>
  );
}