// Dynamics: the Cultural Dynamics Simulator, a cellular automaton for
// topologically modelling civilisation-scale cultural dynamics across
// sovereign political units.
//
// Each hexagon is a sub-topia with three scores, inherited from its culture,
// named as in the article's 2x2 of the four attractor states:
//   sub-topia status          how utopian, notopian or dystopian it is
//   cultural integrity        its culture's hold and pull: its power to keep
//                             itself and to spread (it does the work that
//                             memetic virality and cultural integrity did
//                             separately in the earlier version)
//   membrane impermeability   how closed its borders are
// A neighbour's culture is adopted when its cultural integrity beats both the
// target's membrane impermeability and the target's own cultural integrity.
(function () {
  'use strict';
  var sim = document.querySelector('.sim');
  if (!sim) return;
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = 'http://www.w3.org/2000/svg';

  var nodes = [];
  var initialState = null;
  var phaseHistory = [];
  var proseLog = [];
  var epochHistory = [];
  var simulationEpoch = 0;
  var activePrimary = 'softPower';
  var activeSecondary = null;
  var isImpOverlayActive = true;
  var isSimultaneous = true;
  var isSpectrum = true;
  var currentDensity = 'compact';
  var showScores = true;
  var showImpScores = false;
  var currentLayers = 3;
  var isPlaying = false;
  var isCompleted = false;
  var scoreScale = 100;
  var simInterval = null;
  var currentLevel = 'basic';
  var activeScenarioMode = 'random';

  var PASTEL_RAINBOW = ['#FFB7B2', '#FFDAC1', '#FFF9C4', '#C5E1A5', '#B3E5FC', '#C5CAE9', '#D1C4E9'];
  var CULTURE_NAMES = ['The Culture', 'The Idirans', 'The Homomda', 'The Morthanveld', 'The Azad', 'The Gzilt', 'The Sublimed'];
  var rnd = function () { return Math.random() * 100; };

  var cultureScores = {
    moral: PASTEL_RAINBOW.map(rnd),
    softPower: PASTEL_RAINBOW.map(rnd),
    impermeability: PASTEL_RAINBOW.map(rnd)
  };

  var paletteMap = {
    moral: ['#1A1A1A', '#8E8E93', '#F2F2F7'],
    // cultural integrity: red (low), orange, yellow (high), as in the earlier version
    softPower: ['#E68A73', '#E6994D', '#FDE68A'],
    impermeability: ['#FDE68A', '#E6994D', '#A64B35'],
    cultures: PASTEL_RAINBOW
  };

  // the three grids: cultural affiliation (top left), sub-topia status (top
  // right) and cultural integrity (below, between them, with the borders drawn on it)
  var GRIDS = [
    { type: 'cultures', mesh: 'mesh-cultures', box: 'box-cultures' },
    { type: 'moral', mesh: 'mesh-main', box: 'box-main' },
    { type: 'softPower', mesh: 'mesh-softpower', box: 'box-softpower' }
  ];

  var ICONS = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  };
  var CARET = '<svg viewBox="0 0 24 24" width="14" height="14" style="fill: currentColor; margin-left: 8px;"><path d="M7 10l5 5 5-5z"/></svg>';

  var SCENARIO_NAMES = {
    random: 'Random',
    monocultural: 'Monocultural Takeover',
    dystopian: 'Meta Dystopian Enclosure',
    utopian: 'Meta Utopian Uplift'
  };

  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }
  function baseStroke() { return isDark() ? '#3A3A3C' : '#E2DDD1'; }

  // ---------- the scenario menu ----------
  function toggleScenarioDropdown() {
    if (isPlaying) return;
    $('scenario-dropdown-menu').classList.toggle('show');
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#scenario-dropdown-btn')) $('scenario-dropdown-menu').classList.remove('show');
  });

  function setDynamicScenario(mode) {
    activeScenarioMode = mode;
    $('scenario-dropdown-btn').innerHTML = 'Civilisational Scenarios: ' + SCENARIO_NAMES[mode] + ' ' + CARET;
    document.querySelectorAll('#scenario-dropdown-menu .dropdown-item').forEach(function (el) {
      el.classList.toggle('active', el.dataset.mode === mode);
    });
    $('scenario-dropdown-menu').classList.remove('show');
    randomizeConfiguration();
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  // ---------- the written account: one panel per variable ----------
  var proseBgColors = ['rgba(230, 138, 115, 0.06)', 'rgba(142, 142, 147, 0.06)', 'rgba(230, 153, 77, 0.06)', 'rgba(166, 75, 53, 0.06)'];
  var proseBorders = ['var(--accent)', 'var(--moral-neu)', 'var(--integ-med)', 'var(--imp-high)'];
  var variableLabels = ['Cultural Affiliation', 'Sub-topia Status', 'Cultural Integrity', 'Membrane Impermeability'];

  function formatSection(texts, cultureColorHex) {
    return texts.map(function (t, i) {
      var bg = proseBgColors[i], border = proseBorders[i];
      if (i === 0 && cultureColorHex) { bg = hexToRgba(cultureColorHex, 0.08); border = cultureColorHex; }
      return '<div class="prose-panel" style="background: ' + bg + '; border-left-color: ' + border + ';">' +
        '<div class="prose-panel-head">' + variableLabels[i] + '</div>' +
        '<div class="prose-panel-body">' + t + '</div></div>';
    }).join('');
  }

  function toggleSidebar() { $('main-workspace').classList.toggle('sidebar-open'); }

  function updateHTMLWithAnim(elId, html, animType) {
    var el = $(elId);
    if (!el) return;
    if (el._rawHTML !== html) {
      el._rawHTML = html;
      el.innerHTML = html;
      el.classList.remove('data-pulse', 'fade-in-text');
      void el.offsetWidth;
      if (animType === 'pulse') el.classList.add('data-pulse');
      else if (animType === 'fade') {
        var rows = el.querySelectorAll('.wb-row');
        if (rows.length) rows[rows.length - 1].classList.add('fade-in-text');
      }
    }
  }

  function generatePlaceholderExp() {
    var one = '<div class="prose-step"><span class="prose-step-head">Initial State</span><span class="muted-italic">Calculating initial distribution across the grid...</span></div>' +
      '<div class="prose-step"><span class="prose-step-head">End State</span><span class="muted-italic">Waiting for epoch completion to determine final distribution.</span></div>' +
      '<div class="prose-step"><span class="prose-step-head">Total Shift</span><span class="muted-italic">Comparison will be available once simulation concludes.</span></div>';
    return '<div class="wb-row prose-row">' + formatSection([one, one, one, one], null) + '</div>';
  }

  // ---------- running ----------
  function toggleScenario() {
    if (isCompleted) { resetToInitial(); return; }
    isPlaying = !isPlaying;
    var btn = $('scenario-1-btn'), icon = $('scenario-icon');
    if (isPlaying) {
      btn.classList.add('playing');
      btn.classList.remove('completed');
      btn.lastChild.textContent = ' In-Progress';
      icon.innerHTML = ICONS.pause;
      simInterval = setInterval(runSimulationStep, 800);
    } else {
      btn.classList.remove('playing');
      btn.lastChild.textContent = ' Run Simulation';
      icon.innerHTML = ICONS.play;
      clearInterval(simInterval);
      simInterval = null;
    }
    updateButtonStates();
  }

  var DIRS = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
  function getNeighbors(node) {
    return nodes.filter(function (o) { return DIRS.some(function (d) { return o.q === node.q + d.q && o.r === node.r + d.r; }); });
  }

  // where the civilisation sits on the four-attractor diagram:
  //   cultural integrity    = the share of sub-topias still holding their
  //                           original culture, scaled by average cultural integrity
  //                           (half weight): cultures that keep themselves
  //                           and keep their pull stay high
  //   membrane permeability = how open the membranes still standing between
  //                           different cultures are (100 minus their average
  //                           impermeability); with one culture left there are
  //                           no membranes, and the map is fully permeable
  function attractorPoint(nodeData, avgs) {
    var kept = 0, imp = 0, pairs = 0;
    nodeData.forEach(function (n, i) {
      if (initialState && initialState[i] && n.cultureIndex === initialState[i].cultureIndex) kept++;
      DIRS.forEach(function (d) {
        var m = nodeData.find(function (o) { return o.q === n.q + d.q && o.r === n.r + d.r; });
        if (m && m.cultureIndex !== n.cultureIndex) { imp += (n.impermeability + m.impermeability) / 2; pairs++; }
      });
    });
    var retention = initialState ? kept / nodeData.length : 1;
    return {
      I: 100 * retention * (0.5 + 0.5 * avgs.softPower / 100),
      P: pairs ? 100 - imp / pairs : 100
    };
  }

  function captureEpochState(nodeData) {
    var avgs = {};
    ['moral', 'softPower', 'impermeability'].forEach(function (m) {
      avgs[m] = nodeData.reduce(function (s, n) { return s + n[m]; }, 0) / nodeData.length;
    });
    var counts = new Array(7).fill(0);
    nodeData.forEach(function (n) { counts[n.cultureIndex]++; });
    epochHistory.push({ avgs: avgs, counts: counts, point: attractorPoint(nodeData, avgs) });
  }

  // ---------- the four-attractor diagram, with the path so far ----------
  var ATTRACTORS = {
    enclosure: 'Meta-Dystopian Enclosure', uplift: 'Meta-Utopian Uplift',
    collapse: 'Cultural Collapse', takeover: 'Mono-Cultural Takeover', clash: 'Clash of Civilisations'
  };
  // the plot: x from 26 to 206 (permeability), y from 10 to 190 (integrity)
  var AX = { x0: 26, x1: 206, y0: 10, y1: 190 };
  function attX(P) { return AX.x0 + (AX.x1 - AX.x0) * P / 100; }
  function attY(I) { return AX.y1 - (AX.y1 - AX.y0) * I / 100; }
  function attractorOf(pt) {
    if (pt.I > 30 && pt.I < 70 && pt.P > 25 && pt.P < 75) return 'clash';
    if (pt.I >= 50) return pt.P < 50 ? 'enclosure' : 'uplift';
    return pt.P < 50 ? 'collapse' : 'takeover';
  }
  function drawLocator() {
    var trail = $('att-trail'), dots = $('att-dots'), mark = $('att-mark');
    if (!trail || !epochHistory.length) return;
    var pts = epochHistory.map(function (e) { return e.point; });
    trail.setAttribute('points', pts.map(function (p) { return attX(p.P).toFixed(1) + ',' + attY(p.I).toFixed(1); }).join(' '));
    dots.innerHTML = pts.slice(0, -1).map(function (p) { return '<circle cx="' + attX(p.P).toFixed(1) + '" cy="' + attY(p.I).toFixed(1) + '" r="2"/>'; }).join('');
    var last = pts[pts.length - 1];
    mark.setAttribute('cx', attX(last.P).toFixed(1));
    mark.setAttribute('cy', attY(last.I).toFixed(1));
    var k = attractorOf(last);
    $('att-name').textContent = ATTRACTORS[k];
    $('att-coords').textContent = 'Turn ' + simulationEpoch + ' \u00b7 integrity ' + Math.round(last.I) + ' \u00b7 permeability ' + Math.round(last.P);
    sim.setAttribute('data-attractor', k);
  }

  // a sub-topia adopts a neighbour's culture when that culture's cultural integrity
  // beats both its borders and its own cultural integrity
  function runSimulationStep() {
    var changed = false;
    simulationEpoch++;
    var next = nodes.map(function (n) { return Object.assign({}, n); });
    nodes.forEach(function (target, index) {
      var winner = null;
      getNeighbors(target).forEach(function (origin) {
        if (origin.cultureIndex === target.cultureIndex) return;
        if (origin.softPower > target.impermeability && origin.softPower > target.softPower) {
          if (!winner || origin.softPower > winner.softPower) winner = origin;
        }
      });
      if (winner) {
        changed = true;
        next[index].cultureIndex = winner.cultureIndex;
        next[index].softPower = winner.softPower;
        next[index].impermeability = winner.impermeability;
        next[index].moral = winner.moral;
      }
    });
    nodes.forEach(function (n, i) { n.cultureIndex = next[i].cultureIndex; n.softPower = next[i].softPower; n.impermeability = next[i].impermeability; n.moral = next[i].moral; });
    captureEpochState(nodes);
    updateDisplay();
    if (!changed) completeSimulation();
  }

  function completeSimulation() {
    isPlaying = false; isCompleted = true;
    clearInterval(simInterval); simInterval = null;
    var btn = $('scenario-1-btn');
    btn.classList.remove('playing'); btn.classList.add('completed');
    btn.lastChild.textContent = ' Completed'; $('scenario-icon').innerHTML = ICONS.check;
    updateDisplay();
    updateButtonStates();
  }

  function setSystemLevel(mode) {
    if (isPlaying) return;
    currentLevel = mode;
    if (isCompleted) { randomizeConfiguration(); return; }
    isSimultaneous = true;
    sim.classList.add('sim-mode');
    if (mode === 'basic') { setScale(2); setScoreRange(10); } else { setScale(4); setScoreRange(100); }
    setSpectrum(true);
    showScores = true;
    updateDisplay();
  }

  // ---------- colour ----------
  function interpolateColor(c1, c2, f) {
    var h = function (x) { return x.toString(16).padStart(2, '0'); };
    var r1 = parseInt(c1.substring(1, 3), 16), g1 = parseInt(c1.substring(3, 5), 16), b1 = parseInt(c1.substring(5, 7), 16);
    var r2 = parseInt(c2.substring(1, 3), 16), g2 = parseInt(c2.substring(3, 5), 16), b2 = parseInt(c2.substring(5, 7), 16);
    return '#' + h(Math.round(r1 + f * (r2 - r1))) + h(Math.round(g1 + f * (g2 - g1))) + h(Math.round(b1 + f * (b2 - b1)));
  }

  function getSpectrumColor(val, palette, type) {
    if (type === 'cultures') return palette[val % palette.length];
    if (!isSpectrum) return val < 33.3 ? palette[0] : (val < 66.6 ? palette[1] : palette[2]);
    if (val <= 50) return interpolateColor(palette[0], palette[1], val / 50);
    return interpolateColor(palette[1], palette[2], (val - 50) / 50);
  }

  function isColorDark(hex) {
    if (!hex || hex === 'transparent' || hex.indexOf('var') === 0) return false;
    var r = parseInt(hex.substring(1, 3), 16), g = parseInt(hex.substring(3, 5), 16), b = parseInt(hex.substring(5, 7), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
  }

  function setDensity(mode) {
    currentDensity = mode;
    $('dens-compact').classList.toggle('active', mode === 'compact');
    $('dens-spatial').classList.toggle('active', mode === 'spatial');
    initGrids(currentLayers);
  }

  // ---------- the grids ----------
  function initGrids(layers) {
    sim.classList.remove('sim-ready');
    GRIDS.forEach(function (g) { $(g.mesh).innerHTML = ''; });
    nodes = []; phaseHistory = []; proseLog = []; epochHistory = []; simulationEpoch = 0;

    var hexSize = 15 * (1 + (5 - layers) * 0.35) * (isSimultaneous ? 1.1 : 1.25);
    var spacingSpatial = 1.08;
    var scaleSpatial = layers <= 2 ? 0.92 : (0.91 - (layers - 3) * 0.03);

    for (var q = -layers; q <= layers; q++) {
      for (var r = Math.max(-layers, -q - layers); r <= Math.min(layers, -q + layers); r++) {
        var cIdx = Math.floor(Math.random() * 7);
        var node = {
          q: q, r: r, chessId: String.fromCharCode(65 + q + layers) + (r + layers + 1),
          softPower: cultureScores.softPower[cIdx],
          impermeability: cultureScores.impermeability[cIdx],
          moral: cultureScores.moral[cIdx],
          cultureIndex: cIdx, els: [], circles: [], txt: []
        };
        GRIDS.forEach(function (grid) {
          // the cultural integrity grid is always spatial, so its borders show
          var spatial = grid.type === 'softPower' || currentDensity === 'spatial';
          var sF = spatial ? spacingSpatial : 1, hS = spatial ? scaleSpatial : 1;
          var x = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r) * sF;
          var y = hexSize * (1.5 * r) * sF;
          var g = document.createElementNS(SVGNS, 'g'); g.setAttribute('transform', 'translate(' + x + ', ' + y + ')');
          var h = document.createElementNS(SVGNS, 'polygon');
          var pts = [];
          for (var a = 0; a < 6; a++) { var ang = Math.PI / 3 * a + Math.PI / 6; pts.push(Math.cos(ang) * hexSize + ',' + Math.sin(ang) * hexSize); }
          h.setAttribute('points', pts.join(' ')); h.setAttribute('class', 'hex-cell'); h.setAttribute('transform', 'scale(' + hS + ')');
          if (!spatial) h.style.strokeWidth = '0.5px';
          var circ = document.createElementNS(SVGNS, 'circle'); circ.setAttribute('r', hexSize * 0.2); circ.setAttribute('class', 'hex-circle');
          var t = document.createElementNS(SVGNS, 'text'); t.setAttribute('class', 'hex-label');
          t.style.fontSize = (5.5 * (hexSize / 15)) + 'px';
          t.dataset.base = 5.5 * (hexSize / 15);
          g.appendChild(h); g.appendChild(circ); g.appendChild(t); $(grid.mesh).appendChild(g);
          node.els.push(h); node.circles.push(circ); node.txt.push(t);
        });
        nodes.push(node);
      }
    }
    initialState = nodes.map(function (n) { return { q: n.q, r: n.r, chessId: n.chessId, softPower: n.softPower, impermeability: n.impermeability, moral: n.moral, cultureIndex: n.cultureIndex }; });
    captureEpochState(initialState);
    updateHTMLWithAnim('combined-prose-container', generatePlaceholderExp(), 'none');
    updateDisplay();
    setTimeout(function () { sim.classList.add('sim-ready'); }, 50);
  }

  function setScoreRange(range) {
    scoreScale = range;
    $('range-10').classList.toggle('active', range === 10);
    $('range-100').classList.toggle('active', range === 100);
    updateDisplay();
  }

  function formatScore(val) { return scoreScale === 10 ? (val / 10).toFixed(1) : Math.round(val); }

  // the cultural integrity tiles show cultural integrity, or cultural integrity / impermeability
  function setImpScores(on) {
    showImpScores = on;
    $('tile-sp').classList.toggle('active', !on);
    $('tile-sp-imp').classList.toggle('active', on);
    updateDisplay();
  }

  function updateButtonStates() {
    var primaryIds = { cultures: 'btn-cultures', moral: 'btn-moral', softPower: 'btn-softpower' };
    var secondaryIds = { cultures: 'ovl-cultures', moral: 'ovl-moral', softPower: 'ovl-softpower' };
    $('lvl-basic').classList.toggle('active', currentLevel === 'basic');
    $('lvl-complex').classList.toggle('active', currentLevel === 'complex');
    document.querySelectorAll('#scale-toggle .segment, #level-toggle-sidebar .segment').forEach(function (b) { b.disabled = isPlaying; });
    var dd = $('scenario-dropdown-btn');
    dd.disabled = isPlaying; dd.style.opacity = isPlaying ? '0.35' : '1'; dd.style.cursor = isPlaying ? 'not-allowed' : 'pointer';
    Object.keys(primaryIds).forEach(function (k) { $(primaryIds[k]).classList.toggle('active', !isSimultaneous && activePrimary === k); });
    Object.keys(secondaryIds).forEach(function (k) {
      var b = $(secondaryIds[k]);
      b.classList.toggle('active', activeSecondary === k);
      b.disabled = isSimultaneous || activePrimary === k;
    });
    var impBtn = $('ovl-impermeability');
    impBtn.classList.toggle('active', isImpOverlayActive);
    impBtn.disabled = isSimultaneous;
    $('spec-on').classList.toggle('active', isSpectrum);
    $('spec-off').classList.toggle('active', !isSpectrum);
    var st = $('sim-toggle').children;
    st[0].classList.toggle('active', isSimultaneous);
    st[1].classList.toggle('active', !isSimultaneous);
    $('dens-compact').classList.toggle('active', currentDensity === 'compact');
    $('dens-spatial').classList.toggle('active', currentDensity === 'spatial');
  }

  // ---------- doughnut charts ----------
  function drawPieChart(containerId, data, initData) {
    var container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var initTotal = initData ? initData.reduce(function (s, d) { return s + d.value; }, 0) : total;
    if (total === 0 && (!initData || initTotal === 0)) { container.innerHTML = '—'; return; }

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '-24 -24 48 48');
    svg.setAttribute('class', 'pie-svg');
    var tooltip = document.createElement('div'); tooltip.className = 'pie-tooltip'; container.appendChild(tooltip);
    var stateLabel = document.createElement('div'); stateLabel.className = 'pie-state';
    var isBorders = containerId === 'chart-imp-single';
    var useData = initData || data;
    var slices = useData.map(function (d, i) {
      var initP = d.value / (initTotal || 1), targetP = data[i].value / (total || 1);
      return { label: data[i].label, color: data[i].color, initP: initP, targetP: targetP, currentP: initP };
    });
    var activeHover = null;
    var renderTip = function () { if (activeHover) tooltip.textContent = activeHover.label + ': ' + Math.round(activeHover.currentP * 100) + '%'; };

    slices.forEach(function (slice) {
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('class', 'pie-slice-path');
      path.style.strokeLinejoin = 'round';
      if (isBorders) { path.style.fill = 'transparent'; path.style.stroke = slice.color; path.style.strokeWidth = '1.2'; }
      else { path.style.fill = slice.color; path.style.stroke = 'var(--bg)'; path.style.strokeWidth = '1'; }
      var place = function (e) { var rc = container.getBoundingClientRect(); tooltip.style.left = (e.clientX - rc.left + 12) + 'px'; tooltip.style.top = (e.clientY - rc.top + 12) + 'px'; };
      path.addEventListener('mouseenter', function (e) { activeHover = slice; if (isBorders) path.style.strokeWidth = '2'; else path.style.opacity = '0.75'; tooltip.style.visibility = 'visible'; renderTip(); place(e); });
      path.addEventListener('mousemove', function (e) { if (activeHover) place(e); });
      path.addEventListener('mouseleave', function () { activeHover = null; if (isBorders) path.style.strokeWidth = '1.2'; else path.style.opacity = '1'; tooltip.style.visibility = 'hidden'; });
      slice.el = path; svg.appendChild(path);
    });
    container.appendChild(svg);
    container.appendChild(stateLabel);

    var isEndState = false, lastToggle = performance.now(), anim = null;
    function wedge(start, pct, inner, outer, gap) {
      pct = Math.max(0, Math.min(1, pct));
      if (pct <= 0.001) return '';
      if (pct >= 0.999) return 'M 0 -' + outer + ' A ' + outer + ' ' + outer + ' 0 1 1 0 ' + outer + ' A ' + outer + ' ' + outer + ' 0 1 1 0 -' + outer + ' Z M 0 -' + inner + ' A ' + inner + ' ' + inner + ' 0 1 0 0 ' + inner + ' A ' + inner + ' ' + inner + ' 0 1 0 0 -' + inner + ' Z';
      var s = start + gap / 2, p = Math.max(0, pct - gap);
      if (p <= 0) return '';
      var a1 = s * 2 * Math.PI - Math.PI / 2, a2 = (s + p) * 2 * Math.PI - Math.PI / 2, large = p > 0.5 ? 1 : 0;
      return 'M ' + Math.cos(a1) * outer + ' ' + Math.sin(a1) * outer + ' A ' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + Math.cos(a2) * outer + ' ' + Math.sin(a2) * outer +
        ' L ' + Math.cos(a2) * inner + ' ' + Math.sin(a2) * inner + ' A ' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + Math.cos(a1) * inner + ' ' + Math.sin(a1) * inner + ' Z';
    }
    function animate() {
      var progress = Math.min((performance.now() - lastToggle) / 1200, 1);
      var ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      var acc = 0, visible = slices.filter(function (s) { return s.currentP > 0.01; }).length;
      slices.forEach(function (slice) {
        var a = isEndState ? slice.initP : slice.targetP, b = isEndState ? slice.targetP : slice.initP;
        slice.currentP = initData ? a + (b - a) * ease : slice.targetP;
        var gap = (isBorders && visible > 1 && slice.currentP < 0.99) ? 0.08 : 0;
        slice.el.setAttribute('d', wedge(acc, slice.currentP, 12, 20, gap));
        acc += slice.currentP;
      });
      renderTip();
      if (progress < 1) anim = requestAnimationFrame(animate);
    }
    if (initData) {
      var toggle = function () {
        isEndState = !isEndState; lastToggle = performance.now();
        stateLabel.textContent = isEndState ? 'End State' : 'Initial State';
        if (anim) cancelAnimationFrame(anim);
        animate();
      };
      setTimeout(toggle, 100);
      var id = setInterval(function () { if (!container.contains(svg)) { clearInterval(id); return; } toggle(); }, 2800);
    } else {
      stateLabel.textContent = 'Initial Conditions';
      animate();
    }
  }

  function getScenarioDefinition(title) {
    var defs = [];
    if (title.indexOf('Utopian Takeover') >= 0) defs.push('Absolute global harmony under a single culture.');
    else if (title.indexOf('Utopian Hegemony') >= 0) defs.push('Absolute global harmony under a single culture in its final stabilised form.');
    else if (title.indexOf('Dystopian Takeover') >= 0) defs.push('Totalitarian control by a single culture.');
    else if (title.indexOf('Dystopian Hegemony') >= 0) defs.push('Totalitarian control by a single culture in its final stabilised form.');
    else if (title.indexOf('Mono Cultural Takeover') >= 0) defs.push(title.indexOf('Resistant Enclaves') >= 0 ? 'One culture controls the majority of the map, though small pockets of resistance endure.' : 'A single culture has entirely assimilated the map.');
    else if (title.indexOf('Mono Cultural Hegemony') >= 0) defs.push(title.indexOf('Resistant Enclaves') >= 0 ? 'One culture permanently wields overwhelming influence, though marginal resistance remains.' : 'A single dominant culture wields overwhelming permanent influence over the board.');
    else if (title.indexOf('Meta Utopian Uplift') >= 0) defs.push('A peaceful, prosperous world shared by multiple distinct cultures.');
    else if (title.indexOf('Meta Dystopian Downfall') >= 0) defs.push('The entire world has collapsed into a harsh dystopia across various fractured cultures.');
    else if (title.indexOf('Meta Utopian Enclosure') >= 0) defs.push('A highly fragmented map that maintains an overall utopian standard despite pockets of dystopia.');
    else if (title.indexOf('Meta Dystopian Enclosure') >= 0) defs.push('A highly fragmented, unstable map with no single culture able to establish dominance.');
    if (title.indexOf('Cultural Collapse') >= 0) defs.push('The cultural integrity of the surviving societies has critically broken down.');
    return defs.length ? defs.join(' ') : 'The civilisations have reached a stabilised cultural deadlock.';
  }

  var hexClip = 'clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);';
  function swatch(color, w, h, extra) { return '<div style="width: ' + w + 'px; height: ' + h + 'px; background: ' + color + '; ' + hexClip + ' flex-shrink: 0;' + (extra || '') + '"></div>'; }
  function statusColorFor(m) { return m >= 67 ? 'var(--moral-uto)' : (m <= 33 ? 'var(--moral-dys)' : 'var(--moral-neu)'); }

  // ---------- the analytics and the written account ----------
  var combinedInit = [], combinedEnd = [], combinedShift = [];

  function updateCulturalAnalytics() {
    if (!initialState || !nodes.length) return;
    var totalNodes = nodes.length;

    var formatCellWithKey = function (label, color, count, opacity, isBorder) {
      var c = count !== null ? '<span class="cell-count">' + count + '</span>' : '<span class="cell-count"></span>';
      var sw = isBorder
        ? '<svg width="12" height="14" viewBox="0 0 16 18" style="flex-shrink: 0; overflow: visible; margin-top: 1px;"><polygon points="8,1 15,5 15,13 8,17 1,13 1,5" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/></svg>'
        : swatch(color, 10, 12, ' margin-right: 2px; margin-top: 1px;');
      return '<div class="cell-row" style="opacity: ' + (opacity == null ? 1 : opacity) + ';">' + c + sw + '<span class="cell-label">' + label + '</span></div>';
    };
    var getShiftDiv = function (a, b, opacity) {
      var d = b - a, color = '#8E8E93', sign = '';
      if (d > 0) { color = '#40916C'; sign = '+'; } else if (d < 0) color = '#A64B35';
      return '<div class="cell-shift" style="opacity: ' + (opacity == null ? 1 : opacity) + '; color: ' + color + ';">(' + (d === 0 ? '0' : sign + d) + ')</div>';
    };
    var categorise = function (set, key) {
      var c = { high: 0, med: 0, low: 0 };
      set.forEach(function (n) { var v = n[key]; if (v >= 67) c.high++; else if (v <= 33) c.low++; else c.med++; });
      return c;
    };
    var statText = function (config, a, b) {
      var name = config.metricName.toLowerCase(), L = config.labels.map(function (l) { return l.toLowerCase(); });
      var parts = [];
      [['high', 0], ['med', 1], ['low', 2]].forEach(function (k) {
        var d = b[k[0]] - a[k[0]];
        if (d !== 0) parts.push('<strong>' + (d > 0 ? '+' : '') + d + '</strong> ' + L[k[1]]);
      });
      var diff;
      if (!parts.length) diff = 'The distribution of ' + name + ' remained completely stable with no net changes.';
      else if (parts.length === 1) diff = 'The only change in ' + name + ' was a shift of ' + parts[0] + ' regions.';
      else if (parts.length === 2) diff = 'Net changes in ' + name + ' consisted of ' + parts[0] + ' regions and ' + parts[1] + ' regions.';
      else diff = 'Net changes in ' + name + ' consisted of ' + parts[0] + ' regions, ' + parts[1] + ' regions, and ' + parts[2] + ' regions.';
      var moral = config.key === 'moral';
      var init = moral
        ? 'The simulation began with <strong>' + a.high + '</strong> regions holding a ' + L[0] + ' ' + name + ', <strong>' + a.med + '</strong> with a ' + L[1] + ' status, and <strong>' + a.low + '</strong> with a ' + L[2] + ' status.'
        : 'The simulation began with <strong>' + a.high + '</strong> regions showing ' + L[0] + ' ' + name + ', <strong>' + a.med + '</strong> with ' + L[1] + ' levels, and <strong>' + a.low + '</strong> with ' + L[2] + ' levels.';
      var end = moral
        ? 'By the end of the simulation, the distribution shifted to <strong>' + b.high + '</strong> regions with a ' + L[0] + ' ' + name + ', <strong>' + b.med + '</strong> with a ' + L[1] + ' status, and <strong>' + b.low + '</strong> with a ' + L[2] + ' status.'
        : 'By the end of the simulation, the distribution shifted to <strong>' + b.high + '</strong> regions demonstrating ' + L[0] + ' ' + name + ', <strong>' + b.med + '</strong> with ' + L[1] + ' levels, and <strong>' + b.low + '</strong> with ' + L[2] + ' levels.';
      return { init: init, end: end, shift: diff };
    };

    combinedInit = []; combinedEnd = []; combinedShift = [];

    var renderStatRow = function (id, config, a, b) {
      var data = [
        { label: config.labels[0], color: config.colors[0], i: a.high, e: b.high },
        { label: config.labels[1], color: config.colors[1], i: a.med, e: b.med },
        { label: config.labels[2], color: config.colors[2], i: a.low, e: b.low }
      ];
      var initPie = data.map(function (d) { return { label: d.label, value: d.i, color: d.color }; });
      data.sort(function (x, y) { return isCompleted ? y.e - x.e : y.i - x.i; });
      updateHTMLWithAnim('cell-' + id + '-init', data.map(function (d) { return formatCellWithKey(d.label, d.color, d.i, 1, config.isBorder); }).join(''), 'pulse');
      if (isCompleted) {
        updateHTMLWithAnim('cell-' + id + '-end', data.map(function (d) { return formatCellWithKey(d.label, d.color, d.e, 1, config.isBorder); }).join(''), 'pulse');
        updateHTMLWithAnim('cell-' + id + '-shift', data.map(function (d) { return getShiftDiv(d.i, d.e); }).join(''), 'pulse');
        var t = statText(config, a, b);
        combinedInit.push(t.init); combinedEnd.push(t.end); combinedShift.push(t.shift);
        var endPie = [{ label: config.labels[0], value: b.high, color: config.colors[0] }, { label: config.labels[1], value: b.med, color: config.colors[1] }, { label: config.labels[2], value: b.low, color: config.colors[2] }];
        drawPieChart('chart-' + id + '-single', endPie, initPie);
      } else {
        updateHTMLWithAnim('cell-' + id + '-end', '—', 'pulse');
        updateHTMLWithAnim('cell-' + id + '-shift', '—', 'pulse');
        drawPieChart('chart-' + id + '-single', initPie);
      }
    };

    var uCount = 0, dCount = 0, nCount = 0, uSum = 0, dSum = 0, nSum = 0, spSum = 0, impSum = 0, moralSum = 0;
    var cultStats = {};
    CULTURE_NAMES.forEach(function (name, i) { cultStats[name] = { count: 0, moralSum: 0, index: i }; });
    nodes.forEach(function (n) {
      if (n.moral >= 67) { uCount++; uSum += n.moral; } else if (n.moral <= 33) { dCount++; dSum += n.moral; } else { nCount++; nSum += n.moral; }
      var c = cultStats[CULTURE_NAMES[n.cultureIndex]]; c.count++; c.moralSum += n.moral;
      spSum += n.softPower; impSum += n.impermeability; moralSum += n.moral;
    });
    var uPct = uCount / totalNodes * 100, dPct = dCount / totalNodes * 100, nPct = nCount / totalNodes * 100;
    var spAvg = spSum / totalNodes, impAvg = impSum / totalNodes, moralAvg = moralSum / totalNodes;
    var sorted = Object.keys(cultStats).map(function (k) { return [k, cultStats[k]]; }).filter(function (e) { return e[1].count > 0; }).sort(function (a, b) { return b[1].count - a[1].count; });
    var cMax = sorted.length ? sorted[0][1].count / totalNodes * 100 : 0;

    var scenarios = [];
    if (cMax === 100) {
      if (uPct === 100) scenarios.push(isCompleted ? 'Utopian Hegemony' : 'Utopian Takeover');
      else if (dPct === 100) scenarios.push(isCompleted ? 'Dystopian Hegemony' : 'Dystopian Takeover');
      else scenarios.push(isCompleted ? 'Mono Cultural Hegemony' : 'Mono Cultural Takeover');
    } else {
      if (uPct === 100) scenarios.push('Meta Utopian Uplift');
      else if (dPct === 100) scenarios.push('Meta Dystopian Downfall');
      if (cMax > 50 && cMax < 75) scenarios.push(isCompleted ? 'Mono Cultural Hegemony with Resistant Enclaves' : 'Mono Cultural Takeover with Resistant Enclaves');
      else if (cMax <= 50) scenarios.push(moralAvg >= 67 ? 'Meta Utopian Enclosure with Dystopian Enclaves' : 'Meta Dystopian Enclosure');
      else if (cMax >= 75) scenarios.push(isCompleted ? 'Mono Cultural Hegemony' : 'Mono Cultural Takeover');
    }
    // without cultural integrity, cultures cannot hold themselves together
    if (spAvg < 33.3) scenarios.push('Cultural Collapse');
    var title = scenarios.length > 1 ? scenarios.slice(0, -1).join(' and ') + ' and ' + scenarios[scenarios.length - 1] : (scenarios[0] || '');

    var moralLabel = function (v) { return v >= 67 ? 'Utopian' : (v <= 33 ? 'Dystopian' : 'Notopian'); };
    var moralNoun = function (v) { return v >= 67 ? 'Utopia' : (v <= 33 ? 'Dystopia' : 'Notopia'); };
    var extreme = function (key, max) {
      var best = max ? -1 : Infinity, idx = -1;
      cultureScores[key].forEach(function (v, i) { if (max ? v > best : v < best) { best = v; idx = i; } });
      return { name: CULTURE_NAMES[idx], color: PASTEL_RAINBOW[idx], rawScore: best };
    };
    var fill = function (v, key) { return getSpectrumColor(v, paletteMap[key], key); };

    var metricItem = function (label, name, val, type, metricColor, cultureColor) {
      var pts = [];
      for (var a = 0; a < 6; a++) { var ang = Math.PI / 3 * a + Math.PI / 6; pts.push(Math.cos(ang) * 22 + ',' + Math.sin(ang) * 22); }
      var f = metricColor, s = baseStroke(), sw = '1.5px', tc = isColorDark(f) ? '#FFFFFF' : '#1A1A1A';
      if (type === 'impermeability') { f = 'transparent'; s = metricColor; sw = '4px'; tc = 'var(--text)'; }
      var dot = (type !== 'moral' && type !== 'cultures' && cultureColor) ? swatch(cultureColor, 10, 12, ' margin-right: 6px; margin-top: 1px;') : '';
      return '<div class="metric-item"><svg viewBox="-26 -26 52 52" width="52" height="52" style="overflow: visible; flex-shrink: 0;">' +
        '<polygon points="' + pts.join(' ') + '" fill="' + f + '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linejoin="round"/>' +
        '<text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-family="var(--ff-mono)" font-weight="500" font-size="13px" fill="' + tc + '">' + val + '</text></svg>' +
        '<div class="metric-text"><div class="metric-label">' + label + '</div><div class="metric-name">' + dot + '<span>' + name + '</span></div></div></div>';
    };

    var dom = sorted.length ? sorted[0][1] : null;
    var domMoral = dom ? dom.moralSum / dom.count : 0;
    var maxMoral = extreme('moral', true), minMoral = extreme('moral', false);
    var maxSP = extreme('softPower', true), minSP = extreme('softPower', false);
    var maxImp = extreme('impermeability', true), minImp = extreme('impermeability', false);

    var major = '<div class="block-kicker">Major Metrics</div><div class="metrics-grid">' +
      metricItem('Dominant Culture', sorted.length ? sorted[0][0] : 'None', sorted.length ? Math.round(dom.count / totalNodes * 100) + '%' : '0%', 'cultures', sorted.length ? PASTEL_RAINBOW[dom.index] : 'var(--bg)') +
      metricItem('Dominant Status', moralLabel(domMoral), formatScore(domMoral), 'moral', fill(domMoral, 'moral')) +
      metricItem('Meta-Topia Status', moralLabel(moralAvg), formatScore(moralAvg), 'moral', fill(moralAvg, 'moral')) +
      metricItem('Peak Sub-topia', maxMoral.name, formatScore(maxMoral.rawScore), 'moral', fill(maxMoral.rawScore, 'moral'), maxMoral.color) +
      metricItem('Valley Sub-topia', minMoral.name, formatScore(minMoral.rawScore), 'moral', fill(minMoral.rawScore, 'moral'), minMoral.color) +
      metricItem('Average Sub-topia', 'Global Avg', formatScore(moralAvg), 'moral', fill(moralAvg, 'moral'), null) +
      metricItem('Peak Integrity', maxSP.name, formatScore(maxSP.rawScore), 'softPower', fill(maxSP.rawScore, 'softPower'), maxSP.color) +
      metricItem('Valley Integrity', minSP.name, formatScore(minSP.rawScore), 'softPower', fill(minSP.rawScore, 'softPower'), minSP.color) +
      metricItem('Average Integrity', 'Global Avg', formatScore(spAvg), 'softPower', fill(spAvg, 'softPower'), null) +
      metricItem('Peak Impermeability', maxImp.name, formatScore(maxImp.rawScore), 'impermeability', fill(maxImp.rawScore, 'impermeability'), maxImp.color) +
      metricItem('Valley Impermeability', minImp.name, formatScore(minImp.rawScore), 'impermeability', fill(minImp.rawScore, 'impermeability'), minImp.color) +
      metricItem('Avg Impermeability', 'Global Avg', formatScore(impAvg), 'impermeability', fill(impAvg, 'impermeability'), null) +
      '</div>';
    updateHTMLWithAnim('overview-major-metrics', major, 'none');

    var avgStr = function (c, s) { return formatScore(c > 0 ? s / c : 0); };
    var statusBlock = function (label, pct, avg, color, border) {
      return '<div class="status-block"><div class="block-kicker">' + label + '</div><div class="status-line">' + swatch(color, 20, 23, border ? ' border: 1px solid rgba(142, 142, 147, 0.2);' : '') +
        '<span><strong>' + Math.round(pct) + '%</strong> <span class="status-avg">— Avg Rating: ' + avg + '</span></span></div></div>';
    };
    var html = '<div class="status-row">' + statusBlock('Utopian', uPct, avgStr(uCount, uSum), 'var(--moral-uto)') + statusBlock('Dystopian', dPct, avgStr(dCount, dSum), 'var(--moral-dys)', true) + statusBlock('Notopian', nPct, avgStr(nCount, nSum), 'var(--moral-neu)') + '</div>';
    html += '<div class="status-row">';
    ['Dominant Culture', 'Secondary Culture', 'Tertiary Culture'].forEach(function (t, k) {
      if (k >= sorted.length) return;
      var d = sorted[k][1], m = d.moralSum / d.count;
      html += '<div class="status-block"><div class="block-kicker">' + t + '</div><div class="status-line status-line-wide"><div class="swatch-pair">' + swatch(PASTEL_RAINBOW[d.index], 20, 23) + swatch(statusColorFor(m), 20, 23) + '</div>' +
        '<span><strong>' + Math.round(d.count / totalNodes * 100) + '%</strong> ' + sorted[k][0] + ' &mdash; ' + moralNoun(m) + '</span></div></div>';
    });
    html += '</div><div class="block-kicker">Complete Cultural Distribution</div><div class="dist-grid">';
    sorted.forEach(function (e) {
      var d = e[1], m = d.moralSum / d.count;
      html += '<div class="dist-item"><div class="swatch-pair">' + swatch(PASTEL_RAINBOW[d.index], 14, 16) + swatch(statusColorFor(m), 14, 16) + '</div><span><strong>' + Math.round(d.count / totalNodes * 100) + '%</strong> ' + e[0] + ' &mdash; ' + moralNoun(m) + '</span></div>';
    });
    html += '</div>';
    updateHTMLWithAnim('overview-dominant-cultures', html, 'none');

    var desc = getScenarioDefinition(title);
    updateHTMLWithAnim('scenario-main-title', '<strong>' + title + '</strong>', 'none');
    updateHTMLWithAnim('scenario-title-label', simulationEpoch === 0 ? 'Initial State' : (isCompleted ? 'Terminal State' : 'Current Trajectory'), 'none');
    updateHTMLWithAnim('scenario-main-desc', simulationEpoch === 0 || isCompleted ? desc : '', 'none');

    renderStatRow('moral', { key: 'moral', metricName: 'Sub-topia Status', colors: ['var(--moral-uto)', 'var(--moral-neu)', 'var(--moral-dys)'], labels: ['UTOPIAN', 'NOTOPIAN', 'DYSTOPIAN'] }, categorise(initialState, 'moral'), categorise(nodes, 'moral'));
    renderStatRow('sp', { key: 'softPower', metricName: 'Cultural Integrity', colors: ['var(--integ-high)', 'var(--integ-med)', 'var(--integ-low)'], labels: ['HIGH', 'MED', 'LOW'] }, categorise(initialState, 'softPower'), categorise(nodes, 'softPower'));
    renderStatRow('imp', { key: 'impermeability', metricName: 'Membrane Impermeability', colors: ['var(--imp-high)', 'var(--imp-med)', 'var(--imp-low)'], labels: ['HIGH', 'MED', 'LOW'], isBorder: true }, categorise(initialState, 'impermeability'), categorise(nodes, 'impermeability'));

    var initCounts = {}, endCounts = {};
    initialState.forEach(function (n) {
      var name = CULTURE_NAMES[n.cultureIndex];
      if (!initCounts[name]) initCounts[name] = { count: 0, moralSum: 0, index: n.cultureIndex };
      initCounts[name].count++; initCounts[name].moralSum += n.moral;
    });
    nodes.forEach(function (n) { var name = CULTURE_NAMES[n.cultureIndex]; endCounts[name] = (endCounts[name] || 0) + 1; });
    var displayCults = Object.keys(initCounts).map(function (k) { return { name: k, index: initCounts[k].index, initCount: initCounts[k].count, endCount: isCompleted ? (endCounts[k] || 0) : null }; })
      .sort(function (a, b) { return isCompleted ? b.endCount - a.endCount : b.initCount - a.initCount; });

    updateHTMLWithAnim('cell-cult-init', displayCults.map(function (d) { return formatCellWithKey(d.name, PASTEL_RAINBOW[d.index], d.initCount, d.initCount === 0 ? 0.4 : 1); }).join(''), 'pulse');
    var cultInitPie = CULTURE_NAMES.map(function (name, i) { return { label: name, value: initCounts[name] ? initCounts[name].count : 0, color: PASTEL_RAINBOW[i] }; });

    if (!isCompleted) {
      updateHTMLWithAnim('cell-cult-end', '—', 'pulse');
      updateHTMLWithAnim('cell-cult-shift', '—', 'pulse');
      drawPieChart('chart-cult-single', cultInitPie);
    } else {
      updateHTMLWithAnim('cell-cult-end', displayCults.map(function (d) { return formatCellWithKey(d.name, PASTEL_RAINBOW[d.index], d.endCount, d.endCount === 0 ? 0.4 : 1); }).join(''), 'pulse');
      updateHTMLWithAnim('cell-cult-shift', displayCults.map(function (d) { return getShiftDiv(d.initCount, d.endCount, d.endCount === 0 && d.initCount === 0 ? 0.4 : 1); }).join(''), 'pulse');

      var list = function (arr) { return arr.length === 2 ? arr[0] + ' and ' + arr[1] : arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1]; };
      var initC = displayCults.filter(function (d) { return d.initCount > 0; }).sort(function (a, b) { return b.initCount - a.initCount; });
      var initParts = initC.map(function (c) { return '<strong>' + c.name + '</strong> (' + c.initCount + ')'; });
      combinedInit.unshift(initParts.length === 1 ? 'The map started as a complete monolith, with ' + initParts[0] + ' controlling all regions.' : 'Initially, the map was divided ' + (initParts.length === 2 ? 'between ' : 'among ') + list(initParts) + '.');
      var endC = displayCults.filter(function (d) { return d.endCount > 0; });
      var endParts = endC.map(function (c) { return '<strong>' + c.name + '</strong> (' + c.endCount + ')'; });
      var endText = endParts.length === 1 ? 'By the end, ' + endParts[0] + ' achieved total hegemony, controlling all regions.' : (endParts.length === 2 ? 'By the end, only ' + list(endParts) + ' remained.' : 'By the end, surviving cultures included ' + list(endParts) + '.');
      if (endC.length < initC.length) endText += ' All other cultures were eliminated.';
      combinedEnd.unshift(endText);
      var shiftParts = endC.map(function (c) {
        var d = c.endCount - c.initCount;
        return d !== 0 ? '<strong>' + c.name + '</strong> saw a net shift of <strong>' + (d > 0 ? '+' : '') + d + '</strong> regions' : '<strong>' + c.name + '</strong> maintained their original count of <strong>' + c.initCount + '</strong> regions';
      });
      combinedShift.unshift('Throughout the simulation, ' + (shiftParts.length === 1 ? shiftParts[0] : (shiftParts.length === 2 ? shiftParts[0] + ', while ' + shiftParts[1] : list(shiftParts))) + '.');

      var prose = [];
      for (var i = 0; i < 4; i++) {
        prose.push('<div class="prose-step"><span class="prose-step-head">Initial State</span>' + combinedInit[i] + '</div>' +
          '<div class="prose-step"><span class="prose-step-head">End State</span>' + combinedEnd[i] + '</div>' +
          '<div class="prose-step"><span class="prose-step-head">Total Shift</span>' + combinedShift[i] + '</div>');
      }
      // order: affiliation, status, cultural integrity, impermeability
      updateHTMLWithAnim('combined-prose-container', '<div class="wb-row prose-row">' + formatSection(prose, PASTEL_RAINBOW[displayCults[0].index]) + '</div>', 'fade');
      drawPieChart('chart-cult-single', CULTURE_NAMES.map(function (name, i) { return { label: name, value: endCounts[name] || 0, color: PASTEL_RAINBOW[i] }; }), cultInitPie);
    }

    // the world build history
    var initDom = '';
    if (displayCults.length) {
      var top = [].concat(displayCults).sort(function (a, b) { return b.initCount - a.initCount; });
      var st = initCounts[top[0].name];
      initDom = 'The geopolitical landscape begins with <strong>' + top[0].name + '</strong> exerting primary influence over ' + Math.round(top[0].initCount / totalNodes * 100) + '% of the topology. This establishes a foundational <strong>' + moralLabel(st.moralSum / st.count).toLowerCase() + '</strong> societal baseline.';
      if (top.length > 1) initDom += ' Resistance from <strong>' + top[1].name + '</strong> at ' + Math.round(top[1].initCount / totalNodes * 100) + '% introduces the initial cultural friction.';
    }
    var domName = sorted.length ? sorted[0][0] : '', domPct = sorted.length ? Math.round(sorted[0][1].count / totalNodes * 100) : 0;
    if (!phaseHistory.length) { phaseHistory.push(title); proseLog.push(initDom); }
    else if (phaseHistory[phaseHistory.length - 1] !== title && !isCompleted) {
      phaseHistory.push(title);
      var T = [
        function (s, n, p) { return 'As generations progress, cycles of colonisation and assimilation begin reshaping the map. A <strong>' + s + '</strong> emerges as <strong>' + n + '</strong> advances their territorial control to ' + p + '%, while opposing enclaves either integrate or fortify their resistance.'; },
        function (s, n, p) { return 'Further shifts in ideological dominance push the topology toward a <strong>' + s + '</strong>, with <strong>' + n + '</strong> expanding its influence to ' + p + '%.'; },
        function (s, n, p) { return 'The cultural landscape undergoes significant upheaval, transitioning into a <strong>' + s + '</strong> as <strong>' + n + '</strong> secures ' + p + '% of the global territory.'; },
        function (s, n, p) { return 'Continued assimilation dynamics drive the world into a <strong>' + s + '</strong>, establishing <strong>' + n + '</strong> at a formidable ' + p + '% footprint.'; }
      ];
      proseLog.push(T[Math.max(0, phaseHistory.length - 2) % T.length](title, domName, domPct));
    }
    if (isCompleted && !proseLog.some(function (p) { return p.indexOf('The world has permanently stabilised') === 0; })) {
      var es = cultStats[domName];
      proseLog.push('The world has permanently stabilised into a <strong>' + title + '</strong>. <strong>' + domName + '</strong> has established final hegemony, successfully colonising ' + domPct + '% of the map. Remaining resistance has been permanently marginalised, cementing a <strong>' + (es && es.count ? moralLabel(es.moralSum / es.count) : 'Notopian').toLowerCase() + '</strong> global standard.');
    }
    var phaseBlock = function (name, i) {
      return '<div class="phase-line"><span class="phase-num">0' + i + '</span><div><strong>' + name + '</strong><br><span class="phase-def">' + getScenarioDefinition(name) + '</span></div></div>';
    };
    var muted = function (t) { return '<div class="muted-italic">' + t + '</div>'; };
    var initPhase = phaseHistory.length ? phaseBlock(phaseHistory[0], 1) : '—';
    var transProse, transPhase, endProse, endPhase;
    if (!isCompleted) {
      transProse = proseLog.length > 1 ? proseLog.slice(1).map(function (p, i, a) { return '<div class="wb-row' + (i === a.length - 1 ? ' fade-in-text' : '') + '">' + p + '</div>'; }).join('') : muted('Monitoring topological shift events...');
      transPhase = phaseHistory.length > 1 ? phaseHistory.slice(1).map(function (p, i, a) { return '<div class="wb-row' + (i === a.length - 1 ? ' fade-in-text' : '') + '">' + phaseBlock(p, i + 2) + '</div>'; }).join('') : muted('—');
      endProse = muted('Awaiting generational stabilisation...');
      endPhase = muted('—');
    } else {
      var tp = proseLog.slice(1, -1), tph = phaseHistory.slice(1);
      transProse = tp.length ? tp.map(function (p) { return '<div class="wb-row">' + p + '</div>'; }).join('') : '<em>Stable conversion recorded. No intermediate epochs tracked.</em>';
      transPhase = tp.length ? tph.map(function (p, i) { return '<div class="wb-row">' + phaseBlock(p, i + 2) + '</div>'; }).join('') : '<em>—</em>';
      endProse = '<div class="wb-row fade-in-text">' + proseLog[proseLog.length - 1] + '</div>';
      endPhase = '<div class="wb-row fade-in-text">' + phaseBlock(title, phaseHistory.length ? tph.length + 2 : 2) + '</div>';
    }
    var row = function (label, prose, phase, last) {
      return '<div class="wb-label">' + label + '</div><div class="wb-prose' + (last ? ' last' : '') + '">' + prose + '</div><div class="wb-phase' + (last ? ' last' : '') + '">' + phase + '</div>';
    };
    updateHTMLWithAnim('world-building-content', '<div class="wb-grid">' + row('Initial Conditions', initDom, initPhase) + row('Transitional Phases', transProse, transPhase) + row('End-State Resolution', endProse, endPhase, true) + '</div>', 'fade');
  }

  // ---------- overlays and modes ----------
  function setPrimary(type) {
    if (isSimultaneous) setSimultaneous(false);
    activePrimary = type;
    if (activePrimary === activeSecondary) activeSecondary = null;
    isImpOverlayActive = type === 'softPower';
    updateDisplay();
  }
  function setSecondary(type) {
    if (isSimultaneous || type === activePrimary) return;
    if (type === 'impermeability') isImpOverlayActive = !isImpOverlayActive;
    else { activeSecondary = activeSecondary === type ? null : type; if (activeSecondary && showScores) toggleScores(); }
    updateDisplay();
  }
  function setSimultaneous(val) {
    isSimultaneous = val;
    if (val) { activeSecondary = null; isImpOverlayActive = true; }
    sim.classList.toggle('sim-mode', val);
    initGrids(currentLayers);
  }
  function toggleScores() {
    if (!isSpectrum) return;
    showScores = !showScores;
    if (showScores) activeSecondary = null;
    sim.classList.toggle('hide-scores', !showScores);
    $('sub-scores').classList.toggle('active', showScores);
    updateDisplay();
  }

  function updateDisplay() {
    var stroke = baseStroke();
    updateButtonStates();
    updateCulturalAnalytics();
    sim.classList.toggle('show-ranges', showScores && isSpectrum);
    $('overlays-group').classList.toggle('visible', !isSimultaneous);
    $('spectrum-sub-group').classList.toggle('visible', isSpectrum);
    var m = scoreScale / 100, dp = scoreScale === 10 ? 1 : 0;
    ['moral', 'softpower', 'imp'].forEach(function (t) {
      [['low', 0, 33], ['med', 34, 66], ['high', 67, 100]].forEach(function (r) {
        var el = $('range-' + t + '-' + r[0]);
        if (el) el.textContent = (r[1] * m).toFixed(dp) + '-' + (r[2] * m).toFixed(dp);
      });
    });
    GRIDS.forEach(function (g) {
      var el = $(g.box);
      el.style.display = isSimultaneous || g.type === activePrimary ? 'flex' : 'none';
      el.classList.toggle('solo', !isSimultaneous && g.type === activePrimary);
    });

    nodes.forEach(function (n) {
      GRIDS.forEach(function (grid, idx) {
        var type = grid.type;
        if (!isSimultaneous && type !== activePrimary) return;
        var val = type === 'cultures' ? n.cultureIndex : n[type];
        var col = getSpectrumColor(val, paletteMap[type], type);
        var impCol = getSpectrumColor(n.impermeability, paletteMap.impermeability, 'impermeability');
        var el = n.els[idx], txt = n.txt[idx];
        el.style.fill = col;
        txt.style.fill = isColorDark(col) ? '#FFFFFF' : '#1A1A1A';
        // the borders: on the cultural integrity grid always in the overview, and
        // wherever the impermeability overlay is on
        var bordered = type === 'softPower' ? (isSimultaneous || isImpOverlayActive) : (!isSimultaneous && isImpOverlayActive);
        if (bordered) { el.style.stroke = impCol; el.style.strokeWidth = isSimultaneous ? '2.8px' : '5px'; }
        else { el.style.stroke = stroke; el.style.strokeWidth = isSimultaneous ? '1.4px' : '2px'; }
        if (!isSimultaneous && activeSecondary) {
          var sVal = activeSecondary === 'cultures' ? n.cultureIndex : n[activeSecondary];
          n.circles[idx].style.fill = getSpectrumColor(sVal, paletteMap[activeSecondary], activeSecondary);
          n.circles[idx].classList.add('active');
        } else n.circles[idx].classList.remove('active');
        var label = '';
        if (isSimultaneous || (showScores && isSpectrum)) {
          if (type === 'cultures') label = n.cultureIndex + 1;
          else if (type === 'softPower' && showImpScores) label = formatScore(n.softPower) + '/' + formatScore(n.impermeability);
          else label = formatScore(val);
        }
        txt.textContent = label;
        // two scores in a tile: a little smaller, to fit
        var base = parseFloat(txt.dataset.base) || 5.5;
        txt.style.fontSize = (type === 'softPower' && showImpScores ? base * (scoreScale === 10 ? 0.72 : 0.8) : base) + 'px';
      });
    });
    drawLocator();
    ['moral', 'cultures', 'softpower', 'impermeability'].forEach(function (id) {
      var el = $('key-' + id);
      if (!el) return;
      var on = isSimultaneous || activePrimary === id || activeSecondary === id ||
        (id === 'softpower' && (activePrimary === 'softPower' || activeSecondary === 'softPower')) ||
        (id === 'impermeability' && isImpOverlayActive);
      el.classList.toggle('visible', on);
    });
  }

  function setSpectrum(v) {
    isSpectrum = v;
    if (!v && showScores) { showScores = false; sim.classList.add('hide-scores'); $('sub-scores').classList.remove('active'); }
    updateDisplay();
  }

  function setScale(l) {
    if (isPlaying) return;
    currentLayers = l;
    if (isCompleted) { randomizeConfiguration(); return; }
    document.querySelectorAll('#scale-toggle .segment').forEach(function (b, i) { b.classList.toggle('active', i === l - 1); });
    initGrids(l);
  }

  function press(id) { var b = $(id); b.classList.add('pressed'); setTimeout(function () { b.classList.remove('pressed'); }, 400); }

  function resetToInitial() {
    press('revert-btn');
    isCompleted = false; phaseHistory = []; proseLog = []; epochHistory = []; simulationEpoch = 0;
    updateHTMLWithAnim('combined-prose-container', generatePlaceholderExp(), 'none');
    var btn = $('scenario-1-btn');
    btn.classList.remove('playing', 'completed');
    if (isPlaying) toggleScenario();
    if (!initialState) return;
    initialState.forEach(function (s, i) { nodes[i].cultureIndex = s.cultureIndex; nodes[i].softPower = s.softPower; nodes[i].impermeability = s.impermeability; nodes[i].moral = s.moral; });
    captureEpochState(nodes);
    btn.lastChild.textContent = ' Run Simulation';
    $('scenario-icon').innerHTML = ICONS.play;
    updateDisplay();
  }

  // the scenario presets: each culture's cultural integrity and membranes
  function randomizeConfiguration() {
    press('gen-config-btn');
    isCompleted = false;
    if (isPlaying) toggleScenario();
    var rand = function (a, b) { return a + Math.random() * (b - a); };
    if (activeScenarioMode === 'random') {
      cultureScores.moral = PASTEL_RAINBOW.map(rnd);
      cultureScores.softPower = PASTEL_RAINBOW.map(rnd);
      cultureScores.impermeability = PASTEL_RAINBOW.map(rnd);
    } else if (activeScenarioMode === 'monocultural') {
      var w = Math.floor(Math.random() * 7);
      cultureScores.moral = PASTEL_RAINBOW.map(rnd);
      cultureScores.softPower = PASTEL_RAINBOW.map(function (_, i) { return i === w ? rand(95, 100) : rand(0, 40); });
      cultureScores.impermeability = PASTEL_RAINBOW.map(function (_, i) { return i === w ? rand(50, 70) : rand(0, 30); });
    } else {
      var utopian = activeScenarioMode === 'utopian';
      cultureScores.moral = PASTEL_RAINBOW.map(function () { return utopian ? rand(67, 100) : rand(0, 33); });
      var roles = ['A', 'A', 'A', 'F', 'F', 'W', 'W'].sort(function () { return Math.random() - 0.5; });
      cultureScores.softPower = []; cultureScores.impermeability = [];
      roles.forEach(function (role) {
        if (role === 'A') { cultureScores.softPower.push(rand(80, 100)); cultureScores.impermeability.push(rand(20, 50)); }        // aggressor: strong pull, open borders
        else if (role === 'F') { cultureScores.softPower.push(rand(40, 60)); cultureScores.impermeability.push(rand(80, 100)); }  // fortress: closed borders
        else { cultureScores.softPower.push(rand(10, 30)); cultureScores.impermeability.push(rand(10, 30)); }                    // weak
      });
    }
    initGrids(currentLayers);
    var btn = $('scenario-1-btn');
    btn.classList.remove('playing', 'completed');
    btn.lastChild.textContent = ' Run Simulation';
    $('scenario-icon').innerHTML = ICONS.play;
    updateDisplay();
  }

  // the page's light and dark themes
  new MutationObserver(function () { updateDisplay(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.Dyn = {
    toggleScenarioDropdown: toggleScenarioDropdown, setDynamicScenario: setDynamicScenario,
    toggleScenario: toggleScenario, resetToInitial: resetToInitial, randomizeConfiguration: randomizeConfiguration,
    toggleSidebar: toggleSidebar, setPrimary: setPrimary, setSecondary: setSecondary,
    setSystemLevel: setSystemLevel, setDensity: setDensity, setSimultaneous: setSimultaneous,
    setSpectrum: setSpectrum, toggleScores: toggleScores, setScale: setScale, setScoreRange: setScoreRange,
    setImpScores: setImpScores
  };

  var keys = $('culture-keys-container');
  CULTURE_NAMES.forEach(function (name, i) {
    var item = document.createElement('div'); item.className = 'key-item';
    item.innerHTML = '<div class="swatch" style="color: ' + PASTEL_RAINBOW[i] + '"></div> ' + name + ' <span class="key-range">' + (i + 1) + '</span>';
    keys.appendChild(item);
  });
  setSystemLevel('basic');
})();
