import PortfolioPanel from '../PortfolioPanel';

export default function PortfolioPanelExample() {
  // todo: remove mock functionality
  const mockPositions = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      quantity: 100,
      avgPrice: 150.25,
      currentPrice: 178.85,
      marketValue: 17885.00,
      unrealizedPnL: 2860.00,
      unrealizedPnLPercent: 19.03
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      quantity: 50,
      avgPrice: 130.80,
      currentPrice: 125.30,
      marketValue: 6265.00,
      unrealizedPnL: -275.00,
      unrealizedPnLPercent: -4.20
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      quantity: 75,
      avgPrice: 385.50,
      currentPrice: 415.20,
      marketValue: 31140.00,
      unrealizedPnL: 2227.50,
      unrealizedPnLPercent: 7.70
    },
    {
      symbol: "TSLA",
      name: "Tesla, Inc.",
      quantity: 25,
      avgPrice: 265.80,
      currentPrice: 248.42,
      marketValue: 6210.50,
      unrealizedPnL: -434.50,
      unrealizedPnLPercent: -6.54
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      quantity: 10,
      avgPrice: 820.00,
      currentPrice: 892.50,
      marketValue: 8925.00,
      unrealizedPnL: 725.00,
      unrealizedPnLPercent: 8.84
    }
  ];

  const totalValue = mockPositions.reduce((sum, pos) => sum + pos.marketValue, 0);
  const totalPnL = mockPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalCost = mockPositions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0);
  const totalPnLPercent = (totalPnL / totalCost) * 100;

  const handlePositionClick = (symbol: string) => {
    console.log('Position clicked:', symbol);
  };

  return (
    <div className="p-4">
      <PortfolioPanel 
        positions={mockPositions}
        totalValue={totalValue}
        totalPnL={totalPnL}
        totalPnLPercent={totalPnLPercent}
        onPositionClick={handlePositionClick}
      />
    </div>
  );
}