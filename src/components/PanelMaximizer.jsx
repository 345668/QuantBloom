import { useEffect, useRef, useState } from 'react';

/**
 * Pop any panel out into its own browser window with a keyboard shortcut — no
 * changes to the ~40 individual panels.
 *
 *   Ctrl/Cmd+Shift+M  → open the panel under the cursor in a new window
 *
 * It opens a new window at ?solo=<panel index>; the fresh app instance there
 * focuses that one panel full-window (SoloFocus), so the popped-out panel is
 * fully live and interactive with its own data. If the browser blocks the
 * pop-up, it falls back to an in-place full-screen overlay (Esc to restore).
 */
export default function PanelMaximizer() {
  const mouse = useRef({ x: 0, y: 0 });
  const [inPlace, setInPlace] = useState(null);
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem('qb_popout_hint') === '1'; } catch { return false; }
  });

  const restore = () => {
    if (inPlace) { inPlace.classList.remove('panel-maximized'); setInPlace(null); }
  };

  const popOut = () => {
    const el = document.elementFromPoint(mouse.current.x, mouse.current.y);
    const panel = el?.closest?.('.panel');
    if (!panel) return;
    if (!hintSeen) { try { localStorage.setItem('qb_popout_hint', '1'); } catch {} setHintSeen(true); }

    const panels = [...document.querySelectorAll('.panel')];
    const idx = panels.indexOf(panel);
    const title = (panel.querySelector('.panel-title')?.firstChild?.textContent || 'Panel').trim();
    const url = `${location.pathname}?solo=${idx}&t=${encodeURIComponent(title)}`;
    const win = window.open(url, `qb_panel_${idx}`, 'popup,width=1200,height=820,noopener=no');

    if (!win) {
      // Pop-up blocked → in-place full-screen fallback.
      if (panel.classList.contains('panel-maximized')) { restore(); return; }
      if (inPlace) inPlace.classList.remove('panel-maximized');
      panel.classList.add('panel-maximized');
      setInPlace(panel);
    }
  };

  useEffect(() => {
    const onMove = e => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        popOut();
      } else if (e.key === 'Escape' && inPlace) {
        restore();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey); };
  });

  useEffect(() => {
    if (inPlace) { const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60); return () => clearTimeout(t); }
  }, [inPlace]);

  return (
    <>
      {inPlace && <div className="panel-maximize-backdrop" onClick={restore} />}
      {inPlace && <button className="panel-maximize-close" onClick={restore} title="Restore (Esc)">✕ close</button>}
      {!hintSeen && (
        <div className="panel-maximize-hint">⤢ Ctrl+Shift+M pops the panel under your cursor into a new window</div>
      )}
    </>
  );
}
