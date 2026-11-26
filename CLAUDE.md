# Reprise de Mon Nzonzi
Lire PASSATION.md avant toute modification. Le code se trouve dans projet/.

## Objectif
Continuer un prototype français qui met en relation familles et nzonzi, porte-paroles/médiateurs des cérémonies de dot, dans le respect des coutumes. Orthographe : Mon Nzonzi ; domaine mon-nzonzi.fr. Les anciennes appellations techniques nzozi sont conservées pour compatibilité.

## Méthode
- Inspecter le code avant de proposer une réécriture. Préserver les fonctionnalités existantes et la charte actuelle tant que le propriétaire ne demande pas de changement.
- Travailler sur une copie ou branche indépendante. Ne pas modifier le site Sites, ses DNS ou son audience sans demande explicite.
- Distinguer les profils fictifs des profils utilisateurs sauvegardés. Ne pas présenter les demandes de démonstration comme des réservations réelles.
- Ne jamais faire confiance à des en-têtes d’identité envoyés directement par un navigateur. Hors de Sites, remplacer cette dépendance par une authentification serveur vérifiée.
- Ne jamais intégrer de secrets au frontend ou au dépôt.
- Conserver l’isolation des profils et des photos par compte, le contrôle d’origine et les validations existantes.
- Ne pas déduire une identité culturelle à partir du nom ou d’une photo : la communauté est déclarative.

## Architecture
Cloudflare Worker ES module, JavaScript natif, HTML/CSS/JS générés dans les modules. Aucun framework frontend ni dépendance npm déclaré. DB : D1, binding DB. Photos : R2, binding BUCKET.
Entrée : projet/worker/index.js (Cloudflare : projet/cloudflare/entry.js, voir projet/DEPLOIEMENT.md). Catalogue, thème et animations : projet/worker/catalog.js. Articles du blog : projet/worker/blog.js (inséré dans catalog.js au build). Assemblage : projet/scripts/bundle-worker.mjs. Sortie : projet/dist/server/index.js.

## Construction et vérification
Depuis projet/, avec Bash et Node.js 24 (v24.22.1 utilisée pour cet export) :
```bash
bash scripts/build.sh
node scripts/check-directory.mjs
node scripts/check-profile.mjs
node scripts/check-photo.mjs
node scripts/check-partner.mjs
node scripts/check-access.mjs
node scripts/check-admin.mjs
node scripts/check-contact.mjs
node scripts/check-blog.mjs
node scripts/check-reviews.mjs
node scripts/check-payments.mjs
```
Les tests utilisent node:sqlite. Ne pas éditer seulement dist/ : il est régénéré au build. Aucun script npm start/dev n’existe dans la source. Le script de build supprime puis recrée dist/.

## Première étape attendue
Réaliser un audit bref, expliquer comment exécuter le prototype dans l’environnement choisi, puis attendre le prochain objectif fonctionnel du propriétaire. Ne pas lancer de migration de production ou de refonte complète de sa propre initiative.
