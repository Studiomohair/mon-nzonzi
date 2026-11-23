import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { createTestDb } from './d1-test-db.mjs';
const { db, DB } = createTestDb();
const origin='https://test.example';
const env={DB,NZOZI_OPEN_SIGNUP:'true',NZOZI_ADMIN_EMAILS:'admin@example.test'};
const who=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'});
const call=(path,id,method='GET',data,from=origin)=>worker.fetch(new Request(origin+path,{method,headers:{...(id?who(id):{}),Origin:from,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
const profile={firstName:'Élodie',lastName:'Nsimba',contactEmail:'contact@example.test',phone:'0600000000',city:'Créteil',region:'Île-de-France',languages:'français, lingala',bio:'Je prépare les échanges entre les familles avec patience.',rate:'255',services:'Préparation\nPrise de parole',community:'Kongo'};
const home=async()=> (await (await worker.fetch(new Request(origin+'/'),env)).text());

// Accès admin réservé.
assert.equal((await call('/partenaire/admin')).status,401);
assert.equal((await call('/partenaire/admin','nzonzi')).status,403);
assert.equal((await call('/api/admin/profils','nzonzi')).status,403);
assert.equal((await call('/partenaire/admin','admin')).status,200);
assert.match(await (await call('/partenaire/admin','admin')).text(),/Validation des profils nzonzi/);

// Un nzonzi s'inscrit : rien n'est publié.
assert.equal((await call('/api/profil','nzonzi','PUT',profile)).status,200);
assert.doesNotMatch(await home(),/Nsimba/);
assert.match(await home(),/Les premiers nzonzi arrivent bientôt/);
let list=(await (await call('/api/admin/profils','admin')).json()).profiles;
assert.equal(list.length,1);assert.equal(list[0].status,'pending');assert.equal(list[0].email,'nzonzi@example.test');
const first=list[0];

// Contrôles de la requête admin.
assert.equal((await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'approve',updatedAt:first.updatedAt},'https://evil.test')).status,403);
assert.equal((await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'supprimer'})).status,400);
assert.equal((await call('/api/admin/profils','admin','POST',{userId:'inconnu',action:'approve'})).status,404);
assert.equal((await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'approve',updatedAt:'ancienne'})).status,409);

// Validation : le profil apparaît, sans email ni téléphone.
const approved=await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'approve',updatedAt:first.updatedAt});
assert.equal(approved.status,200);
const {slug}=await approved.json();
assert.equal(slug,'elodie-nsimba');
let page=await home();
assert.match(page,/Élodie Nsimba/);assert.match(page,/1 profil trouvé/);assert.doesNotMatch(page,/Profil de démo/);
assert.doesNotMatch(page,/Prototype privé/);
assert.match(await (await worker.fetch(new Request(origin+'/?communaute=Kongo'),env)).text(),/Élodie Nsimba/);
const fiche=await (await worker.fetch(new Request(origin+'/nzonzi/'+slug),env)).text();
assert.match(fiche,/Prise de parole/);assert.match(fiche,/300\s*€/);assert.match(fiche,/Lingala/);
assert.doesNotMatch(fiche,/contact@example\.test|0600000000|nzonzi@example\.test/);
assert.doesNotMatch(fiche,/name="reference"/);
assert.equal((await worker.fetch(new Request(origin+'/nzonzi/'+slug,{method:'POST',headers:{Origin:origin}}),env)).status,405);
const mine=await (await call('/api/profil','nzonzi')).json();
assert.equal(mine.status,'approved');assert.equal(mine.published,true);assert.equal(mine.slug,slug);

// Modification : l'ancienne version reste en ligne jusqu'à la nouvelle validation.
assert.equal((await call('/api/profil','nzonzi','PUT',{...profile,city:'Vitry-sur-Seine'})).status,200);
page=await home();assert.match(page,/Créteil/);assert.doesNotMatch(page,/Vitry-sur-Seine/);
list=(await (await call('/api/admin/profils','admin')).json()).profiles;
assert.equal(list[0].status,'pending');assert.equal(list[0].published,true);
assert.equal((await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'reject',updatedAt:list[0].updatedAt})).status,200);
assert.match(await home(),/Créteil/);
assert.equal((await call('/api/profil','nzonzi','PUT',{...profile,city:'Vitry-sur-Seine'})).status,200);
list=(await (await call('/api/admin/profils','admin')).json()).profiles;
assert.equal((await call('/api/admin/profils','admin','POST',{userId:first.userId,action:'approve',updatedAt:list[0].updatedAt})).status,200);
page=await home();assert.match(page,/Vitry-sur-Seine/);assert.doesNotMatch(page,/Créteil/);

// Homonyme : adresse unique.
assert.equal((await call('/api/profil','autre','PUT',profile)).status,200);
list=(await (await call('/api/admin/profils','admin')).json()).profiles;
const other=list.find(p=>p.userId==='autre');
assert.equal((await (await call('/api/admin/profils','admin','POST',{userId:'autre',action:'approve',updatedAt:other.updatedAt})).json()).slug,'elodie-nsimba-2');
assert.match(await home(),/2 profils trouvés/);

// Retrait de l'annuaire.
assert.equal((await call('/api/admin/profils','admin','POST',{userId:'autre',action:'unpublish'})).status,200);
assert.match(await home(),/1 profil trouvé/);
assert.equal((await worker.fetch(new Request(origin+'/nzonzi/elodie-nsimba-2'),env)).status,404);
assert.equal(db.prepare("SELECT status FROM nzozi_profiles WHERE user_id='autre'").get().status,'rejected');

// Contenu hostile échappé.
assert.equal((await call('/api/profil','pirate','PUT',{...profile,firstName:'<script>alert(1)</script>',lastName:'X'})).status,200);
list=(await (await call('/api/admin/profils','admin')).json()).profiles;
const pirate=list.find(p=>p.userId==='pirate');
await call('/api/admin/profils','admin','POST',{userId:'pirate',action:'approve',updatedAt:pirate.updatedAt});
page=await home();assert.doesNotMatch(page,/<script>alert/);assert.match(page,/&lt;script&gt;/);
console.log('Validation admin : accès réservé, publication, masquage des coordonnées, modifications, refus, retrait et échappement : OK.');
