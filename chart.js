// chart.js - every chart drawn on <canvas>, devicePixelRatio aware. No library.
(function(){
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const COL = {green:'#00d35a', red:'#ff453a', blue:'#0a84ff', orange:'#ff9f0a', cyan:'#64d2ff', t2:'rgba(235,235,245,0.6)', t3:'rgba(235,235,245,0.3)', c2:'#2c2c2e', sep:'rgba(84,84,88,0.55)'};
function setup(cv){
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (cv.width !== w*dpr || cv.height !== h*dpr){ cv.width = w*dpr; cv.height = h*dpr; }
  const x = cv.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); x.clearRect(0,0,w,h); return {x, w, h};
}
function dotted(x, w, y){ x.setLineDash([0, 6]); x.lineCap = 'round'; x.strokeStyle = 'rgba(235,235,245,0.35)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(4, y); x.lineTo(w - 4, y); x.stroke(); x.setLineDash([]); x.lineCap = 'butt'; }
const FONT = '600 12px -apple-system, "SF Pro Text", system-ui, sans-serif';

// Home line chart. data = chart_{RANGE}.json. Animates a new last point (250ms) and fades new marks (200ms).
function line(cv, data, prev){
  const pts = (data && data.points) || [], start = data ? data.startValue : null;
  const seen = new Set(((prev && prev.marks) || []).map(m => m.ts + m.text));
  const grow = prev && prev.points && prev.points.length && pts.length > prev.points.length && prev.range === data.range && !RM();
  const t0 = performance.now();
  function frame(now){
    const k = grow ? Math.min(1, (now - t0) / 250) : 1, ka = RM() ? 1 : Math.min(1, (now - t0) / 200);
    const {x, w, h} = setup(cv), top = 44, bot = h - 10;   // flat/empty handled below
    if (!pts.length){                       // empty: dashed start line only
      dotted(x, w, h * 0.62); return;
    }
    if (cv.dataset.flat){ dotted(x, w, h * 0.62); return; }   // no trades: flat start stack as a dotted baseline
    const vals = pts.map(p => p[1]).concat(start != null ? [start] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1e-9){ lo -= 1; hi += 1; } const pad = (hi-lo)*0.08; lo -= pad; hi += pad;
    const t1 = pts[0][0], t2 = pts[pts.length-1][0], span = Math.max(1, t2 - t1);
    const X = t => pts.length < 2 ? w : (t - t1) / span * w, Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
    let P = pts.map(p => [X(p[0]), Y(p[1])]);
    if (grow && P.length > 1){ const a = P[P.length-2], b = P[P.length-1]; P[P.length-1] = [a[0] + (b[0]-a[0])*k, a[1] + (b[1]-a[1])*k]; }
    if (start != null){ x.setLineDash([4,4]); x.strokeStyle = COL.t3; x.lineWidth = 1; x.beginPath(); x.moveTo(0, Y(start)); x.lineTo(w, Y(start)); x.stroke(); x.setLineDash([]); }
    const g = x.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(0,211,90,0.28)'); g.addColorStop(1, 'rgba(0,211,90,0)');
    x.beginPath(); P.forEach((p,i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.lineTo(P[P.length-1][0], bot); x.lineTo(P[0][0], bot); x.closePath(); x.fillStyle = g; x.fill();
    x.beginPath(); P.forEach((p,i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.strokeStyle = COL.green; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    // marks above the line; never overlap: a later mark moves up a row
    x.font = FONT; const rows = []; const RH = 20;
    ((data && data.marks) || []).forEach(m => {
      if (m.ts < t1 - 60) return;
      const mx = Math.min(Math.max(X(Math.min(m.ts, t2)), 4), w - 4), tw = x.measureText(m.text).width + 14;
      let lx = Math.min(Math.max(mx - tw/2, 0), w - tw);
      const near = pts.reduce((b, p) => Math.abs(p[0]-m.ts) < Math.abs(b[0]-m.ts) ? p : b, pts[0]);
      let row = 0; while ((rows[row] || []).some(s => lx < s[1] + 4 && lx + tw > s[0] - 4)) row++;
      (rows[row] = rows[row] || []).push([lx, lx + tw]);
      const ly = Math.max(2, Math.min(Y(near[1]) - 30, top - 4) - row * RH);
      x.globalAlpha = seen.has(m.ts + m.text) ? 1 : ka;
      const c = COL[m.color] || COL.blue;
      x.fillStyle = c; x.beginPath(); x.roundRect ? x.roundRect(lx, ly, tw, 18, 9) : x.rect(lx, ly, tw, 18); x.fill();
      x.fillStyle = m.color === 'green' ? '#000' : '#fff'; x.fillText(m.text, lx + 7, ly + 13);
      x.strokeStyle = c; x.lineWidth = 1; x.beginPath(); x.moveTo(mx, ly + 18); x.lineTo(mx, Y(near[1])); x.stroke();
      x.globalAlpha = 1;
    });
    if (k < 1 || ka < 1) requestAnimationFrame(frame);
  }
  frame(performance.now());
}

// Coin candles + volume bars + orange dashed exit line.
function candles(cv, cs, exitLine){
  const {x, w, h} = setup(cv); const vh = 40, top = 8, bot = h - vh - 8;
  if (!cs || !cs.length) return;
  let lo = Math.min(...cs.map(c => c.l)), hi = Math.max(...cs.map(c => c.h));
  if (exitLine != null){ lo = Math.min(lo, exitLine); hi = Math.max(hi, exitLine); }
  if (hi - lo <= 0){ hi *= 1.01; lo *= 0.99; } const pad = (hi-lo)*0.08; lo -= pad; hi += pad;
  const n = Math.max(cs.length, 20), cw = w / n, Y = v => bot - (v - lo)/(hi - lo)*(bot - top);
  const vmax = Math.max(...cs.map(c => c.v || 0), 0);
  cs.forEach((c, i) => {
    const cx = (i + 0.5) * cw + (n - cs.length) * cw, up = c.c >= c.o, col = up ? COL.green : COL.red;
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx, Y(c.h)); x.lineTo(cx, Y(c.l)); x.stroke();
    const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); x.fillRect(cx - cw*0.35, y1, cw*0.7, Math.max(1, y2 - y1));
    if (vmax > 0 && c.v > 0){ const bh = c.v / vmax * vh; x.globalAlpha = 0.5; x.fillRect(cx - cw*0.35, h - bh, cw*0.7, bh); x.globalAlpha = 1; }
  });
  if (exitLine != null){
    const y = Y(exitLine); x.setLineDash([5,4]); x.strokeStyle = COL.orange; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); x.setLineDash([]);
    x.font = FONT; x.fillStyle = COL.orange; x.fillText('Risk trailing stop', 4, y - 5);
  }
}

// Analyst score ring 0-100, green from `greenFrom`.
function ring(cv, score, greenFrom){
  const {x, w, h} = setup(cv), r = Math.min(w, h)/2 - 7, cx = w/2, cy = h/2;
  x.lineWidth = 10; x.lineCap = 'round'; x.strokeStyle = COL.c2; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI*2); x.stroke();
  if (score != null){
    x.strokeStyle = score >= greenFrom ? COL.green : '#ffd60a';
    x.beginPath(); x.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.max(0, Math.min(100, score))/100); x.stroke();
  }
  x.fillStyle = '#fff'; x.font = '600 ' + Math.round(r*0.6) + 'px -apple-system, "SF Pro Display", system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(score == null ? '—' : String(Math.round(score)), cx, cy);
}
window.DeskChart = {line, candles, ring};
})();
