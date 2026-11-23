# Déploiement sur Cloudflare

Le site tourne sur Cloudflare Workers, avec une base D1 (binding `DB`) et,
en option, un bucket R2 pour les photos (binding `BUCKET`).

## Mise en place (une seule fois)
1. **Base D1** : tableau de bord Cloudflare → Storage & Databases → D1 → Create
   → nom `mon-nzonzi`. Reporter son *Database ID* dans `wrangler.toml`.
2. **Projet Worker relié à GitHub** : Workers & Pages → Create → Import a
   repository → `mon-nzonzi`.
   - Root directory : `projet`
   - Build command : (vide, `wrangler.toml` lance `scripts/build.sh`)
   - Deploy command : `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`
3. **Connexion à l'espace nzonzi (Cloudflare Access)** : dans le Worker →
   Settings → Domains & Routes → `workers.dev` → activer Cloudflare Access.
   Noter le *team domain* et l'*AUD tag* affichés.
4. **Variables** (Worker → Settings → Variables and Secrets) :
   - `ACCESS_TEAM_DOMAIN` : ex. `mon-equipe.cloudflareaccess.com`, ou l'URL *JWKS* complète
   - `ACCESS_AUD` : l'AUD tag de l'application Access (plusieurs applications : AUD séparés par des virgules)
   - `NZOZI_ALLOWED_EMAILS` : adresses des partenaires autorisés, séparées par des virgules
   - `NZOZI_ADMIN_EMAILS` : adresses qui peuvent valider les profils sur `/partenaire/admin`, séparées par des virgules
   - `NZOZI_OPEN_SIGNUP` = `true` : tout email vérifié par Cloudflare Access peut créer un profil nzonzi (publié seulement après validation). Sans cette valeur, seule la liste `NZOZI_ALLOWED_EMAILS` a accès.

Ensuite, chaque fusion sur `main` redéploie automatiquement le site.

## Identité
`cloudflare/entry.js` supprime tout en-tête `oai-authenticated-user-*` reçu du
navigateur et ne le recrée qu'à partir d'un jeton Cloudflare Access vérifié
(signature, audience, émetteur, expiration). Sans `ACCESS_TEAM_DOMAIN` /
`ACCESS_AUD`, personne n'est connecté : l'espace nzonzi reste fermé.

## Contrôles
```bash
bash scripts/build.sh
for s in directory profile photo partner access; do node scripts/check-$s.mjs; done
npx wrangler deploy --dry-run   # vérifie l'assemblage Cloudflare
```

## Inscription des nzonzi et validation (étape 2)

1. Application Access « Espace nzonzi » (chemins `/partenaire` et `/api`) : la politique doit autoriser tout le monde (Include → Everyone) avec la connexion par code email (One-time PIN). La sécurité de l'admin est assurée par `NZOZI_ADMIN_EMAILS`, vérifié côté serveur.
2. Secrets du Worker : `NZOZI_ADMIN_EMAILS` (adresse de l'équipe) et `NZOZI_OPEN_SIGNUP` = `true`.
3. La migration `0002_profile_validation.sql` est appliquée automatiquement par la commande de déploiement (`wrangler d1 migrations apply DB --remote`). Elle ajoute des colonnes sans supprimer de données.
4. Page de validation : `https://mon-nzonzi.fr/partenaire/admin`.
