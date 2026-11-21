// Simulator: the rule of the Cultural Dynamics Simulator, shown on two
// sub-topias. A culture crosses into a neighbouring sub-topia when its
// cultural integrity overcomes, first, the neighbour's membrane
// impermeability and, then, the neighbour's own cultural integrity.
// Here A passes both tests, and B is assimilated.
(function () {
  var root = document.querySelector('.simr');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

  var A = { name: 'The Culture', col: '#FFB7B2', integ: 8.2, imp: 4.0 };
  var B = { name: 'The Azad', col: '#B3E5FC', integ: 3.5, imp: 5.1 };

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
    nameB: $('#sr-name-b'), integA: $('#sr-integ-a'), integB: $('#sr-integ-b'), impB: $('#sr-imp-b'),
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
