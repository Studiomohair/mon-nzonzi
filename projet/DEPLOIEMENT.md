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
for s in directory profile photo partner access admin contact blog reviews; do node scripts/check-$s.mjs; done
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
- **Confirmation à la famille** → récapitulatif de sa demande, juste après l'envoi.
- **Réception confirmée** → à la famille, quand le nzonzi clique « Indiquer à la famille que j’ai reçu la demande » dans
  la section « Mes demandes » de son espace (une seule fois par demande). Dans l'admin,
  les demandes sans confirmation de réception depuis plus de 48 h sont signalées.

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

## Blog et référencement (SEO)

- Articles : `/blog` et `/blog/<slug>`, contenu dans `worker/blog.js` (titre de page, description, FAQ, articles liés).
- Chaque page publique a une description, une adresse canonique (`https://mon-nzonzi.fr/...`), des balises de partage (image `/assets/partage.png`) et des données structurées (Article, FAQ, fil d'Ariane).
- `/sitemap.xml` liste l'accueil, le blog, les articles et les fiches validées.
- **Le site reste caché des moteurs** (`noindex` + `robots.txt` qui bloque tout) tant que `SEARCH_INDEXING = false` en haut de `worker/catalog.js`. Au lancement, et seulement avec l'accord de la propriétaire : passer à `true`, fusionner, puis déclarer `https://mon-nzonzi.fr/sitemap.xml` dans Google Search Console. L'espace nzonzi, l'admin et les API restent toujours exclus.

## Avis des familles

- Seules les familles qui ont contacté un nzonzi avec le formulaire de sa fiche (demande transmise) sont invitées. Une tâche planifiée Cloudflare (`[triggers]` dans `wrangler.toml`, chaque jour à 8 h UTC) leur envoie un lien personnel par email 2 jours après la date de la cérémonie, ou 45 jours après la demande sans date. Une seule invitation par demande, et par famille et nzonzi. Le lien vaut 90 jours ; seule son empreinte SHA-256 est stockée.
- Formulaire public : `/avis/<lien>` (note de 1 à 5, commentaire, nom affiché, case de confirmation). Il n'est pas sous `/api` ni `/partenaire`, donc hors Cloudflare Access.
- Validation sur `/partenaire/admin` (section « Avis des familles », API `/api/admin/avis`) : publier, refuser ou retirer avec un motif ; la famille reçoit le motif par email, le nzonzi est prévenu quand un avis est publié. Le bouton « Envoyer maintenant les invitations prévues » lance la tâche sans attendre.
- La note moyenne et les avis publiés s'affichent sur la fiche et sur les cartes de l'annuaire. Règles publiées dans les CGU (`/cgu#avis`).
- La migration `0006_reviews.sql` est appliquée automatiquement au déploiement. Sans Brevo, aucune invitation ne part.

## Réservations et paiements (Stripe Connect)

**Désactivé par défaut.** Sans `STRIPE_SECRET_KEY`, le site fonctionne exactement comme avant. Aucun vrai paiement tant que la propriétaire n'a pas donné son accord : une clé `sk_live_` est refusée sauf si `PAYMENTS_LIVE` vaut `true`.

Parcours (code dans `worker/payments.js`, règles dans `PAYMENT_RULES` de `worker/catalog.js`) :
1. La famille envoie sa demande depuis la fiche (formulaire existant).
2. Dans « Mes demandes », le nzonzi **accepte** (date confirmée, prix de sa fiche + frais éventuels, message) ou **refuse**. La famille reçoit un lien personnel `/reservation/<lien>`.
3. La famille paie un **acompte de 30 %** (Stripe Checkout, carte). Il est versé au nzonzi 14 jours plus tard (délai de rétractation), ou le jour de la cérémonie si elle a lieu avant.
4. Le **solde** se paie à partir de 80 jours avant la cérémonie (email automatique). Il reste sur le compte Stripe de Mon Nzonzi (« separate charges and transfers »).
5. Le lendemain de la cérémonie, la famille confirme (solde versé au nzonzi) ou signale un problème (solde bloqué, décision de l'équipe dans `/partenaire/admin#paiements` : verser ou rembourser, totalement ou en partie). Sans réponse 5 jours après l'email : versement automatique.
6. Commission : 15 % de chaque paiement reste à Mon Nzonzi ; les frais Stripe sont pris dessus.

Limite Stripe : pas de séquestre légal, et les fonds ne doivent pas rester bloqués plus de 90 jours (France). D'où le solde à J-80 et une alerte email à l'équipe pour toute réservation bloquée depuis 75 jours.

Mise en route (mode test d'abord) :
1. Stripe → mode test → Connect → plateforme / place de marché, comptes **Express**, pays France. Compléter le profil de la plateforme.
2. Secrets du Worker (type **Secret**) : `STRIPE_SECRET_KEY` (`sk_test_…`), `PAYMENTS_TEST_EMAILS` (emails de connexion des nzonzi testeurs, séparés par des virgules).
3. Stripe → Développeurs → Webhooks → endpoint `https://mon-nzonzi.fr/stripe/webhook`, événements de **votre compte** : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
4. Pour tous les nzonzi : `PAYMENTS_ENABLED` = `true` (affiche aussi la section paiement des CGU). Pour les vrais paiements : clé `sk_live_…`, nouveau webhook en mode live, et `PAYMENTS_LIVE` = `true`, uniquement avec l'accord de la propriétaire.

`/stripe/webhook`, `/reservation/*` et `/echange/*` ne doivent pas être protégés par Cloudflare Access. Les migrations `0007_bookings_payments.sql` et `0008_messages.sql` sont appliquées automatiquement au déploiement. Les versements et emails sont faits par la tâche quotidienne existante (8 h UTC). Contrôle : `node scripts/check-payments.mjs`.

Messagerie (nzonzi testeurs uniquement, même interrupteur) : la famille écrit depuis son lien personnel `/echange/<jeton>` (reçu par email), le nzonzi répond depuis `/partenaire`. Tant que l’acompte n’est pas payé, les emails, numéros, liens et pseudos tapés dans les messages (et dans la première demande) sont remplacés par « [coordonnées masquées] ». Limite : 20 messages par jour et par personne.
