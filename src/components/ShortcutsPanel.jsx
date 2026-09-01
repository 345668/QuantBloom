const SHORTCUTS = [
  { keys: 'Ctrl / ⌘ + K', desc: 'Command palette — type a ticker to set the active symbol, or a panel name to jump to it' },
  { keys: 'Ctrl / ⌘ + Shift + M', desc: 'Pop the panel under the cursor into its own live window' },
  { keys: '↑ ↓ / ↵ / Esc', desc: 'In the palette: navigate, run, and close' },
];

const TIPS = [
  'Hover a panel, then press Ctrl+Shift+M — it opens in a new browser window with its own live data, so you can spread panels across monitors.',
  'If your browser blocks the pop-up, the panel expands full-screen in place instead; press Esc to restore it.',
  'Each popped-out window is the real panel, fully interactive — change symbols, tabs and inputs independently.',
];

export default function ShortcutsPanel() {
  return (
    <div className="panel shortcuts-panel">
      <h3 className="panel-title">Help &amp; Shortcuts <span className="panel-badge">info</span></h3>

      <table className="shortcuts-table">
        <tbody>
          {SHORTCUTS.map(s => (
            <tr key={s.keys}>
              <td><kbd className="sc-kbd">{s.keys}</kbd></td>
              <td className="sc-desc">{s.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="sub-title">Pop-out windows</h4>
      <ul className="sc-tips">
        {TIPS.map((t, i) => <li key={i}>{t}</li>)}
      </ul>

      <p className="model-note">
        The command palette (Ctrl+K) is the Bloomberg "TICKER &lt;GO&gt;" pattern:
        one box to jump anywhere in the terminal.
      </p>
    </div>
  );
}
