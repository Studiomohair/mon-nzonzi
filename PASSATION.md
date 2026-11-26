# Passation technique et fonctionnelle — Mon Nzonzi

## État vérifié à l’export
Le dépôt main a été récupéré le 17/11/2026 ; commit 72d219efdcf8f88500d4947c479dc53db799d1fe. Sites annonce 11 versions. Le site existant a pour URL https://mon-nzonzi.fr et son audience est limitée au propriétaire. L’export ne change pas cet état. Le commit du dépôt est la référence de cet export ; une comparaison spécifique avec l’archive de la publication n’a pas été effectuée.

## Produit
Plateforme francophone de mise en relation familles/nzonzi. Le partenaire choisit sa rémunération nette ; le tarif famille inclut une commission. Dans le prototype, la part partenaire est 85 % du total : total famille = net / 0,85. Exemple : 255 € nets donnent 300 € au total, dont 45 € de commission. Ce taux est une configuration de prototype, à confirmer avant un lancement commercial.

## Fonctionnalités présentes dans le code
- Accueil avec annuaire, filtres combinés (recherche, région, communauté), illustrations et animations.
- Trois profils fictifs : Jean Mavungu, Patrick Ilunga, André Mbuyi ; fiches détaillées.
- Demande de démonstration depuis une fiche, enregistrement D1, reçu et affichage dans l’espace nzonzi du compte demandeur. Pas d’envoi réel à un médiateur.
- Espace partenaire protégé : profil personnel, région, langues, communauté facultative, présentation, prestations, rémunération et conditions.
- Simulateur tarifaire réservé à l’espace nzonzi.
- Photo privée du compte : JPEG/PNG/WebP, maximum 5 Mio ; contrôle du type et de la signature du fichier.
- Page de présentation historique avec formulaire de récapitulatif téléchargeable, distincte du parcours principal actuel.
- Logo versionné, police Playfair Display et licence, CSS responsive et motion design.

