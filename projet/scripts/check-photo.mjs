import assert from 'node:assert/strict';import worker from '../worker/index.js';
const photos=new Map();const env={NZOZI_ALLOWED_EMAILS:'a@test.fr,b@test.fr',BUCKET:{async put(k,v,m){photos.set(k,{body:v,httpMetadata:m.httpMetadata});},async get(k){return photos.get(k)||null;},async delete(k){photos.delete(k);}}};
function req(id,method='GET',body,type='image/png',origin='https://test.fr'){return new Request('https://test.fr/api/photo',{method,headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@test.fr',Origin:origin,'Content-Type':type},...(body?{body}:{} )});}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
assert.equal((await worker.fetch(req('a','PUT',png),env)).status,200);
assert.equal((await worker.fetch(req('a'),env)).headers.get('Content-Type'),'image/png');
assert.equal((await worker.fetch(req('b'),env)).status,404);
assert.equal((await worker.fetch(req('c'),env)).status,403);
assert.equal((await worker.fetch(req('a','PUT',png,'image/png','https://evil.fr'),env)).status,403);
assert.equal((await worker.fetch(req('a','PUT','<svg/>','image/svg+xml'),env)).status,415);
assert.equal((await worker.fetch(req('a','PUT','garbage'),env)).status,400);
assert.equal((await worker.fetch(req('a','PUT',new Uint8Array(5*1024*1024+1)),env)).status,413);
assert.equal((await worker.fetch(req('a','DELETE'),env)).status,200);assert.equal((await worker.fetch(req('a'),env)).status,404);
console.log('Photos : ajout, confidentialité, suppression, formats et taille validés.');
