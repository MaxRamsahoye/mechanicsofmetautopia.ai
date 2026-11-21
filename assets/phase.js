// Phase portrait: the four post-AGI cultural attractor states as a flow field.
//
// The plane is the 2x2 of the article: membrane permeability across, cultural
// integrity up. Five attractors sit in it: the four corners and the clash in
// the middle (a spiral, cultures circling one another). Each is a well; the
// arrows show which way a civilisation drifts from any point, the shading which
// state each point ends in (its basin of attraction), and the particles are
// civilisations flowing through the space.
//
// Two dials stand for AI capabilities and reshape the wells:
//   offence-defence balance   defence-dominant technology (shields) deepens
//                             enclosure; offence-dominant technology (spears,
//                             memetic replicators) deepens takeover
//   coordination capacity     epistemic and coordination technology deepens
//                             uplift; without it, collapse and the clash deepen
// A third, shocks, shakes the civilisations, so they can leave a shallow well.
(function () {
  var root = document.querySelector('.phase');
  if (!root) return;
  var bgCanvas = root.querySelector('.phase-bg'), fgCanvas = root.querySelector('.phase-fg');
  var bg = bgCanvas.getContext('2d'), fg = fgCanvas.getContext('2d');
  var stage = root.querySelector('.phase-stage');
  var dials = {
    balance: root.querySelector('#ph-balance'),
    coord: root.querySelector('#ph-coord'),
    shocks: root.querySelector('#ph-shocks')
  };
  var outs = {
    balance: root.querySelector('#ph-balance-out'),
    coord: root.querySelector('#ph-coord-out'),
    shocks: root.querySelector('#ph-shocks-out')
  };
  var bars = {};
  root.querySelectorAll('[data-basin]').forEach(function (el) { bars[el.dataset.basin] = el; });
  var playBtn = root.querySelector('.ph-play');

  var KEYS = ['enclosure', 'uplift', 'collapse', 'takeover', 'clash'];
  var COLOURS = { enclosure: '#E6994D', uplift: '#E3B505', collapse: '#D9707A', takeover: '#7D8590', clash: '#9B7BD4' };
  var POS = { enclosure: [0.12, 0.88], uplift: [0.88, 0.88], collapse: [0.12, 0.12], takeover: [0.88, 0.12], clash: [0.5, 0.5] };
  var WIDTH = { enclosure: 0.23, uplift: 0.23, collapse: 0.23, takeover: 0.23, clash: 0.17 };
  var depth = {};

  var PRESETS = {
    defence: { balance: -0.8, coord: 0.4, shocks: 0.35 },
    offence: { balance: 0.8, coord: 0.4, shocks: 0.35 },
    coordinated: { balance: 0, coord: 0.9, shocks: 0.35 },
    uncoordinated: { balance: 0, coord: 0.1, shocks: 0.35 }
  };

  var B = 0, C = 0.5, S = 0.35, running = true, inView = true;

  function setDepths() {
    depth.enclosure = Math.max(0.15, 1 - 0.9 * B);
    depth.takeover = Math.max(0.15, 1 + 0.9 * B);
    depth.uplift = 0.25 + 1.5 * C;
    depth.collapse = 0.25 + 1.2 * (1 - C);
    depth.clash = (0.45 + 0.7 * (1 - Math.abs(B))) * (1.35 - C);
  }

  // the flow at (x, y): down the slopes of the five wells, swirling round the clash
  function field(x, y) {
    var fx = 0, fy = 0;
    for (var k = 0; k < 5; k++) {
      var key = KEYS[k], a = POS[key], s = WIDTH[key];
      var dx = a[0] - x, dy = a[1] - y;
      var g = depth[key] * Math.exp(-(dx * dx + dy * dy) / (2 * s * s)) / (s * s);
      fx += dx * g; fy += dy * g;
    }
    var cx = x - 0.5, cy = y - 0.5;
    var w = 2.2 * depth.clash * Math.exp(-(cx * cx + cy * cy) / (2 * 0.2 * 0.2));
    fx += -cy * w; fy += cx * w;
    // the edges of the plane hold
    if (x < 0.03) fx += (0.03 - x) * 60; if (x > 0.97) fx -= (x - 0.97) * 60;
    if (y < 0.03) fy += (0.03 - y) * 60; if (y > 0.97) fy -= (y - 0.97) * 60;
    return [fx, fy];
  }

  function stepPoint(p, noise) {
    var f = field(p[0], p[1]);
    var vx = f[0] * 0.0016, vy = f[1] * 0.0016;
    var m = Math.sqrt(vx * vx + vy * vy);
    if (m > 0.012) { vx *= 0.012 / m; vy *= 0.012 / m; }
    p[0] += vx + (noise ? (Math.random() - 0.5) * noise : 0);
    p[1] += vy + (noise ? (Math.random() - 0.5) * noise : 0);
    p[0] = Math.min(1, Math.max(0, p[0])); p[1] = Math.min(1, Math.max(0, p[1]));
  }

  function nearest(x, y) {
    var best = 'clash', bd = 1e9;
    for (var k = 0; k < 5; k++) {
      var a = POS[KEYS[k]], d = (a[0] - x) * (a[0] - x) + (a[1] - y) * (a[1] - y);
      if (d < bd) { bd = d; best = KEYS[k]; }
    }
    return best;
  }

  // ---------- drawing the background: basins, arrows, the 2x2 ----------
  var SIZE = 0, dpr = 1, PAD = 0;
  var basinGrid = null, GRID = 56;

  function layout() {
    var w = stage.clientWidth;
    SIZE = w; PAD = 0;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    [bgCanvas, fgCanvas].forEach(function (c) {
      c.width = Math.round(w * dpr); c.height = Math.round(w * dpr);
      c.style.width = w + 'px'; c.style.height = w + 'px';
    });
    stage.style.height = w + 'px';
    drawBackground();
  }

  function px(x) { return x * SIZE; }
  function py(y) { return (1 - y) * SIZE; }
  function css(name, fb) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }
  function rgba(hex, a) { var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

  function computeBasins() {
    basinGrid = [];
    var counts = { enclosure: 0, uplift: 0, collapse: 0, takeover: 0, clash: 0 };
    for (var j = 0; j < GRID; j++) {
      for (var i = 0; i < GRID; i++) {
        var p = [(i + 0.5) / GRID, (j + 0.5) / GRID];
        for (var t = 0; t < 260; t++) stepPoint(p, 0);
        var k = nearest(p[0], p[1]);
        basinGrid.push(k); counts[k]++;
      }
    }
    KEYS.forEach(function (k) {
      var pct = Math.round(100 * counts[k] / (GRID * GRID));
      if (bars[k]) { bars[k].querySelector('.ph-bar-fill').style.width = pct + '%'; bars[k].querySelector('.ph-bar-val').textContent = pct + '%'; }
    });
  }

  function drawBackground() {
    if (!SIZE) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var ink = css('--canvas-ink', dark ? '#fff' : '#000'), paper = css('--canvas-bg', dark ? '#000' : '#fff');
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.fillStyle = paper; bg.fillRect(0, 0, SIZE, SIZE);
    // the basins
    var cell = SIZE / GRID;
    for (var j = 0; j < GRID; j++) {
      for (var i = 0; i < GRID; i++) {
        // whole pixels, edge to edge, so the cells leave no seams
        var x0 = Math.round(i * cell), x1 = Math.round((i + 1) * cell);
        var y0 = Math.round(SIZE - (j + 1) * cell), y1 = Math.round(SIZE - j * cell);
        bg.fillStyle = rgba(COLOURS[basinGrid[j * GRID + i]], dark ? 0.26 : 0.2);
        bg.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    // the 2x2 and its centre
    bg.strokeStyle = rgba(dark ? '#ffffff' : '#000000', 0.25); bg.lineWidth = 1;
    bg.beginPath(); bg.moveTo(px(0.5), 0); bg.lineTo(px(0.5), SIZE); bg.moveTo(0, py(0.5)); bg.lineTo(SIZE, py(0.5)); bg.stroke();
    bg.strokeRect(px(0.25), py(0.7), px(0.5), SIZE * 0.4);
    // the arrows
    var N = 17;
    bg.strokeStyle = rgba(dark ? '#ffffff' : '#000000', 0.42); bg.fillStyle = bg.strokeStyle; bg.lineWidth = 1.1;
    for (var a = 0; a < N; a++) {
      for (var b = 0; b < N; b++) {
        var x = (a + 0.5) / N, y = (b + 0.5) / N, f = field(x, y);
        var m = Math.sqrt(f[0] * f[0] + f[1] * f[1]);
        if (m < 1e-6) continue;
        var len = Math.min(1, 0.35 + Math.log(1 + m) / 6) * SIZE / N * 0.42;
        var ux = f[0] / m, uy = -f[1] / m, cx = px(x), cy = py(y);
        var x1 = cx - ux * len, y1 = cy - uy * len, x2 = cx + ux * len, y2 = cy + uy * len;
        bg.beginPath(); bg.moveTo(x1, y1); bg.lineTo(x2, y2); bg.stroke();
        bg.beginPath(); bg.moveTo(x2, y2); bg.lineTo(x2 - ux * 4 - uy * 2.6, y2 - uy * 4 + ux * 2.6); bg.lineTo(x2 - ux * 4 + uy * 2.6, y2 - uy * 4 - ux * 2.6); bg.closePath(); bg.fill();
      }
    }
    // the attractors and their names
    bg.font = '600 11px ' + css('--sans', 'Inter, sans-serif');
    bg.textAlign = 'center';
    KEYS.forEach(function (k) {
      var a = POS[k];
      bg.beginPath(); bg.arc(px(a[0]), py(a[1]), 5 + 3 * Math.min(1.6, depth[k]), 0, Math.PI * 2);
      bg.fillStyle = COLOURS[k]; bg.fill();
      bg.lineWidth = 2; bg.strokeStyle = paper; bg.stroke();
    });
    bg.fillStyle = ink;
    var label = function (t, x, y) { bg.fillText(t.toUpperCase(), px(x), py(y)); };
    label('Enclosure', 0.17, 0.955); label('Uplift', 0.83, 0.955); label('Collapse', 0.17, 0.03); label('Takeover', 0.83, 0.03); label('Clash', 0.5, 0.665);
    clearTrails(paper);
  }

  // ---------- the civilisations ----------
  var parts = [];
  function spawn(x, y) {
    return { p: [x == null ? Math.random() : x, y == null ? Math.random() : y], life: 240 + Math.random() * 480, age: 0 };
  }
  function seed() { parts = []; for (var i = 0; i < 260; i++) parts.push(spawn()); }

  function clearTrails(paper) {
    fg.setTransform(dpr, 0, 0, dpr, 0, 0);
    fg.clearRect(0, 0, SIZE, SIZE);
  }

  function frame() {
    if (running && inView && !document.hidden && SIZE) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      fg.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the trails fade
      fg.globalCompositeOperation = 'destination-out';
      fg.fillStyle = 'rgba(0,0,0,0.075)';
      fg.fillRect(0, 0, SIZE, SIZE);
      fg.globalCompositeOperation = 'source-over';
      var noise = S * 0.02;
      for (var i = 0; i < parts.length; i++) {
        var q = parts[i];
        var x0 = px(q.p[0]), y0 = py(q.p[1]);
        stepPoint(q.p, noise);
        q.age++;
        var k = nearest(q.p[0], q.p[1]);
        fg.strokeStyle = COLOURS[k];
        fg.lineWidth = 1.6;
        fg.beginPath(); fg.moveTo(x0, y0); fg.lineTo(px(q.p[0]), py(q.p[1])); fg.stroke();
        fg.fillStyle = dark ? '#ffffff' : '#000000';
        fg.fillRect(px(q.p[0]) - 1, py(q.p[1]) - 1, 2, 2);
        if (q.age > q.life) parts[i] = spawn();
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- the dials ----------
  var timer = null;
  function apply(fromInput) {
    if (!fromInput) { dials.balance.value = Math.round(B * 100); dials.coord.value = Math.round(C * 100); dials.shocks.value = Math.round(S * 100); }
    outs.balance.textContent = B < -0.15 ? 'Defence-dominant' : (B > 0.15 ? 'Offence-dominant' : 'Balanced');
    outs.coord.textContent = Math.round(C * 100);
    outs.shocks.textContent = Math.round(S * 100);
    setDepths();
    clearTimeout(timer);
    timer = setTimeout(function () { computeBasins(); drawBackground(); }, 40);
  }

  dials.balance.addEventListener('input', function () { B = dials.balance.value / 100; apply(true); });
  dials.coord.addEventListener('input', function () { C = dials.coord.value / 100; apply(true); });
  dials.shocks.addEventListener('input', function () { S = dials.shocks.value / 100; apply(true); });

  root.querySelectorAll('[data-ph-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = PRESETS[b.dataset.phPreset];
      B = p.balance; C = p.coord; S = p.shocks;
      apply(false);
      root.querySelectorAll('[data-ph-preset]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
    });
  });

  playBtn.addEventListener('click', function () {
    running = !running;
    playBtn.textContent = running ? 'Pause' : 'Play';
  });
  root.querySelector('.ph-release').addEventListener('click', function () { seed(); clearTrails(); });

  // a click releases a handful of civilisations at that point
  fgCanvas.addEventListener('click', function (e) {
    var r = fgCanvas.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    for (var i = 0; i < 24; i++) parts.push(spawn(x + (Math.random() - 0.5) * 0.03, y + (Math.random() - 0.5) * 0.03));
    if (parts.length > 520) parts.splice(0, parts.length - 520);
  });

  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(stage);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
  new MutationObserver(drawBackground).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { running = false; playBtn.textContent = 'Play'; }

  setDepths();
  computeBasins();
  seed();
  layout();
  apply(false);
  requestAnimationFrame(frame);
})();
