import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { onRequest } from '../../functions/admin/dashboard.ts';

for (const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']) {
  test(`admin ${method} serves own protected asset as 401 without forwarding credentials or body`, async () => {
    const request = new Request('https://preview.example.test/admin/dashboard?e=1&secret=private', { method, headers: { cookie:'session=private', authorization:'Bearer private' }, ...(method !== 'GET' && method !== 'HEAD' ? {body:'pass=private-password'} : {}) });
    let assetRequest;
    const response = await onRequest({request,env:{ASSETS:{fetch:async input=>{assetRequest=input;return new Response('<h3>Protected Page</h3>',{headers:{'set-cookie':'bad=1','cache-control':'public','etag':'stale'}});}}}});
    assert.equal(assetRequest.url,'https://preview.example.test/401');
    assert.equal(assetRequest.method,'GET');
    assert.equal(assetRequest.headers.get('cookie'),null);assert.equal(assetRequest.headers.get('authorization'),null);
    assert.equal(await assetRequest.text(),'');
    assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('etag'),null);
    assert.equal(await response.text(),'<h3>Protected Page</h3>');
    assert.equal(request.bodyUsed,false,'Original password payload is not consumed.');
  });
}
for (const path of ['401/index','admin/dashboard']) {
  test(`${path}: real client keeps password submissions in the preview and shows errors only for e=1`, async (t) => {
    const file=fileURLToPath(new URL(`../../src/pages/${path}.astro`,import.meta.url));
    const source=await readFile(file,'utf8');
    assert.equal(source.includes('/.wf_auth'),false);
    assert.equal(source.includes('Acesso não disponível'),false);
    assert.match(source,/<h3 id="protected-title">Protected Page<\/h3>/);
    assert.match(source,/src="\/assets\/utility-lock.svg"/);
    const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
    const compiled=await build({stdin:{contents:script,resolveDir:dirname(file),loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false});
    const body=source.match(/<body[\s\S]*?<\/body>/)[0];
    for(const [query,visible]of [['',false],['?e=0',false],['?e=10',false],['?x=1&e=1',true]]) {
      const dom=new JSDOM(body,{runScripts:'outside-only',url:`https://preview.example.test/${path.startsWith('401')?'401/':'admin/dashboard'}${query}`});
      t.after(()=>dom.window.close());
      dom.window.fetch=()=>{throw new Error('Password preview must never send requests.');};
      dom.window.eval(compiled.outputFiles[0].text);
      assert.equal(dom.window.document.querySelector('[data-password-error]').hidden,!visible);
      const form=dom.window.document.querySelector('form');
      form.elements.pass.value='not-a-real-password';
      const submit=new dom.window.Event('submit',{bubbles:true,cancelable:true});
      form.dispatchEvent(submit);assert.equal(submit.defaultPrevented,true);
      assert.equal(form.getAttribute('action'),null);assert.equal(form.querySelector('button').disabled,false);
    }
  });
}
