// Dynamics: a hex-grid cellular model of the four post-AGI cultural attractor
// states. The grid is divided into sub-topias (each with its own home culture);
// every cell carries a culture, or none. Two dials set the dynamics:
//
//   cultural integrity (I)    how strongly a sub-topia reproduces its own
//                             culture: its cells pass it on, resist foreign
//                             cultures, and return to it after a lapse
//   membrane permeability (P) how freely cultures cross the borders between
//                             sub-topias, and spread once inside
//
// Without integrity, cells lose their culture (they fade to grey) unless
// something refills them. One culture is expansionist: it wins contests a
// little more often. Where integrity and permeability are both high, cultures
// meeting at a border sometimes blend into a new one.
(function () {
  var root = document.querySelector('.dyn');
  if (!root) return;

  var canvas = root.querySelector('.dyn-canvas');
  var ctx = canvas.getContext('2d');
  var iRange = root.querySelector('#dyn-integrity');
  var pRange = root.querySelector('#dyn-permeability');
  var iOut = root.querySelector('#dyn-integrity-out');
  var pOut = root.querySelector('#dyn-permeability-out');
  var playBtn = root.querySelector('.dyn-play');
  var resetBtn = root.querySelector('.dyn-reset');
  var presetBtns = root.querySelectorAll('[data-preset]');
  var locator = root.querySelector('.dyn-locator');
  var dot = root.querySelector('.dyn-dot');
  var stateName = root.querySelector('.dyn-state-name');
  var stateSub = root.querySelector('.dyn-state-sub');
  var stateDesc = root.querySelector('.dyn-state-desc');
  var stat = {
    cultures: root.querySelector('[data-stat="cultures"]'),
    diversity: root.querySelector('[data-stat="diversity"]'),
    largest: root.querySelector('[data-stat="largest"]'),
    lost: root.querySelector('[data-stat="lost"]')
  };

  var COLS = 40, ROWS = 40, N = COLS * ROWS, REGIONS = 12, LOST = -1, MAXC = 600;
  var LOSS = 0.05;

  // the five scenarios: where each sits on the two dials, and what it is
  var PRESETS = {
    enclosure: { I: 0.92, P: 0.03, name: 'Meta-Dystopian Enclosure', sub: 'Localised lock-ins', desc: 'Every sub-topia is a closed system: its culture holds, and nothing crosses its borders. The map freezes into sealed blocks of colour.' },
    uplift: { I: 0.88, P: 0.62, name: 'Meta-Utopian Uplift', sub: 'Epistemic Equilibria', desc: 'Borders open enough for exchange, but sub-topias protected enough to keep their identity: cultures trade and blend at their borders, and no one culture takes over.' },
    collapse: { I: 0.12, P: 0.04, name: 'Cultural Collapse', sub: 'Permanent Plateau', desc: 'Sub-topias lose their coherent identity, and closed borders stop anything new arriving: cultures fade to grey and nothing replaces them.' },
    takeover: { I: 0.12, P: 0.92, name: 'Mono-Cultural Takeover', sub: 'Gray Goo', desc: 'Weak integrity and open borders: the expansionist culture breaks out of its sub-topia and colonises the others, until one colour covers the map.' },
    clash: { I: 0.5, P: 0.5, name: 'Clash of Civilisations', sub: 'Cultural Competition, Conflict & Control', desc: 'An underdetermined, hybrid condition: cultures compete across shifting fronts, some sub-topias are overrun, some hold, and some lose their culture.' }
  };

  var I = PRESETS.clash.I, P = PRESETS.clash.P;
  var running = true, inView = true;

  // ---------- the grid: pointy-top hexagons, odd rows shifted right ----------
  var nb = new Array(N);
  var cube = new Array(N);
  (function () {
    var EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    var ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c, list = [], d = (r & 1) ? ODD : EVEN;
        for (var k = 0; k < 6; k++) {
          var cc = c + d[k][0], rr = r + d[k][1];
          if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) list.push(rr * COLS + cc);
        }
        nb[i] = list;
        var x = c - (r - (r & 1)) / 2;
        cube[i] = [x, r, -x - r];
      }
    }
  })();

  function hexDist(a, b) {
    return Math.max(Math.abs(cube[a][0] - cube[b][0]), Math.abs(cube[a][1] - cube[b][1]), Math.abs(cube[a][2] - cube[b][2]));
  }

  // ---------- state ----------
  var reg = new Int16Array(N);
  var cul = new Int16Array(N);
  var count = new Int32Array(MAXC);
  var colR = new Float32Array(MAXC), colG = new Float32Array(MAXC), colB = new Float32Array(MAXC);
  var fit = new Float32Array(MAXC);
  var lostCount = 0;
  var borders = [];

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }

  var HUES = [8, 30, 50, 85, 135, 168, 192, 214, 244, 272, 302, 334];

  function setCell(i, c) {
    var old = cul[i];
    if (old === c) return;
    if (old === LOST) lostCount--; else count[old]--;
    if (c === LOST) lostCount++; else count[c]++;
    cul[i] = c;
  }

  function newCulture() {
    for (var c = REGIONS; c < MAXC; c++) if (count[c] === 0) return c;
    return -1;
  }

  function seed() {
    // the sub-topias: twelve seeds kept apart, every cell joining its nearest
    var seeds = [], tries = 0;
    while (seeds.length < REGIONS && tries < 5000) {
      var s = Math.floor(Math.random() * N), ok = true;
      for (var q = 0; q < seeds.length; q++) if (hexDist(s, seeds[q]) < 8) { ok = false; break; }
      if (ok) seeds.push(s);
      tries++;
    }
    while (seeds.length < REGIONS) seeds.push(Math.floor(Math.random() * N));
    for (var i = 0; i < N; i++) {
      var best = 0, bd = 1e9;
      for (var q2 = 0; q2 < REGIONS; q2++) {
        var d = hexDist(i, seeds[q2]) + Math.random() * 0.9;
        if (d < bd) { bd = d; best = q2; }
      }
      reg[i] = best;
    }
    // each sub-topia's home culture; the first is expansionist
    count.fill(0);
    var order = HUES.slice().sort(function () { return Math.random() - 0.5; });
    for (var r = 0; r < REGIONS; r++) {
      var rgb = hsl(order[r], 58, r % 2 ? 66 : 54);
      colR[r] = rgb[0]; colG[r] = rgb[1]; colB[r] = rgb[2];
      fit[r] = r === 0 ? 1.7 : 0.9 + Math.random() * 0.2;
    }
    lostCount = 0;
    for (var j = 0; j < N; j++) { cul[j] = reg[j]; count[reg[j]]++; }
    // the borders between sub-topias, once
    borders = [];
    for (var a = 0; a < N; a++) {
      for (var k = 0; k < nb[a].length; k++) {
        var b = nb[a][k];
        if (b > a && reg[a] !== reg[b]) borders.push([a, b]);
      }
    }
    layout();
  }

  // ---------- one update: a cell meets a neighbour ----------
  function step(i) {
    var c = cul[i], home = reg[i];
    // integrity: a sub-topia draws its cells back to its own culture
    if (c !== home && count[home] > 0 && Math.random() < I * (c === LOST ? 0.06 : 0.03)) {
      // only if a neighbour still carries it
      var nn = nb[i];
      for (var k = 0; k < nn.length; k++) if (cul[nn[k]] === home) { setCell(i, home); return; }
    }
    // without integrity, culture lapses
    if (c !== LOST && Math.random() < (1 - I) * LOSS) { setCell(i, LOST); return; }

    var j = nb[i][Math.floor(Math.random() * nb[i].length)];
    var d = cul[j];
    if (d === LOST || d === c) return;
    var border = reg[j] !== home;
    // transmission: across a border by permeability; within a sub-topia its
    // own culture by integrity (weak integrity reproduces it poorly), a
    // foreign one by permeability
    var t = border ? P : (d === home ? Math.pow(I, 1.5) : Math.max(P, 0.15));
    if (Math.random() >= t) return;
    if (c !== LOST) {
      // at an open border between protected sub-topias, cultures blend
      if (border && Math.random() < I * P * 0.12) {
        var n = newCulture();
        if (n >= 0) {
          var w = 0.5, jit = 14;
          colR[n] = colR[c] * w + colR[d] * (1 - w) + (Math.random() - 0.5) * jit;
          colG[n] = colG[c] * w + colG[d] * (1 - w) + (Math.random() - 0.5) * jit;
          colB[n] = colB[c] * w + colB[d] * (1 - w) + (Math.random() - 0.5) * jit;
          fit[n] = (fit[c] + fit[d]) / 2;
          setCell(i, n);
          return;
        }
      }
      // a rooted cell resists foreign cultures, as strongly as its integrity
      if (c === home && Math.random() < I * 0.92) return;
      // a contest, weighted by each culture's fitness
      if (Math.random() > fit[d] / (fit[c] + fit[d])) return;
    }
    setCell(i, d);
  }

  // ---------- drawing ----------
  var R = 10, W = 0, H = 0, dpr = 1, centres = new Float32Array(N * 2), hexPath = null;

  function layout() {
    var cssW = canvas.parentNode.clientWidth;
    R = cssW / (Math.sqrt(3) * (COLS + 0.5));
    W = cssW;
    H = R * (1.5 * (ROWS - 1) + 2);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = H + 'px';
    var w = Math.sqrt(3) * R;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c;
        centres[2 * i] = w * (c + 0.5 + ((r & 1) ? 0.5 : 0));
        centres[2 * i + 1] = R + r * 1.5 * R;
      }
    }
    hexPath = [];
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 180 * (60 * k - 30);
      hexPath.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
    draw();
  }

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function draw() {
    if (!hexPath) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var bg = css('--canvas-bg', dark ? '#000' : '#fff');
    var ink = css('--canvas-ink', dark ? '#fff' : '#000');
    var lost = dark ? '#2b2b2b' : '#e4e2de';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    var shade = dark ? 0.78 : 1;
    for (var i = 0; i < N; i++) {
      var c = cul[i], x = centres[2 * i], y = centres[2 * i + 1];
      ctx.fillStyle = c === LOST ? lost : 'rgb(' + (colR[c] * shade | 0) + ',' + (colG[c] * shade | 0) + ',' + (colB[c] * shade | 0) + ')';
      ctx.beginPath();
      ctx.moveTo(x + hexPath[0][0], y + hexPath[0][1]);
      for (var k = 1; k < 6; k++) ctx.lineTo(x + hexPath[k][0], y + hexPath[k][1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = bg;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    // the membranes: heavier the less permeable
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.18 + 0.82 * (1 - P);
    ctx.lineWidth = 0.8 + 2.4 * (1 - P);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var e = 0; e < borders.length; e++) {
      var a = borders[e][0], b = borders[e][1];
      var ax = centres[2 * a], ay = centres[2 * a + 1], bx = centres[2 * b], by = centres[2 * b + 1];
      // the shared edge: perpendicular to the line between centres, at its midpoint
      var mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
      var hx = -dy / len * R / 2, hy = dx / len * R / 2;
      ctx.moveTo(mx - hx, my - hy);
      ctx.lineTo(mx + hx, my + hy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---------- the readings ----------
  function readings() {
    var alive = 0, largest = 0, h = 0, filled = N - lostCount;
    for (var c = 0; c < MAXC; c++) {
      if (count[c] > 0) {
        alive++;
        if (count[c] > largest) largest = count[c];
        if (filled > 0) { var p = count[c] / filled; h -= p * Math.log(p); }
      }
    }
    stat.cultures.textContent = alive;
    stat.diversity.textContent = filled ? Math.exp(h).toFixed(1) : '0';
    stat.largest.textContent = Math.round(100 * largest / N) + '%';
    stat.lost.textContent = Math.round(100 * lostCount / N) + '%';
  }

  // ---------- the dials ----------
  function nearest() {
    if (Math.abs(I - 0.5) < 0.17 && Math.abs(P - 0.5) < 0.17) return 'clash';
    if (I >= 0.5) return P < 0.5 ? 'enclosure' : 'uplift';
    return P < 0.5 ? 'collapse' : 'takeover';
  }

  function showState() {
    var k = nearest(), s = PRESETS[k];
    stateName.textContent = s.name;
    stateSub.textContent = '(' + s.sub + ')';
    stateDesc.textContent = s.desc;
    root.setAttribute('data-state', k);
    presetBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.preset === k ? 'true' : 'false'); });
  }

  function setDials(i, p, fromRange) {
    I = Math.max(0, Math.min(1, i));
    P = Math.max(0, Math.min(1, p));
    if (!fromRange) { iRange.value = Math.round(I * 100); pRange.value = Math.round(P * 100); }
    iOut.textContent = Math.round(I * 100);
    pOut.textContent = Math.round(P * 100);
    dot.setAttribute('cx', (10 + P * 180).toFixed(1));
    dot.setAttribute('cy', (10 + (1 - I) * 180).toFixed(1));
    showState();
    draw();
  }

  iRange.addEventListener('input', function () { setDials(iRange.value / 100, P, true); });
  pRange.addEventListener('input', function () { setDials(I, pRange.value / 100, true); });

  presetBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var s = PRESETS[b.dataset.preset];
      setDials(s.I, s.P);
    });
  });

  // the locator: a point on the 2x2, dragged or clicked
  function fromPointer(e) {
    var r = locator.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width * 200, y = (e.clientY - r.top) / r.height * 200;
    setDials(1 - (y - 10) / 180, (x - 10) / 180);
  }
  var dragging = false;
  locator.addEventListener('pointerdown', function (e) { dragging = true; locator.setPointerCapture(e.pointerId); fromPointer(e); });
  locator.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
  locator.addEventListener('pointerup', function () { dragging = false; });
  locator.addEventListener('pointercancel', function () { dragging = false; });

  playBtn.addEventListener('click', function () {
    running = !running;
    playBtn.textContent = running ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', running ? 'false' : 'true');
  });
  resetBtn.addEventListener('click', function () { seed(); readings(); });

  // ---------- running ----------
  var frame = 0;
  function tick() {
    if (running && inView && !document.hidden) {
      var n = N;
      for (var k = 0; k < n; k++) step(Math.floor(Math.random() * N));
      draw();
      if (++frame % 8 === 0) readings();
    }
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(canvas);
  }
  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 120); });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // reduced motion: start paused
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    running = false;
    playBtn.textContent = 'Play';
    playBtn.setAttribute('aria-pressed', 'true');
  }

  seed();
  setDials(I, P);
  readings();
  requestAnimationFrame(tick);
})();
