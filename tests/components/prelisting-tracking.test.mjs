import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const compiled = await build({
  stdin: { contents: "import {trackPrelistingView} from './src/scripts/prelisting-tracking'; window.trackView=trackPrelistingView;", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'iife', platform: 'browser', write: false,
});

function setup(t) {
  const dom = new JSDOM('', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(compiled.outputFiles[0].text);
  return dom.window.trackView;
}

test('unshared links and empty tokens never send a tracking request', t => {
  const track = setup(t);
  const unexpected = () => assert.fail('No tracking without token and slug');
  track({ search: '', pathname: '/vouvender/example' }, unexpected);
  track({ search: '?t=', pathname: '/vouvender/example' }, unexpected);
  track({ search: '?t=token', pathname: '/' }, unexpected);
});

test('shared link preserves exact original token/slug payload and fixed endpoint', t => {
  const track = setup(t);
  const calls = [];
  track({ search: '?t=opaque%2Btoken&unrelated=ignored', pathname: '/vouvender/original-slug' }, (...args) => {
    calls.push(args);
    return Promise.resolve({ ok: true });
  });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://doop-tools.pages.dev/api/track');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), { slug: 'original-slug', token: 'opaque+token' });
});

test('network failures do not break the presentation', async t => {
  const track = setup(t);
  const location = { search: '?t=test', pathname: '/vouvender/test' };
  assert.doesNotThrow(() => track(location, () => { throw new Error('offline'); }));
  assert.doesNotThrow(() => track(location, () => Promise.reject(new Error('offline'))));
  await new Promise(resolve => setImmediate(resolve));
});
