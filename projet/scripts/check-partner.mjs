import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../worker/index.js';
const env={NZOZI_ALLOWED_EMAILS:'partner@example.test'};
const req=(path,email,id)=>new Request('https://example.test'+path,{headers:{...(email?{'oai-authenticated-user-email':email}:{}),...(id?{'oai-authenticated-user-id':id}:{})}});
for(const [email,id,status] of [[null,null,401],['family@example.test','family',403],['partner@example.test',null,401],['partner@example.test','partner',200]]){const r=await worker.fetch(req('/partenaire',email,id),env);assert.equal(r.status,status);assert.equal(r.headers.get('Cache-Control'),'private, no-store');const s=await r.text();assert.equal(s.includes('id="net"'),status===200);}
const home=await (await worker.fetch(req('/'),env)).text();assert.ok(!home.includes('id="net"'));assert.ok(!home.includes('net/0.85'));
assert.equal((await worker.fetch(req('/partenaire','partner@example.test','partner'),{})).status,403);
const html=await (await worker.fetch(req('/partenaire','partner@example.test','partner'),env)).text();const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].split("const form=document.getElementById('profile-form')")[0];
const els=new Map();for(const id of ['net','calc-error','total-value','fee-value'])els.set(id,{value:'255',hidden:false,textContent:'',setAttribute(){},addEventListener(_,fn){this.update=fn;}});
vm.runInNewContext(script,{Intl,document:{getElementById:id=>els.get(id),querySelectorAll:()=>[]}});
for(const [value,total,fee] of [['170','200,00','30,00'],['255','300,00','45,00'],['340','400,00','60,00'],['300','352,94','52,94'],['1','1,18','0,18']]){els.get('net').value=value;els.get('net').update();assert.ok(els.get('total-value').textContent.includes(total));assert.ok(els.get('fee-value').textContent.includes(fee));}
for(const value of ['-1','0','1.001','100001','bad']){els.get('net').value=value;els.get('net').update();assert.equal(els.get('calc-error').hidden,false);assert.equal(els.get('total-value').textContent,'—');}
els.get('net').value='';els.get('net').update();assert.equal(els.get('calc-error').hidden,true);assert.equal(els.get('total-value').textContent,'—');
const noBucket=await (await worker.fetch(req('/partenaire','partner@example.test','partner'),env)).text();assert.match(noBucket,/<div id="photo-block" class="full" hidden>/);
const withBucket=await (await worker.fetch(req('/partenaire','partner@example.test','partner'),{...env,BUCKET:{}})).text();assert.match(withBucket,/<div id="photo-block" class="full">/);
console.log('Photo masquée sans stockage, accès serveur, absence du simulateur côté familles, calculs et montants invalides : OK.');
