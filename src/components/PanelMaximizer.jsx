import { useEffect, useRef, useState } from 'react';

/**
 * Pop any panel out to (near) full-screen with a keyboard shortcut — no changes
 * to the ~40 individual panels. It operates on the shared `.panel` DOM class:
 *
 *   Ctrl+Shift+M  → maximise the panel currently under the mouse cursor
 *   Esc / ✕ / backdrop click → restore
 *
 * Because it toggles a CSS class on the existing DOM node, the panel keeps all
 * its React state and live data while enlarged.
 */
export default function PanelMaximizer() {
  const mouse = useRef({ x: 0, y: 0 });
  const [maximized, setMaximized] = useState(null); // the maximized .panel element
  const [hintSeen, setHintSeen] = useState(() => {
    try { return localStorage.getItem('qb_maximize_hint') === '1'; } catch { return false; }
  });

  const restore = () => {
    if (maximized) {
      maximized.classList.remove('panel-maximized');
      setMaximized(null);
    }
  };

  const maximizeUnderCursor = () => {
    const el = document.elementFromPoint(mouse.current.x, mouse.current.y);
    const panel = el?.closest?.('.panel');
    if (!panel) return;
    // Toggle: if this one is already maximized, restore it.
    if (panel.classList.contains('panel-maximized')) { restore(); return; }
    if (maximized) maximized.classList.remove('panel-maximized');
    panel.classList.add('panel-maximized');
    setMaximized(panel);
    if (!hintSeen) { try { localStorage.setItem('qb_maximize_hint', '1'); } catch {} setHintSeen(true); }
  };

  useEffect(() => {
    const onMove = e => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onKey = e => {
      // Ctrl+Shift+M (or Cmd+Shift+M on macOS) toggles the panel under the cursor.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        maximizeUnderCursor();
      } else if (e.key === 'Escape' && maximized) {
        restore();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey); };
  });

  // Repaint charts inside the panel after it resizes (lightweight-charts et al.
  // listen to window resize / their own ResizeObserver).
  useEffect(() => {
    if (maximized) {
      const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
      return () => clearTimeout(t);
    }
  }, [maximized]);

  return (
    <>
      {maximized && <div className="panel-maximize-backdrop" onClick={restore} />}
      {maximized && (
        <button className="panel-maximize-close" onClick={restore} title="Restore (Esc)">✕ close</button>
      )}
      {!hintSeen && (
        <div className="panel-maximize-hint">⤢ Ctrl+Shift+M expands the panel under your cursor</div>
      )}
    </>
  );
}
