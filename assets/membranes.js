// Membranes: sub-topias as cells. Each cell is a circle with a membrane; the
// gaps in the membrane are its permeability. Inside, particles (people, memes)
// carry their culture as a colour.
//
//   membrane permeability   how many and how wide the gaps are: particles
//                           pass through a gap and bounce off the membrane
//   cultural integrity      how strongly a cell recolours the particles inside
//                           it with its own culture, and how firmly the cell
//                           keeps its culture; without it, colours fade to
//                           grey and a cell takes on whatever is inside it
//
// Particles that meet trade colour, the fitter culture more strongly. One
// culture is expansionist: fitter, and firm in its own cell.
(function () {
  var root = document.querySelector('.cells');
  if (!root) return;
  var canvas = root.querySelector('.cells-canvas'), ctx = canvas.getContext('2d');
  var stage = root.querySelector('.cells-stage');
  var iRange = root.querySelector('#ce-integrity'), pRange = root.querySelector('#ce-permeability');
  var iOut = root.querySelector('#ce-integrity-out'), pOut = root.querySelector('#ce-permeability-out');
  var nameEl = root.querySelector('.ce-state-name'), subEl = root.querySelector('.ce-state-sub'), descEl = root.querySelector('.ce-state-desc');
  var playBtn = root.querySelector('.ce-play');
  var stat = {};
  root.querySelectorAll('[data-ce-stat]').forEach(function (el) { stat[el.dataset.ceStat] = el; });

  var PRESETS = {
    enclosure: { I: 0.9, P: 0.0, name: 'Meta-Dystopian Enclosure', sub: 'Localised lock-ins', desc: 'The membranes are sealed. Every cell keeps its own culture, and nothing passes between them.' },
    uplift: { I: 0.88, P: 0.6, name: 'Meta-Utopian Uplift', sub: 'Epistemic Equilibria', desc: 'Open membranes and strong cells: people and memes cross and mix, and every cell still keeps its own colour.' },
    collapse: { I: 0.08, P: 0.04, name: 'Cultural Collapse', sub: 'Permanent Plateau', desc: 'Weak cells behind closed membranes: cultures fade to grey, and nothing new arrives to replace them.' },
    takeover: { I: 0.1, P: 0.85, name: 'Mono-Cultural Takeover', sub: 'Gray Goo', desc: 'Weak cells, open membranes: the expansionist culture floods out of its cell and recolours the rest.' },
    clash: { I: 0.5, P: 0.45, name: 'Clash of Civilisations', sub: 'Cultural Competition, Conflict & Control', desc: 'Half-open membranes and half-strong cells: cultures push into one another, some cells hold and some are overrun.' }
  };

  var I = PRESETS.clash.I, P = PRESETS.clash.P, running = true, inView = true;

  var HUES = [12, 42, 140, 200, 262, 318, 92];
  var cells = [], parts = [], W = 0, H = 0, R = 0, dpr = 1, expansionist = 0, crossings = 0, crossLog = [];

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function grey(c) { var g = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return [g, g, g]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function sat(c) { var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx ? (mx - mn) / mx : 0; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])); }

  function layout() {
    W = stage.clientWidth;
    H = Math.round(W * 0.66);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    R = H * 0.17;
    // seven cells: two, three, two
    var rows = [[0.3, 0.7], [0.14, 0.5, 0.86], [0.3, 0.7]], ys = [0.2, 0.5, 0.8], k = 0;
    rows.forEach(function (row, ri) {
      row.forEach(function (fx) {
        if (cells[k]) { cells[k].x = W * (0.07 + 0.86 * fx); cells[k].y = H * ys[ri]; }
        k++;
      });
    });
    if (!parts.length) return;
    draw();
  }

  function reset() {
    cells = []; parts = [];
    expansionist = Math.floor(Math.random() * 7);
    for (var i = 0; i < 7; i++) {
      var c = hsl(HUES[i], 62, 58);
      cells.push({ x: 0, y: 0, home: c, col: c.slice(), fit: i === expansionist ? 2.4 : 1, spin: i * 0.37 });
    }
    layout();
    cells.forEach(function (cell, i) {
      for (var n = 0; n < 34; n++) {
        var a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R * 0.85;
        var v = Math.random() * Math.PI * 2;
        parts.push({ x: cell.x + Math.cos(a) * r, y: cell.y + Math.sin(a) * r, vx: Math.cos(v), vy: Math.sin(v), col: cell.home.slice(), fit: cell.fit, cell: i });
      }
    });
    crossings = 0; crossLog = [];
    draw();
  }

  // the gaps in a membrane: six, each as wide as permeability allows
  var GAPS = 6;
  function inGap(cell, ang) {
    if (P <= 0.005) return false;
    var seg = Math.PI * 2 / GAPS, half = seg * 0.5 * Math.min(0.95, P);
    var a = ((ang + cell.spin) % seg + seg) % seg;
    return Math.abs(a - seg / 2) < half;
  }

  // how firmly a cell keeps its culture: its integrity, and the expansionist's
  // a good deal more
  function keepOf(i) { return i === expansionist ? Math.max(I, 0.9) : I; }

  function cellAt(x, y) {
    for (var i = 0; i < cells.length; i++) { var dx = x - cells[i].x, dy = y - cells[i].y; if (dx * dx + dy * dy < R * R) return i; }
    return -1;
  }

  function step() {
    var speed = Math.max(0.9, W / 600);
    // integrity: each cell keeps its culture (the expansionist always), or
    // takes on the culture of what is inside it
    cells.forEach(function (cell, i) {
      cell.spin += 0.002;
      // what a cell takes on is weighted by fitness: a few members of a
      // fitter culture count for more than many of a weaker one
      var sum = [0, 0, 0], n = 0, fit = 0;
      parts.forEach(function (p) {
        if (p.cell !== i) return;
        var w = Math.pow(p.fit, 4);
        sum[0] += p.col[0] * w; sum[1] += p.col[1] * w; sum[2] += p.col[2] * w; fit += p.fit * w; n += w;
      });
      var keep = keepOf(i);
      if (n) {
        var mean = [sum[0] / n, sum[1] / n, sum[2] / n];
        cell.col = mix(cell.col, mean, (1 - keep) * 0.02);
        cell.fit += (fit / n - cell.fit) * (1 - keep) * 0.02;
      }
      cell.col = mix(cell.col, cell.home, keep * keep * 0.004);
      if (i === expansionist) cell.fit = Math.max(cell.fit, 2.4);
    });
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k];
      // a random walk
      var a = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.7;
      p.vx = Math.cos(a); p.vy = Math.sin(a);
      // outside, people migrate: each makes for another cell, chosen as it leaves
      if (p.cell < 0) {
        if (p.target == null || p.target === p.from) {
          do { p.target = Math.floor(Math.random() * cells.length); } while (cells.length > 1 && p.target === p.from);
        }
        var tc = cells[p.target], hx = tc.x - p.x, hy = tc.y - p.y, hm = Math.hypot(hx, hy) || 1;
        p.vx += hx / hm * 0.35; p.vy += hy / hm * 0.35;
        var vm = Math.hypot(p.vx, p.vy) || 1; p.vx /= vm; p.vy /= vm;
      }
      var nx = p.x + p.vx * speed, ny = p.y + p.vy * speed;
      // the membranes
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var d0 = Math.hypot(p.x - c.x, p.y - c.y), d1 = Math.hypot(nx - c.x, ny - c.y);
        if ((d0 < R) !== (d1 < R)) {
          var ang = Math.atan2(ny - c.y, nx - c.x);
          if (inGap(c, ang)) { crossings++; }
          else {
            // bounce back off the membrane
            var ux = (p.x - c.x) / (d0 || 1), uy = (p.y - c.y) / (d0 || 1), dot = p.vx * ux + p.vy * uy;
            p.vx -= 2 * dot * ux; p.vy -= 2 * dot * uy;
            nx = p.x; ny = p.y;
          }
        }
      }
      // the edges of the world
      if (nx < 3 || nx > W - 3) { p.vx = -p.vx; nx = Math.min(W - 3, Math.max(3, nx)); }
      if (ny < 3 || ny > H - 3) { p.vy = -p.vy; ny = Math.min(H - 3, Math.max(3, ny)); }
      p.x = nx; p.y = ny;
      var was = p.cell;
      p.cell = cellAt(p.x, p.y);
      if (was >= 0 && p.cell < 0) { p.from = was; p.target = null; }
      // integrity: a cell recolours what is inside it; without it, colour fades
      if (p.cell >= 0) {
        // a fitter culture resists being recoloured, and fading, the more
        var cl = cells[p.cell], keep = keepOf(p.cell), res = Math.max(1, p.fit / cl.fit);
        var r = (0.006 + keep * 0.03) / (res * res);
        p.col = mix(p.col, cl.col, r);
        p.fit += (cl.fit - p.fit) * r;
        p.col = mix(p.col, grey(p.col), (1 - keep) * 0.0014 / p.fit);
      } else {
        p.col = mix(p.col, grey(p.col), (1 - I) * 0.001 / p.fit);
      }
    }
    // particles that meet trade culture, the fitter more strongly
    var r2 = 9 * 9 * Math.max(1, W / 700);
    for (var x = 0; x < parts.length; x++) {
      for (var y = x + 1; y < parts.length; y++) {
        var A = parts[x], Bp = parts[y], dx = A.x - Bp.x, dy = A.y - Bp.y;
        if (dx * dx + dy * dy > r2) continue;
        var t = 0.1, fa = A.fit / (A.fit + Bp.fit);
        var ca = A.col.slice(), fA = A.fit;
        A.col = mix(A.col, Bp.col, t * (1 - fa)); A.fit += (Bp.fit - A.fit) * t * (1 - fa);
        Bp.col = mix(Bp.col, ca, t * fa); Bp.fit += (fA - Bp.fit) * t * fa;
      }
    }
  }

  function css(name, fb) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }

  function draw() {
    if (!W) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var ink = css('--canvas-ink', dark ? '#fff' : '#000'), paper = css('--canvas-bg', dark ? '#000' : '#fff');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    // the cells, tinted by their culture
    cells.forEach(function (c) {
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.fillStyle = rgb(c.col, dark ? 0.2 : 0.16); ctx.fill();
    });
    // the particles
    var pr = Math.max(2.4, W / 300);
    parts.forEach(function (p) {
      ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = rgb(dark ? mix(p.col, [0, 0, 0], 0.12) : p.col, 1); ctx.fill();
    });
    // the membranes: solid where closed, open at the gaps
    ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    cells.forEach(function (c, i) {
      var seg = Math.PI * 2 / GAPS, half = P <= 0.005 ? 0 : seg * 0.5 * Math.min(0.95, P);
      for (var g = 0; g < GAPS; g++) {
        var mid = g * seg + seg / 2 - (c.spin || 0);
        var from = mid + half, to = mid + seg - half;
        if (half === 0) { from = 0; to = Math.PI * 2; }
        ctx.beginPath(); ctx.arc(c.x, c.y, R, from, to); ctx.stroke();
        if (half === 0) break;
      }
      if (i === expansionist) {
        ctx.beginPath(); ctx.arc(c.x, c.y, R + 6, 0, Math.PI * 2);
        ctx.setLineDash([2, 5]); ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2.4;
      }
    });
  }

  // the readings
  function readings() {
    var now = performance.now();
    crossLog.push([now, crossings]);
    while (crossLog.length && now - crossLog[0][0] > 3000) crossLog.shift();
    var rate = crossLog.length > 1 ? (crossings - crossLog[0][1]) / ((now - crossLog[0][0]) / 1000) : 0;
    // distinct cultures: cells whose colours stay apart (and have not faded)
    var distinct = [];
    cells.forEach(function (c) {
      if (sat(c.col) < 0.18) return;
      if (!distinct.some(function (d) { return dist(d, c.col) < 48; })) distinct.push(c.col);
    });
    var vit = 0, exp = 0, home = cells[expansionist].home;
    parts.forEach(function (p) { vit += sat(p.col); if (sat(p.col) > 0.12 && dist(p.col, home) < 80) exp++; });
    stat.cultures.textContent = distinct.length;
    stat.vitality.textContent = Math.round(100 * vit / parts.length / 0.62) + '%';
    stat.expansion.textContent = Math.round(100 * exp / parts.length) + '%';
    stat.exchange.textContent = Math.round(rate);
  }

  function nearestState() {
    if (Math.abs(I - 0.5) < 0.17 && Math.abs(P - 0.5) < 0.2) return 'clash';
    if (I >= 0.5) return P < 0.3 ? 'enclosure' : 'uplift';
    return P < 0.3 ? 'collapse' : 'takeover';
  }

  function setDials(i, p, fromRange) {
    I = i; P = p;
    if (!fromRange) { iRange.value = Math.round(I * 100); pRange.value = Math.round(P * 100); }
    iOut.textContent = Math.round(I * 100); pOut.textContent = Math.round(P * 100);
    var k = nearestState(), s = PRESETS[k];
    nameEl.textContent = s.name; subEl.textContent = '(' + s.sub + ')'; descEl.textContent = s.desc;
    root.querySelectorAll('[data-ce-preset]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.cePreset === k ? 'true' : 'false'); });
    draw();
  }

  iRange.addEventListener('input', function () { setDials(iRange.value / 100, P, true); });
  pRange.addEventListener('input', function () { setDials(I, pRange.value / 100, true); });
  root.querySelectorAll('[data-ce-preset]').forEach(function (b) {
    b.addEventListener('click', function () { var s = PRESETS[b.dataset.cePreset]; setDials(s.I, s.P); reset(); });
  });
  playBtn.addEventListener('click', function () { running = !running; playBtn.textContent = running ? 'Pause' : 'Play'; });
  root.querySelector('.ce-reset').addEventListener('click', reset);

  var fr = 0;
  function frame() {
    if (running && inView && !document.hidden && W) {
      step(); step();
      draw();
      if (++fr % 15 === 0) readings();
    }
    requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(stage);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var oldW = W, oldH = H; layout(); if (oldW) parts.forEach(function (p) { p.x *= W / oldW; p.y *= H / oldH; }); draw(); }, 120); });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { running = false; playBtn.textContent = 'Play'; }

  reset();
  setDials(I, P);
  readings();
  requestAnimationFrame(frame);
})();
