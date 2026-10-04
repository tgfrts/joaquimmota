import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
const pagePath = fileURLToPath(new URL('../../src/pages/lp-flyer-uma-venda-com-sucesso.astro', import.meta.url));
const source = await readFile(pagePath, 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Compile the actual flyer form handler.');
const compiled = await build({ stdin: { contents: script, resolveDir: dirname(pagePath), loader: 'ts' }, bundle:true, format:'iife', platform:'browser', write:false });
const flush=()=>new Promise((resolve)=>setImmediate(resolve));
const html=`<div><form data-campaign-valuation data-route="/lp-flyer-uma-venda-com-sucesso"><input name="firstName" required value="Ana"><input name="lastName" required value="Costa"><input name="email" type="email" required value="ana@example.test"><input name="phone" required value="+351900000000"><input name="consent" type="checkbox" required checked><button type="submit" data-wait="Por favor aguarde...">QUERO VENDER A MINHA CASA</button></form><p data-campaign-status hidden></p></div>`;
function runtime(t, transport) { const dom=new JSDOM(html,{runScripts:'outside-only'});t.after(()=>dom.window.close());Object.defineProperty(dom.window,'crypto',{value:{randomUUID:()=> 'flyer-idempotency-key'}});const calls=[];dom.window.fetch=async(url,options)=>{calls.push({url,...options});return transport(calls.length,options)};dom.window.eval(compiled.outputFiles[0].text);const form=dom.window.document.querySelector('form');return {form,status:dom.window.document.querySelector('[data-campaign-status]'),button:form.querySelector('button'),calls,submit:()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))}; }
test('actual flyer handler sends only source fields and keeps sibling success after 202',async(t)=>{const r=runtime(t,async()=>({status:202}));assert.equal(r.form.checkValidity(),true);r.submit();await flush();assert.deepEqual(JSON.parse(r.calls[0].body),{formType:'valuation',route:'/lp-flyer-uma-venda-com-sucesso',fields:{name:'Ana Costa',email:'ana@example.test',phone:'+351900000000',consent:true}});assert.equal(r.form.hidden,true);assert.equal(r.status.textContent,'Obrigado! O seu formulário foi enviado com sucesso.');});
test('actual flyer handler retries 503 and rejects an overlapping submit',async(t)=>{let accept;let n=0;const r=runtime(t,()=>++n===1?{status:503}:new Promise((resolve)=>{accept=resolve}));r.submit();await flush();assert.equal(r.button.disabled,false);assert.match(r.status.textContent,/Aconteceu algo/);r.submit();r.submit();await flush();assert.equal(r.calls.length,2);assert.equal(r.button.disabled,true);accept({status:202});await flush();assert.equal(r.form.hidden,true);});
