import { readdir, readFile, writeFile } from 'node:fs/promises';

const project = new URL('../', import.meta.url);
const fromRoot = path => new URL(path, project);
const assetDirectory = fromRoot('worker/assets/');
const assets = {};
for (const file of (await readdir(assetDirectory)).sort()) {
  if (!/\.(webp|woff2|txt|png)$/.test(file)) continue;
  assets[file] = (await readFile(new URL(file, assetDirectory))).toString('base64');
}
const blogImport = "import { blogArticles } from './blog.js';";
const catalogSource = await readFile(fromRoot('worker/catalog.js'), 'utf8');
if (!catalogSource.includes(blogImport)) throw new Error('Worker assembly marker missing.');
// Les articles du blog (données seules) sont placés avant le catalogue.
const blog = await readFile(fromRoot('worker/blog.js'), 'utf8');
const catalog = catalogSource.replace(blogImport, () => blog);
const entry = await readFile(fromRoot('worker/index.js'), 'utf8');
const catalogImport = "import { adminEmails, adminPage, catalog, partnerPage, reviewsAdminApi, sendMail, sendReviewInvitations, spaceGatePage } from './catalog.js';";
const assetMarker = '/* SITE_ASSETS */ {}';
if (!entry.includes(catalogImport) || !catalog.includes(assetMarker)) throw new Error('Worker assembly marker missing.');
// Les modules partagent une seule portée : on retire import/export entre eux.
const unexport = source => source.replace(/^export \{[^}]*\};?\n/gm, '').replace(/^export /gm, '');
const bundledCatalog = unexport(catalog).replace(assetMarker, () => JSON.stringify(assets));
// Paiements Stripe (worker/payments.js) : placés après le catalogue, dont ils utilisent les fonctions.
const paymentsImport = /^import \{[^}]*\} from '\.\/payments\.js';\n/m;
const paymentsSource = await readFile(fromRoot('worker/payments.js'), 'utf8');
const catalogFromPayments = /^import \{[^}]*\} from '\.\/catalog\.js';\n/m;
if (!paymentsImport.test(entry) || !catalogFromPayments.test(paymentsSource)) throw new Error('Worker assembly marker missing.');
const bundledPayments = unexport(paymentsSource.replace(catalogFromPayments, ''));
await writeFile(fromRoot('dist/server/index.js'), entry.replace(catalogImport, () => bundledCatalog).replace(paymentsImport, () => bundledPayments));
