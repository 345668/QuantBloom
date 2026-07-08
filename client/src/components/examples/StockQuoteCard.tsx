import StockQuoteCard from '../StockQuoteCard';

export default function StockQuoteCardExample() {
  // todo: remove mock functionality
  return (
    <div className="p-4 space-y-4">
      <StockQuoteCard
        symbol="AAPL"
        name="Apple Inc."
        price={178.85}
        change={2.45}
        changePercent={1.39}
        volume={52400000}
        marketCap={2800000000000}
        pe={28.5}
        high52Week={199.62}
        low52Week={164.08}
      />
      <StockQuoteCard
        symbol="TSLA"
        name="Tesla, Inc."
        price={248.42}
        change={-5.23}
        changePercent={-2.06}
        volume={89200000}
        marketCap={790000000000}
        pe={65.2}
        high52Week={299.29}
        low52Week={138.80}
      />
    </div>
  );
}