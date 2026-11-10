# Fiche modèle : Fidélia

Format inspiré des *Model Cards* (Mitchell et al., 2019).

## Détails

| | |
|---|---|
| **Modèles** | 4 classifieurs binaires (attrition, hausse, passage au mensuel, réactivation) et une règle de remerciement sans IA |
| **Algorithmes** | Régression logistique (Adam, L2), gradient boosting d'arbres (histogrammes, sous-échantillonnage, arrêt précoce), ensemble des deux. Codés en TypeScript sans bibliothèque de ML et vérifiés contre scikit-learn (`verification/`) |
| **Choix de l'algorithme** | Le meilleur modèle est choisi sur le jeu de validation, par AUC-PR. **Il n'est déployé que s'il fait au moins 2 fois mieux que le hasard (R1) et bat la règle RFM de façon significative sur le test (R2)** ; sinon, la liste est classée par la règle RFM calibrée. L'équipe peut forcer un choix dans l'interface |
| **Version** | Inscrite dans `src/data/model.json` (version actuelle : `v20261110.0138`) et affichée dans l'application. Réentraînement : `npm run train` |
| **Référence de comparaison** | Règle RFM (récence, fréquence, montant, quintiles), la méthode traditionnelle des collecteurs de fonds |

## Usage prévu

- **Utilisateurs :** responsables des dons d'un OBNL de 1 à 5 personnes, sans analyste de données.
- **Usage :** classer les donateurs à contacter chaque semaine et proposer une action et un brouillon de courriel. **Aide à la décision** : un humain valide chaque envoi.
- **Hors périmètre :**
  - décision automatique sans validation ;
  - estimation du patrimoine ;
  - toute décision sur l'accès à un service ;
  - ciblage à partir de l'âge, de l'origine ou du quartier.

## Variables

18 variables comportementales calculées avant la date de prédiction (voir `DATASHEET-synthetique.md`). Âge et région sont **exclus** des variables et servent seulement à l'audit d'équité.

## Requis de performance (fixés avant l'entraînement)

| Id | Requis | Raison d'affaires |
|---|---|---|
| R1 | AUC-PR ≥ 2 × taux de base | Faire nettement mieux que contacter au hasard ; condition de déploiement avec R2 |
| R2 | Écart d'AUC-PR avec RFM > 0 avec 95 % de confiance (bootstrap apparié) | Justifier l'IA face à la méthode traditionnelle ; condition de déploiement avec R1 |
| R3 | Précision des 50 premiers noms ≥ règle RFM | Une petite équipe contacte quelques dizaines de personnes par semaine |
| R4 | Score de Brier < prédiction constante | La valeur attendue (probabilité × montant) suppose des probabilités fiables |
| R5 | AUC du test temporel ≥ AUC du test − 0,05 | Stabilité dans le temps |
| R6 | Dans chaque tranche d'âge mesurable, probabilité prédite / taux observé entre 0,67 et 1,5. Une tranche est mesurable si elle compte au moins 100 cas et au moins 5 positifs | Équité : ne sur-estimer ni sous-estimer aucun groupe |

Les requis sont vérifiés automatiquement à chaque entraînement (page **Modèle IA**). Pour le meilleur modèle candidat de chaque tâche : **17 sur 24** (6 requis × 4 modèles). Pour la hausse, le modèle livré est la règle RFM : ses 4 échecs portent sur un modèle non déployé. R1 et R2 sont bloquants ; R3 à R6 sont des alertes à lever par un humain avant usage réel.

- Attrition : 6/6.
- Passage au mensuel : 5/6, R6 non validé.
- Réactivation : 4/6, R5 et R6 non validés.
- Hausse : 2/6 ; le modèle ne bat pas RFM, la liste utilise donc la règle RFM.

## Résultats sur le jeu synthétique (test, donateurs jamais vus, graine 42)

