#!/usr/bin/env node
// Render the article as The Mechanics of Meta-Utopia.pdf (named after the
// article, so that it saves under its title however the browser fetches it),
// the file the PDF icon on the Article page downloads.
//
// Usage (from the repository root): node tools/make-pdf.js
// Needs Playwright (NODE_PATH=$(npm root -g) where it is installed globally)
// and a Chromium (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=/path/to/chromium).
//
// The article's header and sections are lifted out of index.html into a
// plain document set for print: one column, the site's typefaces, no bands,
// buttons or menus, the site's name and page numbers in the margins. Run it again whenever the
// article changes.
//
// The same maker as complexemergencemodel.systems (tools/make-pdf.js), in
// this site's colours: its orange band with black text, and orange links.
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'The Mechanics of Meta-Utopia.pdf');

const CSS = `
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-RomanOSF.woff2') format('woff2'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-SemiBoldOSF.woff2') format('woff2'); font-weight: 600; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/et-book/et-book-bold-line-figures.woff') format('woff'); font-weight: 700; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-DisplayItalic.woff2') format('woff2'); font-weight: 400; font-style: italic; }
  /* the site's name and page numbers in the page margins, in IBM Plex as
     on the site; on the first page its name in the top right corner too */
  @page {
    size: A4;
    margin: 24mm 24mm 22mm;
    @bottom-left { content: 'mechanicsofmetautopia.ai'; font-family: 'IBM Plex Sans', sans-serif; font-size: 8pt; color: #e36843; vertical-align: middle; }
    @bottom-right { content: counter(page); font-family: 'IBM Plex Sans', sans-serif; font-size: 8pt; color: #777; vertical-align: middle; }
  }
  @page :first {
    @top-right { content: 'Mechanics of\\A Meta-Utopia'; white-space: pre; font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; font-size: 10pt; line-height: 1.15; letter-spacing: 0.06em; text-transform: uppercase; text-align: right; vertical-align: bottom; padding-bottom: 2mm; color: #000; }
  }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'ET Bembo', Georgia, serif; font-size: 13.5pt; line-height: 1.42; color: #000; }
  a { color: #e36843; text-decoration: none; }
  .amp { font-style: normal; }
  /* the title on a page of its own, a little below the middle */
  .title-page { padding-top: 92mm; break-after: page; }
  /* set as on the site, in proportion: the author in grey IBM Plex, the
     title in Inter Bold (its second line the width of the text), the
     subtitle in semibold ET Bembo */
  .author { margin: 0 0 18pt; font-family: 'IBM Plex Sans', sans-serif; font-size: 10pt; color: #8c8c8c; }
  .author a { color: inherit; }
  h1 { margin: 0 0 14pt; font-family: 'Inter', sans-serif; font-weight: 700; letter-spacing: -0.02em; font-size: 29pt; line-height: 1.08; }
  h1 .title-line { display: block; white-space: nowrap; }
  .subtitle { margin: 0; font-weight: 600; font-size: 14.5pt; line-height: 1.3; }
  section { margin: 0 0 8pt; }
  h2 { margin: 28pt 0 9pt; font-size: 20pt; font-weight: 600; line-height: 1.2; break-after: avoid; }
  h3 { margin: 20pt 0 7pt; font-size: 15.5pt; font-weight: 600; font-style: italic; break-after: avoid; }
  h4, h5 { margin: 16pt 0 5pt; font-size: 13.5pt; font-weight: 600; break-after: avoid; }
  p { margin: 0 0 9pt; orphans: 3; widows: 3; }
  /* the sections in the site's band (the Overview, then Context and Contents
     together) on pages of their own in its orange, edge to edge, their text
     centred on the page */
  @page band { margin: 0; background: #ee8058; @bottom-left { content: none; } @bottom-right { content: none; } }
  .band-page {
    page: band; break-before: page; break-inside: avoid;
    box-sizing: border-box; min-height: 296.5mm; padding: 24mm;
    display: flex; flex-direction: column; justify-content: center;
    background: #ee8058; color: #000;
  }
  .band-page a { color: inherit; text-decoration: underline; text-underline-offset: 2pt; }
  /* a little smaller than the article's text, so that the Overview keeps to its page */
  .band-page { font-size: 12pt; line-height: 1.38; }
  .band-page h2 { font-size: 18pt; }
  .band-page section + section { margin-top: 26pt; }
  .band-page h2 { margin-top: 0; }
  .band-page section > :last-child { margin-bottom: 0; }
  /* the darker band of the site (Context): edge to edge across its page, in
     the darker shade of the orange */
  .band-page section.band-alt { margin: 0 -24mm; padding: 16mm 24mm; background: #e8734d; }
  /* first on its page, it runs up to the top edge: the top of the page, not
     a band across it, and what follows sits below it rather than centred */
  .band-page:has(> section.band-alt:first-child) { justify-content: flex-start; }
  .band-page > section.band-alt:first-child { margin-top: -24mm; padding-top: 30mm; padding-bottom: 20mm; }
  .band-page section.band-alt + section { margin-top: 38pt; }
  /* the article proper starts on a page of its own */
  .article-start { break-before: page; }
  .article-start > h2:first-child { margin-top: 0; }
  .overview-keywords { margin-top: 26pt; font-family: 'IBM Plex Sans', sans-serif; font-size: 9pt; letter-spacing: 0.02em; }
  ul { margin: 6pt 0 10pt; padding: 0; list-style: none; }
  li { margin: 0 0 4pt; padding-left: 1.3em; text-indent: -1.3em; }
  .live-list > li::before { content: '\\2014\\00a0\\00a0'; }
  .live-sub { margin: 4pt 0 0; }
  .live-sub li::before { content: '\\25CB\\00a0\\00a0'; font-size: 0.75em; vertical-align: 0.1em; }
  #contents .live-list:not(.live-sub) { font-family: 'IBM Plex Sans', sans-serif; font-size: 10.5pt; }
  #contents .live-sub { font-size: 9pt; }
  hr { border: 0; border-top: 0.75pt solid #999; margin: 16pt 0; }
  /* in the band, the list dashes are white, as on the site */
  .band-page .live-list > li::before { color: #fff; }
  /* this article's own blocks: quotations, the Unified Frames note and the
     four futures diagram (drawn by the site's shared assets/matrix.css) */
  blockquote { margin: 10pt 0 12pt; padding-left: 14pt; border-left: 1pt solid #000; font-size: 12pt; }
  blockquote p:last-child { margin-bottom: 0; }
  :root { --canvas-ink: #000; --canvas-bg: #fff; --muted: #8c8c8c; --canvas-accent: #e36843; --serif: 'ET Bembo', Georgia, serif; }
  .matrix-figure { margin: 18pt 0 16pt; }
  /* the diagram on a page of its own, turned landscape: the full version,
     with each future's description, drawn at the site's wide size and
     scaled to fit the page, centred on it */
  @page diagram { size: A4 landscape; margin: 16mm 16mm 18mm; }
  .matrix-figure .matrix-wrap {
    page: diagram; break-before: page; break-after: page;
    --ax-l: 100px; --ax-b: 64px; --ar: 40px;
    width: 1080px; max-width: none; margin: 0 auto; zoom: 0.68;
  }
  .matrix-figure .matrix {
    aspect-ratio: 9 / 8;
    --m-pad: 30px; --m-h4-sans: 21px; --m-h4: 26px; --m-sub: 20px; --m-p: 19px; --m-p-lh: 1.4;
  }
  .matrix .m-text p { display: block !important; }
  .matrix .m-sub { display: block !important; }
  .matrix-axis { font-size: 16px !important; }
  .matrix-tick { font-size: 14px !important; }
  .matrix-tick.y-high, .matrix-tick.y-low { right: calc(100% - var(--ax-l) + 10px) !important; }
  .matrix-tick.x-low, .matrix-tick.x-high { bottom: 34px !important; }
  .matrix-frames { margin: 0 0 16pt; padding-left: 14pt; border-left: 3pt solid #e36843; font-family: 'IBM Plex Sans', sans-serif; font-size: 9.5pt; line-height: 1.55; }
  .matrix-detail { display: none !important; }
  /* drawn at rest: no future chosen, whatever the pointer */
  .matrix { pointer-events: none; }
  .matrix .m-cell { background: #fff !important; transition: none !important; }
  .matrix .m-center::before { opacity: 0 !important; transition: none !important; }
  .matrix .m-text { transform: none !important; transition: none !important; }
  html.serif-headings .matrix .m-text h4 { font-weight: 700 !important; -webkit-text-stroke-width: 0.4px !important; }
  .matrix .m-text :is(.m-sub, p) { -webkit-text-stroke: 0 !important; }
  .matrix .m-text h4 { margin-top: 0; }
`;

