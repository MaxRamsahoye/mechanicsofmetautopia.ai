// Simulator: the rule of the Cultural Dynamics Simulator, shown on two
// sub-topias. A culture crosses into a neighbouring sub-topia when its
// cultural integrity overcomes, first, the neighbour's membrane
// impermeability and, then, the neighbour's own cultural integrity.
// Here A passes both tests, and B is assimilated.
(function () {
  var root = document.querySelector('.simr');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };

  var A = { name: 'The Culture', col: '#FFB7B2', integ: 8.2, imp: 4.0 };
  var B = { name: 'The Azad', col: '#B3E5FC', integ: 3.5, imp: 5.1 };

  // membrane colour and weight by impermeability: yellow (open) to brown (closed)
  function impColour(v) {
    var stops = [[253, 230, 138], [230, 153, 77], [166, 75, 53]], t = v / 10;
    var a = t < 0.5 ? stops[0] : stops[1], b = t < 0.5 ? stops[1] : stops[2], f = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * f); }).join(',') + ')';
  }
  function impWidth(v) { return 3 + v * 1.1; }

  var STEPS = [
    {
      title: 'Two neighbouring sub-topias',
      text: 'Each hexagon is a sub-topia. Its fill is its culture; the number inside is its <b>cultural integrity</b>; its outline is its <b>membrane</b>, thicker and darker the more <b>impermeable</b> it is.'
    },
    {
      title: 'Test 1: through the membrane',
      text: 'A&rsquo;s culture reaches B&rsquo;s border. It crosses only if A&rsquo;s cultural integrity (<b>8.2</b>) is higher than B&rsquo;s membrane impermeability (<b>5.1</b>). It is: the membrane gives way.'
    },
    {
      title: 'Test 2: past B&rsquo;s own integrity',
      text: 'Inside, A&rsquo;s culture meets B&rsquo;s. It takes hold only if A&rsquo;s cultural integrity (<b>8.2</b>) is also higher than B&rsquo;s cultural integrity (<b>3.5</b>). It is: B cannot hold its own culture.'
    },
    {
      title: 'Assimilation',
      text: 'B adopts A&rsquo;s culture, and with it A&rsquo;s cultural integrity and membrane: B is now part of <b>The Culture</b>, with an integrity of <b>8.2</b> and a membrane of <b>4.0</b>.'
    },
    {
      title: 'A larger culture',
      text: 'Two sub-topias, one culture. On a larger map, the same two tests run between every pair of neighbours, turn after turn, until nothing more changes.'
    }
  ];

  var step = 0, playing = true, timer = null;
  var DWELL = 3600;

  var els = {
    hexB: $('#sr-hex-b'), memB: $('#sr-mem-b'), memA: $('#sr-mem-a'),
    nameB: $('#sr-name-b'), integB: $('#sr-integ-b'), impLabB: $('#sr-imp-b'),
    arrow1: $('#sr-arrow-1'), arrow2: $('#sr-arrow-2'), head1: $('#sr-head-1'), head2: $('#sr-head-2'),
    test1: $('#sr-test-1'), test2: $('#sr-test-2'),
    title: $('.sr-step-title'), text: $('.sr-step-text'), num: $('.sr-step-num'),
    dots: root.querySelectorAll('.sr-dot'), play: $('.sr-play')
  };

  function setB(cul) {
    els.hexB.style.fill = cul.col;
    els.memB.style.stroke = impColour(cul.imp);
    els.memB.style.strokeWidth = impWidth(cul.imp);
    els.nameB.textContent = cul.name.toUpperCase();
    els.integB.textContent = cul.integ.toFixed(1);
    els.impLabB.textContent = 'Membrane impermeability ' + cul.imp.toFixed(1);
  }

  function show(el, on) { el.classList.toggle('on', !!on); }

  function render() {
    var s = STEPS[step];
    els.title.innerHTML = s.title;
    els.text.innerHTML = s.text;
    els.num.textContent = 'Step ' + (step + 1) + ' of ' + STEPS.length;
    els.dots.forEach(function (d, i) { d.classList.toggle('on', i === step); d.setAttribute('aria-current', i === step ? 'step' : 'false'); });
    show(els.arrow1, step >= 1); show(els.head1, step >= 1); show(els.test1, step >= 1);
    show(els.arrow2, step >= 2); show(els.head2, step >= 2); show(els.test2, step >= 2);
    // B's membrane gives way once it has been crossed
    els.memB.classList.toggle('breached', step >= 1 && step < 3);
    setB(step >= 3 ? A : B);
    root.setAttribute('data-step', step);
    // after assimilation the arrows have done their work
    if (step >= 4) { show(els.arrow1, false); show(els.head1, false); show(els.arrow2, false); show(els.head2, false); }
  }

  function go(n) {
    step = (n + STEPS.length) % STEPS.length;
    render();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (playing) timer = setTimeout(function () { go(step + 1); }, step === STEPS.length - 1 ? DWELL * 1.4 : DWELL);
  }

  $('.sr-next').addEventListener('click', function () { go(step + 1); });
  $('.sr-back').addEventListener('click', function () { go(step - 1); });
  $('.sr-restart').addEventListener('click', function () { go(0); });
  els.dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
  els.play.addEventListener('click', function () {
    playing = !playing;
    els.play.textContent = playing ? 'Pause' : 'Play';
    els.play.setAttribute('aria-pressed', playing ? 'false' : 'true');
    schedule();
  });

  // A's membrane, fixed
  els.memA.style.stroke = impColour(A.imp);
  els.memA.style.strokeWidth = impWidth(A.imp);

  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    playing = false; els.play.textContent = 'Play'; els.play.setAttribute('aria-pressed', 'true');
  }
  render();
  schedule();
})();
