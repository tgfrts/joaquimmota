import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { bindDesktopHeroVideo } from '../../src/scripts/responsive-hero-video.ts';

function runtime(t, desktop) {
  const dom = new JSDOM('<video data-desktop-video="/assets/hero.mp4"><source type="video/mp4"></video>');
  const video = dom.window.document.querySelector('video');
  const query = new dom.window.EventTarget();
  query.matches = desktop;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    matchMedia: media => { assert.equal(media, '(min-width: 768px)'); return query; },
  } });
  const calls = { load: 0, play: 0, pause: 0 };
  video.load = () => { calls.load++; };
  video.play = () => { calls.play++; return Promise.resolve(); };
  video.pause = () => { calls.pause++; };
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
    dom.window.close();
  });
  const resize = matches => {
    query.matches = matches;
    query.dispatchEvent(new dom.window.Event('change'));
  };
  return { video, calls, resize };
}

test('mobile initial render never attaches or requests a video source', t => {
  const { video, calls } = runtime(t, false);
  bindDesktopHeroVideo(video);
  assert.equal(video.hasAttribute('src'), false);
  assert.equal(video.querySelector('source').hasAttribute('src'), false);
  assert.deepEqual(calls, { load: 0, play: 0, pause: 0 });
});

test('desktop plays muted, unloads on mobile, and resumes when returning to desktop', t => {
  const { video, calls, resize } = runtime(t, true);
  bindDesktopHeroVideo(video);
  assert.equal(video.getAttribute('src'), '/assets/hero.mp4');
  assert.equal(video.muted, true);
  assert.deepEqual(calls, { load: 1, play: 1, pause: 0 });
  resize(true);
  assert.equal(calls.load, 1);
  resize(false);
  assert.equal(video.hasAttribute('src'), false);
  assert.deepEqual(calls, { load: 2, play: 1, pause: 1 });
  resize(true);
  assert.equal(video.getAttribute('src'), '/assets/hero.mp4');
  assert.deepEqual(calls, { load: 3, play: 2, pause: 1 });
});
