import { readdir, readFile, writeFile } from 'node:fs/promises';

const project = new URL('../', import.meta.url);
const fromRoot = path => new URL(path, project);
const assetDirectory = fromRoot('worker/assets/');
const assets = {};
for (const file of (await readdir(assetDirectory)).sort()) {
  if (!/\.(webp|woff2|txt|png)$/.test(file)) continue;
  assets[file] = (await readFile(new URL(file, assetDirectory))).toString('base64');
}
const catalog = await readFile(fromRoot('worker/catalog.js'), 'utf8');
const entry = await readFile(fromRoot('worker/index.js'), 'utf8');
const catalogImport = "import { adminPage, applySiteTheme, catalog, partnerPage, renderDemoInbox, spaceGatePage } from './catalog.js';";
const assetMarker = '/* SITE_ASSETS */ {}';
if (!entry.includes(catalogImport) || !catalog.includes(assetMarker)) throw new Error('Worker assembly marker missing.');
const bundledCatalog = catalog.replace(/^export /gm, '').replace(assetMarker, () => JSON.stringify(assets));
await writeFile(fromRoot('dist/server/index.js'), entry.replace(catalogImport, () => bundledCatalog));
