import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('../../',import.meta.url);
function htmlFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?htmlFiles(path.join(dir,entry.name)):entry.name.endsWith('.html')?[path.join(dir,entry.name)]:[]);}
test('every built form is free of PS Real Estate Team and property consent identifies Joaquim Mota',()=>{
 let forms=0,propertyForms=0;
 for(const file of htmlFiles(new URL('dist',root).pathname)){
  const html=fs.readFileSync(file,'utf8');
  for(const [form] of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)){
   forms++;assert.doesNotMatch(form,/PS\s*Real\s*Estate\s*Team/i,file);
   if(form.includes('name="marketingConsent"')){propertyForms++;assert.match(form,/Joaquim Mota Consultor Imobiliário/,file);}
  }
 }
 assert.ok(forms>0);assert.ok(propertyForms>0);
});
