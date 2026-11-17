# Mon Nzonzi — dossier de reprise pour Claude
Export du 17 novembre 2026. Source récupérée du dépôt Sites, branche main.
Commit : 72d219efdcf8f88500d4947c479dc53db799d1fe. Version Sites la plus récente annoncée : 11.

## Démarrer
1. Décompresser le ZIP.
2. Pour Claude Code : ouvrir le dossier Mon-Nzonzi-Claude ; lire CLAUDE.md et le dossier projet/.
3. Pour Claude sur le web : créer un projet et joindre CLAUDE.md, PASSATION.md, PROMPT-CLAUDE.txt et les fichiers source utiles de projet/. Si les dossiers/ZIP ne sont pas acceptés dans l’interface, joindre les fichiers individuellement.
4. Coller le contenu de PROMPT-CLAUDE.txt dans le premier message.

Le ZIP contient le code, les ressources graphiques, les migrations SQL, les scripts de construction et les contrôles existants. Les anciennes archives de livraison du dépôt sont exclues pour éviter les doublons. Le code source est conservé sans modification ; les documents de passation ont été ajoutés séparément.

Ce dossier permet de reprendre le développement. Il ne migre pas automatiquement le site en production.

## Contenu
- projet/ : source du dépôt, y compris dist/ reconstruit et configuration Sites.
- CLAUDE.md : consignes de reprise pour Claude Code.
- PASSATION.md : fonctionnement, limites, données et migration.
- PROMPT-CLAUDE.txt : premier message prêt à copier.
- VERIFICATION.md : vérifications effectuées.
- INVENTAIRE-SHA256.json : empreintes des fichiers exportés du projet.

Aucune base de données de production, photo téléversée, variable secrète, session, clé de déploiement ou historique de conversation n’est inclus. La variable d’exemple est vide. Les ressources graphiques versionnées sont incluses.