| Modèle | Taux de base | Candidat | AUC-PR [IC 95 %] | RFM AUC-PR [IC 95 %] | Écart apparié [IC 95 %] | AUC-ROC (modèle / RFM) | Déployé |
|---|---|---|---|---|---|---|---|
| Attrition 90 j | 6,7 % | Boosting | 0,243 [0,162–0,377] | 0,091 [0,068–0,139] | +0,152 [0,058 ; 0,255] | 0,710 / 0,585 | Modèle |
| Passage au mensuel 6 mois | 1,8 % | Ensemble | 0,113 [0,076–0,195] | 0,043 [0,031–0,080] | +0,070 [0,028 ; 0,124] | 0,818 / 0,677 | Modèle |
| Réactivation 6 mois | 3,9 % | Boosting | 0,123 [0,080–0,241] | 0,039 [0,027–0,060] | +0,084 [0,036 ; 0,187] | 0,747 / 0,598 | Modèle |
| Hausse 6 mois | 4,1 % | Ensemble | 0,076 [0,047–0,134] | 0,066 [0,042–0,113] | +0,011 [−0,024 ; 0,059] | 0,637 / 0,647 | **Règle RFM** |

**Test temporel** (entraînement sur les dates anciennes, test sur les 4 plus récentes), AUC :
- attrition 0,671 ;
- hausse 0,656 ;
- conversion 0,818 ;
- réactivation 0,643.

La réactivation se dégrade dans le temps (R5) : la population des inactifs change à mesure que l'historique s'allonge.

**Robustesse :** sur 5 autres jeux générés (`npm run robustness`), le modèle a une AUC-PR supérieure à RFM dans **20 cas sur 20**. Il remplit la condition de déploiement (R1 + R2) dans **15 cas sur 20** :

| Modèle | Fidélia AUC-PR | RFM AUC-PR | Déployé (R1 + R2) |
|---|---|---|---|
| Attrition | 0,209 ± 0,032 | 0,097 ± 0,007 | 5/5 |
| Réactivation | 0,215 ± 0,032 | 0,087 ± 0,012 | 5/5 |
| Passage au mensuel | 0,106 ± 0,065 | 0,042 ± 0,018 | 4/5 |
| Hausse | 0,103 ± 0,040 | 0,057 ± 0,011 | 1/5 |

## Résultats sur données réelles (KDD Cup 1998, 18 824 donateurs de test sur 95 412)

| Tâche | Taux de base | Modèle AUC-PR [IC 95 %] | RFM AUC-PR [IC 95 %] | AUC modèle / RFM |
|---|---|---|---|---|
| Réactivation | 5,08 % | 0,083 [0,075–0,094] | 0,053 [0,049–0,058] | 0,62 / 0,53 |
| Hausse du don | 1,73 % | 0,040 [0,033–0,050] | 0,019 [0,017–0,021] | 0,68 / 0,53 |

Sur KDD 98, la « hausse » est un donateur inactif dont la réponse à la relance dépasse son dernier don (`TARGET_D > LASTGIFT`). Ce n'est pas la même cible que la hausse du mensuel dans l'application.

**Règle de déploiement appliquée à KDD 98 :**

| Tâche | R1 : AUC-PR ≥ 2 × taux de base | R2 : écart apparié avec RFM [IC 95 %] | Déployable |
|---|---|---|---|
| Réactivation | 0,083 < 0,102 : **non validé** | [0,022 ; 0,039] : validé | **Non** |
| Hausse du don | 0,040 ≥ 0,035 : validé | [0,016 ; 0,031] : validé | Oui |

Le modèle de réactivation bat RFM de façon significative, mais ne fait pas 2 fois mieux que le hasard. Selon notre règle, il ne serait pas déployé. Sa courbe d'apprentissage est plate (0,082 avec 7 660 exemples, 0,083 avec 76 588) : la limite vient des variables, pas du volume.

**Profit net de la relance sur le test**, à 0,68 $ US par envoi :

| Stratégie | Profit net |
|---|---|
| Envoyer à tout le monde | 1 975 $ |
| 20 % des envois, ciblage par le modèle | 2 133 $ |
| 20 % des envois, ciblage RFM | 1 413 $ |

La méthode de classement fait donc **+51 % par rapport à RFM, avec 5 fois moins d'envois** que l'envoi à tout le monde. Ce modèle de réactivation échoue pourtant à R1 (0,083 < 0,102) : c'est une validation de la méthode, pas un modèle que nous déploierions.

