import NewsPanel from '../NewsPanel';

export default function NewsPanelExample() {
  // todo: remove mock functionality
  const mockNews = [
    {
      id: "1",
      title: "Apple Reports Record Q4 Earnings, iPhone Sales Surge 15%",
      summary: "Apple Inc. announced its fourth-quarter earnings today, showing a 15% increase in iPhone sales year-over-year. The company attributed the growth to strong demand for the latest iPhone models and expansion in emerging markets.",
      source: "Reuters",
      publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      url: "https://example.com/news/1",
      symbol: "AAPL",
      sentiment: "positive" as const
    },
    {
      id: "2",
      title: "Fed Signals Potential Rate Cuts in 2024 Following Inflation Data",
      summary: "The Federal Reserve hinted at possible interest rate reductions in the coming year after new inflation data showed a continued downward trend. Markets responded positively to the announcement during today's FOMC meeting.",
      source: "Bloomberg",
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      url: "https://example.com/news/2",
      sentiment: "positive" as const
    },
    {
      id: "3",
      title: "Tesla Stock Drops 3% After Production Concerns Emerge",
      summary: "Tesla shares fell in pre-market trading following reports of potential production delays at the company's Shanghai facility. Analysts are monitoring the situation closely as it could impact Q1 delivery targets.",
      source: "CNBC",
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      url: "https://example.com/news/3",
      symbol: "TSLA",
      sentiment: "negative" as const
    },
    {
      id: "4",
      title: "Microsoft Azure Revenue Grows 29% as Cloud Competition Intensifies",
      summary: "Microsoft's cloud computing division reported strong quarterly growth, with Azure revenue increasing 29% year-over-year. The company continues to compete aggressively with Amazon Web Services and Google Cloud.",
      source: "Wall Street Journal",
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      url: "https://example.com/news/4",
      symbol: "MSFT",
      sentiment: "positive" as const
    },
    {
      id: "5",
      title: "Oil Prices Rise 2% on Supply Concerns and Geopolitical Tensions",
      summary: "Crude oil futures climbed higher today amid concerns about global supply disruptions and ongoing geopolitical tensions in the Middle East. Energy sector stocks are showing mixed performance in response.",
      source: "MarketWatch",
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      url: "https://example.com/news/5",
      sentiment: "neutral" as const
    }
  ];

  const handleNewsClick = (newsItem: any) => {
    console.log('News item clicked:', newsItem.title);
  };

  const handleFilterBySymbol = (symbol?: string) => {
    console.log('Filter by symbol:', symbol);
  };

  return (
    <div className="p-4">
      <NewsPanel 
        news={mockNews}
        onNewsClick={handleNewsClick}
        onFilterBySymbol={handleFilterBySymbol}
      />
    </div>
  );
}