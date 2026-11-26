import { blogArticles } from './blog.js';

// Adresse publique (liens canoniques, sitemap, données structurées).
const SITE_ORIGIN = 'https://mon-nzonzi.fr';
// Le site reste caché des moteurs de recherche jusqu'au lancement.
// Passer à true UNIQUEMENT avec l'accord de la propriétaire : cela retire le noindex
// des pages publiques et ouvre robots.txt (l'espace nzonzi reste toujours exclu).
const SEARCH_INDEXING = false;

// Seuls les profils validés par l'équipe (colonne published_json) sont publiés.
async function listedProfiles(env) {
  return publishedProfiles(env);
}
async function publishedProfiles(env) {
  if (!env?.DB) return [];
  try {
    const { results } = await env.DB.prepare('SELECT slug, published_json FROM nzozi_profiles WHERE published_json IS NOT NULL AND slug IS NOT NULL ORDER BY reviewed_at DESC LIMIT 500').bind().all();
    const ratings = await reviewStats(env);
    return results.map(row => ({ ...publicProfile(row.slug, JSON.parse(row.published_json)), rating: ratings.get(row.slug) || null }));
  } catch {
    return [];
  }
}
// Note moyenne et nombre d'avis publiés, par fiche.
async function reviewStats(env) {
  try {
    const { results } = await env.DB.prepare("SELECT profile_slug, AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE status = 'approved' GROUP BY profile_slug").bind().all();
    return new Map(results.map(row => [row.profile_slug, { average: Number(row.average), count: Number(row.count) }]));
  } catch {
    return new Map();
  }
}
const splitList = (value, pattern) => String(value || '').split(pattern).map(item => item.trim()).filter(Boolean);
const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
// Seules ces informations sont publiques : jamais l'email ni le téléphone.
function publicProfile(slug, data) {
  const bio = String(data.bio || '').trim();
  return {
    slug,
    name: [data.firstName, data.lastName].filter(Boolean).join(' '),
    city: data.city || '', region: data.region || '',
    community: String(data.community || '').trim(),
    languages: splitList(data.languages, /[,;/]+/).map(capitalize),
    net: Number(data.rate),
    summary: bio.length > 180 ? bio.slice(0, 180).replace(/\s+\S*$/, '') + '…' : bio,
    bio,
    services: splitList(data.services, /\n+|;/),
    travel: data.travelArea || 'Déplacements à convenir',
    experience: data.experience || '', traditions: data.traditions || '',
    duration: data.duration || '', conditions: data.conditions || '',
  };
}

const siteAssets = /* SITE_ASSETS */ {};
const siteAssetRoutes = new Map([
  ['/assets/mon-nzonzi.webp', ['mon-nzonzi.webp', 'image/webp']],
  ['/assets/playfair-display.woff2', ['playfair-display.woff2', 'font/woff2']],
  ['/assets/playfair-license.txt', ['playfair-license.txt', 'text/plain; charset=utf-8']],
  ['/assets/mon-nzonzi-clair.webp', ['mon-nzonzi-clair.webp', 'image/webp']],
  ['/assets/favicon.png', ['favicon.png', 'image/png']],
  ['/assets/partage.png', ['partage.png', 'image/png']],
  ['/assets/outfit.woff2', ['outfit.woff2', 'font/woff2']],
  ['/assets/outfit-license.txt', ['outfit-license.txt', 'text/plain; charset=utf-8']],
]);
const commissionShare = 0.85;
const formatEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });
const safeId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const glyphs = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  pin: '<path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
  chat: '<path d="M21 11.5a8 8 0 0 1-8.5 7.5H5l1.6-3A7.1 7.1 0 0 1 4 11.5a8 8 0 0 1 8.5-7.5 8 8 0 0 1 8.5 7.5Z"/><path d="M9 11.5h7"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.8"/><path d="m15 15 4.3 4.3"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + glyphs[name] + '</svg>';
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’'-]/g, ' ').toLowerCase();
}
function profilePrice(profile) {
  return formatEuro.format(Math.round(profile.net * 100 / commissionShare) / 100);
}
function filterState(params, regions, profiles) {
  const region = params.get('region') || '';
  const community = params.get('communaute') || '';
  return {
    q: (params.get('q') || '').trim().slice(0, 100),
    region: regions.includes(region) ? region : '',
    communaute: community && profiles.some(profile => profile.community === community) ? community : '',
  };
}
function filterQuery(filters) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return query.size ? '?' + escapeHtml(query.toString()) : '';
}
function options(values, selected) {
  return values.map(value => `<option${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
}
const motionScene = `<svg class="motion-scene" viewBox="0 0 620 500" fill="none" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="voice-left" x1="120" y1="195" x2="272" y2="423" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--cream)"/><stop offset="1" stop-color="var(--ochre)"/>
    </linearGradient>
    <linearGradient id="voice-right" x1="406" y1="212" x2="516" y2="423" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--ochre)"/><stop offset="1" stop-color="var(--terracotta)"/>
    </linearGradient>
  </defs>
  <g stroke="var(--cream)" opacity=".16">
    <path d="M69 461V254a241 241 0 0 1 482 0v207"/>
    <path d="M93 461V254a217 217 0 0 1 434 0v207"/>
    <path d="M117 461V254a193 193 0 0 1 386 0v207"/>
    <path d="M22 395h576M22 430h576M45 463h530"/>
    <circle cx="310" cy="250" r="159" stroke-dasharray="1 8" stroke-linecap="round"/>
  </g>
  <g class="motion-rays" stroke="var(--ochre)" stroke-width="1.5" stroke-linecap="round">
    <path d="M105 111v24m-12-12h24m395-9v24m-12-12h24M80 295v16m-8-8h16m452-9v16m-8-8h16M309 62v23m-12-11h24"/>
    <path d="M141 165l6-7 6 7-6 7zm329 3 6-7 6 7-6 7zm-166 62 6-7 6 7-6 7z" fill="var(--ochre)" stroke="none"/>
  </g>
  <g class="motion-person motion-person-left">
    <circle cx="171" cy="242" r="42" fill="url(#voice-left)"/>
    <path d="M87 397v-20c0-47 37-84 83-84h17c46 0 83 37 83 84v20Z" fill="url(#voice-left)"/>
    <path d="M109 396v-21c0-33 27-59 60-59h16c33 0 60 26 60 59v21" stroke="var(--forest)" stroke-opacity=".26" stroke-width="1.5"/>
    <path d="M138 238a34 34 0 0 1 31-32" stroke="var(--cream)" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  </g>
  <g class="motion-person motion-person-right">
    <circle cx="449" cy="242" r="42" fill="url(#voice-right)"/>
    <path d="M350 397v-20c0-47 37-84 83-84h17c46 0 83 37 83 84v20Z" fill="url(#voice-right)"/>
    <path d="M375 396v-21c0-33 27-59 60-59h16c33 0 60 26 60 59v21" stroke="var(--forest)" stroke-opacity=".34" stroke-width="1.5"/>
    <path d="M416 238a34 34 0 0 1 31-32" stroke="var(--cream)" stroke-width="2" stroke-linecap="round" opacity=".65"/>
  </g>
  <path class="motion-link" d="M178 279c61 57 203 57 264 0M191 318c57 53 181 53 238 0M214 355c43 37 149 37 192 0" pathLength="1" stroke="var(--cream)" stroke-width="2" stroke-linecap="round"/>
  <g class="motion-bubble">
    <path d="M259 116h102a30 30 0 0 1 30 30v27a30 30 0 0 1-30 30h-33l-18 19-18-19h-33a30 30 0 0 1-30-30v-27a30 30 0 0 1 30-30Z" fill="var(--cream)"/>
    <path d="M273 160h16m12 0h17m12 0h17" stroke="var(--forest)" stroke-width="5" stroke-linecap="round"/>
  </g>
