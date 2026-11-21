// Simulator: the rule of the Cultural Dynamics Simulator, shown on two
// sub-topias. A culture crosses into a neighbouring sub-topia when its
// cultural integrity overcomes, first, the neighbour's membrane
// impermeability and, then, the neighbour's own cultural integrity.
// Here A passes both tests, and B is assimilated: it takes A's culture,
// sub-topian status, integrity and membrane.
(function () {
  var root = document.querySelector('.simr');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  var A = { name: 'The Culture', col: '#FFB7B2', integ: 8.2, imp: 4.0, status: 'uto' };
  var B = { name: 'The Azad', col: '#B3E5FC', integ: 3.5, imp: 5.1, status: 'dys' };
  var STATUS = { uto: 'UTOPIAN', neu: 'NOTOPIAN', dys: 'DYSTOPIAN' };

  // membrane colour and weight by impermeability: yellow (open) to brown (closed)
  function impColour(v) {
    var stops = [[253, 230, 138], [230, 153, 77], [166, 75, 53]], t = v / 10;
    var a = t < 0.5 ? stops[0] : stops[1], b = t < 0.5 ? stops[1] : stops[2], f = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * f); }).join(',') + ')';
  }
  function impWidth(v) { return 2 + v * 1.6; }

  var N = 5, step = 0, playing = true, timer = null, DWELL = 4200;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var els = {
    hexB: $('#sr-hex-b'), memB: $('#sr-mem-b'), memA: $('#sr-mem-a'),
    nameB: $('#sr-name-b'), statB: $('#sr-stat-b'), integA: $('#sr-integ-a'), integB: $('#sr-integ-b'), impB: $('#sr-imp-b'),
    test1: $$('.sr-t1'), test2: $$('.sr-t2'),
    markA: $('.sr-mark-a'), markB: $('.sr-mark-b'),
    items: $$('.sr-steps > li'), play: $('.sr-play')
  };

  function setB(c, merged) {
    els.hexB.style.fill = c.col;
    els.memB.style.stroke = impColour(c.imp);
    els.memB.style.strokeWidth = impWidth(c.imp);
    els.nameB.textContent = c.name.toUpperCase();
    els.integB.textContent = c.integ.toFixed(1);
    els.impB.textContent = c.imp.toFixed(1);
    els.statB.setAttribute('class', 'sr-stat ' + c.status);
    els.statB.querySelector('text').textContent = STATUS[c.status];
    els.markB.style.left = (c.imp * 10) + '%';
    els.markB.querySelector('b').textContent = merged ? 'A = B' : 'B';
    els.markA.classList.toggle('gone', !!merged);
  }

  function toggle(list, on) { list.forEach(function (el) { el.classList.toggle('on', !!on); }); }

  function render() {
    els.items.forEach(function (li, i) {
      li.classList.toggle('on', i === step);
      li.classList.toggle('done', i < step);
      li.querySelector('button').setAttribute('aria-current', i === step ? 'step' : 'false');
      var bar = li.querySelector('.sr-prog');
      bar.classList.remove('run'); void bar.offsetWidth;
      if (i === step && playing && !reduce) { bar.style.animationDuration = dwell() + 'ms'; bar.classList.add('run'); }
    });
    toggle(els.test1, step >= 1 && step < 4);
    toggle(els.test2, step >= 2 && step < 4);
    els.memB.classList.toggle('breached', step === 1 || step === 2);
    // the figures being compared at each step
    els.integA.classList.toggle('hl', step === 1 || step === 2);
    els.impB.classList.toggle('hl', step === 1);
    els.integB.classList.toggle('hl', step === 2);
    setB(step >= 3 ? A : B, step >= 3);
    root.setAttribute('data-step', step);
  }

  function dwell() { return step === N - 1 ? DWELL * 1.3 : DWELL; }
  function schedule() {
    clearTimeout(timer);
    if (playing) timer = setTimeout(function () { go(step + 1); }, dwell());
  }
  function go(n) { step = (n + N) % N; render(); schedule(); }
  function setPlaying(p) {
    playing = p;
    els.play.textContent = p ? 'Pause' : 'Play';
    els.play.setAttribute('aria-pressed', p ? 'false' : 'true');
  }

  $('.sr-next').addEventListener('click', function () { go(step + 1); });
  $('.sr-back').addEventListener('click', function () { go(step - 1); });
  els.items.forEach(function (li, i) {
    li.querySelector('button').addEventListener('click', function () { setPlaying(false); go(i); });
  });
  els.play.addEventListener('click', function () { setPlaying(!playing); go(step); });

  els.memA.style.stroke = impColour(A.imp);
  els.memA.style.strokeWidth = impWidth(A.imp);
  els.markA.style.left = (A.imp * 10) + '%';

  if (reduce) setPlaying(false);
  render();
  schedule();
})();

