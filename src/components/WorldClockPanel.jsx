import { useState, useEffect } from 'react';

// Bloomberg WCV — world clocks with day/night and market-session state.
const CITIES = [
  { city: 'New York',  code: 'US', tz: 'America/New_York',  open: [9, 30], close: [16, 0] },
  { city: 'London',    code: 'GB', tz: 'Europe/London',     open: [8, 0],  close: [16, 30] },
  { city: 'Frankfurt', code: 'DE', tz: 'Europe/Berlin',     open: [9, 0],  close: [17, 30] },
  { city: 'Dubai',     code: 'AE', tz: 'Asia/Dubai',        open: [10, 0], close: [14, 0] },
  { city: 'Hong Kong', code: 'HK', tz: 'Asia/Hong_Kong',    open: [9, 30], close: [16, 0] },
  { city: 'Tokyo',     code: 'JP', tz: 'Asia/Tokyo',        open: [9, 0],  close: [15, 0] },
  { city: 'Sydney',    code: 'AU', tz: 'Australia/Sydney',  open: [10, 0], close: [16, 0] },
];

// Parts of a Date in a given IANA timezone, without extra deps.
function zonedParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // some engines emit 24 at midnight
  return { weekday: parts.weekday, hour, minute: parseInt(parts.minute, 10), second: parseInt(parts.second, 10) };
}

// UTC offset in hours for a timezone at a given instant.
function offsetHours(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'shortOffset',
  });
  const name = dtf.formatToParts(date).find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
  const m = name.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  return parseInt(m[1], 10) + (m[2] ? Math.sign(parseInt(m[1], 10)) * parseInt(m[2], 10) / 60 : 0);
}

function isOpen(p, open, close) {
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  const mins = p.hour * 60 + p.minute;
  return mins >= open[0] * 60 + open[1] && mins < close[0] * 60 + close[1];
}

export default function WorldClockPanel() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="panel">
      <h3 className="panel-title">World Clocks <span className="panel-code">WCV</span></h3>
      <div className="wcv-list">
        {CITIES.map(c => {
          const p = zonedParts(now, c.tz);
          const day = p.hour >= 6 && p.hour < 18;
          const open = isOpen(p, c.open, c.close);
          const off = offsetHours(now, c.tz);
          const offStr = `UTC${off >= 0 ? '+' : ''}${off}`;
          const hh = String(p.hour).padStart(2, '0');
          const mm = String(p.minute).padStart(2, '0');
          const ss = String(p.second).padStart(2, '0');
          return (
            <div key={c.city} className="wcv-row">
              <span className="wcv-glyph" title={day ? 'day' : 'night'}>{day ? '☀' : '☾'}</span>
              <span className="wcv-time">{hh}:{mm}<span className="wcv-sec">:{ss}</span></span>
              <span className="wcv-city">{c.city}<span className="wcv-code"> {c.code}</span></span>
              <span className="wcv-off">{offStr}</span>
              <span className={`wcv-session ${open ? 'open' : 'closed'}`}>{open ? 'OPEN' : 'CLOSED'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
