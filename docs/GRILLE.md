# Correspondance avec la grille d'évaluation

Chaque élément exigé par la consigne du travail d'équipe (`TECH 60711_A2026_TravailEquipe_Requis`), et où il est couvert.

| Critère (pondération) | Élément exigé | Où | État |
|---|---|---|---|
| **Idée** | Brève description | RAPPORT §1.1 | ✅ |
| | Motivation | RAPPORT §1.2 (43,3 % de rétention, FEP 2025) | ✅ |
| | Pourquoi l'IA plutôt qu'un système traditionnel | RAPPORT §1.3, comparaison chiffrée à RFM (§6.2, page Modèle) | ✅ |
| | Proposition de valeur | RAPPORT §1.4 | ✅ |
| | Impact visé | RAPPORT §1.5, page **Impact** | ✅ |
| **Canevas** | Canevas d'IA complété (Agrawal et al.) | RAPPORT §2, un canevas par prédiction | ✅ À mettre au format diapositive du cours |
| **Requis fonctionnels** | Liste, avec indication de ceux qui utilisent l'IA | RAPPORT §3 (22 requis, marqueurs [IA] et [P]) | ✅ |
| | User stories (optionnel) | RAPPORT §3 | ✅ |
| **Requis techniques** | Type de tâche et de modèle | RAPPORT §4.1 | ✅ |
| | Modèle pré-entraîné, solution fournisseur ou sur mesure : justification | RAPPORT §4.2, vérification scikit-learn (`verification/`) | ✅ |
| | Performance : métriques et valeurs désirées | RAPPORT §4.3, R1 à R6 vérifiés dans l'application (17/24, échecs discutés, gouvernance de repli sur RFM) | ✅ |
| | Système d'IA à haut niveau | RAPPORT §4.4 (schéma) | ✅ |
| | Modalités de déploiement | RAPPORT §4.5 | ✅ |
| | Langages et interopérabilité | RAPPORT §4.5 | ✅ |
| **Requis données** | Sources pour l'entraînement et l'usage | RAPPORT §5.1 | ✅ |
| | Format et transformation | RAPPORT §5.2, `src/ml/features.ts` | ✅ |
| | Qualité, par source (y compris accessibilité) | RAPPORT §5.3, page **Données** (contrôles automatiques) | ✅ |
| | Documentation des caractéristiques | `docs/DATASHEET-synthetique.md`, `docs/DATASHEET-kdd98.md` | ✅ |
| **Prototype** | Démonstration de l'IA | Application (8 pages), page **Modèle IA** | ✅ |
| | Tous les éléments sources livrés, reproductible | Dépôt git, `npm run …`, graines fixes, `model.json` versionné | ✅ |
| | Honnêteté sur les écarts avec la solution cible | RAPPORT §6.4 | ✅ |
| | Aucune donnée réelle d'organisation | Synthétique ; KDD 98 public, organisation non nommée | ✅ Prévenir Epsilon (conditions d'usage) |
| **Risques et éthique** | Risques (individuels, sociétaux, légaux, infrastructure) | RAPPORT §7 | ✅ |
| | Éthique sur tout le cycle de vie, avec cadres du cours | RAPPORT §8 (Suresh et Guttag, Rismani, NIST, Loi 25, Déclaration de Montréal) | ✅ |
| **Estimations** | Ressources humaines, matérielles, financières | RAPPORT §9.1 à 9.3 | ✅ Chiffres à valider |
| | Temps et sous-ensemble de la V1 | RAPPORT §9.4 | ✅ |
| **Réflexion** | Au moins 3 leçons apprises | RAPPORT §10 (5 leçons, plus une optionnelle) | ✅ |
| **Commentaires généraux** | Au moins 10 références, dont au moins la moitié académiques | RAPPORT, Références (19 académiques, 6 autres) | ✅ Vérifier les entrées marquées [vérifier] |
| | Cohérence et intégration | Mêmes chiffres dans l'application, le rapport et la fiche modèle (sources : `reports/`) | ✅ |
| **Présentation** | Affiche, démonstration, vidéo de secours | `docs/PRESENTATION.md` | 🟡 Affiche à monter, vidéo à enregistrer |

## À faire par l'équipe

1. Mettre le canevas au format du gabarit du cours (`TECH 60711_S02_AI Canvas`).
2. Vérifier les références marquées [vérifier] et ajouter 2 ou 3 lectures du cours si possible : Amershi et al. (2019), Sculley et al. (2015), Moorosi et al. (2023).
3. Valider les estimations financières (§9.3).
4. Envoyer la notification d'usage de KDD Cup 1998 aux contacts d'Epsilon (voir la datasheet).
5. Enregistrer la vidéo de démonstration de secours (5 min, script dans `PRESENTATION.md`).
6. Confirmer avec l'enseignante la longueur du rapport et le format de remise.
