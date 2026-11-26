import { adminEmails, adminPage, catalog, partnerPage, reviewsAdminApi, sendMail, sendReviewInvitations, spaceGatePage } from './catalog.js';
import { adminPaymentsApi, adminPaymentsSection, bookingRoute, bookingsCron, partnerBookings, partnerPaymentsApi, stripeWebhook } from './payments.js';

function page(html,status=200,privatePage=false){return new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':privatePage?'private, no-store':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Robots-Tag':privatePage?'noindex, nofollow':'all'}});}

const regions=["Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Bretagne", "Centre-Val de Loire", "Corse", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandie", "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d’Azur", "Guadeloupe", "Martinique", "Guyane", "La Réunion", "Mayotte", "Autre territoire / hors de France"];
const fields={firstName:80,lastName:80,contactEmail:200,phone:40,city:100,travelArea:250,region:120,languages:250,experience:4,traditions:500,community:200,bio:2000,services:2000,rate:20,duration:120,conditions:1500};
function validateProfile(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Profil invalide.');
 const clean={};for(const [key,max] of Object.entries(fields)){if(data[key]!=null&&typeof data[key]!=='string')throw Error('Champ invalide : '+key);const value=(data[key]||'').trim();if(value.length>max)throw Error('Champ trop long : '+key);clean[key]=value;}
 for(const k of ['firstName','lastName','contactEmail','city','region','languages','bio','rate'])if(!clean[k])throw Error('Complétez les champs obligatoires.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.contactEmail))throw Error('Adresse email invalide.');
 if(!regions.includes(clean.region))throw Error('Choisissez une région de la liste.');
 const n=Number(clean.rate);if(!Number.isFinite(n)||n<1||n>100000||Math.abs(n*100-Math.round(n*100))>0.000001)throw Error('Rémunération invalide.');
 if(clean.experience&&(!/^\d+$/.test(clean.experience)||Number(clean.experience)>80))throw Error('Expérience invalide.');
 return clean;
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
function emailSet(value){return new Set((value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));}
function slugify(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'nzonzi';}
async function uniqueSlug(env,profile){
 const base=slugify([profile.firstName,profile.lastName].join(' '));
 for(let n=1;n<=20;n++){const slug=n===1?base:base+'-'+n;if(!await env.DB.prepare('SELECT 1 AS taken FROM nzozi_profiles WHERE slug = ?').bind(slug).first())return slug;}
 return base+'-'+crypto.randomUUID().slice(0,8);
}
// Alertes email (Brevo) : envoyées après la réponse, sans jamais bloquer l'action.
async function background(ctx,promise){const safe=Promise.resolve(promise).catch(()=>false);if(ctx?.waitUntil)ctx.waitUntil(safe);else await safe;}
function alertAdmins(env,url,profile,update){const name=[profile.firstName,profile.lastName].join(' ');return sendMail(env,{to:adminEmails(env),subject:(update?'Profil modifié à valider : ':'Nouveau profil à valider : ')+name,text:'Bonjour,\n\n'+name+' ('+profile.city+', '+profile.region+') '+(update?'a modifié son profil.':'vient de créer son profil.')+'\n\nPour le vérifier et le publier : '+url.origin+'/partenaire/admin\n\nMon Nzonzi'});}
function notifyPublished(env,url,profile,slug){return sendMail(env,{to:[profile.contactEmail],subject:'Votre profil Mon Nzonzi est en ligne',text:'Bonjour '+profile.firstName+',\n\nVotre profil a été vérifié et il est maintenant visible dans l’annuaire :\n'+url.origin+'/nzonzi/'+slug+'\n\nLes familles peuvent vous contacter depuis votre fiche. Vous recevrez leurs demandes à cette adresse email.\n\nL’équipe Mon Nzonzi'});}
// Validation des profils par l'équipe (NZOZI_ADMIN_EMAILS). Seule la version validée est publiée.
async function adminApi(request,env,url,ctx){
 if(!env.DB)return json({error:'Base de données indisponible.'},503);
 try{
  if(request.method==='GET'){
   const {results}=await env.DB.prepare("SELECT user_id, email, status, profile_json, published_json IS NOT NULL AS published, slug, updated_at, reviewed_at FROM nzozi_profiles ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, updated_at DESC LIMIT 500").bind().all();
   let requests=[];try{({results:requests}=await env.DB.prepare('SELECT profile_slug, family_name, family_email, family_phone, ceremony_city, ceremony_venue, ceremony_address, ceremony_date, message, status, created_at, read_at FROM contact_requests ORDER BY created_at DESC LIMIT 50').bind().all());}catch{requests=[];}
   return json({profiles:results.map(r=>({userId:r.user_id,email:r.email,status:r.status,profile:JSON.parse(r.profile_json),published:Boolean(r.published),slug:r.slug,updatedAt:r.updated_at,reviewedAt:r.reviewed_at})),requests:requests.map(r=>({slug:r.profile_slug,name:r.family_name,email:r.family_email,phone:r.family_phone,city:r.ceremony_city,venue:r.ceremony_venue,address:r.ceremony_address,date:r.ceremony_date,message:r.message,status:r.status,createdAt:r.created_at,readAt:r.read_at}))});
  }
  if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Origine non autorisée.'},403);
  if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return json({error:'Format non autorisé.'},415);
  const body=await request.text();if(body.length>2000)return json({error:'Requête trop volumineuse.'},413);
  let input;try{input=JSON.parse(body);}catch{return json({error:'Requête invalide.'},400);}
  const {userId,action,updatedAt}=input||{};
  if(typeof userId!=='string'||!userId||userId.length>200||!['approve','reject','unpublish'].includes(action))return json({error:'Requête invalide.'},400);
  const row=await env.DB.prepare('SELECT profile_json, slug, updated_at FROM nzozi_profiles WHERE user_id = ?').bind(userId).first();
  if(!row)return json({error:'Profil introuvable.'},404);
  if(action!=='unpublish'&&updatedAt!==row.updated_at)return json({error:'Ce profil vient d’être modifié. Rechargez la page avant de décider.'},409);
  const now=new Date().toISOString();
  if(action==='approve'){const slug=row.slug||await uniqueSlug(env,JSON.parse(row.profile_json));await env.DB.prepare("UPDATE nzozi_profiles SET status = 'approved', published_json = profile_json, slug = ?, reviewed_at = ? WHERE user_id = ? AND updated_at = ?").bind(slug,now,userId,row.updated_at).run();await background(ctx,notifyPublished(env,url,JSON.parse(row.profile_json),slug));return json({status:'approved',slug});}
  if(action==='reject'){await env.DB.prepare("UPDATE nzozi_profiles SET status = 'rejected', reviewed_at = ? WHERE user_id = ?").bind(now,userId).run();return json({status:'rejected'});}
  await env.DB.prepare("UPDATE nzozi_profiles SET status = 'rejected', published_json = NULL, reviewed_at = ? WHERE user_id = ?").bind(now,userId).run();return json({status:'rejected'});
 }catch{return json({error:'Action impossible pour le moment. Réessayez.'},503);}
}
export default {
// Tâche planifiée quotidienne (wrangler.toml, [triggers]) : invitations à donner un avis après la cérémonie.
// Réservations payantes : versements, emails de solde et de confirmation (sans effet si Stripe n'est pas configuré).
async scheduled(event,env,ctx){await background(ctx,sendReviewInvitations(env));await background(ctx,bookingsCron(env,undefined,Date.now(),ctx));},
async fetch(request,env,ctx){
 const url=new URL(request.url);const readApi=url.pathname==='/api/demandes';const photo=url.pathname==='/api/photo';const api=url.pathname==='/api/profil';const partner=url.pathname==='/partenaire'||url.pathname==='/partenaire/';
 const adminView=url.pathname==='/partenaire/admin';const reviewsApiPath=url.pathname==='/api/admin/avis';const paymentsAdminPath=url.pathname==='/api/admin/paiements';const adminApiPath=url.pathname==='/api/admin/profils'||reviewsApiPath||paymentsAdminPath;
 const paymentsApi=url.pathname==='/api/reservations'||url.pathname==='/api/paiements/stripe';
 // Pages publiques des réservations (lien personnel de la famille) et webhook Stripe (signé) : hors de Cloudflare Access.
 if(url.pathname==='/stripe/webhook')return stripeWebhook(request,env,ctx);
 if(url.pathname.startsWith('/reservation/'))return bookingRoute(request,env,url.pathname.slice(13),ctx);
 if(adminView||adminApiPath){
  const id=request.headers.get('oai-authenticated-user-id');const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
  if(!id||!email)return adminApiPath?json({error:'Connexion requise.'},401):page(spaceGatePage('login'),401,true);
  if(!emailSet(env.NZOZI_ADMIN_EMAILS).has(email))return adminApiPath?json({error:'Accès non autorisé.'},403):page(spaceGatePage('denied'),403,true);
  if(reviewsApiPath)return reviewsAdminApi(request,env,url);
  if(paymentsAdminPath)return adminPaymentsApi(request,env,url,ctx);
  if(adminApiPath)return adminApi(request,env,url,ctx);
  if(!['GET','HEAD'].includes(request.method))return new Response('Méthode non autorisée',{status:405});
  return page(request.method==='HEAD'?null:adminPage(adminPaymentsSection(env)),200,true);
 }
 if(api||partner||photo||readApi||paymentsApi){
  const id=request.headers.get('oai-authenticated-user-id');const email=(request.headers.get('oai-authenticated-user-email')||'').trim().toLowerCase();
  if(!id||!email)return (api||photo||readApi||paymentsApi)?json({error:'Connexion requise.'},401):page(spaceGatePage('login'),401,true);
  // NZOZI_OPEN_SIGNUP="true" : tout email vérifié par Cloudflare Access peut créer un profil (publié seulement après validation).
  if(env.NZOZI_OPEN_SIGNUP!=='true'&&!emailSet(env.NZOZI_ALLOWED_EMAILS).has(email))return (api||photo||readApi||paymentsApi)?json({error:'Accès non autorisé.'},403):page(spaceGatePage('denied'),403,true);
  if(paymentsApi)return partnerPaymentsApi(request,env,url,ctx,id,email);

  if(photo){
   if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Méthode non autorisée.'},405);
   if(!env.BUCKET)return json({error:'Photos temporairement indisponibles.'},503);
   const key='profile-photos/'+encodeURIComponent(id);
   try{
    if(request.method==='GET'){const object=await env.BUCKET.get(key);if(!object)return json({error:'Aucune photo.'},404);return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
    if(request.headers.get('Origin')!==url.origin)return json({error:'Origine non autorisée.'},403);
    if(request.method==='DELETE'){await env.BUCKET.delete(key);return json({saved:true});}
    const type=request.headers.get('Content-Type');if(!['image/jpeg','image/png','image/webp'].includes(type))return json({error:'Format de photo non autorisé.'},415);
    if(Number(request.headers.get('Content-Length')||0)>5*1024*1024)return json({error:'Photo trop volumineuse.'},413);
    const bytes=new Uint8Array(await request.arrayBuffer());if(!bytes.length||bytes.length>5*1024*1024)return json({error:'Photo invalide ou trop volumineuse.'},413);
    const str=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
    const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes[0]===137&&str(1,4)==='PNG'&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10:str(0,4)==='RIFF'&&str(8,12)==='WEBP';
    if(!valid)return json({error:'Le fichier ne correspond pas à une image autorisée.'},400);
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});return json({saved:true});
   }catch{return json({error:'Impossible de sauvegarder la photo.'},503);}
  }
  // Le nzonzi confirme avoir reçu une demande : la famille est prévenue par email (une seule fois).
  if(readApi){
   if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405);
   if(!env.DB)return json({error:'Service indisponible.'},503);
   if(request.headers.get('Origin')!==url.origin)return json({error:'Origine non autorisée.'},403);
   if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return json({error:'Format non autorisé.'},415);
   const body=await request.text();if(body.length>500)return json({error:'Requête trop volumineuse.'},413);
   let reference;try{({reference}=JSON.parse(body));}catch{return json({error:'Requête invalide.'},400);}
   if(typeof reference!=='string'||!reference||reference.length>100)return json({error:'Requête invalide.'},400);
   try{
    const row=await env.DB.prepare("SELECT c.family_name, c.family_email, c.read_at, p.published_json, p.profile_json, p.slug FROM contact_requests c JOIN nzozi_profiles p ON p.slug = c.profile_slug WHERE c.reference = ? AND p.user_id = ? AND c.status != 'pending'").bind(reference,id).first();
    if(!row)return json({error:'Demande introuvable.'},404);
    if(row.read_at)return json({readAt:row.read_at});
    const readAt=new Date().toISOString();
    await env.DB.prepare('UPDATE contact_requests SET read_at = ? WHERE reference = ? AND read_at IS NULL').bind(readAt,reference).run();
    const nz=JSON.parse(row.published_json||row.profile_json);
    await background(ctx,sendMail(env,{to:[row.family_email],subject:nz.firstName+' a bien reçu votre demande',text:'Bonjour '+row.family_name+',\n\n'+nz.firstName+' '+nz.lastName+' a bien reçu votre demande envoyée via Mon Nzonzi et va vous répondre.\n\nSa fiche : '+url.origin+'/nzonzi/'+row.slug+'\n\nL’équipe Mon Nzonzi'}));
    return json({readAt});
   }catch{return json({error:'Action impossible pour le moment. Réessayez.'},503);}
  }
  if(api){
   if(!['GET','PUT'].includes(request.method))return json({error:'Méthode non autorisée.'},405);
   if(!env.DB)return json({error:'Enregistrement temporairement indisponible.'},503);
   try{
    if(request.method==='GET'){const row=await env.DB.prepare('SELECT profile_json, updated_at, status, published_json IS NOT NULL AS published, slug FROM nzozi_profiles WHERE user_id = ?').bind(id).first();return json({profile:row?JSON.parse(row.profile_json):null,updatedAt:row?.updated_at||null,status:row?.status||null,published:Boolean(row?.published),slug:row?.published?row.slug:null});}
    if(request.headers.get('Origin')!==url.origin)return json({error:'Origine non autorisée.'},403);
    if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return json({error:'Format non autorisé.'},415);
    const body=await request.text();if(body.length>16000)return json({error:'Profil trop volumineux.'},413);
    let profile;try{profile=validateProfile(JSON.parse(body));}catch(e){return json({error:e.message},400);}
    const before=await env.DB.prepare('SELECT status, published_json IS NOT NULL AS published FROM nzozi_profiles WHERE user_id = ?').bind(id).first();
    const updatedAt=new Date().toISOString();await env.DB.prepare("INSERT INTO nzozi_profiles (user_id, profile_json, updated_at, email, status) VALUES (?, ?, ?, ?, 'pending') ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at, email = excluded.email, status = 'pending'").bind(id,JSON.stringify(profile),updatedAt,email).run();
    // Une seule alerte tant que le profil attend la validation (pas à chaque enregistrement).
    if(before?.status!=='pending')await background(ctx,alertAdmins(env,url,profile,Boolean(before?.published)));
    return json({updatedAt,status:'pending'});
   }catch{return json({error:'Impossible d’accéder au profil. Réessayez.'},503);}
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Méthode non autorisée',{status:405});
  if(request.method==='HEAD')return page(null,200,true);
  // Sans stockage R2 (binding BUCKET), le champ photo est masqué.
  // Demandes des familles reçues par ce nzonzi (via le slug de sa fiche), 12 derniers mois.
  let requests=null;
  if(env.DB){try{const mine=await env.DB.prepare('SELECT slug FROM nzozi_profiles WHERE user_id = ?').bind(id).first();if(mine?.slug){({results:requests}=await env.DB.prepare("SELECT reference, family_name, family_email, family_phone, ceremony_city, ceremony_venue, ceremony_address, ceremony_date, message, created_at, read_at FROM contact_requests WHERE profile_slug = ? AND status != 'pending' ORDER BY created_at DESC LIMIT 50").bind(mine.slug).all());}}catch{requests=null;}}
  // Réservations payantes (si activées pour ce nzonzi) : bouton Accepter/Refuser sous chaque demande.
  const bookings=await partnerBookings(env,url,id,email,requests);
  // Coordonnées de la famille masquées jusqu'au paiement de l'acompte.
  if(requests)requests=requests.map(r=>({...r,extra:bookings.extras.get(r.reference)||'',masked:bookings.masked(r.reference)}));
  return page(partnerPage({regions,photo:Boolean(env.BUCKET),requests,payments:bookings.section}),200,true);
 }
 const catalogPage=await catalog(request,env,regions);
 if(catalogPage)return catalogPage;
 if(!['GET','HEAD'].includes(request.method))return new Response('Méthode non autorisée',{status:405});
 return page('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Page introuvable</title><p>Page introuvable. <a href="/">Retour à Mon Nzonzi</a></p></html>',404,true);
}};