## Routes
| Route | Comportement |
|---|---|
| / et /index.html | Annuaire principal et filtres |
| /nzonzi/jean-mavungu (et autres slugs fictifs) | Fiche ; POST pour la demande de démonstration |
| /partenaire | Espace partenaire protégé et boîte des demandes de démonstration du compte |
| /api/profil | GET/PUT du profil du compte |
| /api/photo | GET/PUT/DELETE de sa photo privée |
| /presentation | Ancienne présentation et récapitulatif téléchargeable |
| /assets/* | Logo, police, licence, servis par le Worker |

## Organisation
worker/index.js contient le serveur, les pages partenaire/historique, les validations et les API profil/photo.
worker/catalog.js contient les profils fictifs, le catalogue, les fiches, le thème, les animations et le parcours de demande.
worker/assets/ contient les ressources versionnées.
drizzle/ contient deux migrations : nzozi_profiles et demo_requests.
scripts/ contient l’assemblage et les contrôles existants.
.openai/hosting.json identifie le projet Sites et les bindings DB/BUCKET. Ce fichier n’est pas une configuration universelle d’hébergement.
dist/ est le résultat de construction, pas la source à modifier.

## Données et sécurité à porter
La table nzozi_profiles comporte user_id, profile_json, updated_at. demo_requests comporte user_id, reference, profile_slug, ceremony_city, ceremony_date, message, created_at, avec clé composée et index chronologique.
Les photos sont dans R2 sous profile-photos/<identifiant encodé>. Ces objets et le contenu D1 ne sont pas présents dans le ZIP.
Les profils fictifs ne sont pas alimentés automatiquement par les profils partenaires sauvegardés.
Les routes privées attendent oai-authenticated-user-id et oai-authenticated-user-email, fournis par la plateforme. La variable NZOZI_ALLOWED_EMAILS contient une liste d’adresses autorisées séparées par des virgules. Sa valeur de production n’a pas été exportée.
Hors de Sites, une personne peut falsifier des en-têtes si le serveur les accepte directement : il faut une authentification vérifiée et un middleware qui détermine l’identité côté serveur, sans accepter ces valeurs brutes depuis Internet.

## Reprise locale / autre hébergeur
1. Construire et exécuter les contrôles indiqués dans CLAUDE.md. Ils ne nécessitent pas les données de production.
2. Choisir l’hébergement cible. Cloudflare Workers avec D1/R2 est le plus proche de cette architecture ; un autre serveur implique des adaptateurs de requête, base et stockage.
3. Ajouter une configuration locale propre (par exemple Wrangler), créer une base et un bucket de développement ; appliquer les migrations SQL dans l’ordre. Le ZIP ne contient pas d’identifiants de ressources Cloudflare exploitables dans un autre compte.
4. Ajouter un point d’entrée de développement ou une configuration de serveur local. Aucun démarrage web local prêt à l’emploi n’est fourni par le dépôt actuel.
5. Remplacer l’authentification spécifique à Sites et configurer une liste de partenaires de test.
6. Vérifier le catalogue, les filtres, les reçus, l’enregistrement du profil, les contrôles d’accès et les photos.
7. Avant une migration réelle, exporter séparément D1 et R2 depuis un accès autorisé, puis établir une correspondance des identifiants utilisateurs de l’ancien et du nouveau système.
8. Déployer d’abord sur une URL de test. Le basculement du domaine chez IONOS et la création de nouveaux certificats viennent seulement après validation du propriétaire.

## Limites à conserver visibles
Le prototype n’est pas une plateforme complète de réservation : pas de paiement, agenda de disponibilités confirmé, notification email/SMS réelle, messagerie entre familles et prestataires, ni processus automatique de publication des partenaires. Les profils fictifs et les demandes de démo doivent rester signalés.
La licence Playfair est incluse ; ne pas la supprimer. Le logo et les autres ressources versionnées sont fournis tels quels, sans audit juridique.

## Pistes à faire préciser au propriétaire
Prochain objectif fonctionnel ; maintien ou changement d’hébergement ; authentification cible ; publication de vrais partenaires ; validation des profils ; réservations, commission et paiements ; mentions et modalités de traitement des données.

## Mise à jour du 25/11/2026 (étape 3)
- Restes du prototype supprimés : profils fictifs (`SHOW_DEMO_PROFILES`), demandes de démonstration, bandeau « Prototype privé » et ancienne page `/presentation`. La table `demo_requests` reste en base mais n'est plus utilisée.
- Pages légales : `/mentions-legales`, `/confidentialite`, `/cgu` (objet `legalInfo` dans `worker/catalog.js`).
- Formulaire de contact famille → nzonzi sur chaque fiche validée, et alertes email, via Brevo. Inactifs tant que `BREVO_API_KEY` et `BREVO_SENDER_EMAIL` ne sont pas définis. Voir `projet/DEPLOIEMENT.md`.

## Mise à jour du 26/11/2026 (blog)
- Blog pédagogique `/blog` (5 articles : nzonzi, kinzonzi, dot, étapes du mariage en RDC, qui peut faire le kinzonzi), lien dans l'en-tête, le pied de page et un aperçu sur l'accueil.
- SEO prêt (meta, canonique, Open Graph, JSON-LD, `/sitemap.xml`, `/robots.txt`) mais noindex conservé : interrupteur `SEARCH_INDEXING` dans `worker/catalog.js`. Voir `projet/DEPLOIEMENT.md`.

## Mise à jour du 26/11/2026 (avis des familles)
- Avis vérifiés : invitation par email après la cérémonie (tâche planifiée quotidienne), formulaire `/avis/<lien>`, validation dans `/partenaire/admin`, note moyenne et avis sur les fiches et l'annuaire. Table `reviews` (migration 0006). Détails dans `projet/DEPLOIEMENT.md`, contrôle `scripts/check-reviews.mjs`.
