const SHORTCUTS = [
  { keys: 'Ctrl / ⌘ + Shift + M', desc: 'Pop the panel under the cursor into its own live window' },
  { keys: 'Esc', desc: 'Restore a panel (when popped out in-place because the pop-up was blocked)' },
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
        More Bloomberg-style shortcuts (a Ctrl+K command palette, symbol jump) are
        on the roadmap — see POWER_MARKETS_PLAN.md, Track 3.
      </p>
    </div>
  );
}
