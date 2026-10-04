import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const path = fileURLToPath(new URL('../../src/components/BlogIndex.astro', import.meta.url));
const source = await readFile(path, 'utf8');
const css = await readFile(new URL('../../src/styles/blog-index.css', import.meta.url), 'utf8');
const section = source.match(/<section class="blog-index__subscribe"[\s\S]*?<\/section>/)[0];
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const compiled = await build({ stdin: { contents: script, resolveDir: dirname(path), loader:'ts' }, bundle:true, format:'iife', platform:'browser', write:false });
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(t, transport) {
  const dom = new JSDOM(`<style>${css}</style>${section}`, { runScripts:'outside-only', url:'https://preview.example.test/blog' });
  t.after(() => dom.window.close());
  const calls=[];
  dom.window.fetch = (url, options) => { calls.push({url,...options}); return transport(calls.length); };
  dom.window.eval(compiled.outputFiles[0].text);
  const document=dom.window.document, form=document.querySelector('form'), success=document.querySelector('[data-blog-newsletter-success]'), error=document.querySelector('[data-blog-newsletter-error]'), button=form.querySelector('button');
  const display=element=>dom.window.getComputedStyle(element).display;
  const submit=()=>{const event=new dom.window.Event('submit',{cancelable:true,bubbles:true});form.dispatchEvent(event);assert.equal(event.defaultPrevented,true);};
  return {dom,form,success,error,button,calls,display,submit};
}
test('real blog newsletter validates required email, preserves source maxlength/copy/headings and rejects concurrent submissions',async(t)=>{
  let resolveRequest;
  const r=harness(t,()=>new Promise(resolve=>{resolveRequest=resolve;}));
  assert.equal(r.form.elements.email.maxLength,256);
  assert.equal(r.dom.window.document.querySelector('#blog-subscribe-title').tagName,'H3');
  assert.equal(r.success.textContent,'Subscrito com sucesso!');
  assert.equal(r.error.textContent,'Oops! Alguma coisa correu mal na submissão do formulário');
  r.submit();assert.equal(r.calls.length,0);
  r.form.elements.email.value='invalid';r.submit();assert.equal(r.calls.length,0);
  r.form.elements.email.value='ana@example.test';r.submit();r.submit();await flush();
  assert.equal(r.calls.length,1);assert.equal(r.button.disabled,true);assert.equal(r.button.textContent,'Please wait...');
  assert.equal(r.display(r.success),'none');assert.equal(r.display(r.error),'none');
  resolveRequest({status:202});await flush();
  assert.equal(r.display(r.form),'none');assert.notEqual(r.display(r.success),'none');
  assert.equal(r.success.parentElement,r.form.parentElement);assert.equal(r.form.contains(r.success),false);
  assert.equal(r.display(r.error),'none');
  r.submit();await flush();assert.equal(r.calls.length,1,'Accepted hidden form cannot submit again.');
  assert.deepEqual(JSON.parse(r.calls[0].body),{formType:'newsletter',route:'/blog',fields:{email:'ana@example.test'}});
});
test('real blog newsletter 503 and nonaccepted 200 keep form visible; retry preserves identity and 202 shows external success',async(t)=>{
  const r=harness(t,async number=>({status:[503,200,202][number-1]}));
  r.form.elements.email.value='ana@example.test';
  for(let i=0;i<2;i++){
    r.submit();await flush();
    assert.notEqual(r.display(r.form),'none');assert.notEqual(r.display(r.error),'none');assert.equal(r.display(r.success),'none');
    assert.equal(r.button.disabled,false);assert.equal(r.button.textContent,'SUBSCREVER');
  }
  r.submit();await flush();
  assert.equal(new Set(r.calls.map(call=>call.headers['idempotency-key'])).size,1);
  assert.equal(r.display(r.error),'none');assert.equal(r.display(r.form),'none');assert.notEqual(r.display(r.success),'none');
});
