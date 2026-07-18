import { useDashboard } from '../context/DashboardContext.jsx';
import { usePolling } from '../hooks/usePolling.js';

const TYPE_CLASSES = {
  earnings: 'cal-earnings',
  fed: 'cal-fed',
  macro: 'cal-macro',
};

const TYPE_LABELS = {
  earnings: 'EPS',
  fed: 'FED',
  macro: 'MACRO',
};

function formatCalDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CalendarPanel() {
  const { dispatch } = useDashboard();
  const { data: events, loading } = usePolling('/api/v1/calendar?days=6', 3600000);
  const items = Array.isArray(events) ? events : [];

  function handleClick(ev) {
    if (ev.type === 'earnings' && ev.symbol) {
      dispatch({ type: 'SET_SYMBOL', payload: ev.symbol });
    }
  }

  return (
    <div className="calendar-panel">
      <div className="panel-header-row">
        <span className="panel-label">ECONOMIC CALENDAR</span>
      </div>
      <div className="calendar-table">
        <div className="cal-header-row">
          <span className="cal-col-date">DATE</span>
          <span className="cal-col-time">TIME</span>
          <span className="cal-col-type">TYPE</span>
          <span className="cal-col-event">EVENT</span>
          <span className="cal-col-exp">EXP</span>
          <span className="cal-col-prior">PRIOR</span>
        </div>
        {loading && items.length === 0 && (
          <div className="panel-loading">Loading calendar...</div>
        )}
        {items.map((ev, i) => (
          <button
            key={`${ev.date}-${ev.title}-${i}`}
            className={`cal-row ${ev.type === 'earnings' && ev.symbol ? 'clickable' : ''}`}
            onClick={() => handleClick(ev)}
          >
            <span className="cal-col-date">{formatCalDate(ev.date)}</span>
            <span className="cal-col-time">{ev.time}</span>
            <span className={`cal-col-type ${TYPE_CLASSES[ev.type]}`}>
              {TYPE_LABELS[ev.type] || ev.type}
            </span>
            <span className="cal-col-event">{ev.title}</span>
            <span className="cal-col-exp">{ev.expected || '—'}</span>
            <span className="cal-col-prior">{ev.prior || '—'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
