// Civilisation Designer Console: the console of a civilisational designer with
// control over two variables, the cultural integrity and the membrane
// permeability of sub-topias. Set the dials and the civilisation's map moves
// into one of the four attractor states, or the Clash of Civilisations
// between them. Adapted from the original standalone console.
(function () {
  var root = document.querySelector('.cdc');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  var PASTEL_FILLS = ['#F4A79D', '#FFCC99', '#FFF2AF'];
  var PASTEL_BORDERS = ['#E68A73', '#F2B880', '#E6D690'];
  var MORAL_STATUS = ['#F2F2F7', '#1A1A1A', '#8E8E93'];
  var TAKE_YELLOW = '#FFF2AF';
  var TARGET_GRAY = '#D1D1D6';

  var SCENARIOS = {
    clash: {
      name: 'The Clash of Civilisations', subtitle: '(Cultural Competition, Conflict & Control)', sub: 'Medium integrity × medium permeability',
      body: '<p>Welcome to the present. Both dials sit at their historical defaults, and the map shows what this looks like: many cultures, each with enough internal coherence to keep a distinct identity, and each porous enough to be influenced by, and to influence, its neighbours.</p><p>This is the Westphalian inheritance: a fragile balance of soft power, maintained not by design but by the mutual inadequacy of every party to take over completely.</p><p class="cdc-status"><span>Status</span>From this underdetermined, hybrid condition, civilisation is pulled towards four attractors: one desirable, the other three catastrophic.</p>'
    },
    utopia: {
      name: 'Meta-Utopian Uplift', subtitle: '(Epistemic Equilibria)', sub: 'High integrity × high permeability',
      body: '<p>You have threaded the needle. Both dials are high, and what you have designed is the only attractor state in this framework that is not a catastrophe.</p><p>The boundaries between sub-topias are open: people can leave the community they were born into and join one that fits them. Selective pressure drives moral progress.</p><p class="cdc-status"><span>Status</span>Desirable. If integrity decays: mono-cultural takeover. If permeability collapses: meta-dystopian enclosure.</p>'
    },
    dystopia: {
      name: 'Meta-Dystopian Enclosure', subtitle: '(Localised Lock-Ins)', sub: 'High integrity × low permeability',
      body: '<p>The walls went up. You reduced permeability, reasonably enough at first: the memetic threats were real &ndash; targeted propaganda, AI-optimised influence operations, the soft-power reach of expansionist cultures.</p><p>What you have built is a landscape of sealed gardens. Some are genuinely utopian inside: well governed, internally consensual, morally coherent. Most are not.</p><p class="cdc-status"><span>Status</span>Catastrophic. The escape requires the enclosed sub-topias to want to open.</p>'
    },
    graygoo: {
      name: 'Mono-Cultural Takeover', subtitle: '(Gray Goo)', sub: 'Low integrity × high permeability',
      body: '<p>The flood came. You raised permeability but left the internal integrity of most cultures depleted. One by one, the distinct colours converged on a single hue. By the time any sub-topia recognised what was happening, its immune system was already compromised.</p><p class="cdc-status"><span>Status</span>Catastrophic, and likely unrecoverable. Once cultural diversity is lost to a monoculture, no internal pressure can regenerate it.</p>'
    },
    collapse: {
      name: 'Cultural Collapse', subtitle: '(Permanent Plateau)', sub: 'Low integrity × low permeability',
      body: '<p>Both systems failed. Internal integrity collapsed first, leaving populations that share a geography but not a meaning.</p><p>The borders, meanwhile, stayed closed: not because anyone chose enclosure, but because the defensive reflex outlasted the culture it was defending.</p><p class="cdc-status"><span>Status</span>Catastrophic. A plateau, recoverable only if sufficient internal stimulus arrives.</p>'
    }
  };

  var GLOSSARY = {
    name: 'Civilisation-Scale Cultural Attractors', subtitle: '(Four Futures)', sub: 'Overview',
    body: '<div class="cdc-gloss"><h3>The Clash of Civilisations</h3><p>An underdetermined, hybrid condition in which many cultures compete for survival and supremacy through soft and hard power.</p></div>' +
      '<div class="cdc-gloss"><h3>Meta-Utopian Uplift</h3><p>The only positive attractor: high integrity allows distinct moral experiments, and high permeability allows free movement and selective pressure towards better governance.</p></div>' +
      '<div class="cdc-gloss"><h3>Meta-Dystopian Enclosure</h3><p>High internal coherence but no movement between sub-topias. Without the threat of exit, sub-topias degrade into localised totalities or stagnant &lsquo;sealed gardens&rsquo;.</p></div>' +
      '<div class="cdc-gloss"><h3>Mono-Cultural Takeover</h3><p>A &lsquo;gray goo&rsquo; scenario in which low internal integrity leads to the erasure of cultural diversity, as the most aggressive memetic strain overwrites all the others.</p></div>' +
      '<div class="cdc-gloss"><h3>Cultural Collapse</h3><p>The failure of both internal meaning and external exchange: a permanent plateau of low-complexity survival.</p></div>'
  };

  var integrity = 50, permeability = 50, hexNodes = [], timers = [], currentScenario = null, frame;
  var visited = new Set(), enclosureVisited = new Set(), contagionMoral = null;
  var isStatusPrimary = false, circlesOn = false, takeoverDone = false;

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  // ---------- the map: a disc of hexagonal sub-topias ----------
  function initMap() {
    var container = $('cdc-mesh'), radius = 135, size = 12, layers = 6, map = new Map();
    var nbrs = function (q, r) { return [[q + 1, r], [q + 1, r - 1], [q, r - 1], [q - 1, r], [q - 1, r + 1], [q, r + 1]]; };
    for (var q = -layers; q <= layers; q++) {
      for (var r = Math.max(-layers, -q - layers); r <= Math.min(layers, -q + layers); r++) {
        var x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r), y = size * (3 / 2 * r);
        if (Math.sqrt(x * x + y * y) >= radius) continue;
        var g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('transform', 'translate(' + x.toFixed(2) + ',' + y.toFixed(2) + ')');
        var hex = document.createElementNS(SVGNS, 'polygon'), pts = [];
        for (var a = 0; a < 6; a++) { var ang = Math.PI / 3 * a + Math.PI / 6; pts.push((Math.cos(ang) * size * 1.05).toFixed(2) + ',' + (Math.sin(ang) * size * 1.05).toFixed(2)); }
        hex.setAttribute('points', pts.join(' '));
        hex.setAttribute('class', 'cdc-hex');
        var circ = document.createElementNS(SVGNS, 'circle');
        circ.setAttribute('r', '3.5');
        circ.setAttribute('class', 'cdc-circ');
        g.appendChild(hex); g.appendChild(circ); container.appendChild(g);
        var node = { el: hex, circ: circ, q: q, r: r, neighbors: [], fIdx: Math.floor(Math.random() * 3), bIdx: Math.floor(Math.random() * 3), mIdx: Math.floor(Math.random() * 3), wasUtopian: false };
        hexNodes.push(node); map.set(q + ',' + r, node);
      }
    }
    hexNodes.forEach(function (n) { nbrs(n.q, n.r).forEach(function (c) { var m = map.get(c[0] + ',' + c[1]); if (m) n.neighbors.push(m); }); });
  }

  // ---------- the two view switches and the key ----------
  function toggleLayer() {
    isStatusPrimary = !isStatusPrimary;
    $('cdc-layer').classList.toggle('on', isStatusPrimary);
    $('cdc-layer').setAttribute('aria-checked', isStatusPrimary ? 'true' : 'false');
    updateKey(); render();
  }
  function toggleCircles() {
    circlesOn = !circlesOn;
    $('cdc-circles').classList.toggle('on', circlesOn);
    $('cdc-circles').setAttribute('aria-checked', circlesOn ? 'true' : 'false');
    $('cdc-key-circ').classList.toggle('dim', !circlesOn);
    render();
  }
  function updateKey() {
    var integ = ['Low', 'Med', 'High'], status = ['Utopia', 'Dystopia', 'Mixed'];
    $('cdc-hex-label').textContent = isStatusPrimary ? 'Status (hex)' : 'Integrity (hex)';
    $('cdc-circ-label').textContent = isStatusPrimary ? 'Integrity (dot)' : 'Status (dot)';
    for (var i = 1; i <= 3; i++) {
      $('cdc-kh-' + i).style.fill = isStatusPrimary ? MORAL_STATUS[i - 1] : PASTEL_FILLS[i - 1];
      $('cdc-kh-t' + i).textContent = isStatusPrimary ? status[i - 1] : integ[i - 1];
      $('cdc-kc-' + i).style.background = isStatusPrimary ? PASTEL_FILLS[i - 1] : MORAL_STATUS[i - 1];
      $('cdc-kc-t' + i).textContent = isStatusPrimary ? integ[i - 1] : status[i - 1];
    }
  }

  // ---------- drawing the map for the current state ----------
  function paint(node, integ, moral) {
    node.el.style.fill = isStatusPrimary ? moral : integ;
    node.circ.style.fill = isStatusPrimary ? integ : moral;
  }
  function render() {
    hexNodes.forEach(function (n) {
      if (currentScenario === 'clash') {
        paint(n, PASTEL_FILLS[n.fIdx], MORAL_STATUS[n.mIdx]);
        n.el.style.stroke = PASTEL_BORDERS[n.bIdx];
        n.el.style.strokeWidth = '1px';
      } else if (currentScenario === 'utopia' && visited.has(n)) {
        paint(n, '#FFF2AF', isStatusPrimary ? MORAL_STATUS[0] : MORAL_STATUS[n.mIdx]);
      } else if (currentScenario === 'dystopia' && enclosureVisited.has(n)) {
        paint(n, '#FFF2AF', (n.wasUtopian || n.mIdx === 0) ? MORAL_STATUS[0] : MORAL_STATUS[n.mIdx]);
      } else if (currentScenario === 'collapse' && visited.has(n)) {
        var m = n.mIdx === 0 ? (n.q % 2 === 0 ? MORAL_STATUS[1] : MORAL_STATUS[2]) : MORAL_STATUS[n.mIdx];
        paint(n, '#F4A79D', m);
      } else if (currentScenario === 'graygoo' && visited.has(n)) {
        paint(n, takeoverDone ? TAKE_YELLOW : TARGET_GRAY, contagionMoral || MORAL_STATUS[n.mIdx]);
      }
      n.circ.style.opacity = circlesOn ? '1' : '0';
    });
  }

  // ---------- how each state spreads across the map ----------
  function spreadContagion(node) {
    if (!node || visited.has(node) || currentScenario !== 'graygoo') return;
    visited.add(node);
    if (!contagionMoral) contagionMoral = MORAL_STATUS[node.mIdx];
    node.el.style.stroke = TAKE_YELLOW; node.el.style.strokeWidth = '2.5px';
    later(function () { if (currentScenario === 'graygoo') render(); }, 200);
    node.neighbors.slice().sort(function () { return Math.random() - 0.5; }).forEach(function (nb, i) {
      if (!visited.has(nb)) later(function () { spreadContagion(nb); }, 120 + i * 40);
    });
    later(function () {
      if (currentScenario !== 'graygoo') return;
      node.el.style.stroke = 'var(--cdc-line)'; node.el.style.strokeWidth = '1px';
      if (visited.size === hexNodes.length) { takeoverDone = true; later(function () { if (currentScenario === 'graygoo') render(); }, 600); }
    }, 850);
  }
  function spreadWave(set, key, colour, node, delay, mark) {
    if (!node || set.has(node) || currentScenario !== key) return;
    set.add(node);
    if (mark) node.wasUtopian = true;
    later(function () {
      if (currentScenario !== key) return;
      render();
      node.el.style.stroke = colour; node.el.style.strokeWidth = '2.5px';
      later(function () { if (currentScenario === key) node.el.style.strokeWidth = '1px'; }, 1000);
      node.neighbors.forEach(function (nb) { if (!set.has(nb)) spreadWave(set, key, colour, nb, Math.random() * 300 + 100, mark); });
    }, delay);
  }
  function seeds(n) { var out = []; for (var i = 0; i < n; i++) out.push(hexNodes[Math.floor(Math.random() * hexNodes.length)]); return out; }

  // ---------- the state for a pair of dial settings ----------
  function scenarioFor(i, p) {
    if (i > 75 && p > 75) return 'utopia';
    if (i > 75 && p < 25) return 'dystopia';
    if (i < 25 && p > 75) return 'graygoo';
    if (i < 25 && p < 25) return 'collapse';
    return 'clash';
  }
  function showText(d) {
    $('cdc-sub').textContent = d.sub;
    $('cdc-name').textContent = d.name;
    $('cdc-subtitle').textContent = d.subtitle;
    $('cdc-body').innerHTML = d.body;
  }
  function updateScenario(i, p) {
    var key = scenarioFor(i, p);
    root.querySelectorAll('.cdc-quad').forEach(function (q) { q.classList.toggle('active', q.getAttribute('data-key') === key); });
    root.querySelectorAll('.cdc-scen').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-key') === key); b.setAttribute('aria-pressed', b.getAttribute('data-key') === key ? 'true' : 'false'); });
    $('cdc-matrix').classList.toggle('clash-mode', key === 'clash');
    if (key === currentScenario) return;
    if (key === 'clash' || key === 'collapse' || key === 'graygoo') hexNodes.forEach(function (n) { n.wasUtopian = false; });
    currentScenario = key; takeoverDone = false; contagionMoral = null;
    timers.forEach(clearTimeout); timers = []; visited.clear(); enclosureVisited.clear();
    if (key === 'dystopia') seeds(3).forEach(function (s) { spreadWave(enclosureVisited, 'dystopia', '#F4A79D', s, 0); });
    else if (key === 'utopia') { hexNodes.forEach(function (n) { n.el.style.stroke = 'var(--cdc-line)'; }); seeds(3).forEach(function (s) { spreadWave(visited, 'utopia', '#E6D690', s, 0, true); }); }
    else if (key === 'collapse') seeds(3).forEach(function (s) { spreadWave(visited, 'collapse', '#E68A73', s, 0); });
    else if (key === 'graygoo') spreadContagion(seeds(1)[0]);
    else render();
    showText(SCENARIOS[key]);
  }

  // ---------- the dials ----------
  function showDials(i, p) {
    $('cdc-ival').textContent = Math.round(i) + '%';
    $('cdc-pval').textContent = Math.round(p) + '%';
    $('cdc-isl').value = Math.round(i);
    $('cdc-psl').value = Math.round(p);
  }
  // follow the marker as it glides, so the dials move with it
  function followDot() {
    var dot = $('cdc-dot'), cs = getComputedStyle(dot), box = $('cdc-matrix').getBoundingClientRect();
    if (box.width) showDials(100 - parseFloat(cs.top) / box.height * 100, parseFloat(cs.left) / box.width * 100);
    frame = requestAnimationFrame(followDot);
  }
  function updateButtons() {
    $('cdc-i-up').disabled = integrity >= 100; $('cdc-i-dn').disabled = integrity <= 0;
    $('cdc-p-up').disabled = permeability >= 100; $('cdc-p-dn').disabled = permeability <= 0;
    $('cdc-b-up').disabled = integrity >= 100 && permeability >= 100;
    $('cdc-b-dn').disabled = integrity <= 0 && permeability <= 0;
  }
  function snapTo(i, p, instant) {
    cancelAnimationFrame(frame);
    integrity = i; permeability = p;
    var dot = $('cdc-dot');
    dot.classList.toggle('instant', !!instant);
    dot.style.left = p + '%'; dot.style.top = (100 - i) + '%';
    if (instant) showDials(i, p);
    else { followDot(); setTimeout(function () { cancelAnimationFrame(frame); showDials(integrity, permeability); }, 1300); }
    updateScenario(i, p);
    updateButtons();
  }
  function move(axis, dir) {
    var target = dir > 0 ? 100 : 0;
    if (axis === 'i' && integrity !== target) snapTo(target, permeability);
    if (axis === 'p' && permeability !== target) snapTo(integrity, target);
  }
  function showGlossary() {
    root.querySelectorAll('.cdc-scen').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    $('cdc-all').classList.add('active'); $('cdc-all').setAttribute('aria-pressed', 'true');
    showText(GLOSSARY);
  }

  // ---------- wiring ----------
  $('cdc-layer').addEventListener('click', toggleLayer);
  $('cdc-circles').addEventListener('click', toggleCircles);
  $('cdc-i-up').addEventListener('click', function () { move('i', 1); });
  $('cdc-i-dn').addEventListener('click', function () { move('i', -1); });
  $('cdc-p-up').addEventListener('click', function () { move('p', 1); });
  $('cdc-p-dn').addEventListener('click', function () { move('p', -1); });
  $('cdc-b-up').addEventListener('click', function () { snapTo(100, 100); });
  $('cdc-b-dn').addEventListener('click', function () { snapTo(0, 0); });
  $('cdc-reset').addEventListener('click', function () { snapTo(50, 50); });
  $('cdc-all').addEventListener('click', showGlossary);
  root.querySelectorAll('[data-snap]').forEach(function (el) {
    el.addEventListener('click', function () { var v = el.getAttribute('data-snap').split(','); snapTo(+v[0], +v[1]); });
  });
  $('cdc-isl').addEventListener('input', function () { snapTo(+this.value, permeability, true); });
  $('cdc-psl').addEventListener('input', function () { snapTo(integrity, +this.value, true); });

  initMap();
  updateKey();
  snapTo(50, 50, true);
  render();
})();
