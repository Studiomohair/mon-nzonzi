const demoProfiles = [
  {
    slug: 'jean-mavungu', name: 'Jean Mavungu', city: 'Saint-Denis', region: 'Île-de-France',
    community: 'Kongo', languages: ['Français', 'Lingala', 'Kikongo'], net: 255,
    summary: 'Un accompagnement de la première rencontre à la prise de parole le jour de la dot.',
    bio: 'Je commence par écouter les deux familles pour comprendre leurs attentes. Nous préparons les prises de parole et les étapes de la rencontre ensemble, en respectant les usages de chacun.',
    services: ['Échange de préparation avec la famille', 'Préparation du déroulé et des prises de parole', 'Accompagnement le jour de la cérémonie'],
    travel: 'Île-de-France · Déplacements à convenir',
  },
  {
    slug: 'patrick-ilunga', name: 'Patrick Ilunga', city: 'Lyon', region: 'Auvergne-Rhône-Alpes',
    community: 'Luba', languages: ['Français', 'Tshiluba', 'Lingala'], net: 340,
    summary: 'Une médiation attentive pour préparer le dialogue entre les familles et clarifier le déroulé.',
    bio: 'J’aide les familles à mettre leurs attentes en commun avant la cérémonie. Je prends le temps d’expliquer le déroulé et de préparer une prise de parole que chacun peut suivre.',
    services: ['Appel de préparation avec la famille', 'Coordination des échanges', 'Prise de parole lors de la dot'],
    travel: 'Lyon et sa région · Déplacements à convenir',
  },
  {
    slug: 'andre-mbuyi', name: 'André Mbuyi', city: 'Lille', region: 'Hauts-de-France',
    community: 'Mongo', languages: ['Français', 'Lingala'], net: 170,
    summary: 'Un interlocuteur pour préparer la rencontre et porter la parole de votre famille.',
    bio: 'Nous fixons ensemble le rôle que vous souhaitez me confier. Je peux vous aider à préparer les échanges en amont et à trouver les bons mots pendant la rencontre.',
    services: ['Échange de cadrage', 'Préparation du discours familial', 'Médiation pendant la rencontre'],
    travel: 'Métropole lilloise · Déplacements à convenir',
  },
];

