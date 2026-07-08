import TradingChart from '../TradingChart';

export default function TradingChartExample() {
  // todo: remove mock functionality
  const mockData = [
    { timestamp: "09:30", open: 175.20, high: 176.80, low: 174.90, close: 176.45, volume: 8500000 },
    { timestamp: "10:00", open: 176.45, high: 177.20, low: 176.10, close: 176.85, volume: 6200000 },
    { timestamp: "10:30", open: 176.85, high: 178.40, low: 176.70, close: 178.20, volume: 9100000 },
    { timestamp: "11:00", open: 178.20, high: 179.10, low: 177.80, close: 178.95, volume: 7800000 },
    { timestamp: "11:30", open: 178.95, high: 179.50, low: 178.30, close: 179.25, volume: 5600000 },
    { timestamp: "12:00", open: 179.25, high: 179.85, low: 178.90, close: 179.60, volume: 4900000 },
    { timestamp: "12:30", open: 179.60, high: 180.20, low: 179.40, close: 179.85, volume: 6700000 },
    { timestamp: "13:00", open: 179.85, high: 180.45, low: 179.20, close: 180.10, volume: 8200000 },
    { timestamp: "13:30", open: 180.10, high: 180.90, low: 179.95, close: 180.75, volume: 7300000 },
    { timestamp: "14:00", open: 180.75, high: 181.20, low: 180.40, close: 180.95, volume: 6800000 },
    { timestamp: "14:30", open: 180.95, high: 181.50, low: 180.60, close: 181.30, volume: 5900000 },
    { timestamp: "15:00", open: 181.30, high: 181.80, low: 181.10, close: 181.65, volume: 7100000 },
    { timestamp: "15:30", open: 181.65, high: 182.10, low: 181.40, close: 181.85, volume: 8400000 },
    { timestamp: "16:00", open: 181.85, high: 182.30, low: 181.70, close: 182.15, volume: 9600000 }
  ];

  const handleIntervalChange = (interval: string) => {
    console.log('Chart interval changed:', interval);
  };

  return (
    <div className="p-4">
      <TradingChart 
        symbol="AAPL" 
        data={mockData}
        interval="1D"
        onIntervalChange={handleIntervalChange}
      />
    </div>
  );
}