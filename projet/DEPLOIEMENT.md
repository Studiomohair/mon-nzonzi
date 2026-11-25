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
for s in directory profile photo partner access admin contact; do node scripts/check-$s.mjs; done
npx wrangler deploy --dry-run   # vérifie l'assemblage Cloudflare
```

## Inscription des nzonzi et validation (étape 2)

1. Application Access « Espace nzonzi » (chemins `/partenaire` et `/api`) : la politique doit autoriser tout le monde (Include → Everyone) avec la connexion par code email (One-time PIN). La sécurité de l'admin est assurée par `NZOZI_ADMIN_EMAILS`, vérifié côté serveur.
2. Secrets du Worker : `NZOZI_ADMIN_EMAILS` (adresse de l'équipe) et `NZOZI_OPEN_SIGNUP` = `true`.
3. La migration `0002_profile_validation.sql` est appliquée automatiquement par la commande de déploiement (`wrangler d1 migrations apply DB --remote`). Elle ajoute des colonnes sans supprimer de données.
4. Page de validation : `https://mon-nzonzi.fr/partenaire/admin`.

## Emails avec Brevo (étape 3)

Le formulaire de contact des fiches et les emails automatiques passent par
l'API transactionnelle de Brevo. **Tant que les deux secrets ci-dessous ne sont
pas définis, rien n'est envoyé** : les fiches affichent « La prise de contact en
ligne ouvre très bientôt » et le reste du site fonctionne normalement.

Emails envoyés :
- **Demande d'une famille** → au nzonzi (email de contact de sa fiche validée),
  copie cachée aux adresses de `NZOZI_ADMIN_EMAILS`. Le bouton « Répondre » du
  nzonzi écrit directement à la famille.
- **Nouveau profil ou profil modifié à valider** → aux adresses de `NZOZI_ADMIN_EMAILS`
  (une seule alerte tant que le profil attend la validation).
- **Profil validé** → au nzonzi, avec le lien de sa fiche.

Mise en place :
1. Créer un compte sur brevo.com (offre gratuite : 300 emails par jour).
2. Brevo → Paramètres → **Expéditeurs, domaines et IP dédiées** → Domaines →
   ajouter `mon-nzonzi.fr`. Brevo affiche des enregistrements DNS (code Brevo,
   DKIM, DMARC) : les ajouter dans Cloudflare → `mon-nzonzi.fr` → DNS → Records,
   en mode « DNS only » (nuage gris), puis cliquer « Vérifier » dans Brevo.
3. Brevo → Expéditeurs → ajouter l'adresse d'envoi, par exemple `contact@mon-nzonzi.fr`.
4. Brevo → Paramètres → **Clés API et MCP** → Générer une clé API.
5. Cloudflare → Worker `mon-nzonzi` → Settings → Variables and Secrets → ajouter,
   en type **Secret** :
   - `BREVO_API_KEY` : la clé API Brevo
   - `BREVO_SENDER_EMAIL` : l'adresse d'envoi validée (ex. `contact@mon-nzonzi.fr`)
6. La migration `0003_contact_requests.sql` (table des demandes des familles) est
   appliquée automatiquement au déploiement.

Les demandes sont aussi visibles sur `/partenaire/admin` (50 dernières), conservées
12 mois puis purgées. Limite : 5 demandes par heure et par adresse IP.

## Pages légales

`/mentions-legales`, `/confidentialite` et `/cgu`, liées dans le pied de page.
Les informations de l'éditeur (nom, statut, adresse, SIRET, email, directeur de
la publication) se remplissent dans l'objet `legalInfo` de `worker/catalog.js` ;
tant qu'elles sont vides, la page affiche « … à compléter ».
