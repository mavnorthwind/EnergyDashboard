'use strict';

(function () {
  const C = CONFIG;
  const NS = 'http://www.w3.org/2000/svg';
  const COL = C.COLORS;

  let data = null;

  const fmtTime = new Intl.DateTimeFormat(C.LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: C.TIMEZONE });
  const fmtDate = new Intl.DateTimeFormat(C.LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: C.TIMEZONE });

  const $ = id => document.getElementById(id);
  const time = iso => fmtTime.format(new Date(iso));
  const price = p => p.toFixed(1);
  const duration = (a, b) => {
    const m = Math.round((new Date(b) - new Date(a)) / 60000);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  };
  const range = w => `${time(w.start)} – ${time(w.end)}`;
  const level = p => (p <= C.LOW_THRESHOLD ? 'low' : p > C.HIGH_THRESHOLD ? 'high' : 'mid');

  function el(name, attrs, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /** Monotone kubische Interpolation (Fritsch-Carlson) -> SVG-Pfad */
  function smoothPath(pts) {
    const n = pts.length;
    if (n < 2) return '';
    const dx = [], m = [], t = new Array(n);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
      t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    }
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    return d;
  }

  function renderChart() {
    const box = $('chart');
    box.innerHTML = '';
    if (!data || !data.today.length) return;

    const W = box.clientWidth, H = box.clientHeight;
    const M = { l: 32, r: 10, t: 34, b: 18 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const dayStart = new Date(data.dayStart).getTime();
    const tomStart = new Date(data.tomorrowStart).getTime();

    let yMin = C.Y_MIN, yMax = C.Y_MAX;
    for (const p of data.today.concat(data.tomorrow)) {
      yMin = Math.min(yMin, Math.floor(p.price / C.Y_STEP) * C.Y_STEP);
      yMax = Math.max(yMax, Math.ceil(p.price / C.Y_STEP) * C.Y_STEP);
    }
    const X = min => M.l + Math.max(0, Math.min(1440, min)) / 1440 * pw;
    const Y = v => M.t + (yMax - v) / (yMax - yMin) * ph;
    const xOf = (iso, base) => X((new Date(iso).getTime() - base) / 60000);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    const defs = el('defs', {});
    const grad = el('linearGradient', { id: 'fill', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': COL.line, 'stop-opacity': 0.45 }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': COL.line, 'stop-opacity': 0.03 }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Zonen
    if (data.lowWindow) {
      const x1 = xOf(data.lowWindow.start, dayStart), x2 = xOf(data.lowWindow.end, dayStart);
      svg.appendChild(el('rect', { x: x1, y: Y(C.LOW_THRESHOLD), width: x2 - x1, height: M.t + ph - Y(C.LOW_THRESHOLD), fill: COL.low, 'fill-opacity': 0.16 }));
      for (const x of [x1, x2]) svg.appendChild(el('line', { x1: x, x2: x, y1: Y(C.LOW_THRESHOLD), y2: M.t + ph, stroke: COL.low, 'stroke-dasharray': '3 3', 'stroke-width': 1 }));
    }
    if (data.highWindow) {
      const x1 = xOf(data.highWindow.start, dayStart), x2 = xOf(data.highWindow.end, dayStart);
      svg.appendChild(el('rect', { x: x1, y: M.t, width: x2 - x1, height: ph, fill: '#b5482a', 'fill-opacity': 0.22 }));
      for (const x of [x1, x2]) svg.appendChild(el('line', { x1: x, x2: x, y1: M.t, y2: M.t + ph, stroke: COL.high, 'stroke-dasharray': '3 3', 'stroke-width': 1 }));
    }

    // Gitter und Achsen
    for (let h = 3; h <= 21; h += 3) {
      const x = X(h * 60);
      svg.appendChild(el('line', { x1: x, x2: x, y1: M.t, y2: M.t + ph, stroke: '#16233a', 'stroke-width': 1 }));
    }
    for (let v = yMin; v <= yMax; v += C.Y_STEP) {
      if (v !== C.LOW_THRESHOLD && v !== C.HIGH_THRESHOLD && v !== yMin) {
        svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: Y(v), y2: Y(v), stroke: '#16233a', 'stroke-width': 1 }));
      }
      svg.appendChild(el('text', { x: M.l - 5, y: Y(v) + 3, 'text-anchor': 'end', fill: '#b8c4d4', 'font-size': 10 }, v));
    }
    svg.appendChild(el('line', { x1: M.l, x2: M.l, y1: M.t, y2: M.t + ph, stroke: '#3a4a60' }));
    svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: M.t + ph, y2: M.t + ph, stroke: '#3a4a60' }));
    for (let h = 0; h <= 24; h += 3) {
      const x = X(h * 60);
      svg.appendChild(el('line', { x1: x, x2: x, y1: M.t + ph, y2: M.t + ph + 3, stroke: '#3a4a60' }));
      svg.appendChild(el('text', { x, y: H - 4, 'text-anchor': h === 0 ? 'start' : h === 24 ? 'end' : 'middle', fill: '#b8c4d4', 'font-size': 10 }, String(h).padStart(2, '0') + ':00'));
    }

    // Schwellenlinien
    svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: Y(C.LOW_THRESHOLD), y2: Y(C.LOW_THRESHOLD), stroke: COL.low, 'stroke-dasharray': '4 3' }));
    svg.appendChild(el('line', { x1: M.l, x2: M.l + pw, y1: Y(C.HIGH_THRESHOLD), y2: Y(C.HIGH_THRESHOLD), stroke: COL.high, 'stroke-dasharray': '4 3' }));

    // Heutige Kurve
    const pts = data.today.map(p => [xOf(p.start, dayStart), Y(p.price)]);
    const last = data.today[data.today.length - 1];
    pts.push([xOf(last.end, dayStart), Y(last.price)]);
    const line = smoothPath(pts);
    const base = Y(Math.max(yMin, Math.min(yMax, 0)));
    svg.appendChild(el('path', { d: `${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z`, fill: 'url(#fill)' }));
    svg.appendChild(el('path', { d: line, fill: 'none', stroke: COL.line, 'stroke-width': 2, 'stroke-linejoin': 'round' }));

    // Morgen (gelb)
    if (data.tomorrow.length) {
      const tp = data.tomorrow.map(p => [xOf(p.start, tomStart), Y(p.price)]);
      const tl = data.tomorrow[data.tomorrow.length - 1];
      tp.push([xOf(tl.end, tomStart), Y(tl.price)]);
      svg.appendChild(el('path', { d: smoothPath(tp), fill: 'none', stroke: COL.tomorrow, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
    }

    // Maximum
    if (data.max) {
      svg.appendChild(el('circle', { cx: xOf(data.max.start, dayStart) + (xOf(data.max.end, dayStart) - xOf(data.max.start, dayStart)) / 2, cy: Y(data.max.price), r: 3.5, fill: COL.high, stroke: '#fff', 'stroke-width': 1 }));
    }

    // Jetzt-Marker
    if (data.current) {
      const nowMin = (Date.now() - dayStart) / 60000;
      const x = X(nowMin);
      const y = Y(data.current.price);
      const label = price(data.current.price);
      const bw = 44, bh = 28;
      const bx = Math.max(M.l, Math.min(M.l + pw - bw, x - bw / 2));
      const by = M.t - 4;
      const c = level(data.current.price) === 'high' ? COL.high : level(data.current.price) === 'low' ? COL.low : COL.line;
      svg.appendChild(el('line', { x1: x, x2: x, y1: by + bh, y2: y, stroke: '#cfd8e6', 'stroke-dasharray': '1 2' }));
      svg.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, rx: 4, fill: '#10301f', stroke: c }));
      svg.appendChild(el('text', { x: bx + bw / 2, y: by + 13, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-weight': 700 }, label));
      svg.appendChild(el('text', { x: bx + bw / 2, y: by + 23, 'text-anchor': 'middle', fill: '#b8c4d4', 'font-size': 8 }, 'ct/kWh'));
      svg.appendChild(el('circle', { cx: x, cy: y, r: 4.5, fill: c, stroke: '#fff', 'stroke-width': 1.5 }));
    }

    // Legende
    svg.appendChild(el('text', { x: M.l - 26, y: 20, fill: '#b8c4d4', 'font-size': 10 }, 'ct/kWh'));
    const items = [
      { c: COL.line, d: null, t: `Spot Price (ct/kWh)` },
      { c: COL.low, d: '3 2', t: `<= ${C.LOW_THRESHOLD} ct/kWh` },
      { c: COL.high, d: '3 2', t: `> ${C.HIGH_THRESHOLD} ct/kWh` }
    ];
    if (data.tomorrow.length) items.push({ c: COL.tomorrow, d: null, t: 'Tomorrow' });
    let lx = W - M.r;
    for (const it of items.slice().reverse()) {
      const tw = it.t.length * 4.8;
      lx -= tw;
      svg.appendChild(el('text', { x: lx, y: 14, fill: '#b8c4d4', 'font-size': 9 }, it.t));
      const ln = el('line', { x1: lx - 20, x2: lx - 4, y1: 11, y2: 11, stroke: it.c, 'stroke-width': 2 });
      if (it.d) ln.setAttribute('stroke-dasharray', it.d);
      svg.appendChild(ln);
      lx -= 30;
    }

    box.appendChild(svg);
  }

  function renderCards() {
    if (!data) return;
    const cur = data.current;

    if (cur) {
      const lv = level(cur.price);
      $('curPrice').textContent = price(cur.price);
      const card = $('currentCard');
      card.className = 'card ' + lv;
      $('curBadge').textContent = lv === 'low' ? '\u2193 LOW' : lv === 'high' ? '\u2191 HIGH' : '\u2192 NORMAL';
      $('curHint').textContent = lv === 'low' ? 'Great time to charge!' : lv === 'high' ? 'Consider delaying!' : 'Average price level';
    } else {
      $('curPrice').textContent = '--';
    }

    if (data.min) { $('minPrice').textContent = price(data.min.price); $('minTime').textContent = range(data.min); }
    if (data.max) { $('maxPrice').textContent = price(data.max.price); $('maxTime').textContent = range(data.max); }

    $('lowTitle').textContent = `BEST TIME TO CHARGE (<= ${C.LOW_THRESHOLD} ct/kWh)`;
    $('highTitle').textContent = `HIGH PRICES (> ${C.HIGH_THRESHOLD} ct/kWh)`;
    $('lowWin').innerHTML = data.lowWindow ? `${range(data.lowWindow)} <span class="dur">(${duration(data.lowWindow.start, data.lowWindow.end)})</span>` : 'None today';
    $('highWin').innerHTML = data.highWindow ? `${range(data.highWindow)} <span class="dur">(${duration(data.highWindow.start, data.highWindow.end)})</span>` : 'None today';
    $('lowSub').textContent = data.lowWindow ? 'Ideal for charging your EV' : 'No negative prices expected';
    $('highSub').textContent = data.highWindow ? 'Consider delaying charging' : 'No expensive period today';

    const lv = cur ? level(cur.price) : 'mid';
    $('recTitle').textContent = lv === 'low' ? 'Great time to charge now!' : lv === 'high' ? 'Prices are high right now' : 'Prices are moderate';
    let text = '';
    if (data.highWindow && new Date(data.highWindow.end) > new Date()) {
      text += `Prices above ${C.HIGH_THRESHOLD} ct/kWh from ${time(data.highWindow.start)}. `;
    }
    if (lv !== 'low' && data.nextLowWindow) {
      text += `Next good window <span class="hl">${time(data.nextLowWindow.start)}</span>.`;
    }
    $('recText').innerHTML = text || '&nbsp;';
  }

  function renderClock() {
    const now = new Date();
    $('date').textContent = fmtDate.format(now);
    $('clock').textContent = fmtTime.format(now);
  }

  function render() {
    renderClock();
    renderCards();
    renderChart();
  }

  async function load() {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText || 'Request failed'}`);
      data = await res.json();
      $('connectionStatus').hidden = true;
      render();
    } catch (e) {
      const status = $('connectionStatus');
      const now = new Date();
      status.textContent = `${fmtDate.format(now)} ${fmtTime.format(now)}: ${e.message || String(e)}`;
      status.title = status.textContent;
      status.hidden = false;
    }
  }

  function tick() {
    if (data) {
      const now = Date.now();
      const stale = (data.current && now >= new Date(data.current.end).getTime()) || now >= new Date(data.tomorrowStart).getTime();
      if (stale) { load(); return; }
    }
    render();
  }

  renderClock();
  load();
  setInterval(load, C.RELOAD_MS);
  setInterval(tick, C.TICK_MS);
  setInterval(renderClock, 1000);
})();
