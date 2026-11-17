// The Four Post-AGI Cultural Attractor States: one behaviour for the diagram,
// shared by the article and Typology 1.
//
// - A tour through the futures: from the clash in the middle to the top
//   right and on clockwise, back to the middle after the top left, and again.
// - The pointer takes over while it is on the diagram; the tour resumes a
//   few seconds after it leaves.
// - On narrower windows, where the cells show their titles only, a tap (or
//   Enter or Space) chooses a future and shows its description below the
//   diagram, in its colour; the tour holds until it is closed again.
(function () {
  var ORDER = ['center', 'tr', 'br', 'bl', 'tl'];
  var STEP = 3200, RESUME = 3000;
  var narrow = window.matchMedia('(max-width: 1180px)');

  document.querySelectorAll('.matrix-figure').forEach(function (fig) {
    var matrix = fig.querySelector('.matrix');
    if (!matrix) return;
    var cells = ORDER.map(function (k) { return matrix.querySelector('.m-' + k); });
    var box = fig.querySelector('.matrix-detail');
    if (!box) {
      box = document.createElement('div');
      box.className = 'matrix-detail';
      box.hidden = true;
      box.setAttribute('aria-live', 'polite');
      fig.querySelector('.matrix-wrap').insertAdjacentElement('afterend', box);
    }

    var i = 0, timer = null, resume = null;
    var hovering = false, chosen = null, inView = true;

    function clearTour() { cells.forEach(function (c) { c.classList.remove('is-selected'); }); }

    function step() {
      if (hovering || chosen || !inView || document.hidden || !matrix.offsetParent) return;
      clearTour();
      cells[i].classList.add('is-selected');
      i = (i + 1) % cells.length;
    }

    function start() {
      clearInterval(timer);
      clearTimeout(resume);
      step();
      timer = setInterval(step, STEP);
    }

    function later() {
      clearTimeout(resume);
      resume = setTimeout(start, RESUME);
    }

    // a future chosen by a tap: its description below, in its colour
    function close() {
      chosen = null;
      box.hidden = true;
      box.innerHTML = '';
      cells.forEach(function (c) { if (narrow.matches) c.setAttribute('aria-pressed', 'false'); });
    }

    function choose(cell) {
      clearInterval(timer);
      clearTimeout(resume);
      clearTour();
      if (chosen === cell) { close(); later(); return; }
      close();
      chosen = cell;
      cell.classList.add('is-selected');
      cell.setAttribute('aria-pressed', 'true');
      var k = ORDER[cells.indexOf(cell)];
      box.className = 'matrix-detail d-' + k;
      box.innerHTML = cell.querySelector('.m-text').innerHTML;
      box.hidden = false;
      i = (cells.indexOf(cell) + 1) % cells.length;
    }

    function sync() {
      close();
      clearTour();
      cells.forEach(function (c) {
        if (narrow.matches) {
          c.setAttribute('role', 'button');
          c.setAttribute('tabindex', '0');
          c.setAttribute('aria-pressed', 'false');
        } else {
          ['role', 'tabindex', 'aria-pressed'].forEach(function (a) { c.removeAttribute(a); });
        }
      });
      start();
    }

    cells.forEach(function (c) {
      c.addEventListener('click', function () { if (narrow.matches) choose(c); });
      c.addEventListener('keydown', function (e) {
        if (!narrow.matches || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        choose(c);
      });
    });

    // the pointer (not a touch) takes over while it is on the diagram
    matrix.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      clearTimeout(resume);
    });
    matrix.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      hovering = false;
      if (!chosen) later();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(matrix);
    }

    if (narrow.addEventListener) narrow.addEventListener('change', sync);
    else narrow.addListener(sync);
    sync();
  });
})();
