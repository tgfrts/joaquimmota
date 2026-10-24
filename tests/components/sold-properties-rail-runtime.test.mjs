import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const compiled = await build({
  stdin: {contents: "import {bindSoldPropertiesRail} from './src/scripts/sold-properties-rail'; window.bindRail=bindSoldPropertiesRail;", resolveDir: process.cwd(), loader: 'ts'},
  bundle: true, format: 'iife', platform: 'browser', write: false,
});

function setup(t, count = 5, reduced = false) {
  const cards = Array.from({length: count * 2}, (_, index) => `<article><h3 id="card-${index}">${index % count}</h3></article>`).join('');
  const dom = new JSDOM(`<div data-sold-count="${count}"><div class="sold-properties__track">${cards}</div></div>`, {runScripts: 'outside-only'});
  t.after(() => dom.window.close());
  const w = dom.window;
  let width = 3440, cardWidth = 1600 / .9 * .25, gap = 1600 / .9 * .05;
  let onResize, onIntersection, onReduced;
  const media = {matches: reduced, addEventListener: (_, callback) => {onReduced = callback;}};
  w.matchMedia = () => media;
  w.getComputedStyle = () => ({columnGap: String(gap)});
  w.ResizeObserver = class {constructor(callback) {onResize = callback;} observe() {}};
  w.IntersectionObserver = class {constructor(callback) {onIntersection = callback;} observe() {}};
  w.HTMLElement.prototype.getBoundingClientRect = function() {return {width: cardWidth, top: 0, bottom: 100};};
  const rail = w.document.querySelector('[data-sold-count]');
  Object.defineProperty(rail, 'clientWidth', {get: () => width});
  w.eval(compiled.outputFiles[0].text);
  w.bindRail(rail);
  const track = rail.firstElementChild;
  return {rail, track, media, resize(nextWidth, nextCard = cardWidth, nextGap = gap) {width = nextWidth; cardWidth = nextCard; gap = nextGap; onResize();}, intersect() {onIntersection([{isIntersecting: true}]);}, changeReduced(value) {media.matches = value; onReduced();}, coverage() {
    const period = Number.parseFloat(track.style.getPropertyValue('--sold-loop-distance'));
    return {period, remaining: track.children.length * (cardWidth + gap) - gap - period, width};
  }};
}

test('full-width sold rail has enough repeats at loop end and trims after resize', t => {
  const s = setup(t);
  for (const width of [3440, 5120, 7680]) {
    s.resize(width);
    const {period, remaining} = s.coverage();
    assert.ok(Math.abs(period - 8000 / 3) < .01);
    assert.ok(remaining >= width, `rail fully covered after one period at ${width}px`);
    for (const duplicate of Array.from(s.track.children).slice(5)) {
      assert.equal(duplicate.getAttribute('aria-hidden'), 'true');
      assert.ok(duplicate.hasAttribute('inert'));
    }
    assert.equal(new Set(Array.from(s.track.querySelectorAll('[id]')).map(element => element.id)).size, s.track.querySelectorAll('[id]').length);
  }
  s.resize(1440, 360, 72);
  assert.equal(s.track.children.length, 10);
  s.resize(390, 292.5, 19.5);
  assert.equal(s.coverage().period, 1560);
  assert.ok(s.coverage().remaining >= 390);
});

test('initial reduced motion still covers rail and can subsequently animate', t => {
  const s = setup(t, 3, true);
  s.resize(7680);
  assert.ok(s.coverage().remaining >= 7680);
  assert.equal(s.coverage().period, 1600);
  s.intersect();
  assert.equal(s.rail.classList.contains('is-visible'), false);
  s.changeReduced(false);
  assert.equal(s.rail.classList.contains('is-visible'), true);
  s.changeReduced(true);
  assert.equal(s.rail.classList.contains('is-visible'), false);
});