// The civilisation: the same rule on a map of sixty-one sub-topias, drawn as
// three layers of one hex grid: culture, sub-topian status, and cultural
// integrity with each membrane on it. Each turn every sub-topia is tested
// against each neighbour (both ways round, since every cell is tested as a
// target) and takes on the strongest culture that passes both tests.
(function () {
  var fig = document.querySelector('.sr-layers');
  if (!fig) return;
  var NS = 'http://www.w3.org/2000/svg';
  var svg = fig.querySelector('.sr-stack');

  var CULTURES = [
    { name: 'The Culture', col: '#FFB7B2', integ: 8.2, imp: 4.0, status: 'uto' },
    { name: 'The Idirans', col: '#FFDAC1', integ: 6.0, imp: 3.0, status: 'neu' },
    { name: 'The Homomda', col: '#FFF9C4', integ: 2.5, imp: 2.0, status: 'dys' },
    { name: 'The Morthanveld', col: '#C5E1A5', integ: 5.0, imp: 9.0, status: 'uto' },
    { name: 'The Azad', col: '#B3E5FC', integ: 3.5, imp: 5.1, status: 'dys' },
    { name: 'The Gzilt', col: '#C5CAE9', integ: 8.2, imp: 6.5, status: 'neu' }
  ];
  var SEEDS = [[-3, 1], [1, -3], [0, 0], [4, -2], [1, 2], [-2, 4]];
  var STATUS_COL = { uto: '#F2F2F7', neu: '#8E8E93', dys: '#1A1A1A' };
  var N = 4, R = 16, DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  var CX = 196, CY = [95, 245, 395];

  function mix(stops, t) {
    t = Math.max(0, Math.min(1, t));
    var a = t < 0.5 ? stops[0] : stops[1], b = t < 0.5 ? stops[1] : stops[2], f = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * f); }).join(',') + ')';
  }
  var integCol = function (v) { return mix([[230, 138, 115], [230, 153, 77], [253, 230, 138]], v / 10); };
  var impCol = function (v) { return mix([[253, 230, 138], [230, 153, 77], [166, 75, 53]], v / 10); };

  function dist(a, b) { return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] + a[1] - b[0] - b[1])) / 2; }
  function hexPts(x, y, r) {
    var p = [];
    for (var k = 0; k < 6; k++) { var an = Math.PI / 180 * (60 * k - 90); p.push((x + r * Math.cos(an)).toFixed(1) + ',' + (y + r * Math.sin(an)).toFixed(1)); }
    return p.join(' ');
  }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var cells = [], index = {};
  for (var q = -N; q <= N; q++) for (var r = -N; r <= N; r++) if (Math.abs(q + r) <= N) { index[q + ',' + r] = cells.length; cells.push({ q: q, r: r }); }
  cells.forEach(function (c) {
    c.nbrs = DIRS.map(function (d) { return index[(c.q + d[0]) + ',' + (c.r + d[1])]; }).filter(function (i) { return i !== undefined; });
  });
  function initial() {
    return cells.map(function (c) {
      var best = 0, bd = 1e9;
      SEEDS.forEach(function (s, k) { var dd = dist([c.q, c.r], s); if (dd < bd) { bd = dd; best = k; } });
      return best;
    });
  }

  // the projection: each layer is the map rotated and flattened
  var ISO = 'matrix(0.7071,0.3536,-0.7071,0.3536,0,0)';
  // the map's left and right corners once projected, for the lines that join the layers
  var lo = { x: 1e9, y: 0 }, hi = { x: -1e9, y: 0 };
  cells.forEach(function (c) {
    var x = R * Math.sqrt(3) * (c.q + c.r / 2), y = R * 1.5 * c.r;
    for (var k = 0; k < 6; k++) {
      var an = Math.PI / 180 * (60 * k - 90), vx = x + R * Math.cos(an), vy = y + R * Math.sin(an);
      var px = 0.7071 * (vx - vy), py = 0.3536 * (vx + vy);
      if (px < lo.x) lo = { x: px, y: py };
      if (px > hi.x) hi = { x: px, y: py };
    }
  });
  [lo, hi].forEach(function (pt) { el('line', { class: 'sr-link', x1: CX + pt.x, y1: CY[0] + pt.y, x2: CX + pt.x, y2: CY[2] + pt.y }, svg); });
  var EXT = -lo.x;
  var layers = [];
  for (var L = 2; L >= 0; L--) {
    var g = el('g', { transform: 'translate(' + CX + ',' + CY[L] + ')' }, svg);
    el('text', { class: 'sr-layer-n', x: lo.x - 22, y: lo.y + 5 }, g).textContent = L + 1;
    var m = el('g', { transform: ISO }, g);
    var polys = cells.map(function (c) {
      var x = R * Math.sqrt(3) * (c.q + c.r / 2), y = R * 1.5 * c.r;
      var o = { hex: el('polygon', { points: hexPts(x, y, R), class: 'sr-cell' }, m) };
      if (L === 2) o.mem = el('polygon', { points: hexPts(x, y, R * 0.74), class: 'sr-cellmem' }, m);
      return o;
    });
    layers[L] = polys;
  }

  var state, turn, stable, timer = null, playing = false;
  var turnEl = fig.querySelector('.sr-turn'), noteEl = fig.querySelector('.sr-gnote'), playBtn = fig.querySelector('.sr-gplay');

  function draw() {
    state.forEach(function (k, i) {
      var c = CULTURES[k];
      layers[0][i].hex.style.fill = c.col;
      layers[1][i].hex.style.fill = STATUS_COL[c.status];
      layers[2][i].hex.style.fill = integCol(c.integ);
      layers[2][i].mem.style.stroke = impCol(c.imp);
      layers[2][i].mem.style.strokeWidth = (0.6 + c.imp * 0.32).toFixed(2);
    });
    var alive = {}; state.forEach(function (k) { alive[k] = 1; });
    turnEl.textContent = 'Turn ' + turn + ' · ' + Object.keys(alive).length + ' cultures';
    noteEl.textContent = stable ? 'Stable: no sub-topia can take another.' : '';
  }

  function step() {
    if (stable) return false;
    var next = state.slice(), changed = 0;
    cells.forEach(function (c, i) {
      var t = CULTURES[state[i]], best = -1;
      c.nbrs.forEach(function (j) {
        var o = CULTURES[state[j]];
        if (o.integ > t.imp && o.integ > t.integ && (best < 0 || o.integ > CULTURES[best].integ)) best = state[j];
      });
      if (best >= 0) { next[i] = best; changed++; }
    });
    if (!changed) { stable = true; draw(); return false; }
    state = next; turn++; draw();
    return true;
  }

  function reset() { state = initial(); turn = 0; stable = false; draw(); }
  function loop() {
    clearTimeout(timer);
    if (!playing) return;
    if (stable) { timer = setTimeout(function () { reset(); timer = setTimeout(loop, 1600); }, 3200); return; }
    timer = setTimeout(function () { step(); loop(); }, 1100);
  }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', p ? 'false' : 'true');
    loop();
  }

  playBtn.addEventListener('click', function () { setPlaying(!playing); });
  fig.querySelector('.sr-gstep').addEventListener('click', function () { setPlaying(false); step(); });
  fig.querySelector('.sr-greset').addEventListener('click', function () { setPlaying(false); reset(); });

  reset();
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var started = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !started) { started = true; setPlaying(true); } });
    }, { threshold: 0.4 }).observe(fig);
  }
})();
