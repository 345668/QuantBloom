import { useEffect, useRef, useState } from 'react';
import { buildField, driftPos, fieldRegime, topMovers, rgb } from '../lib/field.js';

// Canvas renderer for the market field. Nodes = instruments (size |move|,
// colour = regime), edges = same-sector "capital routes". Animated drift,
// a faint polar grid backdrop, sector anchors, and floating labels on the
// biggest movers.
export default function MarketFieldPanel({ sectors }) {
  const canvasRef = useRef(null);
  const fieldRef = useRef({ nodes: [], edges: [], width: 900, height: 460, sectorAnchors: {} });
  const labelsRef = useRef(new Set());
  const rafRef = useRef(0);
  const [regime, setRegime] = useState({ stress: 0, label: 'idle' });

  // Rebuild the field whenever the data changes.
  useEffect(() => {
    const el = canvasRef.current;
    const w = el?.clientWidth || 900;
    const f = buildField(sectors || {}, { width: w, height: 460 });
    fieldRef.current = f;
    labelsRef.current = new Set(topMovers(f.nodes, 12).map(n => n.symbol));
    setRegime(fieldRegime(f.nodes));
  }, [sectors]);

  // Animation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let running = true;
    const start = performance.now();

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(now) {
      if (!running) return;
      const t = (now - start) / 1000;
      const { nodes, edges, width, height, sectorAnchors } = fieldRef.current;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const sx = w / width, sy = h / height;
      ctx.clearRect(0, 0, w, h);

      // --- polar grid backdrop ---------------------------------------------
      const gcx = w / 2, gcy = h / 2;
      const gmax = Math.min(w, h) * 0.46;
      ctx.strokeStyle = 'rgba(255,140,0,0.05)';
      ctx.lineWidth = 0.5;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(gcx, gcy, (gmax * ring) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let spoke = 0; spoke < 12; spoke++) {
        const a = (spoke / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(gcx, gcy);
        ctx.lineTo(gcx + Math.cos(a) * gmax, gcy + Math.sin(a) * gmax);
        ctx.stroke();
      }

      // --- node positions ---------------------------------------------------
      const pos = {};
      for (const n of nodes) {
        const p = driftPos(n, t);
        pos[n.symbol] = { x: p.x * sx, y: p.y * sy };
      }

      // --- sector anchor labels (faint) ------------------------------------
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const [sector, a] of Object.entries(sectorAnchors || {})) {
        ctx.fillStyle = 'rgba(180,150,90,0.28)';
        ctx.fillText(sector.toUpperCase().slice(0, 14), a.x * sx, a.y * sy - 2);
      }

      // --- edges (capital routes), colour-graded by endpoints --------------
      ctx.lineWidth = 0.7;
      for (const e of edges) {
        const a = pos[e.a], b = pos[e.b];
        if (!a || !b) continue;
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, `rgba(255,150,40,${0.06 + e.w * 0.28})`);
        g.addColorStop(1, `rgba(255,90,30,${0.04 + e.w * 0.20})`);
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // --- nodes with a glow scaled by move magnitude ----------------------
      for (const n of nodes) {
        const p = pos[n.symbol];
        const mag = Math.min(1, Math.abs(n.change) / 4);
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.5 + n.phase * 6.28);
        ctx.fillStyle = rgb(n.color, (0.08 + mag * 0.18) * pulse);
        ctx.beginPath(); ctx.arc(p.x, p.y, n.r * (2.2 + mag * 1.6), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(n.color, 0.95);
        ctx.beginPath(); ctx.arc(p.x, p.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      // --- floating labels on the biggest movers ---------------------------
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      for (const n of nodes) {
        if (!labelsRef.current.has(n.symbol)) continue;
        const p = pos[n.symbol];
        const lx = p.x + n.r + 3, ly = p.y + 3;
        const label = `${n.symbol} ${n.change >= 0 ? '+' : ''}${n.change.toFixed(1)}%`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(lx - 2, ly - 8, ctx.measureText(label).width + 4, 11);
        ctx.fillStyle = rgb(n.color, 1);
        ctx.fillText(label, lx, ly);
      }

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="mc-field">
      <div className="mc-field-head">
        <span className="mc-field-title">MARKET FIELD</span>
        <span className={`mc-regime mc-regime-${regime.label}`}>
          REGIME · {regime.label.toUpperCase()} <span className="mc-stress">{Math.round(regime.stress * 100)}%</span>
        </span>
        <span className="mc-field-legend">
          <span className="mc-lg mc-lg-down" /> sell-off
          <span className="mc-lg mc-lg-flat" /> calm
          <span className="mc-lg mc-lg-up" /> rally
        </span>
        <span className="mc-field-note">// {fieldRef.current.nodes.length} instruments</span>
      </div>
      <canvas ref={canvasRef} className="mc-canvas" />
    </div>
  );
}
