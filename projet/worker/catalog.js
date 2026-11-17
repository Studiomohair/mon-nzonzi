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

const siteAssets = /* SITE_ASSETS */ {};
const siteAssetRoutes = new Map([
  ['/assets/mon-nzonzi.webp', ['mon-nzonzi.webp', 'image/webp']],
  ['/assets/playfair-display.woff2', ['playfair-display.woff2', 'font/woff2']],
  ['/assets/playfair-license.txt', ['playfair-license.txt', 'text/plain; charset=utf-8']],
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
function filterState(params, regions) {
  const region = params.get('region') || '';
  const community = params.get('communaute') || '';
  return {
    q: (params.get('q') || '').trim().slice(0, 100),
    region: regions.includes(region) ? region : '',
    communaute: demoProfiles.some(profile => profile.community === community) ? community : '',
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
  const initials = profile.name.split(' ').map(word => word[0]).join('');
  return `<div class="profile-motion" data-motion-profile="${profile.slug}" aria-hidden="true">
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
.profile-motion[data-motion-profile="patrick-ilunga"]{background:var(--ochre);color:var(--forest)}
.profile-motion[data-motion-profile="andre-mbuyi"]{background:var(--terracotta)}
.profile-motion svg{width:100%;height:100%;display:block}
.card .profile-motion svg{animation:monogram-in .95s ease-out both}
@supports(animation-timeline:view()){
  .card .profile-motion svg{animation-timeline:view();animation-range:entry 0% cover 26%}
}
.motion-orbits{opacity:.55;transition:transform .55s ease}
.card:hover .motion-orbits,.card:focus-within .motion-orbits{transform:rotate(8deg)}
.motion-monogram{font:600 32px var(--display);fill:var(--ink)}
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

const siteTheme = `
@font-face{font-family:"Playfair Display";src:url("/assets/playfair-display.woff2") format("woff2");font-style:normal;font-weight:400 900;font-display:swap}
:root{
  color-scheme:light;
  /* Palette « Style Apple · chocolat » : blanc, noir et marron. */
  --olive:#5C3A24;--forest:#111111;--cream:#EFE6DC;--ochre:#B08060;--terracotta:#6B4226;
  --paper:#ffffff;--ink:var(--forest);--muted:#6e6e73;--line:#e5e5ea;--field-border:#c7c7cc;
  --soft:#f5f5f7;--bg:#f5f5f7;--success:#efeff2;
  --brown:var(--forest);
  --stage:radial-gradient(ellipse at 50% 43%, #4a3020 0%, #1a110b 78%);
  --display:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Inter,Arial,sans-serif;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Inter,Arial,sans-serif;
}
.brand-logo{display:block;width:212px;max-width:100%;height:auto}
footer .brand-logo{width:172px;padding:7px 9px;border-radius:8px;background:var(--cream)}
@media(max-width:720px){.brand-logo{width:158px}}
`;

const catalogCss = siteTheme + motionCss + `
*{box-sizing:border-box}
html{scroll-padding-top:24px}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 var(--font)}
img{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3,.brand,.price{font-family:var(--display);font-weight:720;line-height:1.1;margin:0;letter-spacing:-.032em}
h1{font-size:clamp(48px,5.4vw,80px);letter-spacing:-.052em}
h2{font-size:clamp(33px,4vw,54px);letter-spacing:-.043em}
h3{font-size:24px}
p{margin:0}
svg{width:20px;height:20px;flex:none}
:focus-visible{outline:3px solid var(--brown);outline-offset:3px}
.skip{position:absolute;top:8px;left:8px;transform:translateY(-200%);z-index:3}
.skip:focus{transform:none}
.shell{width:min(1220px,calc(100% - 88px));margin-inline:auto}
.private{background:var(--ink);color:var(--paper);font-size:12px;padding:7px 0}
.private .shell{display:flex;justify-content:space-between;gap:16px}
.private span:first-child{display:flex;align-items:center;gap:7px}
.private svg{width:14px;height:14px}
.site-header{background:var(--paper)}
.site-header nav{min-height:76px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px}
.brand{display:inline-flex;align-items:center;gap:9px;width:max-content;text-decoration:none;font-size:25px;color:var(--ink);white-space:nowrap}
.nav-links{display:flex;gap:30px;align-items:center;font-size:14px;font-weight:650}
.nav-links>a{text-decoration:none}
.nav-links>a:hover,.link:hover{text-decoration:underline}
.nav-partner{justify-self:end}
.btn{display:inline-flex;justify-content:center;align-items:center;gap:10px;min-height:48px;padding:10px 21px;background:var(--ink);border:1px solid var(--ink);border-radius:999px;color:white;font:700 14px/1.3 var(--font);text-decoration:none;cursor:pointer}
.btn:hover{background:var(--olive);border-color:var(--olive)}
.btn.secondary{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.secondary:hover{background:var(--soft);border-color:var(--brown)}
.btn svg{width:18px;height:18px}
.hero{width:min(1408px,calc(100% - 36px));margin-inline:auto;background:var(--cream);border-radius:44px;padding:clamp(26px,4vw,57px) 0}
.hero .shell{width:calc(100% - clamp(46px,8.8vw,132px));display:grid;grid-template-columns:.94fr 1fr;gap:clamp(22px,4.5vw,70px);align-items:center}
.kicker{display:inline-flex;width:max-content;max-width:100%;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;background:var(--soft);color:var(--brown);font-size:11px;line-height:1.35;font-weight:760;letter-spacing:.085em;text-transform:uppercase;margin-bottom:14px}
.kicker:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--terracotta);flex:none}
.hero .kicker{background:var(--paper)}
.hero h1{max-width:13ch;text-wrap:balance}
.lead{margin:17px 0 23px;color:var(--muted);max-width:48ch}
.hero .lead{font-size:clamp(16px,1.35vw,19px)}
.hero-art{min-width:0;margin:0;position:relative;border-radius:31px;background:var(--stage);overflow:hidden;aspect-ratio:1.22}
.hero-art figcaption{position:absolute;bottom:15px;left:15px;border-radius:999px;background:var(--paper);padding:9px 14px;font-size:12px;color:var(--ink);font-weight:730}
.hero-art figcaption:before{content:'✦';color:var(--terracotta);margin-right:7px}
.motion-replay{position:absolute;right:14px;bottom:14px;display:grid;place-items:center;width:44px;height:44px;border:1px solid #fff9d78c;border-radius:50%;background:var(--forest);color:var(--cream);cursor:pointer}
.motion-replay:hover{background:var(--olive)}
.motion-replay:focus-visible{outline-color:var(--cream)}
@media(prefers-reduced-motion:reduce){.motion-replay{display:none}}

.directory{padding:67px 0 74px}
.section-heading{display:grid;justify-items:center;gap:10px;margin-bottom:26px;text-align:center}
.section-heading .kicker{margin-bottom:10px}
.section-heading>p{color:var(--muted);max-width:53ch}
.filters{display:grid;grid-template-columns:1.14fr 1fr 1fr auto;gap:12px;padding:16px 18px 18px;background:var(--bg);border:1px solid var(--line);border-radius:24px;align-items:end}
.field{display:grid;gap:6px;font-size:13px;font-weight:700;min-width:0}
input,select,textarea{width:100%;min-width:0;min-height:48px;border-radius:14px;border:1px solid var(--field-border);background:white;color:var(--ink);font:400 16px/1.4 var(--font);padding:10px 12px}
textarea{min-height:108px;resize:vertical}
input::placeholder{color:var(--muted)}
.searchbox{position:relative;display:block}
.searchbox svg{position:absolute;top:14px;left:11px;color:var(--muted);pointer-events:none}
.searchbox input{padding-left:39px}
.result-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;color:var(--muted);font-size:14px}
.link{color:var(--brown);font-weight:750;text-underline-offset:3px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.card,.panel{border-radius:28px;background:white}
.card{overflow:clip;display:flex;flex-direction:column;padding:11px;background:var(--card-tone,var(--cream))}
.card[data-profile="patrick-ilunga"]{--card-tone:color-mix(in srgb,var(--paper) 84%,var(--ochre))}
.card[data-profile="andre-mbuyi"]{--card-tone:var(--soft)}
.card-image{position:relative;background:var(--ochre);aspect-ratio:1.58;overflow:clip;border-radius:20px}
.badge{display:inline-flex;align-items:center;font-size:11px;font-weight:730;color:var(--ink);background:white;padding:5px 10px;border-radius:999px}
.card-image .badge{position:absolute;top:10px;left:10px}
.card-content{padding:16px 10px 8px;display:flex;flex-direction:column;flex:1}
.location{display:flex;align-items:flex-start;gap:6px;margin:7px 0 10px;font-size:13px;color:var(--muted)}
.location svg{width:17px;height:17px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.pills li{border-radius:999px;padding:4px 9px;font-size:12px;background:#ffffffb8}
.card-content>p:not(.location){color:var(--muted);font-size:14px;margin:12px 0 17px}
.card-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;border-top:1px solid #1111112e;padding-top:13px}
.price{display:block;font-size:25px}
.card-bottom small,.muted{color:var(--muted);font-size:12px}
.card-bottom .btn{padding-inline:12px;background:var(--ink);border-color:var(--ink);color:white}
.card-bottom .btn:hover{background:var(--olive)}
.panel{border:1px solid var(--line)}
.empty{padding:33px;text-align:center;background:var(--bg)}
.empty p{margin:10px 0 18px;color:var(--muted)}
.empty .link{display:inline-block;margin:10px}
.method{padding:0 0 70px;text-align:center}
.method .shell{background:var(--soft);border-radius:34px;padding:37px clamp(18px,4vw,53px)}
.method .kicker{background:white}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px;text-align:left}
.steps article{border-radius:23px;padding:18px;background:white}
.steps h3{margin:9px 0 7px;font-size:21px}
.steps p{color:var(--muted);font-size:14px}
.steps strong{display:inline-grid;place-items:center;min-width:34px;min-height:34px;border-radius:50%;background:var(--ochre);color:var(--forest);font-size:13px}
.steps article:first-child strong{background:var(--cream)}
.steps article:last-child strong{background:var(--olive);color:var(--cream)}
footer{background:var(--ink);color:var(--paper);padding:23px 0}
footer .shell{display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:13px}
footer .brand{color:white;font-size:22px}
footer a{text-underline-offset:3px}
.profile{padding:29px 0 62px}
.back{display:inline-flex;align-items:center;gap:7px;color:var(--brown);font-weight:750;font-size:14px;text-decoration:none;margin-bottom:20px}
.back:hover{text-decoration:underline}
.profile-head{display:grid;grid-template-columns:1fr 1.08fr;overflow:hidden;margin-bottom:18px;background:var(--soft);border:0;padding:12px}
.profile-head>div:first-child{background:var(--ochre);min-height:280px;position:relative;overflow:hidden;border-radius:21px}
.profile-intro{padding:clamp(22px,5vw,53px);align-self:center}
.profile-intro h1{margin-top:10px;font-size:clamp(38px,5.2vw,69px)}
.profile-intro .lead{margin-bottom:0}
.profile-layout{display:grid;grid-template-columns:1.12fr 1fr;gap:18px;align-items:start}
.profile-layout .panel{padding:clamp(19px,3vw,30px)}
.profile-layout h2{font-size:clamp(25px,3vw,36px)}
.details h2{margin-bottom:12px}
.details h3{margin:24px 0 8px}
.details ul:not(.pills){padding-left:19px}
.details li+li{margin-top:3px}
.details p,.contact>p{color:var(--muted)}
.contact{background:var(--bg)}
.contact h2{margin:6px 0 10px}
.contact .price{color:var(--ink);font-size:40px}
.contact form{display:grid;gap:13px;border-top:1px solid var(--line);margin-top:18px;padding-top:17px}
.contact .btn{justify-self:start}
.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.feedback{margin-top:15px;padding:12px 14px;background:var(--success);border:1px solid #d1d1d6;border-radius:14px}
.feedback p+p{margin-top:6px}
.feedback.error{background:var(--cream);border-color:var(--terracotta)}
@media(max-width:950px){
  .shell{width:calc(100% - 48px)}
  .hero .shell{width:calc(100% - 52px)}
  .hero h1{font-size:clamp(40px,6.8vw,61px)}
  .filters{grid-template-columns:1fr 1fr}
  .cards{gap:12px}
  .card-content{padding-inline:5px}
  .card-bottom .btn svg{display:none}
  .nav-links{gap:18px}
}
@media(max-width:720px){
  .shell{width:calc(100% - 36px)}
  .site-header nav{display:flex;justify-content:space-between;min-height:63px;gap:10px}
  .private .shell{justify-content:center}
  .private span:last-child,.nav-links,.nav-partner svg{display:none}
  .brand{font-size:21px;gap:6px}
  .nav-partner{padding-inline:12px;font-size:12px}
  .hero{width:calc(100% - 20px);border-radius:29px;padding:24px 0 11px}
  .hero .shell{width:calc(100% - 22px);grid-template-columns:1fr;gap:22px}
  .hero-copy{padding:0 8px;text-align:center}
  .hero h1,.hero .lead{margin-inline:auto}
  .hero h1{font-size:clamp(40px,10vw,58px)}
  .hero-art{aspect-ratio:1.28;border-radius:20px}
  .hero-art figcaption{font-size:10px;bottom:10px;left:8px;padding:7px 10px}.motion-replay{right:8px;bottom:8px}
  .directory{padding:41px 0 48px}
  .method{padding-bottom:45px}
  .method .shell{border-radius:27px;padding-top:26px;padding-bottom:20px}
  .section-heading{margin-bottom:20px}
  .filters,.profile-head,.profile-layout,.cards,.steps{grid-template-columns:1fr}
  .filters{padding:13px}
  .filters .btn{justify-self:start}
  .card-content{padding-inline:10px}
  .card-bottom .btn svg{display:block}
  .profile-head>div:first-child{min-height:0;aspect-ratio:1.58}
  .profile{padding-top:17px}
  .steps{gap:9px}
  footer .shell{flex-wrap:wrap}
}
@media(max-width:375px){.two-fields{grid-template-columns:1fr}.hero h1{font-size:37px}}
`;

const companionCss = siteTheme + motionCss + `
body{font-family:var(--font);line-height:1.55}
h1,h2,h3,.brand,.amount,.commission,.quote,.art-caption{font-family:var(--display);font-weight:720;letter-spacing:-.032em}
header{background:var(--paper)}
.button,button{border-radius:999px;font-family:var(--font);background:var(--ink);border-color:var(--ink)}
.button:hover,button:hover{background:var(--olive);border-color:var(--olive)}
.secondary,.tabs button{background:transparent;color:var(--ink);border-color:var(--line)}
.secondary:hover,.tabs button:hover{background:var(--soft)}
.tabs button[aria-selected=true]{background:var(--ink);color:white}
input,select,textarea{border-radius:14px;border-color:var(--field-border);font-family:var(--font)}
form,.empty,.calc,.metric,.result{border-radius:24px}
.hero,.service,.faq,main>section:first-child{background:var(--soft)}
.art{border-radius:29px;background:var(--stage);isolation:isolate}
.art-caption{border-radius:16px}
.metric,.result{border-color:var(--line)}
.number{color:var(--terracotta)}
#demandes-demo .result{background:var(--soft)}
`;

export function applySiteTheme(html) {
  return html
    .replace('</style>', () => companionCss + '</style>')
    .replaceAll('<!-- BRAND_LOGO -->', brandLogo)
    .replace(/<div class="art" role="img"[^>]*>[\s\S]*?<\/svg><div class="art-caption">/, () =>
      '<div class="art">' + motionScene + '<div class="art-caption">');
}

function layout(title, main) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} · Mon Nzonzi</title>
<style>${catalogCss}</style>
</head>
<body>
<a href="#main" class="skip btn">Aller au contenu</a>
<div class="private"><div class="shell"><span>${icon('lock')} Prototype privé</span><span>Les profils et demandes sont fictifs</span></div></div>
<header class="site-header"><nav class="shell" aria-label="Navigation principale">
  <a class="brand" href="/" aria-label="Mon Nzonzi, accueil">${brandLogo()}</a>
  <div class="nav-links">
    <a href="/#nzonzi">Les profils</a>
    <a href="/#comment">Comment ça marche</a>
  </div>
  <a class="btn secondary nav-partner" href="/partenaire">${icon('lock')} Espace nzonzi</a>
</nav></header>
${main}
<footer><div class="shell"><a class="brand" href="/">${brandLogo()}</a><span>Une parole qui rassemble</span><a href="/presentation#histoire">Notre histoire</a></div></footer>
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
    <div class="card-image">${profileMotion(profile)}<span class="badge">Profil de démo</span></div>
    <div class="card-content"><h3>${escapeHtml(profile.name)}</h3>${location(profile)}
    ${pills([profile.community, ...profile.languages])}
    <p>${escapeHtml(profile.summary)}</p>
    <div class="card-bottom"><div><strong class="price">${profilePrice(profile)}</strong><small>Commission incluse</small></div>
    <a class="btn secondary" aria-label="Voir le profil de ${escapeHtml(profile.name)}" href="/nzonzi/${profile.slug}${query}">Voir le profil ${icon('arrow')}</a></div></div>
  </article>`;
}
function directoryPage(filters, regions) {
  const { q, region, communaute } = filters;
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const filtered = demoProfiles.filter(profile => {
    const searchable = normalize([profile.name, profile.city, profile.region, profile.community, ...profile.languages].join(' '));
    return (!region || profile.region === region) && (!communaute || profile.community === communaute)
      && words.every(word => searchable.includes(word));
  });
  const query = filterQuery(filters);
  const communities = [...new Set(demoProfiles.map(profile => profile.community))].sort();
  return layout('Trouver un nzonzi pour votre cérémonie de dot', `<main id="main">
<section class="hero" aria-labelledby="hero-title"><div class="shell">
  <div class="hero-copy"><p class="kicker">Deux familles, une rencontre</p>
  <h1 id="hero-title">Trouvez le nzonzi de votre famille.</h1>
  <p class="lead">Préparez votre cérémonie de dot avec un porte-parole qui connaît vos langues et vos coutumes.</p>
  <a class="btn" href="#nzonzi">Trouver un nzonzi ${icon('arrow')}</a></div>
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
  <div class="section-heading"><div><p class="kicker">Le répertoire</p><h2 id="directory-title">Rencontrez les nzonzi</h2></div><p>Comparez les langues, les prestations et le tarif total de chaque profil de démonstration.</p></div>
  <form class="filters" role="search" action="/#nzonzi" method="get" aria-label="Rechercher un nzonzi">
    <label class="field field-search">Mot-clé<span class="searchbox">${icon('search')}<input name="q" type="search" maxlength="100" placeholder="Nom, ville ou langue" value="${escapeHtml(q)}"></span></label>
    <label class="field">Région<select name="region"><option value="">Toutes les régions</option>${options(regions, region)}</select></label>
    <label class="field">Ethnie ou communauté<select name="communaute"><option value="">Toutes les communautés</option>${options(communities, communaute)}</select></label>
    <button type="submit" class="btn">Rechercher ${icon('arrow')}</button>
  </form>
  <div class="result-bar"><span>${filtered.length} profil${filtered.length === 1 ? '' : 's'} ${filtered.length === 1 ? 'trouvé' : 'trouvés'}</span>${query ? '<a class="link" href="/#nzonzi">Réinitialiser les filtres</a>' : ''}</div>
  ${filtered.length ? `<div class="cards">${filtered.map(profile => card(profile, query)).join('')}</div>` : '<div class="panel empty"><h3>Aucun profil pour ces critères</h3><p>Modifiez un filtre ou essayez une autre ville ou langue.</p><a class="btn secondary" href="/#nzonzi">Voir tous les profils</a> <a class="link" href="/presentation#demande">Préparer une demande générale</a></div>'}
</div></section>
<section class="method" id="comment" aria-labelledby="method-title"><div class="shell">
  <p class="kicker">Votre cérémonie, pas à pas</p><h2 id="method-title">Comment ça marche ?</h2>
  <div class="steps">
    <article><strong>01</strong><h3>Recherchez un profil</h3><p>Choisissez une région, une communauté ou une langue qui compte pour vos familles.</p></article>
    <article><strong>02</strong><h3>Consultez la fiche</h3><p>Découvrez le rôle du nzonzi, ses prestations et le tarif, commission comprise.</p></article>
    <article><strong>03</strong><h3>Testez la prise de contact</h3><p>Envoyez une demande fictive et retrouvez-la dans l’espace nzonzi de démonstration.</p></article>
  </div>
</div></section>
</main>`);
}

function profilePage(profile, query, state = {}) {
  const url = '/nzonzi/' + profile.slug + query;
  const values = state.values || {};
  const feedback = state.receipt
    ? '<div class="feedback" role="status"><p><strong>Demande de démonstration enregistrée.</strong></p><p>Retrouvez-la dans <a class="link" href="/partenaire#demandes-demo">l’espace nzonzi</a>.</p></div>'
    : state.error ? `<div class="feedback error" role="alert">${escapeHtml(state.error)}</div>` : '';
  return layout(profile.name, `<main class="profile" id="main"><div class="shell">
    <a class="back" href="/${query}#nzonzi">${icon('back')} Retour aux profils</a>
    <section class="panel profile-head" aria-labelledby="profile-name">
      <div>${profileMotion(profile)}</div>
      <div class="profile-intro"><span class="badge">Profil de démonstration</span><h1 id="profile-name">${escapeHtml(profile.name)}</h1>
      ${location(profile)}${pills([profile.community, ...profile.languages])}<p class="lead">${escapeHtml(profile.summary)}</p></div>
    </section>
    <div class="profile-layout">
      <section class="panel details"><h2>À propos</h2><p>${escapeHtml(profile.bio)}</p>
        <h3>Prestations</h3><ul>${profile.services.map(service => `<li>${escapeHtml(service)}</li>`).join('')}</ul>
        <h3>Zone de déplacement</h3><p>${escapeHtml(profile.travel)}</p>
      </section>
      <section class="panel contact" id="contact" aria-labelledby="contact-title">
        <p class="kicker">Tarif de la prestation</p><strong class="price">${profilePrice(profile)}</strong>
        <p>Commission incluse. Déplacements à convenir.</p>
        ${feedback}
        <form method="post" action="${url}#contact">
          <h2 id="contact-title">Faire une demande de démo</h2>
          <p class="muted">Utilisez des informations fictives. La demande apparaît dans l’espace nzonzi de ce prototype.</p>
          <input type="hidden" name="reference" value="${values.reference || crypto.randomUUID()}">
          <div class="two-fields">
            <label class="field">Ville de la cérémonie<input name="ville" maxlength="100" required value="${escapeHtml(values.city || '')}"></label>
            <label class="field">Date envisagée <span class="muted">(facultative)</span><input type="date" name="date" value="${escapeHtml(values.date || '')}"></label>
          </div>
          <label class="field">Votre message<textarea name="message" maxlength="500" required placeholder="Ex. Nous préparons une cérémonie de dot.">
${escapeHtml(values.message || '')}</textarea></label>
          <button class="btn" type="submit">Enregistrer la demande ${icon('arrow')}</button>
        </form>
      </section>
    </div>
  </div></main>`);
}

async function saveDemoRequest(request, env, profile, query) {
  const userId = request.headers.get('oai-authenticated-user-id');
  if (!userId) return catalogResponse(profilePage(profile, query, { error: 'Connectez-vous à votre compte ChatGPT pour enregistrer une demande.' }), 401);
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
  if (!rows.length) return '<p class="result">Aucune demande de démonstration. <a href="/#nzonzi">Testez la prise de contact depuis un profil.</a></p>';
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
  const filters = filterState(url.searchParams, regions);
  if (pathname === '/' || pathname === '/index.html') {
    if (!isRead) return new Response(null, { status: 405, headers: catalogHeaders });
    return catalogResponse(request.method === 'HEAD' ? null : directoryPage(filters, regions));
  }
  if (!pathname.startsWith('/nzonzi/')) return null;
  const profile = demoProfiles.find(entry => pathname === '/nzonzi/' + entry.slug);
  if (!profile) return catalogResponse(request.method === 'HEAD' ? null : layout('Profil introuvable', '<main class="profile" id="main"><div class="shell"><h1>Profil introuvable</h1><a class="back" href="/#nzonzi">Retour aux profils</a></div></main>'), 404);
  const query = filterQuery(filters);
  if (request.method === 'POST') return saveDemoRequest(request, env, profile, query);
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