À gros volume (68 % des envois), RFM fait même un peu mieux : 2 422 $ contre 2 320 $ pour le modèle. La performance absolue sur données réelles (AUC environ 0,62) est modeste, comme dans la littérature sur ce jeu. Prédire la réponse à une relance reste difficile.

## Équité

L'âge et la région ne sont **pas** des variables du modèle. Pourtant :
- **Passage au mensuel :** le modèle sous-estime les 70 ans et plus (prédit / observé = 0,54, environ 38 conversions) et sur-estime les 35-54 ans (2,24, environ 8 conversions sur 1 290 cas). R6 n'est pas validé. Les 70 ans et plus restent sur-représentés dans les 20 % mieux classés (ratio de sélection 1,80, IC 95 % [1,51 ; 2,10]).
- **Réactivation :** sur-estimation des 35-54 ans (2,03).
- **Attrition :** R6 validé dans les tranches mesurables ; la tranche 55-69 ans est à la limite (0,68). Les 70 ans et plus (126 cas, 2 départs observés) sont exclus faute d'effectif ; leur ratio vaudrait 2,28. Les 70 ans et plus sont peu ciblés (ratio de sélection 0,48) parce qu'ils arrêtent moins (1,6 % de départs observés). Les 55-69 ans le sont aussi (0,42), alors que leur taux de départ (6,0 %) est proche de la moyenne (6,7 %) : le modèle les sous-estime (prédit 4,1 % / observé 6,0 % = 0,68, à la limite de R6). Source : `reports/synthetique-42.json`.
- **KDD 98 :** ratio de sélection de 1,47 pour les 75 ans et plus.

**Prudence.** Les ratios de calibration (R6) reposent sur peu de positifs et n'ont pas encore d'intervalle de confiance. Les ratios de sélection en ont un (bootstrap par donateur, 1 000 tirages, `reports/impact-42.json`). Surtout, les données sont synthétiques : le générateur lie l'attachement à l'âge (`src/data/generate.ts`). Les écarts reflètent donc d'abord nos hypothèses. L'audit doit être refait sur les données réelles de l'organisation.

**Explication.** Dans le générateur, l'âge influence la fidélité. Sans accès à l'âge, le modèle ne peut pas corriger cet écart : « l'équité par ignorance » ne garantit pas la calibration.

**Options :**
1. recalibrer par tranche d'âge, ce qui demande d'utiliser l'âge, une donnée sensible ;
2. accepter l'écart et le surveiller ;
3. retirer le modèle pour ce cas d'usage.

**Choix actuel : l'option 2**, avec garde-fous :
- plafond d'un courriel par 30 jours ;
- remerciement avant toute demande ;
- validation humaine ;
- audit trimestriel.

## Limites connues

1. Les données synthétiques reflètent les hypothèses du générateur. KDD 98 valide la **méthode** sur deux tâches voisines : la réactivation d'inactifs et un don plus élevé que le dernier, chez des inactifs. Il ne valide pas le modèle de hausse du mensuel, qui n'est d'ailleurs pas déployé. Sur KDD 98, la réactivation échoue à R1.
2. Les modèles prédisent une **propension**, pas l'**effet causal** d'une action. Un groupe témoin de 10 % est prévu pour mesurer l'effet réel.
3. Petits effectifs de test pour les mensuels (environ 700 à 800 exemples), d'où des intervalles de confiance larges.
4. Deux fuites de données ont été trouvées et corrigées pendant le projet (voir RAPPORT, leçon 2). Tout nouveau calcul de variable doit être revu sous cet angle.
5. Boucle de rétroaction (Sculley et al., 2015) : une fois les relances lancées, les étiquettes futures sont influencées par le modèle. Le groupe témoin sert aussi à garder des données d'entraînement non biaisées.

## Surveillance en production

- **Chaque semaine :** distribution des scores, taux de base observés, alertes si l'AUC-PR glissante passe sous la règle RFM.
- **Chaque trimestre :** réentraînement, audit d'équité, comparaison contactés / témoins.
- **Retour arrière :** chaque version de `model.json` est conservée dans git ; il suffit de redéployer la version précédente.
