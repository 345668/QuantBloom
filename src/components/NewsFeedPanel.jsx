import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { formatTime } from '../utils/format.js';

const SENTIMENT_COLORS = {
  bullish: 'sentiment-bullish',
  bearish: 'sentiment-bearish',
  neutral: 'sentiment-neutral',
};

export default function NewsFeedPanel() {
  const { dispatch } = useDashboard();
  const { data: articles, loading } = usePolling('/api/v1/news?limit=20', 60000);
  const items = Array.isArray(articles) ? articles : [];

  function handleClick(article) {
    if (article.relatedSymbol) {
      dispatch({ type: 'SET_SYMBOL', payload: article.relatedSymbol });
    }
    window.open(article.url, '_blank', 'noopener');
  }

  return (
    <div className="news-panel">
      <div className="panel-header-row">
        <span className="panel-label">MARKET NEWS</span>
        <span className="live-badge">LIVE</span>
      </div>
      <div className="news-list">
        {loading && items.length === 0 && (
          <div className="panel-loading">Loading news...</div>
        )}
        {items.map(article => (
          <button
            key={article.id}
            className="news-item"
            onClick={() => handleClick(article)}
          >
            <div className="news-meta">
              <span className={`sentiment-badge ${SENTIMENT_COLORS[article.sentiment]}`}>
                {article.sentiment?.toUpperCase()}
              </span>
              <span className="news-source">{article.source}</span>
              <span className="news-time">{formatTime(article.publishedAt)}</span>
            </div>
            <div className="news-headline">{article.headline}</div>
            {article.relatedSymbol && (
              <span className="news-symbol-tag">{article.relatedSymbol}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
