# Correspondance avec la grille d'évaluation

Chaque élément exigé par la consigne du travail d'équipe (`TECH 60711_A2026_TravailEquipe_Requis`), et où il est couvert.

| Critère (pondération) | Élément exigé | Où | État |
|---|---|---|---|
| **Idée** | Brève description | RAPPORT §1.1 | ✅ |
| | Motivation | RAPPORT §1.2 (43,3 % de rétention, FEP 2025) | ✅ |
| | Pourquoi l'IA plutôt qu'un système traditionnel | RAPPORT §1.3 (Davenport et Ronanki, Ng), comparaison chiffrée à RFM (§6.2, page Modèle) | ✅ |
| | Recherche sur l'existant | RAPPORT §1.4 (Dataro, Keela, Bloomerang : prix et limites) | ✅ |
| | Proposition de valeur | RAPPORT §1.5 | ✅ |
| | Impact visé | RAPPORT §1.6 (mesuré contre supposé), page **Impact** | ✅ |
| **Canevas** | Canevas d'IA complété (Agrawal et al.) | RAPPORT §2 : canevas principal au format du gabarit S02, différences des 3 autres | ✅ Version diapositive à monter pour l'affiche |
| **Requis fonctionnels** | Liste, avec indication de ceux qui utilisent l'IA | RAPPORT §3 (24 requis, marqueurs [IA] et [P] ; RF23 et RF24 traduisent la Loi 25) | ✅ |
| | User stories (optionnel) | RAPPORT §3 | ✅ |
| **Requis techniques** | Type de tâche et de modèle | RAPPORT §4.1 | ✅ |
| | Modèle pré-entraîné, solution fournisseur ou sur mesure : justification | RAPPORT §4.2, vérification scikit-learn (`verification/`) | ✅ |
| | Performance : métriques et valeurs désirées | RAPPORT §4.3, R1 à R6 vérifiés dans l'application (17/24 pour le meilleur candidat, 6 requis × 4 modèles ; R1 et R2 bloquants, R3 à R6 en alertes ; repli sur RFM) | ✅ |
| | Système d'IA à haut niveau | RAPPORT §4.4 (schéma) | ✅ |
| | Modalités de déploiement | RAPPORT §4.5 (API FastAPI, Docker, AWS ca-central-1 : ECS Fargate, EventBridge Scheduler, Cognito, RDS, SES) | ✅ |
| | Langages et interopérabilité | RAPPORT §4.5 (Python et scikit-learn en cible, justification KISS) | ✅ |
| **Requis données** | Sources pour l'entraînement et l'usage | RAPPORT §5.1 | ✅ |
| | Volume minimal et démarrage à froid | RAPPORT §5.4 (requis RD1 à RD6, entraînement ou scoring ; repli sur RFM ; calcul de puissance du groupe témoin) | ✅ |
| | Format et transformation | RAPPORT §5.2, `src/ml/features.ts` | ✅ |
| | Qualité, par source (y compris accessibilité) | RAPPORT §5.3 (S1 à S4, dont l'outil de courriels), page **Données** (contrôles automatiques) | ✅ |
| | Documentation des caractéristiques | `docs/DATASHEET-synthetique.md`, `docs/DATASHEET-kdd98.md`, RAPPORT §5.5 | ✅ |
| **Prototype** | Démonstration de l'IA | Application (8 pages), page **Modèle IA** | ✅ |
| | Tous les éléments sources livrés, reproductible | Dépôt git, `npm run …`, graines fixes, `model.json` versionné ; `npm ci` (versions figées) | ✅ |
| | Conteneur Docker, tests, CI (portabilité, séance 5, scénario 4) | `Dockerfile` (étapes `build`, `eval`, `web`), `npm test` (19 tests), `npm run check:repro` (graine 42 comparée au rapport versionné, tolérance 1e-9) ; CI : lint, tests, check:repro, construction du site, `docker build` web et eval, `docker run` eval, puis publication ; README et RAPPORT §6.3 | ✅ |
| | Démonstration accessible sans installation | https://wtigg.github.io/fidelia/ (README, RAPPORT en tête et §6.1) | ✅ |
| | Honnêteté sur les écarts avec la solution cible | RAPPORT §6.4 | ✅ |
| | Aucune donnée réelle d'organisation | Synthétique ; KDD 98 public, organisation non nommée | ✅ Prévenir Epsilon (conditions d'usage) |
| **Risques et éthique** | Risques (individuels, sociétaux, légaux, infrastructure) | RAPPORT §7 (lignes Individuel et Sociétal comprises) | ✅ |
| | Éthique sur tout le cycle de vie, avec cadres du cours | RAPPORT §8 (Suresh et Guttag avec étapes Collecte et Maintenance, Rismani, NIST, Loi 25, Déclaration de Montréal, trois questions de S04 en §8.5, guide de Meta pour le LLM) | ✅ |
| | Pérennité et réalisme | RAPPORT §11 (conclusion et viabilité : trois menaces, condition de poursuite) | ✅ |
| **Estimations** | Ressources humaines, matérielles, financières | RAPPORT §9.1 à 9.3 (taux du Guichet-Emplois, réserve de 10 à 20 %, vente et support, légal récurrent, seuil de rentabilité) | ✅ Hypothèses signalées (charges 25 %, conseiller juridique, vente et support, réserve) ; assurance non chiffrée |
| | Temps et sous-ensemble de la V1 | RAPPORT §9.4 (requis par mois ; pilote aux mois 4 à 6, suivi après lancement ; V1 = RF1 à RF9 et RF11 à RF24) | ✅ |
| **Réflexion** | Au moins 3 leçons apprises | RAPPORT §10 (8 leçons) | ✅ |
| **Commentaires généraux** | Au moins 10 références, dont au moins la moitié académiques | RAPPORT, Références (39 au total, dont 20 académiques ; 6 lectures du cours en revues professionnelles ou ouvrages), APA 7 avec DOI | ✅ |
| | Cohérence et intégration | Mêmes chiffres dans l'application, le rapport et la fiche modèle (sources : `reports/`) | ✅ |
| **Présentation** | Affiche, démonstration, vidéo de secours | `docs/PRESENTATION.md` (plan inspiré de `files/Poster_Exemple 1.pdf` et `2.pdf`) | 🟡 Affiche à monter (fichier final : à indiquer ici), vidéo à enregistrer |

## À faire par l'équipe

1. Monter le canevas principal en diapositive pour l'affiche (gabarit `TECH 60711_S02_AI Canvas`).
2. Monter l'affiche en s'inspirant des exemples du cours (`files/Poster_Exemple 1.pdf` et `Poster_Exemple 2.pdf`) : canevas S02 en visuel, graphique AUC-PR modèle contre RFM, encadré KDD 98 nuancé. Indiquer le fichier final dans le tableau ci-dessus.
3. Ajouter au script d'évaluation un export des chiffres d'impact (`reports/impact-42.json`, capacités 100 et 300, modèle / RFM / hasard) et des intervalles de confiance des ratios d'équité par âge. D'ici là, `PRESENTATION.md` ne cite aucun multiplicateur d'impact.
4. Créer `verification/requirements.txt` avec les versions exactes (voir `README.md`, Prérequis).
5. Confirmer les hypothèses de coûts (charges sociales, conseiller juridique).
6. Envoyer la notification d'usage de KDD Cup 1998 aux contacts d'Epsilon (voir la datasheet).
7. Enregistrer la vidéo de démonstration de secours (5 min, script dans `PRESENTATION.md`).
8. Confirmer avec l'enseignante la longueur du rapport et le format de remise.
