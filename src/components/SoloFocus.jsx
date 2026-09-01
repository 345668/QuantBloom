import { useEffect } from 'react';

/**
 * In a popped-out window (?solo=<index>), focus a single panel full-window.
 * The window loads the full app — so the .panel DOM order matches the opener —
 * then this hides all other rows and stretches the target panel. The panel is
 * the real, live component (its own data polling), fully interactive.
 */
export default function SoloFocus() {
  const params = new URLSearchParams(window.location.search);
  const solo = params.get('solo');
  const title = params.get('t') || 'Panel';

  useEffect(() => {
    if (solo == null) return;
    const idx = parseInt(solo, 10);
    document.body.classList.add('solo-mode');

    let tries = 0;
    let timer;
    const focus = () => {
      const panels = [...document.querySelectorAll('.panel')];
      const target = panels[idx];
      if (!target) { if (tries++ < 25) { timer = setTimeout(focus, 120); } return; }

      // Belt-and-suspenders: hide the terminal chrome directly (a body class can
      // be toggled off by a dev StrictMode double-mount).
      document.body.classList.add('solo-mode');
      document.querySelectorAll('.nav-bar, .ticker-bar').forEach(el => { el.style.display = 'none'; });
      // Hide every row, then reveal the target's ancestor chain full-width.
      document.querySelectorAll('.dashboard-row').forEach(r => { r.style.display = 'none'; });
      let el = target;
      while (el && el !== document.body) {
        if (el.classList.contains('dashboard-row')) el.style.display = 'block';
        else if (el.classList.contains('col-wide') || el.classList.contains('col-side')) el.style.width = '100%';
        el = el.parentElement;
      }
      const row = target.closest('.dashboard-row');
      if (row) [...row.children].forEach(c => { if (!c.contains(target)) c.style.display = 'none'; });
      target.classList.add('solo-focus');
      window.dispatchEvent(new Event('resize'));
    };
    timer = setTimeout(focus, 150);
    // Keep the solo styling for the life of this dedicated window; only cancel a
    // pending focus attempt on unmount.
    return () => clearTimeout(timer);
  }, [solo]);

  if (solo == null) return null;
  return (
    <div className="solo-bar">
      <span>QUANTBLOOM · {title}</span>
      <button onClick={() => window.close()} title="Close window">✕ close window</button>
    </div>
  );
}
