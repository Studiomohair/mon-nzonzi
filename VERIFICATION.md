# Vérifications du 17 novembre 2026
Source : commit 72d219efdcf8f88500d4947c479dc53db799d1fe, branche main.
Environnement : Node.js v24.22.1.

Exécutés avec succès :
- bash scripts/build.sh : génération de dist/.
- node scripts/check-directory.mjs : annuaire, filtres, animations, police, tarifs, demande, reçu, protections et boîte de démonstration.
- node scripts/check-profile.mjs : sauvegarde, isolation des comptes, validation, origine et erreurs.
- node scripts/check-photo.mjs : ajout, confidentialité, suppression, formats et limite de taille.
- node scripts/check-partner.mjs : accès serveur, simulateur absent côté familles, calculs et montants invalides.

Les contrôles utilisent des données et services de test ; ils ne valident pas une migration des données réelles. Aucun test visuel dans le navigateur ni déploiement dans un autre environnement n’a été réalisé. Aucun changement poussé au dépôt, à l’hébergement ou aux DNS.
