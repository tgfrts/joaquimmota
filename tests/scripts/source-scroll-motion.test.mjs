import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindInteriorHero, bindSourceScrollMotion } from '../../src/scripts/source-scroll-motion.ts';

function runtime(t, initiallyReduced) {
  const dom = new JSDOM('<main><div id="overlay"></div><img id="hero" alt=""><section id="sensor"><img id="lazy" alt=""></section></main>');
  const { window } = dom;
  const preference = new window.EventTarget();
  preference.matches = initiallyReduced;
  preference.media = '(prefers-reduced-motion: reduce)';
  preference.set = value => {
    preference.matches = value;
    preference.dispatchEvent(new window.Event('change'));
  };
  const frames = new Map();
  let nextId = 0;
  const replacement = {
    document: window.document,
    innerHeight: 720,
    addEventListener: window.addEventListener.bind(window),
    matchMedia: query => {
      assert.equal(query, preference.media);
      return preference;
    },
    requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; },
  };
  const originals = new Map(Object.keys(replacement).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(replacement).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }));
  Object.defineProperty(window.document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
  let top = 360;
  const rectangle = () => new window.DOMRect(0, top, 1000, 640);
  const image = window.document.getElementById('hero');
  const overlay = window.document.getElementById('overlay');
  const sensor = window.document.getElementById('sensor');
  image.getBoundingClientRect = rectangle;
  sensor.getBoundingClientRect = rectangle;
  t.after(() => {
    frames.clear();
    for (const [key, original] of originals) {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    }
    window.close();
  });
  const frame = () => {
    assert.ok(frames.size > 0, 'The runtime should have scheduled a frame.');
    const batch = [...frames.values()]; frames.clear();
    batch.forEach(callback => callback(0));
  };
  const settle = () => {
    let count = 0;
    while (frames.size && count++ < 100) frame();
    assert.equal(frames.size, 0, 'Smoothing should converge instead of scheduling forever.');
  };
  return { window, image, overlay, sensor, preference, frames, frame, settle, setTop: value => { top = value; } };
}

function assertReducedHero(image, overlay) {
  assert.equal(image.style.transform, 'none');
  assert.equal(image.style.filter, 'none');
  assert.equal(image.style.opacity, '1');
  assert.equal(overlay.style.opacity, '0');
  assert.equal(overlay.style.filter, 'none');
}

test('initial reduced-motion preference makes the first rendered hero frame stable and visible', t => {
  const r = runtime(t, true);
  bindInteriorHero(r.image, r.overlay);
  assert.equal(r.frames.size, 1);
  r.frame();
  assertReducedHero(r.image, r.overlay);
  r.settle();
  assertReducedHero(r.image, r.overlay);
  r.setTop(-300);
  r.window.dispatchEvent(new r.window.Event('scroll'));
  r.frame();
  assertReducedHero(r.image, r.overlay);
  r.settle();
});

test('changing false to true during a pending animation removes transform, blur and fading on the next frame', t => {
  const r = runtime(t, false);
  bindInteriorHero(r.image, r.overlay);
  r.frame();
  assert.notEqual(r.image.style.transform, 'none');
  assert.notEqual(r.image.style.filter, 'none');
  assert.notEqual(r.overlay.style.filter, 'none');
  assert.ok(r.frames.size > 0, 'The fixture exercises an animation still converging.');
  r.preference.set(true);
  r.frame();
  assertReducedHero(r.image, r.overlay);
  r.settle();
  assertReducedHero(r.image, r.overlay);
});

test('changing false to true after convergence schedules a fresh render without scrolling', t => {
  const r = runtime(t, false);
  bindInteriorHero(r.image, r.overlay);
  r.settle();
  assert.notEqual(r.image.style.transform, 'none');
  assert.equal(r.frames.size, 0);
  r.preference.set(true);
  assert.equal(r.frames.size, 1);
  r.frame();
  assertReducedHero(r.image, r.overlay);
  r.settle();
});

test('generic motion consumers receive the changed preference on resize and lazy-image load too', t => {
  const r = runtime(t, false);
  const rendered = [];
  bindSourceScrollMotion(r.sensor, (progress, reduced) => rendered.push({ progress, reduced }));
  r.settle();
  assert.equal(rendered.at(-1).reduced, false);
  assert.ok(rendered.every(({ progress }) => progress >= 0 && progress <= 1));
  r.preference.set(true);
  r.frame();
  assert.equal(rendered.at(-1).reduced, true);
  r.settle();
  r.window.dispatchEvent(new r.window.Event('resize'));
  r.frame();
  assert.equal(rendered.at(-1).reduced, true);
  r.settle();
  r.window.document.getElementById('lazy').dispatchEvent(new r.window.Event('load'));
  r.frame();
  assert.equal(rendered.at(-1).reduced, true);
  r.settle();
});