(async () => {
  const exe = process.env.CHROMIUM || (process.env.PLAYWRIGHT_BROWSERS_PATH ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  // read the article out of the page as it is written, before any script runs
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  const parts = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const body = q('.article-body').cloneNode(true);
    body.querySelectorAll('button, .sidenote, .sidenote-label').forEach((n) => n.remove());
    // headings lose their self-links, keeping their text
    body.querySelectorAll('.heading-link').forEach((a) => a.replaceWith(...a.childNodes));
    const sections = Array.from(body.children);
    // the sections in the Overview's band, kept together as the lead-in
    let n = 0;
    while (n < sections.length && (sections[n].id === 'overview' || sections[n].classList.contains('in-band'))) n++;
    const html = (els) => els.map((e) => e.outerHTML).join('\n');
    const title = q('.article-title').cloneNode(true);
    title.querySelectorAll('.heading-link').forEach((a) => a.replaceWith(...a.childNodes));
    return {
      author: q('.article-author').innerHTML,
      title: title.innerHTML,
      titleText: q('.article-title').textContent.replace(/\s+/g, ' ').trim(),
      subtitle: q('.article-subtitle').innerHTML,
      // the Overview on one page, the sections after it in the band on another
      bandPages: n ? [html(sections.slice(0, 1))].concat(n > 1 ? [html(sections.slice(1, n))] : []) : [],
      rest: html(sections.slice(n)),
    };
  });
  const doc = '<!doctype html><html class="serif-headings"><head><meta charset="utf-8"><base href="file://' + ROOT + '/">' +
    '<title>' + parts.titleText + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    '<link href="assets/matrix.css" rel="stylesheet">' +
    '<style>' + CSS + '</style></head><body>' +
    '<div class="title-page"><p class="author">' + parts.author + '</p><h1>' + parts.title + '</h1><p class="subtitle">' + parts.subtitle + '</p></div>' +
    parts.bandPages.map((h) => '<div class="band-page">' + h + '</div>').join('') +
    parts.rest.replace('<section', '<section class="article-start"') + '</body></html>';
  await page.setContent(doc, { waitUntil: 'load', timeout: 20000 }).catch(() => page.setContent(doc, { waitUntil: 'domcontentloaded' }));
  // the margins' type is not in the page itself, so load it by name
  await page.evaluate(() => Promise.all(['400 8pt "IBM Plex Sans"', '500 10pt "IBM Plex Sans"', '700 29pt "Inter"'].map((f) => document.fonts.load(f))).then(() => document.fonts.ready));
  await page.pdf({
    path: OUT,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  await browser.close();
  console.log('Wrote ' + path.relative(ROOT, OUT));
})().catch((e) => { console.error(e); process.exit(1); });
