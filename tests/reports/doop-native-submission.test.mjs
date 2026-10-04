import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createDoopHandler, schemas } from '../../functions/api/doop/_handler.ts';

function fields(kind) {
  return new URLSearchParams(Object.entries(schemas[kind]).map(([name, rule]) => [name, rule.values?.[0] ?? (name === 'message' ? 'A synthetic note & example' : 'Synthetic test value')]));
}
const ownURL = 'https://hook.eu1.make.com/synthetic-jrm-test';
const env = { DOOP_ACTIVITY_WEBHOOK_URL: ownURL, DOOP_VISIT_WEBHOOK_URL: ownURL };
function request(kind, body = fields(kind), overrides = {}) {
  return new Request(`https://preview.example.test/api/doop/${kind}`, { method: 'POST', headers: {origin:'https://preview.example.test','content-type':'application/x-www-form-urlencoded'}, body:body.toString(), ...overrides });
}
for (const kind of ['activities','visits']) {
  test(`${kind}: valid native form forwards exact source fields only to configured own endpoint and returns safe bounded text`, async()=> {
    let call;
    const handler=createDoopHandler(kind,async(url,options)=>{call={url,options};return new Response('<b>Accepted</b>',{status:202,headers:{'content-type':'text/html','set-cookie':'injected=1',location:'https://external.example.test'}});});
    const response=await handler({request:request(kind),env});
    assert.equal(response.status,202);assert.equal(await response.text(),'<b>Accepted</b>');
    assert.equal(response.headers.get('content-type'),'text/plain; charset=utf-8');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('location'),null);
    assert.equal(call.url,ownURL);assert.equal(call.options.redirect,'manual');assert.equal(call.options.method,'POST');
    assert.equal(call.options.headers.cookie,undefined);assert.equal(call.options.headers.authorization,undefined);
    assert.deepEqual([...new URLSearchParams(call.options.body)],[...fields(kind)]);
  });
  test(`${kind}: invalid native input never reaches transport`,async()=>{
    let calls=0;const handler=createDoopHandler(kind,async()=>{calls++;throw new Error('No invalid input may leave the server.');});
    const cases=[
      [request(kind,fields(kind),{method:'GET',body:undefined}),405],
      [request(kind,fields(kind),{headers:{origin:'https://other.example.test','content-type':'application/x-www-form-urlencoded'}}),403],
      [request(kind,fields(kind),{headers:{'content-type':'application/x-www-form-urlencoded'}}),403],
      [request(kind,fields(kind),{headers:{origin:'https://preview.example.test','content-type':'application/json'}}),415],
      [request(kind,'bad=%GG'),400], [request(kind,'bad=%ED%A0%80'),400],
      [request(kind,'x'.repeat(65537)),413],
    ];
    for (const [mutation,status] of [[data=>data.append('webhookURL','https://external.example.test'),400],[data=>data.append('__proto__','bad'),400],[data=>data.append('Data','duplicate'),400],[data=>data.delete('Data'),400],[data=>data.set('Data','   '),400],[data=>data.set('message','x'.repeat(5001)),400],[data=>data.set('Data','x'.repeat(257)),400]]) {
      const data=fields(kind);mutation(data);cases.push([request(kind,data),status]);
    }
    const enumName=kind==='activities'?'Tipo-atividade':'compraria';const invalidEnum=fields(kind);invalidEnum.set(enumName,'null');cases.push([request(kind,invalidEnum),400]);
    for(const [input,status]of cases)assert.equal((await handler({request:input,env})).status,status);
    assert.equal(calls,0);
  });
  test(`${kind}: missing or unsafe configuration fails closed without network`,async()=>{
    let calls=0;const handler=createDoopHandler(kind,async()=>{calls++;throw new Error('No config must mean no call.');});
    const key=kind==='activities'?'DOOP_ACTIVITY_WEBHOOK_URL':'DOOP_VISIT_WEBHOOK_URL';
    for(const value of [undefined,'http://hook.eu1.make.com/test','https://external.example.test/test','https://hook.eu1.make.com.evil.test/test','https://user:password@hook.eu1.make.com/test','https://hook.eu1.make.com/test?url=x','https://hook.eu1.make.com/test#fragment'])assert.equal((await handler({request:request(kind),env:{[key]:value}})).status,503);
    assert.equal(calls,0);
  });
  test(`${kind}: redirects, upstream failure, oversized response and transport rejection never report acceptance`,async()=>{
    for(const transport of [async()=>new Response('redirect',{status:302,headers:{location:'https://other.example.test'}}),async()=>new Response('no',{status:500}),async()=>new Response('x'.repeat(8193)),async()=>{throw new Error('timeout');}]) {
      const response=await createDoopHandler(kind,transport)({request:request(kind),env});
      assert.equal(response.status,502);assert.equal(response.headers.get('location'),null);
      assert.match(await response.text(),/^Report submission/);
    }
  });
}
test('page forms use native same-origin POST and preserve exact field allowlists without invented inline feedback',async()=>{
  const component=await readFile(new URL('../../src/components/ReportDatePicker.astro',import.meta.url),'utf8');
  assert.match(component,/name=\{name\}/);assert.match(component,/type="text"/);assert.match(component,/maxlength=\{maxlength\}/);assert.match(component,/required=\{required\}/);
  for(const [file,kind]of [['relatorios-de-atividades','activities'],['relatorios-de-visita','visits']]){
    const source=await readFile(new URL(`../../src/pages/doop/${file}.astro`,import.meta.url),'utf8');
    const renderedSource=source.replace(/<ReportDatePicker\s+([^>]*?)\s*\/>/g,(_match,attributes)=>{
      const props=Object.fromEntries([...attributes.matchAll(/(\w+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
      return `<input id="${props.id}" name="${props.name}" type="text" maxlength="256" required data-datepicker-input>`;
    });
    assert.notEqual(renderedSource,source,'the date picker component should appear in this native form');
    const document=new JSDOM(renderedSource).window.document;const form=document.querySelector('form');
    assert.equal(form.getAttribute('method'),'post');assert.equal(form.getAttribute('action'),`/api/doop/${kind}`);
    assert.equal(form.querySelector('button').type,'submit');
    assert.equal(source.includes('Pré-visualização:'),false);assert.equal(source.includes('data-preview-status'),false);
    const actual=[...form.querySelectorAll('input[name],select[name],textarea[name]')].map(field=>field.name).sort();
    assert.deepEqual(actual,Object.keys(schemas[kind]).sort());
    for(const element of form.querySelectorAll('input[name],select[name],textarea[name]')){
      const rule=schemas[kind][element.name];assert.equal(element.required,rule.required===true);
      if(rule.max)assert.equal(element.maxLength,rule.max);
      if(rule.values)assert.deepEqual([...element.options].slice(1).map(option=>option.value),rule.values);
    }
  }
});
