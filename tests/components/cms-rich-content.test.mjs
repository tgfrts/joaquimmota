import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const component = fs.readFileSync(new URL('../../src/components/CmsRichContent.astro', import.meta.url), 'utf8');

test('rich content renders H5 and safe new-tab annotations without discarding link behavior', () => {
  assert.match(component, /block\.style === 'h5' \? <h5 set:html=\{inline\(block\)\}/);
  assert.match(component, /openInNewTab === true/);
  assert.ok(component.includes('target="_blank" rel="noopener noreferrer"'));
});