</svg>`;

function profileMotion(profile) {
  const initials = profile.name.split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 3);
  const tone = [...profile.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3;
  return `<div class="profile-motion" data-motion-profile="${profile.slug}" data-tone="${tone}" aria-hidden="true">
    <svg viewBox="0 0 340 210" fill="none" focusable="false" preserveAspectRatio="xMidYMid slice">
      <g class="motion-orbits" stroke="currentColor" stroke-width="1.2">
        <ellipse cx="170" cy="105" rx="114" ry="59" transform="rotate(-20 170 105)"/>
        <ellipse cx="170" cy="105" rx="113" ry="62" transform="rotate(20 170 105)"/>
        <circle cx="170" cy="105" r="66" stroke-dasharray="1 5" stroke-linecap="round"/>
        <circle cx="64" cy="137" r="4" fill="currentColor" stroke="none"/>
        <circle cx="273" cy="70" r="4" fill="currentColor" stroke="none"/>
        <path d="M56 47v18m-9-9h18m219 89v18m-9-9h18"/>
      </g>
      <circle cx="170" cy="105" r="50" fill="var(--cream)"/>
      <circle cx="170" cy="105" r="43" stroke="var(--forest)" stroke-opacity=".28"/>
      <text class="motion-monogram" x="170" y="106" dominant-baseline="central" text-anchor="middle">${escapeHtml(initials)}</text>
    </svg>
  </div>`;
}

const motionCss = `
.motion-scene{display:block;width:100%;height:100%}
.motion-person,.motion-bubble,.motion-rays,.motion-orbits{transform-box:fill-box;transform-origin:center}
.motion-person-left{animation:voice-left 1.2s .12s both cubic-bezier(.18,.75,.23,1)}
.motion-person-right{animation:voice-right 1.2s .12s both cubic-bezier(.18,.75,.23,1)}
.motion-bubble{animation:bubble-arrival 1.05s .85s both cubic-bezier(.2,.75,.28,1.25)}
.motion-link{animation:link-draw 1.55s .55s both ease-out}
.motion-rays{animation:light-in 1.3s 1.35s both ease-out}
.profile-motion{position:absolute;inset:0;background:var(--olive);color:var(--cream)}
.profile-motion[data-tone="1"]{background:var(--bordeaux)}
.profile-motion[data-tone="2"]{background:var(--sage);color:var(--brun)}
.profile-motion svg{width:100%;height:100%;display:block}
.card .profile-motion svg{animation:monogram-in .95s ease-out both}
@supports(animation-timeline:view()){
  .card .profile-motion svg{animation-timeline:view();animation-range:entry 0% cover 26%}
}
.motion-orbits{opacity:.55;transition:transform .55s ease}
.card:hover .motion-orbits,.card:focus-within .motion-orbits{transform:rotate(8deg)}
.motion-monogram{font:500 30px var(--display);letter-spacing:.04em;fill:var(--ink)}
.profile-head .motion-orbits{animation:orbit-arrival .95s ease-out both}
@keyframes voice-left{from{transform:translateX(-24px);opacity:.15}}
@keyframes voice-right{from{transform:translateX(24px);opacity:.15}}
@keyframes bubble-arrival{from{transform:translateY(13px) scale(.82);opacity:0}}
@keyframes link-draw{from{stroke-dasharray:1;stroke-dashoffset:1;opacity:.18}to{stroke-dasharray:1;stroke-dashoffset:0;opacity:.77}}
@keyframes light-in{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:.88}}
@keyframes orbit-arrival{from{transform:rotate(-12deg);opacity:.2}}
@keyframes monogram-in{from{transform:scale(.93);opacity:.32}}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .motion-person,.motion-bubble,.motion-link,.motion-rays,.profile-head .motion-orbits,.card .profile-motion svg{animation:none}
  .motion-orbits{transition:none}
  .card:hover .motion-orbits,.card:focus-within .motion-orbits{transform:none}
}
`;

const catalogHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': SEARCH_INDEXING ? 'all' : 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};
function catalogResponse(html, status = 200) {
  return new Response(html, { status, headers: { ...catalogHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

// Logo « MonNzonzi » (25/11/2026) : bordeaux sur fond clair, version blanche pour les fonds foncés.
function brandLogo(light = false) {
  const file = light ? 'mon-nzonzi-clair.webp' : 'mon-nzonzi.webp';
  return siteAssets[file]
    ? `<img class="brand-logo" src="/assets/${file}" alt="Mon Nzonzi" width="447" height="67">`
    : 'Mon Nzonzi';
}

// Charte « Brun, bordeaux et olive » choisie par la propriétaire (24/11/2026).
// Police : Outfit (SIL OFL), proche de la typographie Now de la planche de référence.
const siteTheme = `
@font-face{font-family:"Outfit";src:url("/assets/outfit.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap}
:root{
  color-scheme:light;
  --brun:#382D20;--bordeaux:#8C3D20;--bordeaux-dark:#6F2F17;--sage:#A6A18A;--olive:#726B4F;--blanc:#E7E5DD;
  --paper:#F6F4EF;--card:#FFFDF8;--ink:var(--brun);--muted:#5E574A;--line:#DAD6CA;--field-border:#B5B09E;
  --soft:var(--blanc);--bg:var(--blanc);--success:#E3E6D5;
  /* Alias utilisés par les animations et les anciennes pages. */
  --cream:var(--blanc);--ochre:var(--sage);--terracotta:var(--bordeaux);--forest:var(--brun);--brown:var(--bordeaux);
  --stage:radial-gradient(ellipse at 50% 42%, #847C5E 0%, var(--olive) 70%);
  --display:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif;
  --font:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif;
}
.brand-logo{display:block;width:220px;max-width:100%;height:auto}
footer .brand-logo{width:180px}
@media(max-width:720px){.brand-logo{width:168px}footer .brand-logo{width:160px}}
`;

const catalogCss = siteTheme + motionCss + `
*{box-sizing:border-box}
html{scroll-padding-top:24px;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--font)}
img{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3,.brand,.price{font-family:var(--display);line-height:1.08;margin:0;letter-spacing:-.02em}
h1,h2{font-weight:250}
h1 strong,h2 strong{font-weight:600}
h1{font-size:clamp(44px,5.6vw,76px)}
h2{font-size:clamp(32px,3.8vw,50px)}
h3{font-size:22px;font-weight:600}
p{margin:0}
svg{width:20px;height:20px;flex:none}
:focus-visible{outline:3px solid var(--bordeaux);outline-offset:3px}
.skip{position:absolute;top:8px;left:8px;transform:translateY(-200%);z-index:3}
.skip:focus{transform:none}
.shell{width:min(1180px,calc(100% - 80px));margin-inline:auto}
.site-header nav{min-height:80px;display:flex;align-items:center;gap:28px}
.brand{display:inline-flex;align-items:center;text-decoration:none;color:var(--ink)}
.nav-links{display:flex;gap:28px;align-items:center;margin-left:auto;font-size:15px}
.nav-links>a{text-decoration:none;color:var(--muted)}
.nav-links>a:hover{color:var(--ink)}
.link:hover{text-decoration:underline}
.btn{display:inline-flex;justify-content:center;align-items:center;gap:10px;min-height:50px;padding:10px 24px;background:var(--bordeaux);border:1px solid var(--bordeaux);border-radius:999px;color:#fff;font:600 16px/1.2 var(--font);text-decoration:none;cursor:pointer}
.btn:hover{background:var(--bordeaux-dark);border-color:var(--bordeaux-dark)}
.btn.secondary{background:transparent;color:var(--ink);border-color:var(--ink)}
.btn.secondary:hover{background:var(--ink);color:var(--paper)}
.btn.light{background:var(--blanc);border-color:var(--blanc);color:var(--brun)}
.btn.light:hover{background:#fff;border-color:#fff}
.btn svg{width:18px;height:18px}
.kicker{display:block;color:var(--olive);font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.lead{margin:18px 0 28px;color:var(--muted);font-size:clamp(17px,1.4vw,20px);font-weight:300;max-width:46ch}

.hero{width:min(1400px,calc(100% - 32px));margin-inline:auto;background:var(--brun);color:var(--blanc);border-radius:36px;padding:clamp(28px,5vw,64px) 0}
.hero .shell{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,72px);align-items:center}
.hero .kicker{color:var(--sage)}
.hero h1{margin-top:14px;max-width:12ch;text-wrap:balance}
.hero .lead{color:#D9D5C8}
.hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px}
.hero-actions .link{color:var(--blanc)}
.hero-art{min-width:0;margin:0;position:relative;border-radius:26px;background:var(--stage);overflow:hidden;aspect-ratio:1.2}
.hero-art figcaption{position:absolute;bottom:14px;left:14px;border-radius:999px;background:var(--blanc);padding:8px 14px;font-size:13px;color:var(--brun);font-weight:500}
.motion-replay{position:absolute;right:14px;bottom:14px;display:grid;place-items:center;width:44px;height:44px;border:1px solid #E7E5DD66;border-radius:50%;background:var(--brun);color:var(--blanc);cursor:pointer;padding:0}
.motion-replay:hover{background:var(--bordeaux)}
.motion-replay:focus-visible{outline-color:var(--blanc)}
@media(prefers-reduced-motion:reduce){.motion-replay{display:none}}

section{scroll-margin-top:16px}
.directory{padding:80px 0 72px}
.section-heading{display:grid;gap:10px;margin-bottom:28px}
.section-heading h2{margin-top:4px}
.section-heading>p{color:var(--muted);font-weight:300;max-width:52ch}
.filters{display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:12px;padding:16px;background:var(--blanc);border-radius:22px;align-items:end}
.field{display:grid;gap:6px;font-size:14px;font-weight:500;min-width:0}
.optional{color:var(--muted);font-weight:300}
input,select,textarea{width:100%;min-width:0;min-height:50px;border-radius:12px;border:1px solid var(--field-border);background:var(--card);color:var(--ink);font:400 16px/1.4 var(--font);padding:11px 13px}
textarea{min-height:110px;resize:vertical}
input::placeholder,textarea::placeholder{color:#8A8472}
.searchbox{position:relative;display:block}
.searchbox svg{position:absolute;top:15px;left:12px;color:var(--muted);pointer-events:none}
.searchbox input{padding-left:40px}
.result-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;color:var(--muted);font-size:15px}
.link{color:var(--bordeaux);font-weight:600;text-underline-offset:3px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.card,.panel{border-radius:24px;background:var(--card)}
.card{overflow:clip;display:flex;flex-direction:column;border:1px solid var(--line);transition:transform .25s ease,box-shadow .25s ease}
.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px #382D201a}
.card-image{position:relative;background:var(--olive);aspect-ratio:1.7;overflow:clip}
.badge{display:inline-flex;align-items:center;font-size:12px;font-weight:500;color:var(--brun);background:var(--blanc);padding:5px 10px;border-radius:999px}
.card-image .badge{position:absolute;top:12px;left:12px}
.card-content{padding:20px 20px 18px;display:flex;flex-direction:column;flex:1}
.card-content h3 a{text-decoration:none}
.card-content h3 a:after{content:'';position:absolute;inset:0}
.card{position:relative}
.location{display:flex;align-items:flex-start;gap:6px;margin:6px 0 12px;font-size:14px;color:var(--muted)}
.location svg{width:17px;height:17px;margin-top:2px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.pills li{border-radius:999px;padding:3px 10px;font-size:13px;background:var(--blanc)}
.card-content>p:not(.location){color:var(--muted);font-size:15px;font-weight:300;margin:14px 0 18px}
.card-bottom{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:auto;border-top:1px solid var(--line);padding-top:14px}
.price{display:block;font-size:26px;font-weight:600}
.card-bottom small,.muted{color:var(--muted);font-size:13px}
.card-bottom .more{color:var(--bordeaux);font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:6px}
.panel{border:1px solid var(--line)}
.empty{padding:40px 24px;text-align:center;background:var(--blanc);border:0}
.empty p{margin:10px auto 20px;color:var(--muted);max-width:46ch}

.method{padding:0 0 80px}
.method .section-heading{text-align:left}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:0;padding:0;list-style:none;counter-reset:step}
.steps li{border-top:2px solid var(--brun);padding-top:20px;counter-increment:step}
.steps li:before{content:counter(step);display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--bordeaux);color:#fff;font-weight:600;margin-bottom:16px}
.steps h3{margin-bottom:6px}
.steps p{color:var(--muted);font-weight:300}
.join{padding:0 0 80px}
.join .shell{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:24px;background:var(--olive);color:var(--blanc);border-radius:28px;padding:clamp(28px,4vw,48px)}
.join h2{font-size:clamp(28px,3vw,40px)}
.join p{margin-top:8px;color:#ECEADF;font-weight:300;max-width:48ch}
footer{background:var(--brun);color:var(--blanc);padding:28px 0}
footer .shell{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;font-size:14px;font-weight:300}
footer a{text-underline-offset:3px}
.footer-links{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}
.social{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.social:hover span{text-decoration:underline}
.social svg{width:22px;height:22px}
.legal-links{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px 22px;padding-top:14px;border-top:1px solid #E7E5DD33;font-size:13px}
.legal-links a{color:#D9D5C8}
.legal-links a:hover{color:var(--blanc)}
.legal{padding:32px 0 80px}
.legal .shell{max-width:780px}
.legal h1{font-size:clamp(36px,4.4vw,54px);margin:10px 0 8px}
.legal .updated{color:var(--muted);font-size:14px;margin-bottom:28px}
.legal h2{font-size:clamp(24px,2.6vw,30px);font-weight:500;margin:36px 0 12px}
.legal p,.legal li{color:var(--ink);font-weight:300}
.legal p+p{margin-top:10px}
.legal ul{padding-left:22px;margin:10px 0}
.legal li+li{margin-top:6px}
.legal a{color:var(--bordeaux);font-weight:500}
.legal dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:0}
.legal dt{color:var(--muted)}
.legal dd{margin:0}
.todo{background:#F3E1D9;color:var(--bordeaux);border-radius:6px;padding:1px 6px;font-weight:500}
.check{display:flex;gap:10px;align-items:flex-start;font-size:14px;font-weight:300}
.check input{width:20px;min-width:20px;min-height:20px;height:20px;margin:3px 0 0;accent-color:var(--bordeaux)}
.check a{color:var(--blanc);font-weight:500}
.hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
@media(max-width:640px){.legal dl{grid-template-columns:1fr}.legal dt{margin-top:8px}}

.blog-teaser{padding:0 0 80px}
.blog-more{margin-top:18px}
.blog,.article{padding:32px 0 80px}
.blog-head h1{font-size:clamp(38px,4.6vw,60px)}
.blog-head .lead{margin-bottom:8px}
.article-card .card-content>.kicker{margin-bottom:6px}
.article-card h2{font-size:22px;font-weight:600;letter-spacing:-.02em}
.article-card h2 a,.article-card h3 a{text-decoration:none}
.article-card h2 a:after,.article-card h3 a:after{content:'';position:absolute;inset:0}
.article-card .card-content>p{margin:10px 0 18px}
.article-art{aspect-ratio:1.9;display:grid;place-items:center;overflow:clip}
.article-art svg{width:72%;height:auto;max-height:86%}
.article>.shell>article,.article-head{max-width:760px}
.article-head h1{font-size:clamp(38px,5vw,62px);margin-top:10px;text-wrap:balance}
.article-head .lead{max-width:none;margin:18px 0 12px}
.article-meta{color:var(--muted);font-size:14px}
.takeaways{margin:28px 0 8px;padding:20px 24px;border-radius:20px;background:var(--blanc);border-left:5px solid var(--olive)}
.takeaways h2{font-size:15px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--olive)}
.takeaways ul{margin:10px 0 0;padding-left:20px}
.takeaways li+li{margin-top:6px}
.article-body h2,.faq>h2{font-size:clamp(26px,3vw,34px);font-weight:500;margin:40px 0 12px}
.article-body p,.article-body li,.faq p{font-weight:300}
.article-body p+p{margin-top:12px}
.article-body ul,.article-body ol{padding-left:22px;margin:12px 0}
.article-body li+li{margin-top:8px}
.article-body a,.article-note a{color:var(--bordeaux);font-weight:500;text-underline-offset:3px}
.article-body>p:first-child{margin-top:28px}
.faq h3{font-size:19px;margin:24px 0 6px}
.faq p{color:var(--muted)}
.article-note{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:14px;font-weight:300}
.article-cta{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:20px;margin:48px 0;background:var(--olive);color:var(--blanc);border-radius:28px;padding:clamp(24px,4vw,44px)}
.article-cta h2{font-size:clamp(28px,3vw,40px)}
.article-cta p{margin-top:8px;color:#ECEADF;font-weight:300;max-width:48ch}
.related h2{font-size:clamp(28px,3vw,38px);margin-bottom:20px}

.profile{padding:28px 0 72px}
.back{display:inline-flex;align-items:center;gap:7px;color:var(--bordeaux);font-weight:600;font-size:15px;text-decoration:none;margin-bottom:20px}
.back:hover{text-decoration:underline}
.profile-head{display:grid;grid-template-columns:1fr 1.1fr;overflow:hidden;margin-bottom:20px;background:var(--blanc);border:0;padding:12px}
.profile-head>div:first-child{background:var(--olive);min-height:280px;position:relative;overflow:hidden;border-radius:18px}
.profile-intro{padding:clamp(20px,5vw,52px);align-self:center}
.profile-intro h1{margin-top:8px;font-size:clamp(38px,5vw,64px)}
.profile-intro .lead{margin-bottom:0}
.profile-head .pills li,.profile-head .badge{background:var(--card)}
.contact .optional{color:var(--sage)}
.profile-layout{display:grid;grid-template-columns:1.15fr 1fr;gap:20px;align-items:start}
.profile-layout .panel{padding:clamp(20px,3vw,32px)}
.profile-layout h2{font-size:clamp(26px,3vw,34px)}
.details h2{margin-bottom:12px}
.details h3{margin:26px 0 8px;font-size:18px}
.details ul:not(.pills){padding-left:20px;margin:0}
.details li+li{margin-top:4px}
.details p,.contact>p{color:var(--muted)}
.contact{background:var(--brun);color:var(--blanc);border:0;position:sticky;top:20px}
.contact .kicker{color:var(--sage)}
.contact h2{margin:22px 0 8px}
.contact .price{color:#fff;font-size:44px;margin-top:6px}
.contact>p,.contact .muted{color:#D9D5C8}
.contact form{display:grid;gap:14px;border-top:1px solid #E7E5DD33;margin-top:20px;padding-top:18px}
.contact .field{color:var(--blanc)}
.contact .btn{justify-self:start}
.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.feedback{margin-top:16px;padding:12px 14px;background:var(--success);color:var(--brun);border-radius:12px}
.feedback p+p{margin-top:6px}
.feedback.error{background:#F3E1D9;border:1px solid var(--bordeaux)}

.space{padding:32px 0 72px}
.space-head{margin-bottom:24px}
.space-head h1{font-size:clamp(38px,4.6vw,60px);margin-top:10px}
.space-head .lead{margin-bottom:0}
.status{margin-top:20px;padding:14px 18px;border-radius:14px;background:var(--blanc);font-weight:500;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.status[data-state="approved"]{background:var(--success)}
.status[data-state="rejected"]{background:#F3E1D9}
.status{border-left:5px solid var(--sage)}
.status[data-state="approved"]{border-left-color:var(--olive)}
.status[data-state="rejected"]{border-left-color:var(--bordeaux)}
.space-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px;align-items:start}
.space form{padding:clamp(20px,3vw,36px);display:grid;gap:8px}
fieldset{border:0;margin:0;padding:0 0 28px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
fieldset+fieldset{border-top:1px solid var(--line);padding-top:28px}
legend{float:left;width:100%;grid-column:1/-1;display:flex;align-items:center;gap:12px;font-size:22px;font-weight:600;margin-bottom:4px}
legend span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--bordeaux);color:#fff;font-size:16px}
.full{grid-column:1/-1}
.note{color:var(--muted);font-size:14px;font-weight:300}
.price-box{grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;padding:16px 18px;border-radius:14px;background:var(--blanc)}
.price-box strong{font-size:26px;font-weight:600}
.error{color:var(--bordeaux);font-weight:500;font-size:14px}
.save-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px}
#profile-status{color:var(--muted);font-size:15px}
#profile-status button{margin-left:10px;min-height:40px}
.preview{position:sticky;top:20px}
.preview .card-image{aspect-ratio:2.2;display:grid;place-items:center}
.preview .card-image img{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--blanc)}
.preview h3{font-size:24px}
.preview .preview-label{position:absolute;top:12px;left:12px}
.result{display:block;margin-top:12px;padding:16px 18px;border-radius:14px;background:var(--blanc)}
.inbox{margin-top:48px}
.inbox h2{font-size:clamp(28px,3vw,38px);margin-bottom:8px}
.request{padding:clamp(18px,3vw,26px);margin-top:14px}
.request-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 16px}
.request .location{margin:6px 0 10px}
.request-address{margin:-4px 0 10px 23px}
.request-message{white-space:pre-wrap;overflow-wrap:anywhere}
.request.unread{border-left:5px solid var(--bordeaux)}
.request-read{margin-top:14px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;color:var(--olive);font-weight:500;font-size:15px}
.request-read .btn{min-height:42px;padding:8px 18px;font-size:15px}
.request-contact{margin-top:12px;display:flex;flex-wrap:wrap;gap:4px 8px;overflow-wrap:anywhere}
.gate{max-width:640px;padding:64px 0 96px}
.gate h1{font-size:clamp(36px,4.4vw,56px);margin-top:10px}
.gate .hero-actions .link{color:var(--bordeaux)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.stars{position:relative;display:inline-block;color:var(--line);letter-spacing:2px;line-height:1;font-size:18px}
.stars::before{content:"★★★★★";position:absolute;inset:0;width:calc(var(--rate) * 20%);overflow:hidden;color:var(--bordeaux);white-space:nowrap}
.rating{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:0 0 10px;font-size:15px;color:var(--muted)}
.rating strong{color:var(--ink);font-weight:600}
.rating a{color:var(--bordeaux);font-weight:500;text-underline-offset:3px}
.card .rating{margin:-2px 0 10px;font-size:14px}.card .stars{font-size:15px}
.profile-intro .rating{margin:4px 0 12px}
.profile-main{display:grid;gap:20px;min-width:0}
.reviews h2{margin-bottom:8px}
.reviews-summary{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:14px 18px;border-radius:14px;background:var(--blanc);margin:14px 0 6px}
.reviews-summary strong{font-family:var(--display);font-size:34px;font-weight:600;line-height:1}
.reviews-summary .stars{font-size:22px}
.review{padding:18px 0;border-top:1px solid var(--line)}
.review:first-of-type{border-top:0}
.review-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px}
.review-head strong{font-weight:600}
.review p{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink);font-weight:300}
.review small{display:block;margin-top:8px;color:var(--muted);font-size:13px}
.verified{display:inline-flex;align-items:center;gap:5px;color:var(--olive);font-size:13px;font-weight:500}
.verified svg{width:15px;height:15px}
.review-page{padding:32px 0 80px}
.review-page .shell{max-width:720px}
.review-page h1{font-size:clamp(34px,4.4vw,52px);margin:10px 0 8px}
.review-page .lead{margin:10px 0 24px;max-width:none}
.review-form{display:grid;gap:18px;padding:clamp(20px,3vw,32px)}
.star-input{display:inline-flex;flex-direction:row-reverse;justify-content:flex-end;gap:2px}
.star-input input{position:absolute;opacity:0;width:1px;height:1px}
.star-input label{font-size:44px;line-height:1;color:var(--line);cursor:pointer;padding:0 2px;border-radius:8px}
.star-input input:checked~label,.star-input label:hover,.star-input label:hover~label{color:var(--bordeaux)}
.star-input input:focus-visible+label{outline:3px solid var(--olive);outline-offset:2px}
.star-label{display:block;font-size:14px;font-weight:500;margin-bottom:4px}
.review-form .check a{color:var(--bordeaux)}
.review-form .btn{justify-self:start}
@media(max-width:960px){
  .shell{width:calc(100% - 48px)}
  .filters{grid-template-columns:1fr 1fr}
  .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  .nav-links{gap:18px}
  .space-grid{grid-template-columns:1fr}
  .preview,.contact{position:static}
}
@media(max-width:720px){
  body{font-size:16px}
  .shell{width:calc(100% - 32px)}
  .site-header nav{min-height:66px;gap:12px}
  .nav-links>a{display:none}
  .nav-links .btn{min-height:42px;padding:8px 14px;font-size:14px}
  .hero{width:calc(100% - 16px);border-radius:26px;padding:28px 0 12px}
  .hero .shell{grid-template-columns:1fr;gap:26px}
  .hero-art{aspect-ratio:1.3;border-radius:20px}
  .hero-art figcaption{font-size:11px;bottom:10px;left:10px;padding:6px 10px}.motion-replay{right:8px;bottom:8px}
  .directory{padding:48px 0}
  .method,.join{padding-bottom:48px}
  .filters,.profile-head,.profile-layout,.cards,.steps,fieldset{grid-template-columns:1fr}
  .filters{padding:12px}
  .filters .btn{width:100%}
  .profile-head>div:first-child{min-height:0;aspect-ratio:1.7}
  .profile{padding-top:16px}
  .blog-teaser{padding-bottom:48px}
  .article-cta .btn{width:100%}
  .join .btn{width:100%}
}
@media(max-width:480px){.venue-row{grid-template-columns:1fr}}
@media(max-width:375px){.two-fields{grid-template-columns:1fr}.hero h1{font-size:38px}}
`;

// options.space : navigation de l'espace nzonzi.
// options.seo : { path, description, fullTitle, type, jsonLd } pour les pages publiques.
function jsonLdScript(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
function seoTags(title, seo) {
  if (!seo) return '';
  const url = SITE_ORIGIN + seo.path;
  const description = escapeHtml(seo.description);
  return `<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="Mon Nzonzi">
<meta property="og:locale" content="fr_FR">
<meta property="og:type" content="${seo.type || 'website'}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_ORIGIN}/assets/partage.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${(seo.jsonLd || []).map(jsonLdScript).join('\n')}`;
}
function layout(title, main, options = {}) {
  const { space = false, seo = null } = options;
  const fullTitle = seo?.fullTitle || `${title} · Mon Nzonzi`;
  const links = space
    ? `<a href="/">Voir les nzonzi</a><a class="btn secondary" href="/cdn-cgi/access/logout">Se déconnecter</a>`
    : `<a href="/#nzonzi">Les nzonzi</a><a href="/#comment">Comment ça marche</a><a href="/blog">Blog</a><a class="btn secondary nav-partner" href="/partenaire">Vous êtes nzonzi ?</a>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${SEARCH_INDEXING && seo ? 'index,follow' : 'noindex,nofollow'}">
<meta name="theme-color" content="#382D20">
<title>${escapeHtml(fullTitle)}</title>
${seoTags(fullTitle, seo)}
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/favicon.png">
<link rel="preload" href="/assets/outfit.woff2" as="font" type="font/woff2" crossorigin>
<style>${catalogCss}</style>
</head>
<body>
<a href="#main" class="skip btn">Aller au contenu</a>
<header class="site-header"><nav class="shell" aria-label="Navigation principale">
  <a class="brand" href="/" aria-label="Mon Nzonzi, accueil">${brandLogo()}</a>
  <div class="nav-links">${links}</div>
</nav></header>
${main}
<footer><div class="shell"><a class="brand" href="/" aria-label="Mon Nzonzi, accueil">${brandLogo(true)}</a><span>Une parole qui rassemble.</span><span class="footer-links"><a class="social" href="https://www.instagram.com/monnzonzi/" target="_blank" rel="noopener" aria-label="Mon Nzonzi sur Instagram">${icon('instagram')}<span>@monnzonzi</span></a><a href="/blog">Blog</a><a href="/partenaire">Espace nzonzi</a></span>
<nav class="legal-links" aria-label="Informations légales"><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/cgu">Conditions d’utilisation</a></nav></div></footer>
</body></html>`;
}

function pills(values) {
  return `<ul class="pills">${values.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}
function location(profile) {
  return `<p class="location">${icon('pin')}${escapeHtml(profile.city)} · ${escapeHtml(profile.region)}</p>`;
}
function card(profile, query) {
  return `<article class="card" data-profile="${profile.slug}">
    <div class="card-image">${profileMotion(profile)}</div>
    <div class="card-content"><h3><a href="/nzonzi/${profile.slug}${query}">${escapeHtml(profile.name)}</a></h3>${location(profile)}${profile.rating ? ratingLine(profile.rating) : ''}
    ${pills([profile.community, ...profile.languages].filter(Boolean))}
    <p>${escapeHtml(profile.summary)}</p>
    <div class="card-bottom"><div><strong class="price">${profilePrice(profile)}</strong><small>Prix total</small></div>
    <span class="more" aria-hidden="true">Voir le profil ${icon('arrow')}</span></div></div>
  </article>`;
}
function directoryPage(filters, regions, profiles) {
  const { q, region, communaute } = filters;
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const filtered = profiles.filter(profile => {
    const searchable = normalize([profile.name, profile.city, profile.region, profile.community, ...profile.languages].join(' '));
    return (!region || profile.region === region) && (!communaute || profile.community === communaute)
      && words.every(word => searchable.includes(word));
  });
  const query = filterQuery(filters);
  const communities = [...new Set(profiles.map(profile => profile.community).filter(Boolean))].sort();
  const results = !profiles.length
    ? '<div class="panel empty"><h3>Les premiers nzonzi arrivent bientôt</h3><p>Nous rencontrons en ce moment les premiers porte-paroles. Revenez très vite.</p><a class="btn secondary" href="/partenaire">Vous êtes nzonzi ? Créez votre profil</a></div>'
    : filtered.length
      ? `<div class="cards">${filtered.map(profile => card(profile, query)).join('')}</div>`
      : '<div class="panel empty"><h3>Aucun profil pour ces critères</h3><p>Essayez une autre ville, une autre langue ou une autre région.</p><a class="btn secondary" href="/#nzonzi">Voir tous les nzonzi</a></div>';
  return layout('Trouver un nzonzi pour votre cérémonie de dot', `<main id="main">
<section class="hero" aria-labelledby="hero-title"><div class="shell">
  <div class="hero-copy"><p class="kicker">Cérémonie de dot</p>
  <h1 id="hero-title">Trouvez <strong>le nzonzi</strong> de votre famille.</h1>
  <p class="lead">Un porte-parole qui parle vos langues et connaît vos coutumes, près de chez vous.</p>
  <div class="hero-actions"><a class="btn" href="#nzonzi">Voir les nzonzi ${icon('arrow')}</a><a class="link" href="#comment">Comment ça marche ?</a></div></div>
  <figure class="hero-art">${motionScene}
    <figcaption>Une parole qui rassemble.</figcaption>
    <button class="motion-replay" type="button" aria-label="Rejouer l’animation" title="Rejouer l’animation">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1.7 7.1M4 10V4m0 6h6"/></svg>
    </button>
  </figure>
  <script>
    const replay = document.querySelector('.motion-replay');
    const scene = replay.closest('.hero-art').querySelector('.motion-scene');
    replay.addEventListener('click', () => {
      for (const animation of scene.getAnimations({subtree:true})) {
        animation.currentTime = 0;
        animation.play();
      }
    });
  </script>
</div></section>
<section class="directory" id="nzonzi" aria-labelledby="directory-title"><div class="shell">
  <div class="section-heading"><p class="kicker">L’annuaire</p><h2 id="directory-title">Les <strong>nzonzi</strong></h2><p>Chaque profil est vérifié par notre équipe avant d’être publié.</p></div>
  <form class="filters" role="search" action="/#nzonzi" method="get" aria-label="Rechercher un nzonzi">
    <label class="field">Recherche<span class="searchbox">${icon('search')}<input name="q" type="search" maxlength="100" placeholder="Nom, ville ou langue" value="${escapeHtml(q)}"></span></label>
    <label class="field">Région<select name="region"><option value="">Toutes</option>${options(regions, region)}</select></label>
    <label class="field">Communauté<select name="communaute"><option value="">Toutes</option>${options(communities, communaute)}</select></label>
    <button type="submit" class="btn">Rechercher</button>
  </form>
  <div class="result-bar" role="status"><span>${filtered.length} profil${filtered.length === 1 ? '' : 's'} ${filtered.length === 1 ? 'trouvé' : 'trouvés'}</span>${query ? '<a class="link" href="/#nzonzi">Effacer les filtres</a>' : ''}</div>
  ${results}
</div></section>
<section class="method" id="comment" aria-labelledby="method-title"><div class="shell">
  <div class="section-heading"><p class="kicker">Simple et sans engagement</p><h2 id="method-title">Comment <strong>ça marche ?</strong></h2></div>
  <ol class="steps">
    <li><h3>Cherchez</h3><p>Filtrez par région, langue ou communauté.</p></li>
    <li><h3>Choisissez</h3><p>Lisez sa présentation, ses prestations et son prix total.</p></li>
    <li><h3>Contactez</h3><p>Échangez avec le nzonzi pour préparer votre cérémonie.</p></li>
  </ol>
</div></section>
${blogTeaser()}
<section class="join" aria-labelledby="join-title"><div class="shell">
  <div><h2 id="join-title">Vous êtes <strong>nzonzi ?</strong></h2><p>Créez votre profil gratuitement. Il apparaît dans l’annuaire après notre validation.</p></div>
  <a class="btn light" href="/partenaire">Créer mon profil ${icon('arrow')}</a>
</div></section>
</main>`, { seo: { path: '/', fullTitle: 'Mon Nzonzi · Trouver un nzonzi pour votre cérémonie de dot', description: 'Trouvez un nzonzi, porte-parole de votre famille pour la cérémonie de dot : profils vérifiés, langues, coutumes et prix affichés, près de chez vous.', jsonLd: [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Mon Nzonzi', url: SITE_ORIGIN + '/', inLanguage: 'fr-FR', publisher },
  ] } });
}

// Blog pédagogique : /blog et /blog/<slug> (contenu dans worker/blog.js).
const blogDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });
const blogArt = {
  voices: '<circle cx="132" cy="150" r="34"/><circle cx="268" cy="150" r="34"/><path d="M84 240c0-40 22-62 48-62s48 22 48 62M220 240c0-40 22-62 48-62s48 22 48 62"/><path d="M150 52h100a20 20 0 0 1 20 20v18a20 20 0 0 1-20 20h-38l-12 14-12-14h-38a20 20 0 0 1-20-20V72a20 20 0 0 1 20-20Z"/><path d="M168 81h12m14 0h12m14 0h12"/>',
  circle: '<circle cx="200" cy="130" r="88" stroke-dasharray="2 10"/><circle cx="200" cy="130" r="56"/><circle cx="200" cy="42" r="14"/><circle cx="200" cy="218" r="14"/><circle cx="112" cy="130" r="14"/><circle cx="288" cy="130" r="14"/><path d="M186 124h28M186 136h18"/>',
  gift: '<rect x="128" y="96" width="144" height="112" rx="10"/><path d="M118 96h164v-26H118zM200 70v138"/><path d="M200 70c-10-26-46-34-50-12-3 16 26 16 50 12Zm0 0c10-26 46-34 50-12 3 16-26 16-50 12Z"/><path d="M80 210h240"/>',
  steps: '<path d="M60 196h70v-40h70v-40h70V76h70" /><circle cx="95" cy="176" r="8"/><circle cx="165" cy="136" r="8"/><circle cx="235" cy="96" r="8"/><circle cx="305" cy="56" r="8"/><path d="M60 216h280"/>',
  people: '<circle cx="200" cy="96" r="30"/><path d="M146 210c0-46 24-72 54-72s54 26 54 72"/><circle cx="110" cy="126" r="22"/><path d="M70 214c0-34 18-54 40-54 12 0 22 5 29 15"/><circle cx="290" cy="126" r="22"/><path d="M330 214c0-34-18-54-40-54-12 0-22 5-29 15"/>',
};
const blogAccents = { voices: 'var(--olive)', circle: 'var(--brun)', gift: 'var(--bordeaux)', steps: 'var(--olive)', people: 'var(--brun)' };
function articleArt(article) {
  return `<div class="article-art" style="background:${blogAccents[article.art] || 'var(--olive)'}"><svg viewBox="0 0 400 240" fill="none" stroke="var(--blanc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${blogArt[article.art] || ''}</svg></div>`;
}
function articleCard(article, headingLevel = 'h3') {
  return `<article class="card article-card">${articleArt(article)}
    <div class="card-content"><span class="kicker">${escapeHtml(article.kicker)}</span><${headingLevel}><a href="/blog/${article.slug}">${escapeHtml(article.title)}</a></${headingLevel}>
    <p>${escapeHtml(article.description)}</p>
    <div class="card-bottom"><small>${article.minutes} min de lecture</small><span class="more" aria-hidden="true">Lire ${icon('arrow')}</span></div></div>
  </article>`;
}
const publisher = { '@type': 'Organization', name: 'Mon Nzonzi', url: SITE_ORIGIN + '/', logo: SITE_ORIGIN + '/assets/favicon.png', sameAs: ['https://www.instagram.com/monnzonzi/'] };
function breadcrumbs(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: SITE_ORIGIN + path })) };
}
function blogIndexPage() {
  const description = 'Nzonzi, kinzonzi, dot, étapes du mariage en RDC : nos articles pour comprendre les traditions du mariage congolais et bien préparer votre cérémonie.';
  return layout('Blog', `<main class="blog" id="main"><div class="shell">
  <div class="section-heading blog-head"><p class="kicker">Le blog</p><h1>Comprendre <strong>la dot</strong> et le kinzonzi</h1>
  <p class="lead">Des explications simples sur les traditions du mariage congolais. Chaque famille a ses coutumes : ces articles donnent des repères, pas des règles.</p></div>
  <div class="cards">${blogArticles.map(article => articleCard(article, 'h2')).join('')}</div>
</div></main>`, { seo: { path: '/blog', description, fullTitle: 'Blog : comprendre la dot et le kinzonzi · Mon Nzonzi', jsonLd: [
    { '@context': 'https://schema.org', '@type': 'Blog', name: 'Le blog Mon Nzonzi', url: SITE_ORIGIN + '/blog', inLanguage: 'fr-FR', description, publisher,
      blogPost: blogArticles.map(article => ({ '@type': 'BlogPosting', headline: article.title, url: SITE_ORIGIN + '/blog/' + article.slug, datePublished: article.published })) },
    breadcrumbs([['Accueil', '/'], ['Blog', '/blog']]),
  ] } });
}
function articlePage(article) {
  const path = '/blog/' + article.slug;
  const updated = article.updated || article.published;
  const related = article.related.map(slug => blogArticles.find(entry => entry.slug === slug)).filter(Boolean);
  return layout(article.title, `<main class="article" id="main"><div class="shell">
  <a class="back" href="/blog">${icon('back')} Tous les articles</a>
  <article>
    <header class="article-head"><p class="kicker">${escapeHtml(article.kicker)}</p><h1>${escapeHtml(article.title)}</h1>
      <p class="lead">${escapeHtml(article.lead)}</p>
      <p class="article-meta"><time datetime="${article.published}">${blogDate.format(new Date(article.published + 'T12:00:00Z'))}</time> · ${article.minutes} min de lecture · L’équipe Mon Nzonzi</p></header>
    <aside class="takeaways" aria-label="À retenir"><h2>À retenir</h2><ul>${article.takeaways.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></aside>
    <div class="article-body">${article.body}</div>
    <section class="faq" aria-labelledby="faq-title"><h2 id="faq-title">Questions fréquentes</h2>
      ${article.faq.map(item => `<h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p>`).join('')}</section>
    <p class="article-note">Les coutumes varient d’une famille, d’une région et d’une communauté à l’autre. Cet article donne des repères généraux : en cas de doute, la parole des aînés de votre famille passe avant tout.</p>
  </article>
  <section class="article-cta"><div><h2>Besoin d’un <strong>nzonzi ?</strong></h2><p>Trouvez un porte-parole qui parle vos langues et connaît vos coutumes, près de chez vous.</p></div>
    <a class="btn light" href="/#nzonzi">Voir les nzonzi ${icon('arrow')}</a></section>
  <section class="related" aria-labelledby="related-title"><h2 id="related-title">À lire aussi</h2><div class="cards">${related.map(entry => articleCard(entry)).join('')}</div></section>
</div></main>`, { seo: { path, description: article.description, fullTitle: article.seoTitle, type: 'article', jsonLd: [
    { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description, inLanguage: 'fr-FR',
      datePublished: article.published, dateModified: updated, mainEntityOfPage: SITE_ORIGIN + path, image: SITE_ORIGIN + '/assets/partage.png',
      author: { '@type': 'Organization', name: 'Mon Nzonzi', url: SITE_ORIGIN + '/' }, publisher },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: article.faq.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) },
    breadcrumbs([['Accueil', '/'], ['Blog', '/blog'], [article.title, path]]),
  ] } });
}
function blogTeaser() {
  return `<section class="blog-teaser" aria-labelledby="blog-teaser-title"><div class="shell">
  <div class="section-heading"><p class="kicker">Le blog</p><h2 id="blog-teaser-title">Comprendre <strong>la dot</strong></h2><p>Nzonzi, kinzonzi, liste de la dot, étapes du mariage : des repères simples pour bien préparer votre cérémonie.</p></div>
  <div class="cards">${blogArticles.slice(0, 3).map(article => articleCard(article)).join('')}</div>
  <p class="blog-more"><a class="link" href="/blog">Tous les articles</a></p>
</div></section>`;
}
// Plan du site pour les moteurs de recherche (pages publiques seulement).
function sitemap(profiles) {
  const latest = blogArticles.map(article => article.updated || article.published).sort().at(-1);
  const entries = [['/', null], ['/blog', latest], ...blogArticles.map(article => ['/blog/' + article.slug, article.updated || article.published]), ...profiles.map(profile => ['/nzonzi/' + profile.slug, null])];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([path, date]) => `  <url><loc>${SITE_ORIGIN}${escapeHtml(path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}
function robotsTxt() {
  return SEARCH_INDEXING
    ? `User-agent: *\nDisallow: /partenaire\nDisallow: /api/\nDisallow: /cdn-cgi/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

// Envoi d'emails par Brevo (API transactionnelle). Rien n'est envoyé tant que
// BREVO_API_KEY et BREVO_SENDER_EMAIL ne sont pas définis (secrets du Worker).
export function mailEnabled(env) {
  return Boolean(env?.BREVO_API_KEY && env?.BREVO_SENDER_EMAIL);
}
export function adminEmails(env) {
  return [...new Set(String(env?.NZOZI_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))];
}
// Mise en page commune des emails (styles en ligne, compatibles messageries).
const mailColors = { brun: '#382D20', bordeaux: '#8C3D20', olive: '#726B4F', fond: '#F6F4EF', carte: '#FFFDF8', ligne: '#DAD6CA' };
export function mailButton(label, href, secondary = false) {
  const style = secondary
    ? `display:inline-block;padding:12px 22px;border-radius:999px;border:1px solid ${mailColors.brun};color:${mailColors.brun};text-decoration:none;font-weight:bold;font-size:15px`
    : `display:inline-block;padding:13px 24px;border-radius:999px;background:${mailColors.bordeaux};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px`;
  return `<a href="${escapeHtml(href)}" style="${style}">${escapeHtml(label)}</a>`;
}
export function mailDetails(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:18px 0;background:${mailColors.fond};border-radius:14px">`
    + rows.filter(([, value]) => value).map(([label, value]) => `<tr><td style="padding:10px 16px;color:${mailColors.olive};font-size:13px;width:130px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 16px;font-size:15px;color:${mailColors.brun};font-weight:bold">${escapeHtml(value)}</td></tr>`).join('')
    + '</table>';
}
function mailLayout(inner) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:${mailColors.fond}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${mailColors.fond};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${mailColors.carte};border-radius:20px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${mailColors.brun}">
<tr><td style="background:${mailColors.bordeaux};padding:22px 28px;color:#ffffff;font-size:26px;font-weight:bold;letter-spacing:-0.5px">MonNzonzi</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${inner}</td></tr>
<tr><td style="background:${mailColors.brun};padding:18px 28px;color:#D9D5C8;font-size:12px;line-height:1.5">Mon Nzonzi · Une parole qui rassemble.<br>mon-nzonzi.fr</td></tr>
</table></td></tr></table></body></html>`;
}
function textToHtml(text) {
  return text.split(/\n{2,}/).map(block => `<p style="margin:0 0 14px">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}
export async function sendMail(env, { to, subject, text, html: inner, replyTo, bcc = [] }) {
  if (!mailEnabled(env)) return false;
  const recipients = [...new Set(to.map(email => email.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return false;
  const hidden = [...new Set(bcc.map(email => email.trim().toLowerCase()))].filter(email => email && !recipients.includes(email));
  const html = mailLayout(inner || textToHtml(text));
  const body = {
    sender: { name: 'Mon Nzonzi', email: env.BREVO_SENDER_EMAIL },
    to: recipients.map(email => ({ email })),
    subject, textContent: text, htmlContent: html,
  };
  if (replyTo) body.replyTo = replyTo;
  if (hidden.length) body.bcc = hidden.map(email => ({ email }));
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const VENUES = ['Salle de réception', 'Domicile familial', 'Autre lieu', 'Pas encore défini'];
const ADDRESS_VENUES = ['Salle de réception', 'Domicile familial'];
function venueLabel(venue, city) {
  if (!venue || venue === 'Pas encore défini') return city + (venue ? ' (lieu pas encore défini)' : '');
  return venue + ' · ' + city;
}
function contactForm(profile, url, state) {
  const values = state.values || {};
  const firstName = escapeHtml(profile.name.split(' ')[0]);
  return `${state.error ? `<div class="feedback error" role="alert">${escapeHtml(state.error)}</div>` : ''}
        <form method="post" action="${url}#contact">
          <h2 id="contact-title">Contacter ${firstName}</h2>
          <p class="muted">Votre message est envoyé par email à ${firstName}, qui vous répond directement.</p>
          <input type="hidden" name="reference" value="${values.reference || crypto.randomUUID()}">
          <div class="hp" aria-hidden="true"><label>Ne pas remplir<input name="site" tabindex="-1" autocomplete="off"></label></div>
          <label class="field">Votre nom<input name="nom" maxlength="100" autocomplete="name" required value="${escapeHtml(values.name || '')}"></label>
          <div class="two-fields">
            <label class="field">Votre email<input name="email" type="email" maxlength="200" autocomplete="email" required value="${escapeHtml(values.email || '')}"></label>
            <label class="field"><span>Téléphone <span class="optional">(facultatif)</span></span><input name="telephone" type="tel" maxlength="40" autocomplete="tel" value="${escapeHtml(values.phone || '')}"></label>
          </div>
          <div class="two-fields venue-row">
            <label class="field">Ville de la cérémonie<input name="ville" maxlength="100" required value="${escapeHtml(values.city || '')}"></label>
            <label class="field">Lieu<select name="lieu" required><option value="">Choisir</option>${options(VENUES, values.venue || '')}</select></label>
          </div>
          <label class="field" id="address-field"${ADDRESS_VENUES.includes(values.venue) ? '' : ' hidden'}><span id="address-label">${values.venue === 'Domicile familial' ? 'Adresse du domicile' : 'Adresse de la salle'}</span><input name="adresse" maxlength="200" autocomplete="street-address" placeholder="Numéro, rue, code postal" value="${escapeHtml(values.address || '')}"></label>
          <label class="field"><span>Date <span class="optional">(facultatif)</span></span><input type="date" name="date" value="${escapeHtml(values.date || '')}"></label>
          <label class="field">Votre message<textarea name="message" maxlength="2000" required placeholder="Présentez votre famille et votre projet de cérémonie.">${escapeHtml(values.message || '')}</textarea></label>
          <label class="check"><input type="checkbox" name="accord" value="oui" required${values.consent ? ' checked' : ''}><span>J’accepte que mes coordonnées et mon message soient transmis à ${firstName} et à l’équipe Mon Nzonzi. <a href="/confidentialite" target="_blank">En savoir plus</a></span></label>
          <button class="btn" type="submit">Envoyer ${icon('arrow')}</button>
        </form>
        <script>
        (() => {
          const venue = document.querySelector('select[name="lieu"]');
          const field = document.getElementById('address-field');
          const input = field.querySelector('input');
          const label = document.getElementById('address-label');
          const sync = () => {
            const show = venue.value === 'Salle de réception' || venue.value === 'Domicile familial';
            field.hidden = !show; input.required = show;
            label.textContent = venue.value === 'Domicile familial' ? 'Adresse du domicile' : 'Adresse de la salle';
          };
          venue.addEventListener('change', sync); sync();
        })();
        </script>`;
}

function contactSection(profile, url, state, env) {
  const firstName = escapeHtml(profile.name.split(' ')[0]);
  const body = state.sent
    ? `<h2 id="contact-title">Contacter ${firstName}</h2><div class="feedback" role="status"><p><strong>Merci, votre demande a été envoyée.</strong></p><p>${firstName} vous répondra directement par email.</p></div>`
    : mailEnabled(env)
      ? contactForm(profile, url, state)
      : `<h2 id="contact-title">Contacter ${firstName}</h2><p class="muted">La prise de contact en ligne ouvre très bientôt.</p>`;
  return `<section class="panel contact" id="contact" aria-labelledby="contact-title">
        <p class="kicker">Prix total</p><strong class="price">${profilePrice(profile)}</strong>
        <p>Commission incluse.${profile.duration ? ' Durée : ' + escapeHtml(profile.duration) + '.' : ''} Déplacements à convenir.</p>
        ${body}
      </section>`;
}
function profileDetails(profile) {
  const block = (title, value) => value ? `<h3>${title}</h3><p>${escapeHtml(value)}</p>` : '';
  return `${profile.services.length ? `<h3>Prestations</h3><ul>${profile.services.map(service => `<li>${escapeHtml(service)}</li>`).join('')}</ul>` : ''}
        ${block('Coutumes', profile.traditions)}
        ${block('Expérience', profile.experience ? profile.experience + (profile.experience === '1' ? ' an' : ' ans') : '')}
        <h3>Se déplace</h3><p>${escapeHtml(profile.travel)}</p>
        ${block('Conditions', profile.conditions)}`;
}

function profilePage(profile, query, state = {}, env = {}) {
  const url = '/nzonzi/' + profile.slug + query;
  return layout(profile.name, `<main class="profile" id="main"><div class="shell">
    <a class="back" href="/${query}#nzonzi">${icon('back')} Tous les nzonzi</a>
    <section class="panel profile-head" aria-labelledby="profile-name">
      <div>${profileMotion(profile)}</div>
      <div class="profile-intro"><h1 id="profile-name">${escapeHtml(profile.name)}</h1>
      ${location(profile)}${profile.rating ? ratingLine(profile.rating, '#avis') : ''}${pills([profile.community, ...profile.languages].filter(Boolean))}<p class="lead">${escapeHtml(profile.summary)}</p></div>
    </section>
    <div class="profile-layout">
      <div class="profile-main">
      <section class="panel details"><h2>Présentation</h2><p>${escapeHtml(profile.bio)}</p>
        ${profileDetails(profile)}
      </section>
      ${reviewsSection(profile, state.reviews || [])}
      </div>
      ${contactSection(profile, url, state, env)}
    </div>
  </div></main>`, { seo: { path: '/nzonzi/' + profile.slug, description: `${profile.name}, nzonzi à ${profile.city} (${profile.region}). ${profile.summary}`.slice(0, 300) } });
}

// Demandes des familles : conservées 12 mois (voir la politique de confidentialité).
const CONTACT_RETENTION_MS = 365 * 24 * 3600 * 1000;
const CONTACT_LIMIT_PER_HOUR = 5;
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const changes = result => Number(result?.meta?.changes ?? result?.changes ?? 0);

async function sendContactRequest(request, env, profile, query) {
  if (!mailEnabled(env) || !env.DB) return new Response(null, { status: 405, headers: catalogHeaders });
  const show = async (state, status) => catalogResponse(profilePage(profile, query, { ...state, reviews: await publishedReviews(env, profile.slug) }, env), status);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return show({ error: 'Origine de la demande non autorisée.' }, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/x-www-form-urlencoded')) return new Response(null, { status: 415, headers: catalogHeaders });
  const raw = await request.text();
  if (raw.length > 12000) return new Response(null, { status: 413, headers: catalogHeaders });
  const fields = new URLSearchParams(raw);
  const get = (name, max) => (fields.get(name) || '').trim().slice(0, max);
  const reference = fields.get('reference') || '';
  const values = {
    reference: safeId.test(reference) ? reference : undefined,
    name: get('nom', 100), email: get('email', 200), phone: get('telephone', 40),
    city: get('ville', 100), venue: get('lieu', 40), address: get('adresse', 200), date: get('date', 10), message: get('message', 2000),
    consent: fields.get('accord') === 'oui',
  };
  const sentUrl = '/nzonzi/' + profile.slug + (query ? query.replace(/&amp;/g, '&') + '&' : '?') + 'envoye=1#contact';
  const done = () => new Response(null, { status: 303, headers: { ...catalogHeaders, Location: sentUrl } });
  // Champ piège invisible : les robots le remplissent, on fait semblant d'avoir envoyé.
  if (get('site', 200)) return done();
  const error = message => show({ values, error: message }, 400);
  const { date } = values;
  const validDate = !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
  if (!values.reference || !values.name || !values.city || !values.message) return error('Complétez votre nom, la ville et votre message.');
  if (!VENUES.includes(values.venue)) return error('Choisissez le lieu de la cérémonie.');
  if (!ADDRESS_VENUES.includes(values.venue)) values.address = '';
  else if (!values.address) return error(values.venue === 'Domicile familial' ? 'Indiquez l’adresse du domicile.' : 'Indiquez l’adresse de la salle.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return error('Vérifiez votre adresse email.');
  if (!validDate) return error('Vérifiez la date de la cérémonie.');
  if (!values.consent) return error('Cochez la case pour accepter la transmission de votre demande.');
  const now = new Date();
  try {
    const row = await env.DB.prepare('SELECT published_json FROM nzozi_profiles WHERE slug = ? AND published_json IS NOT NULL').bind(profile.slug).first();
    const to = row ? String(JSON.parse(row.published_json).contactEmail || '') : '';
    if (!to) return show({ values, error: 'Ce nzonzi ne peut pas être contacté pour le moment.' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ipHash = await sha256(ip + '|' + now.toISOString().slice(0, 10));
    const recent = await env.DB.prepare('SELECT COUNT(*) AS count FROM contact_requests WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, new Date(now - 3600 * 1000).toISOString()).first();
    if (Number(recent?.count || 0) >= CONTACT_LIMIT_PER_HOUR) return show({ values, error: 'Trop de demandes envoyées. Réessayez dans une heure.' }, 429);
    await env.DB.prepare('DELETE FROM contact_requests WHERE created_at < ?').bind(new Date(now - CONTACT_RETENTION_MS).toISOString()).run();
    const inserted = await env.DB.prepare("INSERT INTO contact_requests (reference, profile_slug, family_name, family_email, family_phone, ceremony_city, ceremony_venue, ceremony_address, ceremony_date, message, ip_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?) ON CONFLICT(reference) DO NOTHING")
      .bind(values.reference, profile.slug, values.name, values.email, values.phone, values.city, values.venue, values.address, values.date, values.message, ipHash, now.toISOString()).run();
    // Double clic ou rechargement : la demande est déjà partie.
    if (!changes(inserted)) return done();
    const firstName = profile.name.split(' ')[0];
    const text = [
      `Bonjour ${firstName},`,
      '',
      `Une famille vous contacte via Mon Nzonzi pour une cérémonie de dot.`,
      '',
      `Nom : ${values.name}`,
      `Email : ${values.email}`,
      values.phone ? `Téléphone : ${values.phone}` : '',
      `Lieu de la cérémonie : ${venueLabel(values.venue, values.city)}`,
      values.address ? `Adresse : ${values.address}` : '',
      values.date ? `Date : ${formatDate.format(new Date(values.date))}` : '',
      '',
      'Message :',
      values.message,
      '',
      'Pour répondre, utilisez simplement le bouton « Répondre » de votre messagerie.',
      `Pour rassurer la famille, indiquez-lui que vous avez bien reçu sa demande depuis votre espace : ${new URL(request.url).origin}/partenaire#demandes`,
      '',
      'L’équipe Mon Nzonzi',
    ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n');
    const origin = new URL(request.url).origin;
    const dateLabel = values.date ? formatDate.format(new Date(values.date)) : 'À définir';
    const details = mailDetails([
      ['Famille', values.name], ['Email', values.email], ['Téléphone', values.phone],
      ['Ville', values.city], ['Lieu', values.venue], ['Adresse', values.address], ['Date', dateLabel],
    ]);
    const html = `<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${mailColors.olive}">Nouvelle demande</p>
<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:normal">Bonjour ${escapeHtml(firstName)}, <strong>une famille souhaite vous confier sa cérémonie de dot.</strong></h1>
<p style="margin:0">${escapeHtml(values.name)} vous a écrit depuis votre fiche Mon Nzonzi.</p>
${details}
<p style="margin:0 0 8px;color:${mailColors.olive};font-size:13px">Son message</p>
<div style="margin:0 0 22px;padding:16px 18px;border-left:4px solid ${mailColors.bordeaux};background:${mailColors.fond};border-radius:0 12px 12px 0;white-space:pre-wrap">${escapeHtml(values.message)}</div>
<p style="margin:0 0 10px">${mailButton('Répondre à la famille', `mailto:${values.email}?subject=${encodeURIComponent('Votre demande sur Mon Nzonzi')}`)}</p>
<p style="margin:0 0 22px">${mailButton('Confirmer la réception à la famille', origin + '/partenaire#demandes', true)}</p>
<p style="margin:0;color:${mailColors.olive};font-size:13px">Vous pouvez aussi simplement répondre à cet email : votre réponse arrive directement chez la famille. En confirmant la réception depuis votre espace, la famille est rassurée.</p>`;
    const sent = await sendMail(env, {
      to: [to], bcc: adminEmails(env),
      subject: `Nouvelle demande de ${values.name} · ${values.city}`,
      text, html, replyTo: { email: values.email, name: values.name },
    });
    await env.DB.prepare('UPDATE contact_requests SET status = ? WHERE reference = ?').bind(sent ? 'sent' : 'failed', values.reference).run();
    if (!sent) {
      // Nouvelle référence : la famille peut renvoyer la même demande.
      return show({ values: { ...values, reference: undefined }, error: 'Votre demande n’a pas pu être envoyée. Réessayez dans quelques minutes.' }, 502);
    }
    // Confirmation à la famille, avec le récapitulatif (un échec n'annule pas la demande).
    await sendMail(env, {
      to: [values.email],
      subject: `Votre demande a bien été transmise à ${firstName}`,
      html: `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:normal">Merci ${escapeHtml(values.name)}, <strong>votre demande est bien partie.</strong></h1>
<p style="margin:0 0 6px">${escapeHtml(firstName)} l’a reçue par email et vous répondra directement${values.phone ? ' par email ou par téléphone' : ' par email'}. Vous recevrez aussi un message dès qu’il ou elle aura confirmé la réception.</p>
${mailDetails([['Nzonzi', profile.name], ['Ville', values.city], ['Lieu', values.venue], ['Adresse', values.address], ['Date', dateLabel]])}
<p style="margin:0 0 8px;color:${mailColors.olive};font-size:13px">Votre message</p>
<div style="margin:0 0 22px;padding:16px 18px;border-left:4px solid ${mailColors.bordeaux};background:${mailColors.fond};border-radius:0 12px 12px 0;white-space:pre-wrap">${escapeHtml(values.message)}</div>
<p style="margin:0">${mailButton('Revoir la fiche de ' + firstName, origin + '/nzonzi/' + profile.slug, true)}</p>`,
      text: [
        `Bonjour ${values.name},`,
        '',
        `Votre demande a bien été transmise à ${firstName} via Mon Nzonzi. ${firstName} vous répondra directement par email${values.phone ? ' ou par téléphone' : ''}.`,
        'Vous recevrez aussi un email dès qu’il ou elle aura confirmé la réception de votre demande.',
        '',
        'Récapitulatif :',
        `Lieu de la cérémonie : ${venueLabel(values.venue, values.city)}`,
        values.address ? `Adresse : ${values.address}` : '',
        values.date ? `Date : ${formatDate.format(new Date(values.date))}` : '',
        `Message : ${values.message}`,
        '',
        `Fiche de ${firstName} : ${new URL(request.url).origin}/nzonzi/${profile.slug}`,
        '',
        'L’équipe Mon Nzonzi',
      ].filter((line, index, lines) => line !== '' || lines[index - 1] !== '').join('\n'),
    });
  } catch {
    return show({ values: { ...values, reference: undefined }, error: 'Votre demande n’a pas pu être envoyée. Réessayez dans quelques minutes.' }, 503);
  }
  return done();
}

// ——— Avis des familles ———
// Seules les familles qui ont contacté un nzonzi via le formulaire du site sont invitées,
// par un lien unique envoyé après la date de la cérémonie. Chaque avis est vérifié par
// l'équipe avant publication (voir les CGU, section « Avis des familles »).
const REVIEW_DAYS_AFTER_CEREMONY = 2;   // invitation 2 jours après la date de la cérémonie
const REVIEW_DAYS_WITHOUT_DATE = 45;    // sans date : 45 jours après la demande
const REVIEW_MAX_LATE_DAYS = 60;        // au-delà, plus d'invitation (souvenir trop lointain)
const REVIEW_LINK_DAYS = 90;            // durée de validité du lien
const REVIEW_BATCH = 40;                // invitations envoyées au plus par passage
const REVIEW_COMMENT_MIN = 20;
const REVIEW_COMMENT_MAX = 1500;
export const REVIEW_REJECT_REASONS = [
  'Propos injurieux, discriminatoires ou diffamatoires',
  'Informations personnelles (téléphone, adresse, nom d’une autre personne)',
  'Avis sans rapport avec la cérémonie ou avec ce nzonzi',
  'Doute sérieux sur l’authenticité de l’avis ou conflit d’intérêts',
  'Publicité ou lien vers un autre service',
];
const DAY_MS = 24 * 3600 * 1000;
const formatRating = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const ratingWords = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'];

function stars(value, label) {
  return `<span class="stars" style="--rate:${Math.max(0, Math.min(5, Number(value) || 0)).toFixed(2)}" role="img" aria-label="${escapeHtml(label)}"><span aria-hidden="true">★★★★★</span></span>`;
}
function countLabel(count) {
  return count + ' avis';
}
function ratingLine(rating, href = '') {
  const text = formatRating.format(rating.average);
  const count = countLabel(rating.count);
  return `<p class="rating">${stars(rating.average, `Note moyenne : ${text} sur 5`)}<strong>${text}</strong>${href ? `<a href="${href}">${count}</a>` : `<span>${count}</span>`}</p>`;
}
function ceremonyMonth(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? formatMonth.format(new Date(date + 'T12:00:00Z')) : '';
}
async function publishedReviews(env, slug) {
  if (!env?.DB) return [];
  try {
    const { results } = await env.DB.prepare("SELECT rating, comment, author_name, ceremony_date, submitted_at FROM reviews WHERE profile_slug = ? AND status = 'approved' ORDER BY submitted_at DESC LIMIT 100").bind(slug).all();
    return results;
  } catch {
    return [];
  }
}
function reviewsSection(profile, reviews) {
  const firstName = escapeHtml(profile.name.split(' ')[0]);
  const verified = `<span class="verified">${icon('check')}Avis vérifié</span>`;
  const summary = profile.rating
    ? `<div class="reviews-summary"><strong>${formatRating.format(profile.rating.average)}</strong>${stars(profile.rating.average, `Note moyenne : ${formatRating.format(profile.rating.average)} sur 5`)}<span class="muted">sur ${countLabel(profile.rating.count)}</span></div>`
    : `<p class="muted">Pas encore d’avis pour ${firstName}.</p>`;
  const list = reviews.map(review => {
    const month = ceremonyMonth(review.ceremony_date);
    return `<article class="review">
          <div class="review-head">${stars(review.rating, `Note : ${review.rating} sur 5`)}<strong>${escapeHtml(review.author_name)}</strong>${verified}</div>
          <p>${escapeHtml(review.comment)}</p>
          <small>Avis publié le ${formatDate.format(new Date(review.submitted_at))}${month ? ` · cérémonie de ${month}` : ''}</small>
        </article>`;
  }).join('');
  return `<section class="panel reviews" id="avis" aria-labelledby="reviews-title">
        <h2 id="reviews-title">Avis des familles</h2>
        ${summary}
        ${list}
        <p class="note">Seules les familles qui ont contacté ${firstName} via Mon Nzonzi peuvent laisser un avis, après leur cérémonie. Chaque avis est vérifié avant publication. <a class="link" href="/cgu#avis">Comment fonctionnent les avis</a></p>
      </section>`;
}

function tokenOk(token) {
  return /^[A-Za-z0-9_-]{32,64}$/.test(token);
}
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const reviewHeaders = { ...catalogHeaders, 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'Content-Type': 'text/html; charset=utf-8' };
function reviewResponse(html, status = 200) {
  return new Response(html, { status, headers: reviewHeaders });
}
function reviewMessage(title, text, link = true) {
  return layout('Votre avis', `<main class="review-page" id="main"><div class="shell">
  <p class="kicker">Avis des familles</p>
  <h1>${title}</h1>
  <p class="lead">${text}</p>
  ${link ? '<a class="btn secondary" href="/">Retour à Mon Nzonzi</a>' : ''}
</div></main>`);
}
function reviewForm(row, name, token, state = {}) {
  const values = state.values || {};
  const firstName = escapeHtml(name.split(' ')[0]);
  const month = ceremonyMonth(row.ceremony_date);
  const starInputs = [5, 4, 3, 2, 1].map(n => `<input type="radio" id="note-${n}" name="note" value="${n}" required${String(values.rating) === String(n) ? ' checked' : ''}><label for="note-${n}" title="${ratingWords[n]}"><span aria-hidden="true">★</span><span class="sr-only">${n} sur 5 · ${ratingWords[n]}</span></label>`).join('');
  return layout('Votre avis', `<main class="review-page" id="main"><div class="shell">
  <p class="kicker">Avis des familles</p>
  <h1>Comment s’est passée votre cérémonie avec <strong>${escapeHtml(name)}</strong> ?</h1>
  <p class="lead">Votre avis aide d’autres familles à choisir leur nzonzi${month ? ` (cérémonie de ${month})` : ''}. Il sera publié sur la fiche de ${firstName} après vérification par l’équipe Mon Nzonzi.</p>
  ${state.error ? `<div class="feedback error" role="alert">${escapeHtml(state.error)}</div>` : ''}
  <form class="panel review-form" method="post" action="/avis/${escapeHtml(token)}">
    <div><span class="star-label" id="note-title">Votre note</span>
    <div class="star-input" role="radiogroup" aria-labelledby="note-title">${starInputs}</div></div>
    <label class="field">Votre avis<textarea name="commentaire" minlength="${REVIEW_COMMENT_MIN}" maxlength="${REVIEW_COMMENT_MAX}" required placeholder="Comment ${firstName} a-t-il ou a-t-elle accompagné votre famille ? Préparation, prise de parole, respect des coutumes…">${escapeHtml(values.comment || '')}</textarea></label>
    <label class="field"><span>Nom affiché <span class="optional">(par exemple « Famille M. » ou votre prénom)</span></span><input name="nom" maxlength="60" required value="${escapeHtml(values.author ?? suggestAuthor(row.family_name))}"></label>
    <label class="check"><input type="checkbox" name="accord" value="oui" required${values.consent ? ' checked' : ''}><span>Je confirme que ma famille a fait appel à ${firstName} et j’accepte que mon avis, ma note et le nom affiché soient publiés sur sa fiche. <a href="/cgu#avis" target="_blank">Règles des avis</a></span></label>
    <button class="btn" type="submit">Envoyer mon avis ${icon('arrow')}</button>
    <p class="note">Si la cérémonie n’a pas eu lieu avec ${firstName}, ne remplissez pas ce formulaire.</p>
  </form>
</div></main>`);
}
// Proposition de nom affiché : « Famille » + initiale du dernier mot (« Famille Mbemba » → « Famille M. »).
function suggestAuthor(familyName) {
  const words = String(familyName || '').trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] || '';
  return last ? 'Famille ' + last.charAt(0).toUpperCase() + '.' : '';
}
async function reviewRoute(request, env, token) {
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (!isRead && request.method !== 'POST') return new Response(null, { status: 405, headers: reviewHeaders });
  const invalid = () => reviewResponse(reviewMessage('Ce lien n’est <strong>pas valide.</strong>', 'Vérifiez que vous avez copié le lien complet reçu par email. Pour toute question, écrivez-nous depuis le site.'), 404);
  if (!tokenOk(token) || !env?.DB) return invalid();
  let row;
  try {
    row = await env.DB.prepare('SELECT r.reference, r.profile_slug, r.family_name, r.ceremony_date, r.status, r.invited_at, p.published_json FROM reviews r LEFT JOIN nzozi_profiles p ON p.slug = r.profile_slug WHERE r.token_hash = ?').bind(await sha256(token)).first();
  } catch {
    row = null;
  }
  if (!row) return invalid();
  if (row.status !== 'invited') return reviewResponse(reviewMessage('Merci, votre avis <strong>est bien arrivé.</strong>', 'Nous le vérifions avant de le publier. Un seul avis est possible par demande.'));
  if (!row.published_json) return reviewResponse(reviewMessage('Ce nzonzi n’est <strong>plus présent</strong> sur Mon Nzonzi.', 'Il n’est donc plus possible de laisser un avis sur sa fiche. Merci d’avoir pensé à nous.'), 410);
  if (Date.now() - new Date(row.invited_at) > REVIEW_LINK_DAYS * DAY_MS) return reviewResponse(reviewMessage('Ce lien <strong>a expiré.</strong>', `Les liens pour donner un avis restent valables ${REVIEW_LINK_DAYS} jours.`), 410);
  const nzonzi = JSON.parse(row.published_json);
  const name = [nzonzi.firstName, nzonzi.lastName].filter(Boolean).join(' ');
  if (isRead) return reviewResponse(request.method === 'HEAD' ? null : reviewForm(row, name, token));

  const url = new URL(request.url);
  const show = (state, status) => reviewResponse(reviewForm(row, name, token, state), status);
  if (request.headers.get('Origin') !== url.origin) return show({ error: 'Origine de la demande non autorisée.' }, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/x-www-form-urlencoded')) return new Response(null, { status: 415, headers: reviewHeaders });
  const raw = await request.text();
  if (raw.length > 8000) return new Response(null, { status: 413, headers: reviewHeaders });
  const fields = new URLSearchParams(raw);
  const values = {
    rating: Number(fields.get('note')),
    comment: (fields.get('commentaire') || '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, REVIEW_COMMENT_MAX),
    author: (fields.get('nom') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
    consent: fields.get('accord') === 'oui',
  };
  const error = message => show({ values, error: message }, 400);
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5) return error('Choisissez une note de 1 à 5 étoiles.');
  if (values.comment.length < REVIEW_COMMENT_MIN) return error(`Écrivez quelques mots de plus (au moins ${REVIEW_COMMENT_MIN} caractères).`);
  if (!values.author) return error('Indiquez le nom à afficher avec votre avis.');
  if (!values.consent) return error('Cochez la case pour confirmer et accepter la publication.');
  const now = new Date().toISOString();
  try {
    const saved = await env.DB.prepare("UPDATE reviews SET status = 'pending', rating = ?, comment = ?, author_name = ?, submitted_at = ? WHERE reference = ? AND status = 'invited'")
      .bind(values.rating, values.comment, values.author, now, row.reference).run();
    if (changes(saved)) {
      await sendMail(env, {
        to: adminEmails(env),
        subject: `Nouvel avis à valider : ${values.rating}/5 pour ${name}`,
        text: `Bonjour,\n\n${values.author} a laissé un avis (${values.rating}/5) sur ${name} :\n\n${values.comment}\n\nPour le publier ou le refuser : ${url.origin}/partenaire/admin#avis\n\nMon Nzonzi`,
      });
    }
  } catch {
    return show({ values, error: 'Votre avis n’a pas pu être enregistré. Réessayez dans quelques minutes.' }, 503);
  }
  return new Response(null, { status: 303, headers: { ...reviewHeaders, Location: '/avis/' + token } });
}

// Date à partir de laquelle la famille est invitée à donner son avis.
function reviewDueAt(request) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(request.ceremony_date || '')) return new Date(request.ceremony_date + 'T09:00:00Z').getTime() + REVIEW_DAYS_AFTER_CEREMONY * DAY_MS;
  return new Date(request.created_at).getTime() + REVIEW_DAYS_WITHOUT_DATE * DAY_MS;
}
function invitationMail(origin, link, request, nzonzi) {
  const firstName = nzonzi.firstName;
  const fullName = [nzonzi.firstName, nzonzi.lastName].filter(Boolean).join(' ');
  const month = ceremonyMonth(request.ceremony_date);
  return {
    to: [request.family_email],
    subject: `Comment s’est passée votre cérémonie avec ${firstName} ?`,
    html: `<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${mailColors.olive}">Votre avis compte</p>
<h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:normal">Bonjour ${escapeHtml(request.family_name)}, <strong>comment s’est passée votre cérémonie avec ${escapeHtml(firstName)} ?</strong></h1>
<p style="margin:0 0 14px">Vous avez contacté ${escapeHtml(fullName)} via Mon Nzonzi${month ? ` pour votre cérémonie de ${escapeHtml(month)}` : ''}. En une minute, votre note et quelques mots aideront d’autres familles à trouver le bon nzonzi.</p>
<p style="margin:0 0 22px">${mailButton('Donner mon avis', link)}</p>
<p style="margin:0 0 8px;color:${mailColors.olive};font-size:13px">Votre avis sera vérifié par l’équipe avant d’être publié sur la fiche de ${escapeHtml(firstName)}. Ce lien est personnel et valable ${REVIEW_LINK_DAYS} jours.</p>
<p style="margin:0;color:${mailColors.olive};font-size:13px">Si la cérémonie n’a pas encore eu lieu ou ne s’est pas faite avec ${escapeHtml(firstName)}, ignorez simplement cet email.</p>`,
    text: [
      `Bonjour ${request.family_name},`,
      '',
      `Vous avez contacté ${fullName} via Mon Nzonzi${month ? ` pour votre cérémonie de ${month}` : ''}. Comment s’est-elle passée ?`,
      'En une minute, votre note et quelques mots aideront d’autres familles à trouver le bon nzonzi :',
      link,
      '',
      `Votre avis sera vérifié par l’équipe avant d’être publié. Ce lien est personnel et valable ${REVIEW_LINK_DAYS} jours.`,
      `Si la cérémonie n’a pas encore eu lieu ou ne s’est pas faite avec ${firstName}, ignorez simplement cet email.`,
      '',
      'L’équipe Mon Nzonzi',
    ].join('\n'),
  };
}
// Envoie les invitations arrivées à échéance (tâche planifiée quotidienne, ou bouton de l'admin).
// Une seule invitation par demande, et une seule par famille et par nzonzi.
export async function sendReviewInvitations(env, origin = SITE_ORIGIN, now = Date.now()) {
  if (!env?.DB || !mailEnabled(env)) return { sent: 0, failed: 0 };
  const { results } = await env.DB.prepare(`SELECT c.reference, c.profile_slug, c.family_name, c.family_email, c.ceremony_date, c.created_at, p.published_json
    FROM contact_requests c JOIN nzozi_profiles p ON p.slug = c.profile_slug AND p.published_json IS NOT NULL
    WHERE c.status = 'sent' AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.reference = c.reference OR (r.profile_slug = c.profile_slug AND r.family_email = lower(c.family_email)))
    ORDER BY c.created_at LIMIT 500`).bind().all();
  const seen = new Set();
  let sent = 0, failed = 0;
  for (const request of results) {
    const due = reviewDueAt(request);
    const pair = request.profile_slug + '|' + request.family_email.toLowerCase();
    if (!(due <= now) || now - due > REVIEW_MAX_LATE_DAYS * DAY_MS || seen.has(pair)) continue;
    if (sent + failed >= REVIEW_BATCH) break;
    seen.add(pair);
    const token = newToken();
    const inserted = await env.DB.prepare("INSERT INTO reviews (reference, profile_slug, family_email, family_name, ceremony_date, token_hash, status, invited_at) VALUES (?, ?, ?, ?, ?, ?, 'invited', ?) ON CONFLICT(reference) DO NOTHING")
      .bind(request.reference, request.profile_slug, request.family_email.toLowerCase(), request.family_name, request.ceremony_date || '', await sha256(token), new Date(now).toISOString()).run();
    if (!changes(inserted)) continue;
    const ok = await sendMail(env, invitationMail(origin, origin + '/avis/' + token, request, JSON.parse(request.published_json)));
    if (ok) sent++;
    else {
      failed++;
      // Échec d'envoi : nouvelle tentative au prochain passage.
      await env.DB.prepare("DELETE FROM reviews WHERE reference = ? AND status = 'invited'").bind(request.reference).run();
    }
  }
  return { sent, failed };
}

// Administration des avis (/api/admin/avis), réservée à NZOZI_ADMIN_EMAILS (contrôle dans index.js).
function adminJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
// Les réponses aux emails liés aux avis arrivent à l'équipe.
function adminReplyTo(env) {
  const [email] = adminEmails(env);
  return email ? { email, name: 'Mon Nzonzi' } : undefined;
}
export async function reviewsAdminApi(request, env, url) {
  if (!env.DB) return adminJson({ error: 'Base de données indisponible.' }, 503);
  try {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare("SELECT reference, profile_slug, family_name, family_email, ceremony_date, status, rating, comment, author_name, reject_reason, invited_at, submitted_at, reviewed_at FROM reviews WHERE status != 'invited' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, submitted_at DESC LIMIT 200").bind().all();
      const invited = await env.DB.prepare("SELECT COUNT(*) AS count FROM reviews WHERE status = 'invited'").bind().first();
      return adminJson({
        reasons: REVIEW_REJECT_REASONS,
        invited: Number(invited?.count || 0),
        mail: mailEnabled(env),
        reviews: results.map(r => ({ reference: r.reference, slug: r.profile_slug, family: r.family_name, email: r.family_email, ceremonyDate: r.ceremony_date, status: r.status, rating: r.rating, comment: r.comment, author: r.author_name, rejectReason: r.reject_reason, invitedAt: r.invited_at, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at })),
      });
    }
    if (request.method !== 'POST') return adminJson({ error: 'Méthode non autorisée.' }, 405);
    if (request.headers.get('Origin') !== url.origin) return adminJson({ error: 'Origine non autorisée.' }, 403);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return adminJson({ error: 'Format non autorisé.' }, 415);
    const body = await request.text();
    if (body.length > 1000) return adminJson({ error: 'Requête trop volumineuse.' }, 413);
    let input;
    try { input = JSON.parse(body); } catch { return adminJson({ error: 'Requête invalide.' }, 400); }
    const { reference, action, reason } = input || {};
    if (action === 'invite') return adminJson(await sendReviewInvitations(env, url.origin));
    if (typeof reference !== 'string' || !reference || reference.length > 100 || !['approve', 'reject'].includes(action)) return adminJson({ error: 'Requête invalide.' }, 400);
    if (action === 'reject' && !(Number.isInteger(reason) && REVIEW_REJECT_REASONS[reason])) return adminJson({ error: 'Choisissez le motif du refus.' }, 400);
    const row = await env.DB.prepare('SELECT r.status, r.family_email, r.family_name, r.author_name, r.rating, r.profile_slug, p.published_json FROM reviews r LEFT JOIN nzozi_profiles p ON p.slug = r.profile_slug WHERE r.reference = ?').bind(reference).first();
    if (!row || row.status === 'invited') return adminJson({ error: 'Avis introuvable.' }, 404);
    const now = new Date().toISOString();
    const nzonzi = row.published_json ? JSON.parse(row.published_json) : null;
    if (action === 'approve') {
      if (row.status === 'approved') return adminJson({ status: 'approved' });
      await env.DB.prepare("UPDATE reviews SET status = 'approved', reject_reason = '', reviewed_at = ? WHERE reference = ?").bind(now, reference).run();
      if (nzonzi?.contactEmail) {
        await sendMail(env, {
          to: [nzonzi.contactEmail],
          subject: 'Un nouvel avis est publié sur votre fiche',
          replyTo: adminReplyTo(env),
          text: `Bonjour ${nzonzi.firstName},\n\n${row.author_name} a laissé un avis (${row.rating}/5) après votre cérémonie. Il est maintenant visible sur votre fiche :\n${url.origin}/nzonzi/${row.profile_slug}#avis\n\nSi un avis vous semble contraire à nos règles, écrivez-nous en répondant à cet email.\n\nL’équipe Mon Nzonzi`,
        });
      }
      return adminJson({ status: 'approved' });
    }
    const label = REVIEW_REJECT_REASONS[reason];
    await env.DB.prepare("UPDATE reviews SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE reference = ?").bind(label, now, reference).run();
    // La famille est informée du refus et de son motif.
    const name = nzonzi ? [nzonzi.firstName, nzonzi.lastName].filter(Boolean).join(' ') : 'ce nzonzi';
    await sendMail(env, {
      to: [row.family_email],
      subject: row.status === 'approved' ? 'Votre avis a été retiré de Mon Nzonzi' : 'Votre avis n’a pas pu être publié',
      replyTo: adminReplyTo(env),
      text: `Bonjour ${row.family_name},\n\nMerci d’avoir pris le temps de donner votre avis sur ${name}. ${row.status === 'approved' ? 'Il a été retiré de sa fiche' : 'Nous ne pouvons pas le publier'} pour la raison suivante :\n${label}.\n\nNos règles sur les avis : ${url.origin}/cgu#avis\nPour toute question, répondez simplement à cet email.\n\nL’équipe Mon Nzonzi`,
    });
    return adminJson({ status: 'rejected' });
  } catch {
    return adminJson({ error: 'Action impossible pour le moment. Réessayez.' }, 503);
  }
}

// Informations légales. Les valeurs vides s'affichent « à compléter ».
const legalInfo = {
  publisher: '',          // Nom et prénom de l'entrepreneur, ou raison sociale
  legalForm: '',          // Ex. Entrepreneur individuel (micro-entreprise)
  address: '',            // Adresse du siège
  siret: '',              // Numéro SIRET (14 chiffres)
  email: '',              // Email de contact public, ex. contact@mon-nzonzi.fr
  director: '',           // Directeur ou directrice de la publication
  updated: '26 novembre 2026',
};
function info(key, label) {
  return legalInfo[key] ? escapeHtml(legalInfo[key]) : `<mark class="todo">${label} à compléter</mark>`;
}
function contactLink() {
  return legalInfo.email ? `<a href="mailto:${escapeHtml(legalInfo.email)}">${escapeHtml(legalInfo.email)}</a>` : info('email', 'Email de contact');
}
function legalPage(title, body) {
  return layout(title, `<main class="legal" id="main"><div class="shell">
  <p class="kicker">Informations légales</p>
  <h1>${title}</h1>
  <p class="updated">Dernière mise à jour : ${legalInfo.updated}</p>
  ${body}
</div></main>`);
}
const legalPages = {
  '/mentions-legales': () => legalPage('Mentions légales', `
  <h2>Éditeur du site</h2>
  <dl>
    <dt>Nom</dt><dd>${info('publisher', 'Nom ou raison sociale')}</dd>
    <dt>Statut</dt><dd>${info('legalForm', 'Statut juridique')}</dd>
    <dt>Adresse</dt><dd>${info('address', 'Adresse')}</dd>
    <dt>SIRET</dt><dd>${info('siret', 'SIRET')}</dd>
    <dt>Email</dt><dd>${contactLink()}</dd>
    <dt>Directeur de la publication</dt><dd>${info('director', 'Nom')}</dd>
  </dl>
  <h2>Hébergement</h2>
  <p>Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis. <a href="https://www.cloudflare.com" target="_blank" rel="noopener">cloudflare.com</a></p>
  <h2>Propriété intellectuelle</h2>
  <p>Le nom Mon Nzonzi, le logo, les textes et les illustrations du site appartiennent à l’éditeur. Toute reproduction sans autorisation est interdite. Les textes des profils restent la propriété des nzonzi qui les ont rédigés.</p>
  <p>Le site utilise la police Outfit, sous licence SIL Open Font License.</p>
  <h2>Contact</h2>
  <p>Pour toute question ou pour signaler un contenu : ${contactLink()}.</p>`),

  '/confidentialite': () => legalPage('Politique de confidentialité', `
  <p>Cette page explique quelles données Mon Nzonzi utilise, pourquoi, et comment exercer vos droits. Nous collectons seulement ce qui est utile à la mise en relation.</p>
  <h2>Responsable du traitement</h2>
  <p>${info('publisher', 'Nom ou raison sociale')}, ${info('address', 'Adresse')}. Contact : ${contactLink()}.</p>
  <h2>Les données que nous utilisons</h2>
  <ul>
    <li><strong>Familles</strong> : nom, email, téléphone (facultatif), ville, lieu, adresse (pour une salle ou un domicile) et date de la cérémonie, message. Elles servent uniquement à transmettre votre demande au nzonzi choisi.</li>
    <li><strong>Nzonzi</strong> : email de connexion, prénom, nom, email et téléphone de contact, ville, région, langues, présentation, prestations, tarif, conditions, communauté (facultative) et photo (facultative). Elles servent à créer, vérifier et publier votre fiche.</li>
    <li><strong>Avis</strong> : si une famille donne son avis, nous conservons sa note, son commentaire, le nom affiché qu’elle a choisi, son email et la date de la cérémonie. L’email sert uniquement à l’inviter à donner son avis et à la prévenir si l’avis n’est pas publié ; il n’est jamais affiché.</li>
    <li><strong>Données techniques</strong> : adresse IP et journaux techniques, utilisés pour la sécurité du site et contre les envois abusifs. L’adresse IP liée à une demande est conservée sous une forme non lisible (empreinte).</li>
  </ul>
  <h2>Pourquoi et sur quelle base</h2>
  <ul>
    <li>Transmettre la demande d’une famille à un nzonzi : mesures prises à votre demande (article 6.1.b du RGPD).</li>
    <li>Publier la fiche d’un nzonzi et gérer son espace : exécution des conditions d’utilisation (article 6.1.b).</li>
    <li>Inviter une famille à donner son avis après sa cérémonie et publier les avis : intérêt légitime de Mon Nzonzi et des familles à disposer d’avis fiables (article 6.1.f). Vous pouvez ignorer l’invitation, et demander à tout moment le retrait de votre avis.</li>
    <li>Sécurité du site et lutte contre le spam : intérêt légitime de Mon Nzonzi (article 6.1.f).</li>
  </ul>
  <p>La <strong>communauté</strong> est une information facultative et déclarative. Elle n’est jamais déduite d’un nom ou d’une photo. Si un nzonzi la renseigne, elle est affichée sur sa fiche publique avec son accord explicite. Il peut la retirer à tout moment depuis son espace.</p>
  <h2>Qui voit vos données</h2>
  <ul>
    <li>Le nzonzi que vous contactez reçoit votre demande par email et vous répond directement.</li>
    <li>L’équipe Mon Nzonzi reçoit une copie des demandes et vérifie les fiches avant publication.</li>
    <li>Un avis publié affiche la note, le commentaire, le nom choisi par la famille, la date de publication et le mois de la cérémonie. Le nzonzi concerné est prévenu de sa publication.</li>
    <li>Sur une fiche publique, seuls le nom, la ville, la région, les langues, la communauté (si renseignée), la présentation, les prestations et le prix sont visibles. L’email et le téléphone d’un nzonzi ne sont jamais affichés.</li>
    <li>Nos prestataires techniques : Cloudflare (hébergement, base de données, connexion à l’espace nzonzi), dont les serveurs peuvent être situés hors de l’Union européenne, avec les garanties prévues par le RGPD (clauses contractuelles types et Data Privacy Framework) ; Brevo (envoi des emails), société française.</li>
  </ul>
  <p>Vos données ne sont jamais vendues ni utilisées pour de la publicité.</p>
  <h2>Combien de temps</h2>
  <ul>
    <li>Demandes des familles : 12 mois après l’envoi, puis supprimées.</li>
    <li>Avis : tant que la fiche du nzonzi est en ligne, ou jusqu’à ce que la famille demande leur retrait. Une invitation restée sans réponse expire au bout de 90 jours.</li>
    <li>Profils des nzonzi : tant que le compte est actif. Sur demande, le profil est retiré puis supprimé sous 30 jours.</li>
    <li>Journaux techniques : quelques jours, selon les règles de notre hébergeur.</li>
  </ul>
  <h2>Cookies</h2>
  <p>Le site n’utilise ni cookie publicitaire ni outil de mesure d’audience. Seul un cookie de connexion (CF_Authorization) est déposé quand un nzonzi se connecte à son espace. Il est nécessaire au fonctionnement du service et ne demande donc pas de consentement.</p>
  <h2>Vos droits</h2>
  <p>Vous pouvez demander l’accès à vos données, leur correction, leur suppression, leur portabilité, ou vous opposer à leur utilisation, en écrivant à ${contactLink()}. Nous répondons sous un mois.</p>
  <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL : <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">cnil.fr/fr/plaintes</a>.</p>`),

  '/cgu': () => legalPage('Conditions d’utilisation', `
  <h2>1. Le service</h2>
  <p>Mon Nzonzi est un annuaire qui aide les familles à trouver un nzonzi (porte-parole ou médiateur) pour préparer une cérémonie de dot, dans le respect des coutumes de chacun. Mon Nzonzi met en relation les familles et les nzonzi. Il n’organise pas la cérémonie et n’est pas partie à l’accord conclu entre une famille et un nzonzi.</p>
  <h2>2. Pour les familles</h2>
  <ul>
    <li>La consultation de l’annuaire et l’envoi d’une demande sont gratuits et sans engagement.</li>
    <li>Le prix affiché sur une fiche est un prix total indicatif, commission Mon Nzonzi incluse. Les détails (durée, déplacements, déroulé) se décident directement avec le nzonzi.</li>
    <li>Mon Nzonzi n’encaisse aucun paiement à ce jour. ${'<mark class="todo">Modalités de paiement et de commission à compléter</mark>'}</li>
    <li>Merci de rester courtois et d’utiliser le formulaire uniquement pour une demande réelle.</li>
  </ul>
  <h2>3. Pour les nzonzi</h2>
  <ul>
    <li>L’inscription et la création du profil sont gratuites. Le profil est publié après vérification par l’équipe Mon Nzonzi, qui peut refuser ou retirer un profil, notamment s’il est incomplet, trompeur ou contraire à ces conditions.</li>
    <li>Le nzonzi garantit que les informations de son profil sont exactes et qu’il a le droit de publier sa photo.</li>
    <li>Il fixe librement la rémunération qu’il souhaite recevoir. Le prix affiché aux familles inclut la commission Mon Nzonzi (15 % du prix total).</li>
    <li>Il s’engage à répondre aux familles avec respect et à utiliser leurs coordonnées uniquement pour leur demande.</li>
    <li>Il exerce son activité en toute indépendance et reste responsable de ses obligations (déclarations, assurances, impôts).</li>
    <li>Il peut modifier son profil à tout moment depuis son espace, ou demander sa suppression à ${contactLink()}.</li>
  </ul>
  <h2 id="avis">4. Avis des familles</h2>
  <ul>
    <li><strong>Qui peut donner un avis</strong> : seules les familles qui ont contacté un nzonzi avec le formulaire de sa fiche. Elles reçoivent par email un lien personnel, 2 jours après la date de la cérémonie (ou 45 jours après leur demande si aucune date n’a été indiquée). Ce lien est valable 90 jours et ne permet de donner qu’un seul avis. Les avis sont donc liés à une vraie demande, mais Mon Nzonzi ne peut pas vérifier que la cérémonie a bien eu lieu : la famille le confirme en cochant une case.</li>
    <li><strong>Vérification</strong> : chaque avis est lu par l’équipe Mon Nzonzi avant publication, en général sous 7 jours. Le texte n’est jamais modifié. Aucun avis n’est rémunéré ni acheté, et un nzonzi ne peut ni supprimer ni commander un avis.</li>
    <li><strong>Motifs de refus ou de retrait</strong> : propos injurieux, discriminatoires ou diffamatoires ; informations personnelles (téléphone, adresse, nom d’une autre personne) ; avis sans rapport avec la cérémonie ou avec ce nzonzi ; doute sérieux sur l’authenticité de l’avis ou conflit d’intérêts ; publicité. La famille est prévenue par email du refus et de son motif.</li>
    <li><strong>Affichage</strong> : les avis sont classés du plus récent au plus ancien, avec leur date de publication et le mois de la cérémonie. La note moyenne d’un nzonzi est la moyenne de tous ses avis publiés.</li>
    <li><strong>Signaler un avis</strong> : un nzonzi ou une famille peut signaler un avis à ${contactLink()}. Une famille peut aussi demander le retrait de son propre avis.</li>
  </ul>
  <h2>5. Responsabilité</h2>
  <p>Mon Nzonzi vérifie les profils avant publication mais ne peut pas garantir le déroulement d’une cérémonie. En cas de désaccord entre une famille et un nzonzi, la solution se trouve d’abord entre eux. Vous pouvez nous signaler tout problème à ${contactLink()}.</p>
  <h2>6. Données personnelles</h2>
  <p>Voir la <a href="/confidentialite">politique de confidentialité</a>.</p>
  <h2>7. Modifications et droit applicable</h2>
  <p>Ces conditions peuvent évoluer. La version en vigueur est celle publiée sur cette page. Elles sont soumises au droit français.</p>`),
};

export async function catalog(request, env, regions) {
  const url = new URL(request.url);
  const { pathname } = url;
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  const asset = siteAssetRoutes.get(pathname);
  if (asset) {
    const [file, type] = asset;
    const source = siteAssets[file];
    if (!isRead || !source) return new Response(null, { status: isRead ? 404 : 405, headers: catalogHeaders });
    return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(source), byte => byte.charCodeAt(0)), {
      headers: { ...catalogHeaders, 'Content-Type': type },
    });
  }
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
    const body = pathname === '/robots.txt' ? robotsTxt() : sitemap(await listedProfiles(env));
    return new Response(request.method === 'HEAD' ? null : body, { headers: { ...catalogHeaders, 'Cache-Control': 'public, max-age=3600', 'Content-Type': pathname === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8' } });
  }
  if (pathname === '/blog' || pathname === '/blog/' || pathname.startsWith('/blog/')) {
    if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
    if (pathname === '/blog/') return new Response(null, { status: 301, headers: { ...catalogHeaders, Location: '/blog' } });
    const article = pathname === '/blog' ? null : blogArticles.find(entry => pathname === '/blog/' + entry.slug);
    if (pathname !== '/blog' && !article) return catalogResponse(request.method === 'HEAD' ? null : layout('Article introuvable', '<main class="article" id="main"><div class="shell"><h1>Article introuvable</h1><a class="back" href="/blog">Tous les articles</a></div></main>'), 404);
    return catalogResponse(request.method === 'HEAD' ? null : article ? articlePage(article) : blogIndexPage());
  }
  const legal = legalPages[pathname];
  if (legal) {
    if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
    return catalogResponse(request.method === 'HEAD' ? null : legal());
  }
  if (pathname.startsWith('/avis/')) return reviewRoute(request, env, pathname.slice(6));
  if (pathname !== '/' && pathname !== '/index.html' && !pathname.startsWith('/nzonzi/')) return null;
  const profiles = await listedProfiles(env);
  const filters = filterState(url.searchParams, regions, profiles);
  if (pathname === '/' || pathname === '/index.html') {
    if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
    return catalogResponse(request.method === 'HEAD' ? null : directoryPage(filters, regions, profiles));
  }
  const profile = profiles.find(entry => pathname === '/nzonzi/' + entry.slug);
  if (!profile) return catalogResponse(request.method === 'HEAD' ? null : layout('Profil introuvable', '<main class="profile" id="main"><div class="shell"><h1>Profil introuvable</h1><a class="back" href="/#nzonzi">Retour aux profils</a></div></main>'), 404);
  const query = filterQuery(filters);
  if (request.method === 'POST') return sendContactRequest(request, env, profile, query);
  if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
  if (request.method === 'HEAD') return catalogResponse(null);
  return catalogResponse(profilePage(profile, query, { sent: url.searchParams.get('envoye') === '1', reviews: await publishedReviews(env, profile.slug) }, env));
}

// Page d'administration : liste des profils et validation avant publication.
// Le contenu est inséré avec textContent côté navigateur (aucun HTML venant des profils).
export function adminPage() {
  return layout('Validation des profils', `<main class="profile admin" id="main"><div class="shell">
  <p class="kicker">Administration</p>
  <h1>Validation des profils nzonzi</h1>
  <p class="lead">Un profil n’apparaît dans l’annuaire qu’après votre validation. Quand un nzonzi modifie un profil déjà publié, l’ancienne version reste en ligne jusqu’à votre nouvelle validation.</p>
  <p id="admin-status" class="muted" role="status" aria-live="polite">Chargement des profils…</p>
  <section aria-labelledby="pending-title"><h2 id="pending-title">À valider</h2><div id="list-pending" class="admin-list"></div></section>
  <section aria-labelledby="approved-title"><h2 id="approved-title">Publiés</h2><div id="list-approved" class="admin-list"></div></section>
  <section aria-labelledby="rejected-title"><h2 id="rejected-title">Refusés ou retirés</h2><div id="list-rejected" class="admin-list"></div></section>
  <section aria-labelledby="requests-title"><h2 id="requests-title">Demandes des familles</h2><p class="muted">Les 50 dernières demandes envoyées depuis les fiches. Vous en recevez aussi une copie par email.</p><div id="list-requests" class="admin-list"></div></section>
  <section id="avis" aria-labelledby="reviews-title"><h2 id="reviews-title">Avis des familles</h2><p class="muted">Les familles qui ont contacté un nzonzi reçoivent un lien par email 2 jours après la date de leur cérémonie (45 jours après leur demande si elles n’ont pas donné de date). Un avis n’est publié qu’après votre accord. En cas de refus ou de retrait, la famille reçoit le motif par email.</p>
  <div class="admin-actions"><button class="btn secondary" type="button" id="send-invitations">Envoyer maintenant les invitations prévues</button><span id="invited-count" class="muted"></span></div>
  <div id="list-reviews" class="admin-list"></div></section>
</div></main>
<style>
.admin h1{margin:14px 0 10px}.admin section{margin-top:34px}.admin h2{margin-bottom:14px}
.admin-list{display:grid;gap:16px}.admin-card{padding:clamp(18px,3vw,28px)}
.admin-card dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:14px 0}.admin-card dt{color:var(--muted);font-size:13px}.admin-card dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.admin-card.late{border-left:5px solid var(--bordeaux)}
.admin-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px}
.admin-actions select{width:auto;max-width:100%;min-height:50px}
.admin-stars{color:var(--bordeaux);font-size:20px;letter-spacing:2px}.admin-state{font-size:13px;font-weight:650;color:var(--brown)}
@media(max-width:640px){.admin-card dl{grid-template-columns:1fr}.admin-card dt{margin-top:6px}}
</style>
<script>
const statusEl = document.getElementById('admin-status');
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const labels = {
  pending: p => p.published ? 'Modifications à valider · l’ancienne version reste en ligne' : 'Nouveau profil à valider',
  approved: () => 'Publié dans l’annuaire',
  rejected: p => p.published ? 'Modifications refusées · la version précédente reste en ligne' : 'Non publié',
};
const fields = [
  ['Email de connexion', p => p.email], ['Email de contact', p => p.profile.contactEmail], ['Téléphone', p => p.profile.phone],
  ['Ville', p => p.profile.city], ['Région', p => p.profile.region], ['Zone de déplacement', p => p.profile.travelArea],
  ['Langues', p => p.profile.languages], ['Communauté déclarée', p => p.profile.community], ['Coutumes', p => p.profile.traditions],
  ['Expérience', p => p.profile.experience ? p.profile.experience + ' an(s)' : ''], ['Présentation', p => p.profile.bio],
  ['Prestations', p => p.profile.services],
  ['Rémunération', p => Number(p.profile.rate) > 0 ? euro.format(Number(p.profile.rate)) + ' (prix famille : ' + euro.format(Math.round(Number(p.profile.rate) * 100 / 0.85) / 100) + ')' : ''],
  ['Durée incluse', p => p.profile.duration], ['Conditions', p => p.profile.conditions],
  ['Mis à jour le', p => new Date(p.updatedAt).toLocaleString('fr-FR')],
];
function el(tag, text, className) { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; }
function render(profiles) {
  for (const key of ['pending', 'approved', 'rejected']) {
    const list = document.getElementById('list-' + key);
    const items = profiles.filter(p => p.status === key);
    list.replaceChildren(...(items.length ? items.map(card) : [el('p', 'Aucun profil.', 'muted')]));
  }
}
const requestStates = { sent: 'Transmise, réception pas encore confirmée', failed: 'Échec de l’envoi, à relancer à la main', pending: 'Envoi en cours' };
const LATE_MS = 48 * 3600 * 1000;
const isLate = r => r.status === 'sent' && !r.readAt && Date.now() - new Date(r.createdAt) > LATE_MS;
function requestState(r) {
  if (r.readAt) return 'Réception confirmée par le nzonzi le ' + new Date(r.readAt).toLocaleString('fr-FR');
  if (isLate(r)) return '⚠ Réception non confirmée depuis plus de 48 h · à relancer';
  return requestStates[r.status] || r.status;
}
function renderRequests(requests) {
  const list = document.getElementById('list-requests');
  list.replaceChildren(...(requests.length ? requests.map(r => {
    const article = el('article', '', 'panel admin-card');
    if (isLate(r) || r.status === 'failed') article.classList.add('late');
    article.append(el('span', requestState(r), 'admin-state'), el('h3', r.name + ' → ' + r.slug));
    const dl = document.createElement('dl');
    for (const [label, value] of [['Reçue le', new Date(r.createdAt).toLocaleString('fr-FR')], ['Email', r.email], ['Téléphone', r.phone], ['Ville', r.city], ['Lieu', r.venue], ['Adresse', r.address], ['Date', r.date], ['Message', r.message]]) if (value) dl.append(el('dt', label), el('dd', value));
    article.append(dl);
    return article;
  }) : [el('p', 'Aucune demande pour le moment.', 'muted')]));
}
const reviewStates = { pending: 'Avis à valider', approved: 'Publié sur la fiche', rejected: 'Refusé ou retiré' };
let reasons = [];
function renderReviews(data) {
  reasons = data.reasons || [];
  document.getElementById('invited-count').textContent = data.mail === false ? 'Emails désactivés (Brevo non configuré).' : (data.invited || 0) + ' invitation' + (data.invited > 1 ? 's' : '') + ' envoyée' + (data.invited > 1 ? 's' : '') + ', en attente de réponse.';
  const list = document.getElementById('list-reviews');
  const items = data.reviews || [];
  list.replaceChildren(...(items.length ? items.map(reviewCard) : [el('p', 'Aucun avis reçu pour le moment.', 'muted')]));
}
function reviewCard(r) {
  const article = el('article', '', 'panel admin-card');
  if (r.status === 'pending') article.classList.add('late');
  article.append(el('span', reviewStates[r.status] || r.status, 'admin-state'), el('h3', r.author + ' → ' + r.slug));
  const starsEl = el('p', '★★★★★'.slice(0, r.rating) + '☆☆☆☆☆'.slice(0, 5 - r.rating) + '  ' + r.rating + '/5', 'admin-stars');
  article.append(starsEl);
  const dl = document.createElement('dl');
  for (const [label, value] of [['Avis', r.comment], ['Famille', r.family + ' · ' + r.email], ['Cérémonie', r.ceremonyDate], ['Reçu le', r.submittedAt && new Date(r.submittedAt).toLocaleString('fr-FR')], ['Motif', r.rejectReason]]) if (value) dl.append(el('dt', label), el('dd', value));
  article.append(dl);
  const actions = el('div', '', 'admin-actions');
  if (r.status !== 'approved') { const b = el('button', 'Publier l’avis', 'btn'); b.type = 'button'; b.onclick = () => reviewAct(r, 'approve', b); actions.append(b); }
  if (r.status !== 'rejected') {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Motif du refus');
    select.append(new Option('Motif du refus…', ''), ...reasons.map((text, i) => new Option(text, String(i))));
    const b = el('button', r.status === 'approved' ? 'Retirer l’avis' : 'Refuser', 'btn secondary'); b.type = 'button';
    b.onclick = () => { if (select.value === '') { statusEl.textContent = 'Choisissez d’abord le motif du refus.'; select.focus(); return; } reviewAct(r, 'reject', b, Number(select.value)); };
    actions.append(select, b);
  }
  if (r.status === 'approved') { const link = el('a', 'Voir sur la fiche', 'btn secondary'); link.href = '/nzonzi/' + r.slug + '#avis'; link.target = '_blank'; actions.append(link); }
  article.append(actions);
  return article;
}
async function reviewAct(r, action, button, reason) {
  button.disabled = true; statusEl.textContent = 'Enregistrement…';
  try {
    const res = await fetch('/api/admin/avis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: r.reference, action, reason }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Action impossible.');
    await load(action === 'approve' ? 'Avis publié.' : 'Avis refusé, la famille est prévenue.');
  } catch (error) { statusEl.textContent = error.message; button.disabled = false; }
}
document.getElementById('send-invitations').onclick = async event => {
  const button = event.currentTarget; button.disabled = true; statusEl.textContent = 'Envoi des invitations…';
  try {
    const res = await fetch('/api/admin/avis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'invite' }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Envoi impossible.');
    await load(data.sent ? data.sent + ' invitation' + (data.sent > 1 ? 's' : '') + ' envoyée' + (data.sent > 1 ? 's.' : '.') : 'Aucune invitation à envoyer aujourd’hui.');
  } catch (error) { statusEl.textContent = error.message; }
  button.disabled = false;
};
function card(p) {
  const article = el('article', '', 'panel admin-card');
  article.append(el('span', labels[p.status](p), 'admin-state'), el('h3', [p.profile.firstName, p.profile.lastName].join(' ')));
  const dl = document.createElement('dl');
  for (const [label, read] of fields) { const value = read(p); if (value) dl.append(el('dt', label), el('dd', value)); }
  article.append(dl);
  const actions = el('div', '', 'admin-actions');
  const button = (text, action, secondary) => { const b = el('button', text, secondary ? 'btn secondary' : 'btn'); b.type = 'button'; b.onclick = () => act(p, action, b); actions.append(b); };
  if (p.status !== 'approved') button(p.published ? 'Valider les modifications' : 'Valider et publier', 'approve');
  if (p.status === 'pending') button(p.published ? 'Refuser les modifications' : 'Refuser', 'reject', true);
  if (p.published) button('Retirer de l’annuaire', 'unpublish', true);
  if (p.published && p.slug) { const link = el('a', 'Voir la fiche publique', 'btn secondary'); link.href = '/nzonzi/' + p.slug; link.target = '_blank'; actions.append(link); }
  article.append(actions);
  return article;
}
async function act(p, action, button) {
  if (action === 'unpublish' && !confirmRemoval(p)) return;
  button.disabled = true; statusEl.textContent = 'Enregistrement…';
  try {
    const r = await fetch('/api/admin/profils', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: p.userId, action, updatedAt: p.updatedAt }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Action impossible.');
    await load('Action enregistrée.');
  } catch (error) { statusEl.textContent = error.message; button.disabled = false; }
}
function confirmRemoval(p) { return window.confirm('Retirer ' + p.profile.firstName + ' ' + p.profile.lastName + ' de l’annuaire ?'); }
async function load(message) {
  try {
    const r = await fetch('/api/admin/profils', { cache: 'no-store' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Chargement impossible.');
    render(data.profiles);
    renderRequests(data.requests || []);
    let reviewsData = { reviews: [] };
    try { const rr = await fetch('/api/admin/avis', { cache: 'no-store' }); if (rr.ok) reviewsData = await rr.json(); } catch {}
    renderReviews(reviewsData);
    const pending = data.profiles.filter(p => p.status === 'pending').length;
    const late = (data.requests || []).filter(isLate).length;
    const pendingReviews = reviewsData.reviews.filter(r => r.status === 'pending').length;
    statusEl.textContent = (message ? message + ' ' : '') + pending + ' profil' + (pending > 1 ? 's' : '') + ' à valider.' + (pendingReviews ? ' ' + pendingReviews + ' avis à valider.' : '') + (late ? ' ' + late + ' demande' + (late > 1 ? 's' : '') + ' sans confirmation de réception depuis plus de 48 h.' : '');
  } catch (error) { statusEl.textContent = error.message || 'Chargement impossible. Rechargez la page.'; }
}
load();
</script>`);
}

// Pages de l'espace nzonzi : connexion, accès refusé, profil en 3 étapes.
export function spaceGatePage(kind) {
  const denied = kind === 'denied';
  return layout('Espace nzonzi', `<main id="main"><div class="shell gate">
  <p class="kicker">Espace nzonzi</p>
  <h1>${denied ? 'Votre accès <strong>n’est pas encore ouvert.</strong>' : 'Connectez-vous <strong>avec votre email.</strong>'}</h1>
  <p class="lead">${denied ? 'Ce compte ne peut pas encore créer de profil. Écrivez-nous ou connectez-vous avec une autre adresse.' : 'Vous recevrez un code par email. Pas de mot de passe à retenir.'}</p>
  <div class="hero-actions">${denied ? '<a class="btn" href="/cdn-cgi/access/logout">Changer de compte</a><a class="link" href="/">Retour au site</a>' : '<a class="btn" href="/partenaire">Recevoir mon code</a><a class="link" href="/">Retour au site</a>'}</div>
</div></main>`, { space: denied });
}

function partnerRequests(requests) {
  const intro = '<h2 id="requests-title">Mes <strong>demandes</strong></h2>';
  if (!requests) return `<section class="inbox" id="demandes" aria-labelledby="requests-title">${intro}<p class="note">Les familles pourront vous contacter dès que votre fiche sera en ligne.</p></section>`;
  const items = requests.map(r => {
    const when = r.ceremony_date ? ' · le ' + formatDate.format(new Date(r.ceremony_date)) : '';
    const place = r.ceremony_venue && r.ceremony_venue !== 'Pas encore défini' ? r.ceremony_venue + ' à ' + r.ceremony_city : r.ceremony_city + (r.ceremony_venue ? ' (lieu à définir)' : '');
    const email = escapeHtml(r.family_email);
    const phone = r.family_phone ? ` · <a class="link" href="tel:${escapeHtml(r.family_phone.replace(/[^+\d]/g, ''))}">${escapeHtml(r.family_phone)}</a>` : '';
    const read = r.read_at
      ? `<p class="request-read">Réception confirmée à la famille le ${formatDate.format(new Date(r.read_at))}</p>`
      : `<p class="request-read"><button type="button" class="btn secondary mark-read" data-ref="${escapeHtml(r.reference)}">Indiquer à la famille que j’ai reçu la demande</button><span class="note">La famille reçoit un email pour être rassurée.</span></p>`;
    return `<article class="request panel${r.read_at ? '' : ' unread'}"><div class="request-head"><h3>${escapeHtml(r.family_name)}</h3><span class="note">Reçue le ${formatDate.format(new Date(r.created_at))}</span></div>
      <p class="location">${icon('pin')}Cérémonie : ${escapeHtml(place)}${escapeHtml(when)}</p>
      ${r.ceremony_address ? `<p class="note request-address">Adresse : ${escapeHtml(r.ceremony_address)}</p>` : ''}
      <p class="request-message">${escapeHtml(r.message)}</p>
      <p class="request-contact"><a class="link" href="mailto:${email}">${email}</a>${phone}</p>${read}</article>`;
  }).join('');
  return `<section class="inbox" id="demandes" aria-labelledby="requests-title">${intro}
    <p class="note">Les familles qui vous contactent depuis votre fiche. Vous recevez aussi chaque demande par email. Elles restent ici 12 mois.</p>
    ${items || '<p class="result">Aucune demande pour le moment.</p>'}</section>
  <script>
  for (const button of document.querySelectorAll('.mark-read')) button.addEventListener('click', async () => {
    button.disabled = true;
    const box = button.closest('.request-read');
    const article = button.closest('.request');
    const note = box.querySelector('.note');
    try {
      const r = await fetch('/api/demandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: button.dataset.ref }) });
      if (!r.ok) throw new Error();
      article.classList.remove('unread');
      box.textContent = 'Réception confirmée à la famille aujourd’hui';
    } catch { button.disabled = false; note.textContent = 'Impossible pour le moment. Réessayez.'; }
  });
  </script>`;
}

export function partnerPage({ regions, photo = false, requests = null }) {
  const field = (label, name, attrs = '', extra = '') => `<label class="field${extra}"><span>${label}</span><input name="${name}" ${attrs}></label>`;
  const req = ' <span aria-hidden="true">*</span>';
  const opt = ' <span class="optional">(facultatif)</span>';
  return layout('Mon profil nzonzi', `<main class="space" id="main"><div class="shell">
  <div class="space-head">
    <p class="kicker">Espace nzonzi</p>
    <h1>Mon <strong>profil</strong></h1>
    <p class="lead">Remplissez votre fiche en 3 étapes. Nous la vérifions, puis elle apparaît dans l’annuaire.</p>
    <div id="publication-status" class="status" role="status" hidden></div>
  </div>
  <div class="space-grid">
    <form id="profile-form" class="panel" novalidate>
      <fieldset><legend><span>1</span>Vous</legend>
        <div id="photo-block" class="full"${photo ? '' : ' hidden'}>
          <label class="field" for="photo-file"><span>Photo${opt}</span><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <p class="note">JPEG, PNG ou WebP, 5 Mo maximum.</p>
          <button type="button" class="btn secondary" id="remove-photo" hidden>Retirer la photo</button>
        </div>
        ${field('Prénom' + req, 'firstName', 'maxlength="80" autocomplete="given-name" required')}
        ${field('Nom' + req, 'lastName', 'maxlength="80" autocomplete="family-name" required')}
        ${field('Email' + req, 'contactEmail', 'type="email" maxlength="200" autocomplete="email" required')}
        ${field('Téléphone' + opt, 'phone', 'type="tel" maxlength="40" autocomplete="tel"')}
        <p class="note full">Votre email et votre téléphone ne sont jamais affichés sur le site.</p>
        ${field('Ville' + req, 'city', 'maxlength="100" autocomplete="address-level2" required')}
        <label class="field"><span>Région${req}</span><select name="region" required><option value="">Choisir</option>${options(regions, '')}</select></label>
        ${field('Langues parlées' + req, 'languages', 'maxlength="250" placeholder="Ex. français, lingala, kikongo" required', ' full')}
      </fieldset>
      <fieldset><legend><span>2</span>Votre accompagnement</legend>
        <label class="field full"><span>Présentation${req}</span><textarea name="bio" maxlength="2000" required placeholder="Qui êtes-vous ? Comment accompagnez-vous les familles ?"></textarea></label>
        <label class="field full"><span>Prestations${opt}</span><textarea name="services" maxlength="2000" placeholder="Une prestation par ligne. Ex. Préparation avec la famille"></textarea></label>
        ${field('Coutumes que vous connaissez' + opt, 'traditions', 'maxlength="500"', ' full')}
        <label class="field full"><span>Communauté${opt}</span><input name="community" maxlength="200" aria-describedby="community-help"><span id="community-help" class="note">À indiquer seulement si vous le souhaitez. Elle sera affichée sur votre fiche publique.</span></label>
        ${field('Années d’expérience' + opt, 'experience', 'type="number" min="0" max="80" step="1" inputmode="numeric"')}
        ${field('Où vous déplacez-vous ?' + opt, 'travelArea', 'maxlength="250" placeholder="Ex. Île-de-France"')}
      </fieldset>
      <fieldset><legend><span>3</span>Votre tarif</legend>
        <label class="field"><span>Ce que vous souhaitez recevoir (€)${req}</span><input id="net" name="rate" type="number" min="1" max="100000" step="0.01" inputmode="decimal" required aria-describedby="calc-error"></label>
        ${field('Durée incluse' + opt, 'duration', 'maxlength="120" placeholder="Ex. 3 heures"')}
        <div class="price-box" aria-live="polite"><span>Prix affiché aux familles<br><span class="note">dont commission Mon Nzonzi (15 %) : <span id="fee-value">—</span></span></span><strong id="total-value">—</strong></div>
        <p id="calc-error" class="error full" role="alert" hidden>Indiquez un montant entre 1 € et 100 000 €.</p>
        <label class="field full"><span>Conditions${opt}</span><textarea name="conditions" maxlength="1500" placeholder="Frais de déplacement, disponibilités…"></textarea></label>
      </fieldset>
      <div class="save-row"><button id="save-profile" class="btn" type="submit" disabled>Enregistrer mon profil</button><p id="profile-status" role="status" aria-live="polite">Chargement…</p></div>
      <p class="note"><span aria-hidden="true">*</span> Champs obligatoires. En enregistrant votre profil, vous acceptez les <a class="link" href="/cgu" target="_blank">conditions d’utilisation</a> et la <a class="link" href="/confidentialite" target="_blank">politique de confidentialité</a>.</p>
    </form>
    <aside class="card preview" aria-label="Aperçu de votre fiche">
      <div class="card-image"><div class="profile-motion" data-tone="0"></div><img id="preview-photo" alt="" hidden><span class="badge preview-label">Aperçu</span></div>
      <div class="card-content">
        <h3 id="preview-name">Votre nom</h3>
        <p class="location" id="preview-location">Votre ville</p>
        <ul class="pills" id="preview-pills"><li>Vos langues</li></ul>
        <p id="preview-bio">Votre présentation apparaîtra ici.</p>
        <div class="card-bottom"><div><strong class="price" id="preview-rate">—</strong><small>Prix total</small></div></div>
      </div>
    </aside>
  </div>
  ${partnerRequests(requests)}
</div></main>
<script>
const fmt=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});const input=document.getElementById('net');function familyPrice(n){const net=Math.round(n*100);const total=Math.round(net/0.85);return {total:total/100,fee:(total-net)/100};}function validRate(val){const n=Number(val);return String(val).trim()!==''&&Number.isFinite(n)&&n>=1&&n<=100000&&Math.abs(n*100-Math.round(n*100))<0.000001;}function update(){const val=input.value;const valid=validRate(val);document.getElementById('calc-error').hidden=valid||String(val).trim()==='';input.setAttribute('aria-invalid',String(!valid&&String(val).trim()!==''));document.getElementById('total-value').textContent='—';document.getElementById('fee-value').textContent='—';if(!valid)return;const p=familyPrice(Number(val));document.getElementById('total-value').textContent=fmt.format(p.total);document.getElementById('fee-value').textContent=fmt.format(p.fee);}input.addEventListener('input',update);update();
const form=document.getElementById('profile-form');const status=document.getElementById('profile-status');const save=document.getElementById('save-profile');const pubBox=document.getElementById('publication-status');let ready=false;let pendingPhoto=null;let photoRemoved=false;let photoUrl=null;const photoInput=document.getElementById('photo-file');const removePhoto=document.getElementById('remove-photo');
function showPhoto(url){const im=document.getElementById('preview-photo');im.hidden=!url;if(url)im.src=url;else im.removeAttribute('src');removePhoto.hidden=!url;}
photoInput.onchange=()=>{const file=photoInput.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){status.textContent='Choisissez un JPEG, PNG ou WebP de 5 Mo maximum.';photoInput.value='';return;}pendingPhoto=file;photoRemoved=false;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(file);showPhoto(photoUrl);status.textContent='Photo choisie. Enregistrez pour la garder.';};
removePhoto.onclick=()=>{pendingPhoto=null;photoRemoved=true;photoInput.value='';showPhoto(null);status.textContent='La photo sera retirée à l’enregistrement.';};
function showPublication(st,published,slug){const msgs={pending:published?'Modifications en cours de vérification. Votre fiche actuelle reste en ligne.':'Profil envoyé. Nous le vérifions avant de le publier.',approved:'Votre profil est en ligne.',rejected:published?'Vos dernières modifications n’ont pas été retenues. Votre fiche précédente reste en ligne.':'Votre profil n’est pas publié pour le moment. Contactez-nous pour en savoir plus.'};pubBox.hidden=!msgs[st];pubBox.dataset.state=st||'';pubBox.textContent=msgs[st]||'';if(published&&slug){const a=document.createElement('a');a.className='link';a.href='/nzonzi/'+encodeURIComponent(slug);a.textContent='Voir ma fiche';pubBox.appendChild(a);}}
let pubState={published:false,slug:null};
function preview(){const d=Object.fromEntries(new FormData(form));document.getElementById('preview-name').textContent=[d.firstName,d.lastName].filter(Boolean).join(' ')||'Votre nom';document.getElementById('preview-location').textContent=[d.city,d.region].filter(Boolean).join(' · ')||'Votre ville';const tags=[(d.community||'').trim(),...String(d.languages||'').split(/[,;/]+/).map(t=>t.trim())].filter(Boolean);document.getElementById('preview-pills').replaceChildren(...(tags.length?tags:['Vos langues']).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));document.getElementById('preview-bio').textContent=d.bio?(d.bio.length>180?d.bio.slice(0,180)+'…':d.bio):'Votre présentation apparaîtra ici.';document.getElementById('preview-rate').textContent=validRate(d.rate)?fmt.format(familyPrice(Number(d.rate)).total):'—';}
form.addEventListener('input',()=>{preview();if(ready)status.textContent='Modifications non enregistrées.';});
async function loadProfile(){try{const r=await fetch('/api/profil',{cache:'no-store'});if(!r.ok)throw new Error();const data=await r.json();if(data.profile){for(const [key,value] of Object.entries(data.profile)){if(form.elements.namedItem(key))form.elements.namedItem(key).value=value;}}ready=true;save.disabled=false;preview();update();pubState={published:data.published,slug:data.slug};showPublication(data.status,data.published,data.slug);status.textContent=data.updatedAt?'Enregistré le '+new Date(data.updatedAt).toLocaleString('fr-FR')+'.':'';if(!document.getElementById('photo-block').hidden){const pr=await fetch('/api/photo',{cache:'no-store'});if(pr.ok){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(await pr.blob());showPhoto(photoUrl);}}}catch{status.textContent='Impossible de charger votre profil.';const retry=document.createElement('button');retry.type='button';retry.className='btn secondary';retry.textContent='Réessayer';retry.onclick=loadProfile;status.appendChild(retry);}}
form.onsubmit=async e=>{e.preventDefault();if(!ready)return;const missing=[...form.querySelectorAll('[required]')].find(el=>!el.value.trim());if(missing){status.textContent='Complétez les champs obligatoires (*).';missing.focus();return;}if(!validRate(input.value)){update();input.focus();return;}save.disabled=true;status.textContent='Enregistrement…';try{const r=await fetch('/api/profil',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries([...new FormData(form)].filter(([k])=>k!=='photo')))});const data=await r.json();if(!r.ok)throw new Error(data.error||'Enregistrement impossible.');if(pendingPhoto||photoRemoved){const photoResp=await fetch('/api/photo',{method:pendingPhoto?'PUT':'DELETE',headers:pendingPhoto?{'Content-Type':pendingPhoto.type}:{},body:pendingPhoto||undefined});if(!photoResp.ok)throw new Error('Profil enregistré, mais la photo n’a pas pu être sauvegardée. Réessayez.');pendingPhoto=null;photoRemoved=false;photoInput.value='';}status.textContent='Enregistré le '+new Date(data.updatedAt).toLocaleString('fr-FR')+'.';showPublication(data.status,pubState.published,pubState.slug);}catch(error){status.textContent=error.message||'Impossible d’enregistrer. Vos informations restent dans le formulaire.';}finally{save.disabled=false;}};
loadProfile();
</script>`, { space: true });
}
