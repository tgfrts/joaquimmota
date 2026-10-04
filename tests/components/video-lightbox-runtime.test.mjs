import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const componentPath = fileURLToPath(new URL('../../src/components/VideoLightbox.astro', import.meta.url));
const componentSource = await readFile(componentPath, 'utf8');
const script = componentSource.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'VideoLightbox must contain its lifecycle script.');
const compiled = await build({
  stdin: { contents: script, resolveDir: dirname(componentPath), loader: 'ts' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
});

function fixture(id, videoId) {
  return `<div data-video-lightbox id="${id}">
    <button type="button" data-video-trigger>Open</button>
    <dialog data-video-dialog><button type="button" data-video-close>Close</button><iframe data-video-frame data-src="https://www.youtube.com/embed/${videoId}"></iframe></dialog>
  </div>`;
}

function installDialogMethods(window) {
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
}

test('actual VideoLightbox script defers fixed YouTube frames, cleans them up, and isolates instances', (t) => {
  const dom = new JSDOM(`${fixture('first', 'GA8Iw5rMdyw')}${fixture('second', 'MTuuS9VXc8E')}`, { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  installDialogMethods(dom.window);
  dom.window.eval(compiled.outputFiles[0].text);

  const first = dom.window.document.querySelector('#first');
  const second = dom.window.document.querySelector('#second');
  const firstDialog = first.querySelector('dialog');
  const secondDialog = second.querySelector('dialog');
  const firstFrame = first.querySelector('iframe');
  const secondFrame = second.querySelector('iframe');

  assert.equal(firstFrame.hasAttribute('src'), false);
  assert.equal(secondFrame.hasAttribute('src'), false);

  first.querySelector('[data-video-trigger]').click();
  assert.equal(firstDialog.open, true);
  assert.equal(firstFrame.src, 'https://www.youtube.com/embed/GA8Iw5rMdyw');
  assert.equal(secondDialog.open, false);
  assert.equal(secondFrame.hasAttribute('src'), false);

  first.querySelector('[data-video-close]').click();
  assert.equal(firstDialog.open, false);
  assert.equal(firstFrame.hasAttribute('src'), false);

  second.querySelector('[data-video-trigger]').click();
  assert.equal(secondFrame.src, 'https://www.youtube.com/embed/MTuuS9VXc8E');
  secondDialog.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(secondDialog.open, false);
  assert.equal(secondFrame.hasAttribute('src'), false);
});