// Les profils fictifs ne s'affichent que si SHOW_DEMO_PROFILES vaut "true" (tests, démonstration).
// Les vrais profils n'apparaissent qu'après validation (colonne published_json).
async function listedProfiles(env) {
  const demo = env?.SHOW_DEMO_PROFILES === 'true' ? demoProfiles : [];
  return [...demo, ...await publishedProfiles(env)];
}
async function publishedProfiles(env) {
  if (!env?.DB) return [];
  try {
    const { results } = await env.DB.prepare('SELECT slug, published_json FROM nzozi_profiles WHERE published_json IS NOT NULL AND slug IS NOT NULL ORDER BY reviewed_at DESC LIMIT 500').bind().all();
    return results.map(row => publicProfile(row.slug, JSON.parse(row.published_json)));
  } catch {
    return [];
  }
}
const splitList = (value, pattern) => String(value || '').split(pattern).map(item => item.trim()).filter(Boolean);
const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
// Seules ces informations sont publiques : jamais l'email ni le téléphone.
function publicProfile(slug, data) {
  const bio = String(data.bio || '').trim();
  return {
    slug, real: true,
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
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};
function catalogResponse(html, status = 200) {
  return new Response(html, { status, headers: { ...catalogHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

function brandLogo() {
  return siteAssets['mon-nzonzi.webp']
    ? '<img class="brand-logo" src="/assets/mon-nzonzi.webp" alt="Mon Nzonzi" width="680" height="100">'
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
.brand-logo{display:block;width:200px;max-width:100%;height:auto}
footer .brand-logo{width:164px;padding:8px 10px;border-radius:10px;background:var(--blanc)}
@media(max-width:720px){.brand-logo{width:150px}}
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
.private{background:var(--olive);color:var(--card);font-size:13px;padding:7px 0}
.private .shell{display:flex;justify-content:space-between;gap:16px}
.private span:first-child{display:flex;align-items:center;gap:7px}
.private svg{width:14px;height:14px}
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
.inbox{margin-top:40px}
.inbox h2{font-size:30px;margin-bottom:12px}
.result{display:block;margin-top:12px;padding:16px 18px;border-radius:14px;background:var(--blanc)}
.gate{max-width:640px;padding:64px 0 96px}
.gate h1{font-size:clamp(36px,4.4vw,56px);margin-top:10px}
.gate .hero-actions .link{color:var(--bordeaux)}
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
  .private .shell{justify-content:center}
  .private span:last-child{display:none}
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
  .join .btn{width:100%}
}
@media(max-width:375px){.two-fields{grid-template-columns:1fr}.hero h1{font-size:38px}}
`;

const companionCss = siteTheme + motionCss + `
body{font-family:var(--font);line-height:1.6;background:var(--paper);color:var(--ink)}
h1,h2,h3,.brand,.amount,.commission,.quote,.art-caption{font-family:var(--display);font-weight:400;letter-spacing:-.02em}
header{background:var(--paper)}
.button,button{border-radius:999px;font-family:var(--font);background:var(--bordeaux);border-color:var(--bordeaux)}
.button:hover,button:hover{background:var(--bordeaux-dark);border-color:var(--bordeaux-dark)}
.secondary,.tabs button{background:transparent;color:var(--ink);border-color:var(--ink)}
.secondary:hover,.tabs button:hover{background:var(--blanc)}
.tabs button[aria-selected=true]{background:var(--ink);color:white}
input,select,textarea{border-radius:12px;border-color:var(--field-border);font-family:var(--font)}
form,.empty,.calc,.metric,.result{border-radius:22px}
.hero,.service,.faq,main>section:first-child{background:var(--blanc)}
.art{border-radius:26px;background:var(--stage);isolation:isolate}
.art-caption{border-radius:14px}
.metric,.result{border-color:var(--line)}
.number{color:var(--bordeaux)}
`;

export function applySiteTheme(html) {
  return html
    .replace('</style>', () => companionCss + '</style>')
    .replaceAll('<!-- BRAND_LOGO -->', brandLogo)
    .replace(/<div class="art" role="img"[^>]*>[\s\S]*?<\/svg><div class="art-caption">/, () =>
      '<div class="art">' + motionScene + '<div class="art-caption">');
}

// options.demo : bandeau « profils fictifs » ; options.space : navigation de l'espace nzonzi.
function layout(title, main, options = {}) {
  const { demo = false, space = false } = typeof options === 'boolean' ? { demo: options } : options;
  const links = space
    ? `<a href="/">Voir les nzonzi</a><a class="btn secondary" href="/cdn-cgi/access/logout">Se déconnecter</a>`
    : `<a href="/#nzonzi">Les nzonzi</a><a href="/#comment">Comment ça marche</a><a class="btn secondary nav-partner" href="/partenaire">Vous êtes nzonzi ?</a>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#382D20">
<title>${escapeHtml(title)} · Mon Nzonzi</title>
<link rel="preload" href="/assets/outfit.woff2" as="font" type="font/woff2" crossorigin>
<style>${catalogCss}</style>
</head>
<body>
<a href="#main" class="skip btn">Aller au contenu</a>
${demo ? `<div class="private"><div class="shell"><span>${icon('lock')} Prototype privé</span><span>Les profils et demandes sont fictifs</span></div></div>` : ''}
<header class="site-header"><nav class="shell" aria-label="Navigation principale">
  <a class="brand" href="/" aria-label="Mon Nzonzi, accueil">${brandLogo()}</a>
  <div class="nav-links">${links}</div>
</nav></header>
${main}
<footer><div class="shell"><a class="brand" href="/" aria-label="Mon Nzonzi, accueil">${brandLogo()}</a><span>Une parole qui rassemble.</span><a href="/partenaire">Espace nzonzi</a></div></footer>
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
    <div class="card-image">${profileMotion(profile)}${profile.real ? '' : '<span class="badge">Profil de démo</span>'}</div>
    <div class="card-content"><h3><a href="/nzonzi/${profile.slug}${query}">${escapeHtml(profile.name)}</a></h3>${location(profile)}
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
<section class="join" aria-labelledby="join-title"><div class="shell">
  <div><h2 id="join-title">Vous êtes <strong>nzonzi ?</strong></h2><p>Créez votre profil gratuitement. Il apparaît dans l’annuaire après notre validation.</p></div>
  <a class="btn light" href="/partenaire">Créer mon profil ${icon('arrow')}</a>
</div></section>
</main>`, { demo: profiles.some(profile => !profile.real) });
}

function realContact(profile) {
  return `<section class="panel contact" id="contact" aria-labelledby="contact-title">
        <p class="kicker">Prix total</p><strong class="price">${profilePrice(profile)}</strong>
        <p>Commission incluse.${profile.duration ? ' Durée : ' + escapeHtml(profile.duration) + '.' : ''} Déplacements à convenir.</p>
        <h2 id="contact-title">Contacter ${escapeHtml(profile.name.split(' ')[0])}</h2>
        <p class="muted">La prise de contact en ligne ouvre très bientôt.</p>
      </section>`;
}
function realDetails(profile) {
  const block = (title, value) => value ? `<h3>${title}</h3><p>${escapeHtml(value)}</p>` : '';
  return `${profile.services.length ? `<h3>Prestations</h3><ul>${profile.services.map(service => `<li>${escapeHtml(service)}</li>`).join('')}</ul>` : ''}
        ${block('Coutumes', profile.traditions)}
        ${block('Expérience', profile.experience ? profile.experience + (profile.experience === '1' ? ' an' : ' ans') : '')}
        <h3>Se déplace</h3><p>${escapeHtml(profile.travel)}</p>
        ${block('Conditions', profile.conditions)}`;
}

function profilePage(profile, query, state = {}) {
  const url = '/nzonzi/' + profile.slug + query;
  const values = state.values || {};
  const feedback = state.receipt
    ? '<div class="feedback" role="status"><p><strong>Demande de démonstration enregistrée.</strong></p><p>Retrouvez-la dans <a class="link" href="/partenaire#demandes-demo">l’espace nzonzi</a>.</p></div>'
    : state.error ? `<div class="feedback error" role="alert">${escapeHtml(state.error)}</div>` : '';
  return layout(profile.name, `<main class="profile" id="main"><div class="shell">
    <a class="back" href="/${query}#nzonzi">${icon('back')} Tous les nzonzi</a>
    <section class="panel profile-head" aria-labelledby="profile-name">
      <div>${profileMotion(profile)}</div>
      <div class="profile-intro">${profile.real ? '' : '<span class="badge">Profil de démonstration</span>'}<h1 id="profile-name">${escapeHtml(profile.name)}</h1>
      ${location(profile)}${pills([profile.community, ...profile.languages].filter(Boolean))}<p class="lead">${escapeHtml(profile.summary)}</p></div>
    </section>
    <div class="profile-layout">
      <section class="panel details"><h2>Présentation</h2><p>${escapeHtml(profile.bio)}</p>
        ${profile.real ? realDetails(profile) : `<h3>Prestations</h3><ul>${profile.services.map(service => `<li>${escapeHtml(service)}</li>`).join('')}</ul>
        <h3>Se déplace</h3><p>${escapeHtml(profile.travel)}</p>`}
      </section>
      ${profile.real ? realContact(profile) : `<section class="panel contact" id="contact" aria-labelledby="contact-title">
        <p class="kicker">Prix total</p><strong class="price">${profilePrice(profile)}</strong>
        <p>Commission incluse. Déplacements à convenir.</p>
        ${feedback}
        <form method="post" action="${url}#contact">
          <h2 id="contact-title">Demande de démo</h2>
          <p class="muted">Utilisez des informations fictives. La demande apparaît dans l’espace nzonzi de ce prototype.</p>
          <input type="hidden" name="reference" value="${values.reference || crypto.randomUUID()}">
          <div class="two-fields">
            <label class="field">Ville de la cérémonie<input name="ville" maxlength="100" required value="${escapeHtml(values.city || '')}"></label>
            <label class="field"><span>Date <span class="optional">(facultatif)</span></span><input type="date" name="date" value="${escapeHtml(values.date || '')}"></label>
          </div>
          <label class="field">Votre message<textarea name="message" maxlength="500" required placeholder="Ex. Nous préparons une cérémonie de dot.">
${escapeHtml(values.message || '')}</textarea></label>
          <button class="btn" type="submit">Envoyer ${icon('arrow')}</button>
        </form>
      </section>`}
    </div>
  </div></main>`, { demo: !profile.real });
}

async function saveDemoRequest(request, env, profile, query) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) return catalogResponse(profilePage(profile, query, { error: 'Connectez-vous pour enregistrer une demande de démonstration.' }), 401);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return catalogResponse(profilePage(profile, query, { error: 'Origine de la demande non autorisée.' }), 403);
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('application/x-www-form-urlencoded')) return new Response(null, { status: 415, headers: catalogHeaders });
  const body = await request.text();
  if (body.length > 9000) return new Response(null, { status: 413, headers: catalogHeaders });
  const fields = new URLSearchParams(body);
  const reference = fields.get('reference') || '';
  const city = (fields.get('ville') || '').trim();
  const date = (fields.get('date') || '').trim();
  const message = (fields.get('message') || '').trim();
  const values = { reference: safeId.test(reference) ? reference : undefined, city: city.slice(0, 100), date, message: message.slice(0, 500) };
  const showError = (error, status) => catalogResponse(profilePage(profile, query, { values, error }), status);
  const validDate = !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
  if (!values.reference || !city || city.length > 100 || !validDate || !message || message.length > 500) return showError('Vérifiez la ville, la date et le message, puis réessayez.', 400);
  try {
    await env.DB.prepare('INSERT INTO demo_requests (user_id, reference, profile_slug, ceremony_city, ceremony_date, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, reference) DO NOTHING')
      .bind(userId, reference, profile.slug, city, date, message, new Date().toISOString()).run();
  } catch {
    return showError('La demande n’a pas pu être enregistrée. Réessayez dans quelques instants.', 503);
  }
  const next = new URLSearchParams(new URL(request.url).search);
  next.set('demande', reference);
  return new Response(null, { status: 303, headers: { ...catalogHeaders, Location: '/nzonzi/' + profile.slug + '?' + next + '#contact' } });
}

export async function renderDemoInbox(env, userId) {
  let rows;
  try {
    ({ results: rows } = await env.DB.prepare('SELECT profile_slug, ceremony_city, ceremony_date, message, created_at FROM demo_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 12').bind(userId).all());
  } catch {
    return '<p class="result" role="status">Les demandes sont temporairement indisponibles.</p>';
  }
  if (!rows.length) return '';
  return rows.map(row => {
    const name = demoProfiles.find(profile => profile.slug === row.profile_slug)?.name || 'Profil de démonstration';
    const date = row.ceremony_date ? ' · Cérémonie le ' + formatDate.format(new Date(row.ceremony_date)) : '';
    return `<article class="result"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(row.ceremony_city)}${date}<br><small>Reçue le ${formatDate.format(new Date(row.created_at))}</small><br>${escapeHtml(row.message)}</article>`;
  }).join('');
}

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
  if (request.method === 'POST' && !profile.real) return saveDemoRequest(request, env, profile, query);
  if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
  if (request.method === 'HEAD') return catalogResponse(null);
  const reference = url.searchParams.get('demande') || '';
  const userId = request.headers.get('oai-authenticated-user-id');
  let receipt = false;
  if (userId && safeId.test(reference)) {
    try {
      receipt = Boolean(await env.DB.prepare('SELECT reference FROM demo_requests WHERE user_id = ? AND reference = ? AND profile_slug = ?').bind(userId, reference, profile.slug).first());
    } catch {
      return catalogResponse(profilePage(profile, query, { error: 'Le reçu est temporairement indisponible. Retrouvez la demande dans l’espace nzonzi.' }), 503);
    }
  }
  return catalogResponse(profilePage(profile, query, { receipt }));
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
</div></main>
<style>
.admin h1{margin:14px 0 10px}.admin section{margin-top:34px}.admin h2{margin-bottom:14px}
.admin-list{display:grid;gap:16px}.admin-card{padding:clamp(18px,3vw,28px)}
.admin-card dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:14px 0}.admin-card dt{color:var(--muted);font-size:13px}.admin-card dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.admin-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.admin-state{font-size:13px;font-weight:650;color:var(--brown)}
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
    const pending = data.profiles.filter(p => p.status === 'pending').length;
    statusEl.textContent = (message ? message + ' ' : '') + pending + ' profil' + (pending > 1 ? 's' : '') + ' à valider.';
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

export function partnerPage({ regions, photo = false, inbox = '' }) {
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
        <label class="field full"><span>Communauté${opt}</span><input name="community" maxlength="200" aria-describedby="community-help"><span id="community-help" class="note">À indiquer seulement si vous le souhaitez.</span></label>
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
      <p class="note"><span aria-hidden="true">*</span> Champs obligatoires</p>
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
  ${inbox ? `<section class="inbox" id="demandes-demo" aria-labelledby="inbox-title"><h2 id="inbox-title">Demandes de démonstration</h2><p class="note">Demandes fictives créées avec ce compte.</p>${inbox}</section>` : ''}
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
