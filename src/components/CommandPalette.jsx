import { useEffect, useRef, useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { buildCommands } from '../lib/command.js';

/**
 * Bloomberg-style command palette (Ctrl/Cmd+K) — the "TICKER <GO>" interaction.
 * Type a ticker to set the active symbol across the terminal, or a panel name to
 * jump to it. Arrow keys to move, Enter to run, Esc to close.
 */
export default function CommandPalette() {
  const { dispatch } = useDashboard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  // Snapshot the panels (title + element) whenever the palette opens.
  const [panels, setPanels] = useState([]);
  const openPalette = () => {
    const found = [...document.querySelectorAll('.panel')].map(el => ({
      el, title: (el.querySelector('.panel-title')?.firstChild?.textContent || '').trim(),
    })).filter(p => p.title);
    setPanels(found); setQuery(''); setSel(0); setOpen(true);
  };

  const commands = useMemo(() => buildCommands(query, panels.map(p => p.title)), [query, panels]);

  const run = (cmd) => {
    if (!cmd) return;
    if (cmd.type === 'symbol') {
      dispatch({ type: 'SET_SYMBOL', payload: cmd.symbol });
      window.dispatchEvent(new Event('resize'));
    } else if (cmd.type === 'panel') {
      const target = panels[cmd.index]?.el;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('panel-flash');
        setTimeout(() => target.classList.remove('panel-flash'), 1300);
      }
    }
    setOpen(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open ? setOpen(false) : openPalette(); return; }
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, commands.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); run(commands[sel] || commands[0]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  useEffect(() => { setSel(0); }, [query]);

  if (!open) return null;
  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <span className="cmdk-prompt">›</span>
          <input ref={inputRef} className="cmdk-input" value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a ticker (AAPL) or a panel (Power Desk)…" />
          <kbd className="cmdk-esc">ESC</kbd>
        </div>
        <div className="cmdk-results">
          {commands.length === 0 && <div className="cmdk-empty">{query ? 'No matches' : 'Enter a ticker or panel name'}</div>}
          {commands.slice(0, 8).map((c, i) => (
            <button key={i} className={`cmdk-item ${i === sel ? 'active' : ''}`}
              onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <span className={`cmdk-tag ${c.type}`}>{c.type === 'symbol' ? 'SYMBOL' : 'GO'}</span>
              <span className="cmdk-label">{c.label}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot">↑↓ navigate · ↵ run · Ctrl/⌘+K toggle</div>
      </div>
    </div>
  );
}
