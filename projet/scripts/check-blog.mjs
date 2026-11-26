// Blog pédagogique : pages, liens, SEO (meta, données structurées, sitemap) et noindex conservé.
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { blogArticles } from '../worker/blog.js';
import { createTestDb } from './d1-test-db.mjs';

const { db, DB } = createTestDb();
const data = { firstName: 'Jean', lastName: 'Mavungu', contactEmail: 'prive@example.test', city: 'Saint-Denis', region: 'Île-de-France', languages: 'français, lingala', bio: 'J’accompagne les familles.', rate: '255' };
db.prepare("INSERT INTO nzozi_profiles (user_id, profile_json, updated_at, email, status, published_json, slug, reviewed_at) VALUES ('u1', ?, '2026-11-20', 'u1@example.test', 'approved', ?, 'jean-mavungu', '2026-11-20')").run(JSON.stringify(data), JSON.stringify(data));
const env = { DB };
const visit = (path, init) => worker.fetch(new Request('https://test.example' + path, init), env);
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));

assert.equal(blogArticles.length, 5);
assert.equal(new Set(blogArticles.map(a => a.slug)).size, 5);

// Index du blog
const index = await visit('/blog');
assert.equal(index.status, 200);
assert.equal(index.headers.get('X-Robots-Tag'), 'noindex, nofollow');
const indexHtml = await index.text();
assert.match(indexHtml, /<meta name="robots" content="noindex,nofollow">/);
assert.match(indexHtml, /<link rel="canonical" href="https:\/\/mon-nzonzi\.fr\/blog">/);
for (const a of blogArticles) assert.ok(indexHtml.includes('href="/blog/' + a.slug + '"'), a.slug);
assert.deepEqual(jsonLd(indexHtml).map(d => d['@type']), ['Blog', 'BreadcrumbList']);
assert.equal((await visit('/blog/')).status, 301);

// Chaque article : titre < 70 signes, description 110-170, canonical, JSON-LD valide, liens internes existants.
const slugs = new Set(blogArticles.map(a => a.slug));
for (const a of blogArticles) {
  assert.ok(a.seoTitle.length <= 70, a.slug + ' title ' + a.seoTitle.length);
  assert.ok(a.description.length >= 110 && a.description.length <= 170, a.slug + ' description ' + a.description.length);
  for (const s of a.related) assert.ok(slugs.has(s), s);
  for (const [, s] of a.body.matchAll(/href="\/blog\/([^"]+)"/g)) assert.ok(slugs.has(s), 'lien ' + s);
  const res = await visit('/blog/' + a.slug);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const html = await res.text();
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.ok(html.includes(`<link rel="canonical" href="https://mon-nzonzi.fr/blog/${a.slug}">`));
  assert.ok(html.includes('<meta property="og:type" content="article">'));
  const types = jsonLd(html);
  assert.deepEqual(types.map(d => d['@type']), ['Article', 'FAQPage', 'BreadcrumbList']);
  assert.equal(types[1].mainEntity.length, a.faq.length);
  assert.match(html, /Les coutumes varient/);
  assert.match(html, /href="\/#nzonzi"/);
}
assert.equal((await visit('/blog/inconnu')).status, 404);
assert.equal((await visit('/blog', { method: 'POST' })).status, 405);
assert.equal((await visit('/blog/c-est-quoi-un-nzonzi', { method: 'HEAD' })).status, 200);

// Accueil : lien Blog, aperçu des articles, toujours noindex.
const home = await (await visit('/')).text();
assert.match(home, /<a href="\/blog">Blog<\/a>/);
assert.match(home, /Comprendre <strong>la dot<\/strong>/);
assert.match(home, /<meta name="robots" content="noindex,nofollow">/);
assert.match(home, /<meta name="description"/);
// Fiche : description, sans email ni téléphone.
const fiche = await (await visit('/nzonzi/jean-mavungu')).text();
assert.match(fiche, /<link rel="canonical" href="https:\/\/mon-nzonzi\.fr\/nzonzi\/jean-mavungu">/);
assert.doesNotMatch(fiche, /prive@example\.test/);

// robots.txt bloque tout tant que le site n'est pas lancé ; sitemap prêt.
const robots = await (await visit('/robots.txt')).text();
assert.match(robots, /Disallow: \/\n/);
const map = await visit('/sitemap.xml');
assert.match(map.headers.get('Content-Type'), /application\/xml/);
const xml = await map.text();
assert.match(xml, /<loc>https:\/\/mon-nzonzi\.fr\/blog<\/loc>/);
for (const a of blogArticles) assert.ok(xml.includes(`<loc>https://mon-nzonzi.fr/blog/${a.slug}</loc>`));
assert.match(xml, /nzonzi\/jean-mavungu/);
assert.doesNotMatch(xml, /partenaire|api/);

// Image de partage
const og = await visit('/assets/partage.png');
assert.equal(og.status, 200);
assert.equal(og.headers.get('Content-Type'), 'image/png');

console.log('Blog OK');
