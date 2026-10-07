# Fiche modèle : Fidélia

Format inspiré des *Model Cards* (Mitchell et al., 2019).

## Détails

| | |
|---|---|
| **Modèles** | 4 classifieurs binaires (attrition, hausse, passage au mensuel, réactivation) et une règle de remerciement sans IA |
| **Algorithmes** | Régression logistique (Adam, L2), gradient boosting d'arbres (histogrammes, sous-échantillonnage, arrêt précoce), ensemble des deux. Codés en TypeScript sans bibliothèque de ML et vérifiés contre scikit-learn (`verification/`) |
| **Choix de l'algorithme** | Le meilleur modèle est choisi sur le jeu de validation, par AUC-PR. **Il n'est déployé que s'il bat la règle RFM sur le test** (requis R1 et R2) ; sinon, la liste est classée par la règle RFM calibrée. L'équipe peut forcer un choix dans l'interface |
| **Version** | Inscrite dans `src/data/model.json` (ex. `v20261006.2353`) et affichée dans l'application. Réentraînement : `npm run train` |
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
| R1 | AUC-PR ≥ 2 × taux de base | Faire nettement mieux que contacter au hasard |
| R2 | Écart d'AUC-PR avec RFM > 0 avec 95 % de confiance (bootstrap apparié) | Justifier l'IA face à la méthode traditionnelle ; condition de déploiement |
| R3 | Précision des 50 premiers noms ≥ règle RFM | Une petite équipe contacte quelques dizaines de personnes par semaine |
| R4 | Score de Brier < prédiction constante | La valeur attendue (probabilité × montant) suppose des probabilités fiables |
| R5 | AUC du test temporel ≥ AUC du test − 0,05 | Stabilité dans le temps |
| R6 | Dans chaque tranche d'âge, probabilité prédite / taux observé entre 0,67 et 1,5 | Équité : ne sur-estimer ni sous-estimer aucun groupe |

Les requis sont vérifiés automatiquement à chaque entraînement (page **Modèle IA**). Avec le modèle livré : **17 sur 24**.

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

**Robustesse :** sur 5 autres jeux générés (`npm run robustness`), le modèle a une AUC-PR supérieure à RFM dans **20 cas sur 20**. Il passe la condition de déploiement (écart significatif) dans **15 cas sur 20** :

| Modèle | Fidélia AUC-PR | RFM AUC-PR | Déployé |
|---|---|---|---|
| Attrition | 0,209 ± 0,032 | 0,097 ± 0,007 | 5/5 |
| Réactivation | 0,215 ± 0,032 | 0,087 ± 0,012 | 5/5 |
| Passage au mensuel | 0,106 ± 0,065 | 0,042 ± 0,018 | 4/5 |
| Hausse | 0,103 ± 0,040 | 0,057 ± 0,011 | 1/5 |

## Résultats sur données réelles (KDD Cup 1998, 18 824 donateurs de test)

| Tâche | Taux de base | Modèle AUC-PR [IC 95 %] | RFM AUC-PR [IC 95 %] | AUC modèle / RFM |
|---|---|---|---|---|
| Réactivation | 5,08 % | 0,083 [0,075–0,094] | 0,053 [0,049–0,058] | 0,62 / 0,53 |
| Hausse du don | 1,73 % | 0,040 [0,033–0,050] | 0,019 [0,017–0,021] | 0,68 / 0,53 |

**Profit net de la relance sur le test**, à 0,68 $ US par envoi :

| Stratégie | Profit net |
|---|---|
| Envoyer à tout le monde | 1 975 $ |
| 20 % des envois, ciblage par le modèle | 2 133 $ |
| 20 % des envois, ciblage RFM | 1 413 $ |

Le modèle fait donc **+51 % par rapport à RFM, avec 5 fois moins d'envois** que l'envoi à tout le monde.

À gros volume (68 % des envois), le modèle (2 320 $) et RFM (2 422 $) font jeu égal. La performance absolue sur données réelles (AUC environ 0,62) est modeste, comme dans la littérature sur ce jeu. Prédire la réponse à une relance reste difficile.

## Équité

L'âge et la région ne sont **pas** des variables du modèle. Pourtant :
- **Passage au mensuel :** le modèle sous-estime les 70 ans et plus (prédit / observé = 0,54) et sur-estime les 35-54 ans (2,24). R6 n'est pas validé. Les 70 ans et plus restent sur-représentés dans les 20 % mieux classés (ratio de sélection 1,80).
- **Réactivation :** sur-estimation des 35-54 ans (2,03).
- **Attrition :** calibrée dans toutes les tranches (R6 validé). Les 55 ans et plus sont peu ciblés (ratio 0,42 à 0,48) parce qu'ils arrêtent moins.
- **KDD 98 :** ratio de sélection de 1,47 pour les 75 ans et plus.

**Explication.** L'âge influence la fidélité. Sans accès à l'âge, le modèle ne peut pas corriger cet écart : « l'équité par ignorance » ne garantit pas la calibration.

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

1. Les données synthétiques reflètent les hypothèses du générateur. Seules la réactivation et la hausse sont validées sur données réelles.
2. Les modèles prédisent une **propension**, pas l'**effet causal** d'une action. Un groupe témoin de 10 % est prévu pour mesurer l'effet réel.
3. Petits effectifs de test pour les mensuels (environ 700 à 800 exemples), d'où des intervalles de confiance larges.
4. Deux fuites de données ont été trouvées et corrigées pendant le projet (voir RAPPORT, leçon 2). Tout nouveau calcul de variable doit être revu sous cet angle.
5. Boucle de rétroaction (Sculley et al., 2015) : une fois les relances lancées, les étiquettes futures sont influencées par le modèle. Le groupe témoin sert aussi à garder des données d'entraînement non biaisées.

## Surveillance en production

- **Chaque semaine :** distribution des scores, taux de base observés, alertes si l'AUC-PR glissante passe sous la règle RFM.
- **Chaque trimestre :** réentraînement, audit d'équité, comparaison contactés / témoins.
- **Retour arrière :** chaque version de `model.json` est conservée dans git ; il suffit de redéployer la version précédente.
