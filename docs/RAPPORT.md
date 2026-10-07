# Fidélia : qui relancer, remercier ou solliciter

**TECH60711, Réalisation d'applications d'intelligence artificielle, HEC Montréal, automne 2026**
**Équipe 4 :** Geoffrey Carel, Juliette Ponce, Juliette Violon, Paul Soubigou

> Brouillon de rapport rédigé à partir du prototype. Les chiffres viennent des scripts du dépôt (`npm run evaluate`, `npm run kdd98`, `npm run robustness`) et sont reproductibles. Les passages entre crochets [ ] sont à compléter ou valider par l'équipe.

---

## 1. Idée

### 1.1 Description

Fidélia est un outil web pour les OBNL de petite taille (1 à 5 personnes à la collecte de fonds, sans analyste de données). Il lit l'historique des dons et produit chaque semaine **quatre listes d'actions** :

| Liste | Question | Méthode |
|---|---|---|
| **Relancer** | Quel donateur mensuel risque d'arrêter son don dans les 90 jours ? | Modèle d'attrition |
| **Proposer le mensuel** | Quel donateur ponctuel ou annuel passerait au don mensuel dans les 6 mois ? | Modèle de conversion |
| **Solliciter plus** | Quel donateur mensuel fidèle augmenterait son don ? Quel inactif redonnerait ? | Modèles de hausse et de réactivation |
| **Remercier** | Qui vient de faire un premier don, un don inhabituel ou d'atteindre un anniversaire ? | Règle simple, sans IA |

Pour chaque donateur, l'outil affiche :
- la probabilité ;
- la valeur attendue (probabilité × montant annuel) ;
- les trois raisons principales de la prédiction ;
- un brouillon de courriel personnalisé.

L'équipe relit, ajuste et valide chaque envoi.

### 1.2 Motivation

**Moins d'un donateur sur deux redonne l'année suivante** : 43,3 % de rétention en 2025 selon le Fundraising Effectiveness Project, sur 15 102 OBNL américains (AFP et GivingTuesday, 2026). Acquérir un nouveau donateur coûte bien plus cher que d'en retenir un (Sargeant, 2001). Le don mensuel est le plus précieux : revenu prévisible, meilleure rétention, valeur à vie plus élevée.

Une petite équipe ne peut pas analyser des milliers de fiches. Elle relance donc tout le monde avec le même message, ou personne. Fidélia concentre son peu de temps sur les bons donateurs, avec le bon message, au bon moment.

### 1.3 Pourquoi l'IA ?

La méthode traditionnelle du secteur est la **segmentation RFM** (récence, fréquence, montant ; Fader, Hardie et Lee, 2005). Elle classe tout le monde sur trois variables, avec des seuils fixes.

Un modèle d'apprentissage supervisé :
1. **combine davantage de signaux** : échecs de paiement, ouverture des courriels, tendance, canal d'acquisition, saisonnalité, date anniversaire ;
2. **apprend leurs poids et leurs interactions** à partir de l'historique de l'organisation elle-même, au lieu de seuils universels ;
3. **produit une probabilité calibrée**, indispensable pour calculer une valeur attendue et arbitrer entre des actions différentes ;
4. **explique chaque prédiction**, ce que RFM ne fait que grossièrement.

Nous avons fixé un garde-fou dès la séance 6 : **on ne garde le modèle que s'il bat la règle RFM**. L'application l'applique automatiquement : un modèle n'est déployé que s'il bat RFM de façon statistiquement significative. C'est le cas pour 3 des 4 modèles (attrition, passage au mensuel, réactivation) et sur de vraies données de donateurs (KDD Cup 1998). Pour le 4e, « solliciter plus », le modèle ne fait pas mieux sur nos données : Fidélia garde donc la règle RFM pour cette liste (section 6).

### 1.4 Proposition de valeur

*Pour les responsables des dons des petits OBNL, qui n'ont ni le temps ni les compétences pour analyser leur base, Fidélia est un assistant de fidélisation. Il livre chaque semaine une courte liste priorisée de donateurs à contacter, avec la raison et un brouillon de message. Contrairement aux CRM qui affichent des données brutes ou un score RFM fixe, Fidélia apprend du comportement des donateurs de l'organisation, mesure honnêtement sa performance face à la méthode traditionnelle et garde l'humain aux commandes.*

### 1.5 Impact visé

**Pour l'organisation**, avec le jeu de démonstration de 4 000 donateurs :
- 7 998 $ par an de dons mensuels à risque d'attrition ;
- environ 26 900 $ par an de valeur en jeu au total.

À effort égal (300 donateurs contactés), le ciblage par le modèle récupère environ **2 434 $ par an, contre 676 $ avec la règle RFM** (×3,6 ; page **Impact**). Le seul paramètre hypothétique de ce calcul est l'effet de l'action ; la qualité du ciblage, elle, est mesurée sur le jeu de test.

**Sur données réelles** (KDD Cup 1998), avec un budget limité à 20 % des envois : +51 % de profit net par rapport à RFM, avec 5 fois moins d'envois qu'un envoi à tous.

**Pour les donateurs**, moins de sollicitations génériques et plus de remerciements :
- un courriel au plus par 30 jours ;
- un remerciement avant toute nouvelle demande.

**Pour le secteur**, un outil accessible aux petites organisations, qui n'ont pas les moyens d'un analyste.

---

## 2. Canevas d'IA (Agrawal, Gans et Goldfarb, 2018)

Un canevas par prédiction. Les quatre partagent les cases Données, Action et Rétroaction.

| Case | Attrition | Passage au mensuel | Hausse | Réactivation |
|---|---|---|---|---|
| **Prédiction** | P(arrêt du mensuel dans 90 j) | P(passage au mensuel dans 6 mois) | P(hausse du don mensuel dans 6 mois) | P(nouveau don dans 6 mois) |
| **Jugement** | Rater un départ coûte le don annuel (≈ 240 $). Relancer à tort coûte peu, mais agace | Solliciter trop tôt peut faire fuir ; montant suggéré raisonnable | Ne jamais demander plus à un donateur à risque | Coût d'un envoi contre un don moyen de retour |
| **Action** | Courriel de relance (carte expirée, impact du don, option de pause) | Proposition de mensuel avec montant suggéré | Demande de hausse de 5 ou 10 $ | Courriel « vous nous manquez » |
| **Résultat** | Donateur conservé ou non (90 j) | Conversion ou non (6 mois) | Hausse ou non | Don ou non |
| **Entrée** | 18 variables comportementales à la date d'analyse (section 5) | idem | idem | idem |
| **Entraînement** | Historique de dons et d'ouvertures des courriels de l'organisation, photos mensuelles sur 4 ans | idem | idem | idem |
| **Rétroaction** | Résultats des actions (donné ou non), comparés à un **groupe témoin de 10 %** non contacté ; réentraînement trimestriel | idem | idem | idem |

Lecture pour un non-spécialiste : l'IA rend la **prédiction** bon marché. L'équipe garde le **jugement** : seuils, ton, validation. Les **résultats** des campagnes réalimentent le modèle.

---

## 3. Requis fonctionnels

Légende : **[IA]** = le requis repose sur un modèle d'apprentissage. **[P]** = démontré dans le prototype.

| # | Requis | IA | Prototype |
|---|---|---|---|
| RF1 | Importer l'historique des dons et des donateurs depuis un export CSV du CRM ou de la plateforme de dons | | P |
| RF2 | Contrôler automatiquement la qualité des données importées (complétude, validité, doublons, cohérence, actualité, consentement) | | P |
| RF3 | Calculer pour chaque donateur actif un **risque d'attrition** à 90 jours | IA | P |
| RF4 | Calculer une **propension au passage au mensuel** à 6 mois et suggérer un montant | IA | P |
| RF5 | Calculer une **propension à augmenter** le don mensuel | IA | P |
| RF6 | Calculer une **probabilité de réactivation** des inactifs | IA | P |
| RF7 | Identifier les donateurs **à remercier** (règle explicite) | | P |
| RF8 | Choisir pour chaque donateur l'action la plus utile et classer par **valeur attendue** | IA | P |
| RF9 | **Expliquer** chaque prédiction par ses trois facteurs principaux | IA | P |
| RF10 | Générer un **brouillon de courriel** personnalisé, sans montant ni fait inventé | (IA en V2) | P (gabarits) |
| RF11 | Validation humaine obligatoire avant tout envoi, modifiable par type d'action | | P |
| RF12 | Plafond de sollicitation : un courriel par donateur et par 30 jours ; remerciement prioritaire | | P |
| RF13 | Respect du consentement : aucun courriel sans consentement, lien de désabonnement | | P |
| RF14 | **Groupe témoin** de 10 % pour mesurer l'effet réel des actions | | P |
| RF15 | Tableau de bord : revenus, segments, valeur à risque, santé des modèles | IA | P |
| RF16 | Page **Impact** : dons récupérables selon la capacité de l'équipe, comparés à RFM et au hasard | IA | P |
| RF17 | Page **Modèle** : métriques, requis de performance, équité, version du modèle | IA | P |
| RF18 | Réentraînement planifié (hebdomadaire pour les scores, trimestriel pour le modèle) et retour à la version précédente | IA | P (manuel) |
| RF19 | Envoi réel par un fournisseur de courriels et suivi des ouvertures | | Non (simulé) |
| RF20 | Authentification, comptes par organisation, journal des accès | | Non |
| RF21 | Temps de réponse : liste de la semaine affichée en moins de 2 s | | P (modèle pré-entraîné) |
| RF22 | Interface en français, utilisable sur ordinateur et téléphone | | P |

### User stories (extrait)

- *En tant que responsable des dons*, je veux voir chaque lundi les 50 donateurs à contacter en priorité, pour utiliser mes 2 heures de la semaine au mieux. (RF8)
- *En tant que responsable des dons*, je veux savoir **pourquoi** un donateur est signalé, pour adapter mon message et faire confiance à l'outil. (RF9)
- *En tant que directrice*, je veux savoir combien de dons l'outil peut nous faire récupérer avant de l'adopter. (RF16)
- *En tant que donateur*, je ne veux pas recevoir trois demandes dans le mois. (RF12)
- *En tant que bénévole au CA*, je veux vérifier que l'outil ne cible pas injustement les aînés. (RF17, équité)

---

## 4. Requis techniques

### 4.1 Tâche et type de modèle

- **Tâche :** 4 problèmes de **classification binaire supervisée** sur données tabulaires et temporelles, avec des classes déséquilibrées (2 à 8 % de positifs).
- **Apprentissage :** supervisé, avec des étiquettes construites à partir de l'historique (photo à la date T, résultat observé sur l'horizon).
- **Algorithmes :**
  - **régression logistique** : lisible, coefficients interprétables, bien calibrée ;
  - **gradient boosting d'arbres** (Friedman, 2001) : capte les interactions et les seuils, par exemple deux échecs de paiement consécutifs ;
  - **ensemble** des deux.
  Choix automatique sur un jeu de validation.
- **Référence :** règle RFM par quintiles.

### 4.2 Pourquoi un modèle personnalisé plutôt qu'un modèle pré-entraîné ?

| Option | Évaluation |
|---|---|
| Modèle pré-entraîné (Hugging Face) | Aucun modèle public ne prédit l'attrition de donateurs ; chaque base est propre à son organisation |
| Service clé en main (scoring d'un CRM, AutoML) | Coûteux pour un petit OBNL, boîte noire, données envoyées à un tiers hors Canada |
| LLM généraliste (ChatGPT, Gemini) | Mauvais en prédiction tabulaire calibrée, non reproductible, coût par appel |
| **Modèle personnalisé, petit** | Entraîné sur les données de l'organisation, explicable, gratuit à l'usage, exécutable localement |

Nous avons choisi des **modèles petits et frugaux** (Varoquaux, Luccioni et Whittaker, 2025). Ils sont **codés à la main** en TypeScript pour tourner dans le navigateur, sans serveur de calcul. Leur justesse est **vérifiée contre scikit-learn** sur les mêmes données (`verification/RESULTATS.md`) : la régression logistique donne la même AUC-PR à 0,003 près, le boosting le même ordre de grandeur (écart ≤ 0,03).

Un **LLM pré-entraîné**, sans entraînement supplémentaire, est prévu en V2 pour reformuler les gabarits de courriels. Il reste sous validation humaine, ne reçoit que des champs non libres (pas de notes du CRM, contre l'injection de requêtes) et n'a aucun droit d'inventer un montant.

### 4.3 Requis de performance

Fixés **avant** l'entraînement (Huyen, 2022, ch. 2 : relier métrique ML et métrique d'affaires). Ils sont vérifiés automatiquement à chaque réentraînement.

| Id | Métrique et seuil | Lien avec l'affaire |
|---|---|---|
| R1 | AUC-PR ≥ 2 × taux de base | Faire nettement mieux que le hasard |
| R2 | Écart d'AUC-PR avec RFM > 0 avec 95 % de confiance (bootstrap apparié) | Justifier l'IA ; **condition de déploiement** avec R1 |
| R3 | Précision des 50 premiers noms ≥ RFM | Capacité hebdomadaire d'une petite équipe |
| R4 | Score de Brier < prédiction constante | Valeur attendue = probabilité × montant |
| R5 | AUC du test temporel ≥ AUC du test − 0,05 | Stabilité face à la dérive |
| R6 | Calibration par tranche d'âge entre 0,67 et 1,5 | Équité (section 8) |

**Gouvernance.** Si R1 ou R2 échoue, l'application n'utilise pas le modèle et classe les donateurs avec la règle RFM, calibrée en probabilité. La décision est affichée dans la page Modèle IA.

**Pourquoi l'AUC-PR plutôt que l'exactitude ?** Avec 2 à 8 % de positifs, prédire « non » partout donne plus de 92 % d'exactitude. La précision moyenne (aire sous la courbe précision-rappel) est plus informative en classes déséquilibrées (Saito et Rehmsmeier, 2015).

### 4.4 Système d'IA

```
 CRM / plateforme de dons ──CSV──▶ Import + contrôles de qualité
 Outil de courriels (ouvertures) ─▶        │
                                           ▼
                        Calcul des 18 variables à la date d'analyse
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
   Entraînement (trimestriel)     Scoring (hebdomadaire)       Règle « remercier »
   photos mensuelles, réglage     4 modèles + explications
   sur validation, test, audit             │
   d'équité → model.json versionné ───────▶│
                                           ▼
                    Choix de l'action (valeur attendue, garde-fous)
                                           ▼
                Brouillons de courriels → validation humaine → envoi
                                           ▼
                Résultats et groupe témoin → rétroaction au modèle
```

### 4.5 Déploiement et technologies

| | Prototype (livré) | Solution cible |
|---|---|---|
| Interface | React 19 + TypeScript + Tailwind, site statique (GitHub Pages) | Identique, derrière une authentification |
| Calcul des modèles | Dans le navigateur (Web Worker) ; modèle pré-entraîné `model.json` | Tâche planifiée en conteneur Docker (même code TypeScript, ou Python et scikit-learn) |
| Données | Générées localement ou importées en CSV, jamais envoyées | PostgreSQL hébergé au Canada, chiffré, une base par organisation |
| Courriels | Simulés | Fournisseur d'envoi (Brevo, Mailchimp), suivi des ouvertures, désabonnement |
| Vérification | Script Python et scikit-learn | Idem, dans l'intégration continue |

Le prototype exécute le modèle **côté client** (edge). Coût d'hébergement nul, et les données de l'organisation ne quittent jamais le poste. Contrepartie : maintenance et surveillance plus difficiles, ce qui justifie le passage à une tâche serveur en production.

**Langages :**
- TypeScript pour l'interface et le ML. Un seul langage permet de partager exactement le même calcul de variables entre entraînement et production, ce qui évite le décalage entre entraînement et service.
- Python pour la vérification indépendante.

---

## 5. Requis relatifs aux données

### 5.1 Sources

| Source | Rôle | Format | Disponibilité |
|---|---|---|---|
| **S1. Jeu synthétique** (`src/data/generate.ts`) | Entraînement et démonstration, 4 cas d'usage | Objets JSON ; export CSV | Généré, reproductible (graine) |
| **S2. KDD Cup 1998** (archive UCI) | Validation sur **vrais donateurs** : réactivation et hausse | Texte délimité, 95 412 lignes × 481 champs | Public, sous conditions (`docs/DATASHEET-kdd98.md`) |
| **S3. CRM de l'organisation** (production) | Entraînement et scoring réels | Export CSV : donateurs, dons, consentement | Accord de l'organisation ; Loi 25 |
| **S4. Outil de courriels** (production) | Ouvertures mensuelles | CSV ou API | Uniquement pour les donateurs consentants |

Aucune donnée réelle d'organisation n'est utilisée dans le projet, conformément aux consignes. S2 est un jeu public de recherche.

### 5.2 Transformation

1. **Photos temporelles :** pour chaque date T (tous les 2 à 6 mois sur 4 ans), on ne garde que les dons antérieurs à T, ce qui évite les fuites. On calcule 18 variables puis l'étiquette sur l'horizon.
2. **Transformations :** logarithme des variables asymétriques (montants, récence, ancienneté). Imputation explicite du taux d'ouverture manquant, avec un indicateur dédié. Standardisation pour la régression logistique, découpage en quantiles pour le boosting.
3. **Découpage par donateur :** 60 % entraînement, 20 % validation, 20 % test. Un donateur photographié à plusieurs dates reste dans un seul jeu.
4. **Test temporel :** entraînement sur les dates anciennes, test sur les plus récentes.

Détail des variables : `docs/DATASHEET-synthetique.md`, section 4.

### 5.3 Qualité des données, par source (Strong, Lee et Wang, 1997)

| Dimension | S1 synthétique | S2 KDD 98 | S3 CRM réel (anticipé) |
|---|---|---|---|
| Exactitude | Exacte par construction | Élevée (transactionnel) | Risque de saisie manuelle, doublons |
| Crédibilité | Moyenne (calibrée) | Élevée (référence en recherche) | Élevée |
| Actualité | Configurable | Faible (1997) | Bonne si synchronisation hebdomadaire |
| Complétude | 14 % sans ouvertures (documenté) | Âge manquant à 25 % | Ouvertures absentes sans consentement |
| Pertinence | 4 cas d'usage | Réactivation et hausse seulement | Totale |
| Représentativité | Hypothèses du générateur | États-Unis, cause unique, aînés | Propre à l'organisation |
| Accessibilité | Locale | Publique, conditions d'usage | Export CSV, consentement, Loi 25 |
| Interprétabilité | Dictionnaire de données | Dictionnaire fourni (`cup98dic.txt`) | Variable selon le CRM |

Les contrôles mesurables sont **automatisés** dans la page **Données** : courriels valides, ouvertures, montants aberrants, dates futures, doublons d'identifiants et de courriels, dons orphelins, dons antérieurs à l'inscription, actualité du dernier don, taux de consentement. Le principe directeur est « fit for use » : une donnée est de qualité si elle convient à l'usage visé.

### 5.4 Documentation

- `docs/DATASHEET-synthetique.md` et `docs/DATASHEET-kdd98.md` (Gebru et al., 2021) : motivation, composition, processus, prétraitement, usages, distribution, maintenance.
- `docs/MODEL_CARD.md` : usage prévu, performances, équité, limites, surveillance.

---

## 6. Prototype

### 6.1 Ce qu'il démontre

Application web complète, en français, disponible en local et sur GitHub Pages :

| Page | Contenu |
|---|---|
| Tableau de bord | Revenus, segments, valeur à risque, priorités, santé des modèles face à RFM |
| Recommandations | Les listes par action, classées par valeur attendue, avec raisons et préparation des courriels en un clic |
| Impact | Dons récupérables selon la capacité de l'équipe et l'effet supposé ; modèle, RFM et hasard ; preuve sur données réelles |
| Donateurs | Fiche détaillée : probabilités, explication, historique de 24 mois, variables |
| Courriels | Brouillons, validation, envoi simulé, groupe témoin |
| Automatisations | Seuils, validation humaine, cycle hebdomadaire, garde-fous |
| Modèle IA | Méthode, requis de performance et décision de déploiement, comparaison avec IC et écart apparié contre RFM, courbes PR / ROC / gain, importance par permutation, calibration, test temporel, équité, simulateur, validation sur KDD 98 |
| Données | Import CSV, contrôles de qualité, génération, exports |

### 6.2 Résultats principaux

**Jeu synthétique, test (donateurs jamais vus, graine 42) :**

| Modèle | Taux de base | Fidélia AUC-PR [IC 95 %] | RFM AUC-PR [IC 95 %] | Écart [IC 95 % apparié] | Précision@50 (Fidélia / RFM) | Utilisé |
|---|---|---|---|---|---|---|
| Attrition | 6,7 % | **0,243** [0,162–0,377] | 0,091 [0,068–0,139] | +0,152 [0,058 ; 0,255] | 34 % / 8 % | Modèle (boosting) |
| Passage au mensuel | 1,8 % | **0,113** [0,076–0,195] | 0,043 [0,031–0,080] | +0,070 [0,028 ; 0,124] | 24 % / 12 % | Modèle (ensemble) |
| Réactivation | 3,9 % | **0,123** [0,080–0,241] | 0,039 [0,027–0,060] | +0,084 [0,036 ; 0,187] | 18 % / 2 % | Modèle (boosting) |
| Hausse | 4,1 % | 0,076 [0,047–0,134] | 0,066 [0,042–0,113] | +0,011 [−0,024 ; 0,059] | 10 % / 4 % | **Règle RFM** (repli) |

**Requis de performance : 17 sur 24 validés.**

| Modèle | Requis non validés |
|---|---|
| Attrition | aucun (6/6) |
| Hausse | R1, R2, R4, R6 : modèle remplacé par la règle RFM |
| Passage au mensuel | R6 (calibration par âge) |
| Réactivation | R5 (dérive temporelle), R6 |

Les échecs sont discutés en sections 8 et 10 ; nous ne les avons pas « corrigés » en modifiant les seuils ou le générateur.

- **Robustesse :** sur 5 autres jeux générés (`npm run robustness`), le modèle a une AUC-PR supérieure à RFM dans **20 cas sur 20**. Il passe la condition de déploiement (écart significatif) dans **15 cas sur 20** :

| Modèle | Fidélia AUC-PR | RFM AUC-PR | Déployé |
|---|---|---|---|
| Attrition | 0,209 ± 0,032 | 0,097 ± 0,007 | 5/5 |
| Réactivation | 0,215 ± 0,032 | 0,087 ± 0,012 | 5/5 |
| Passage au mensuel | 0,106 ± 0,065 | 0,042 ± 0,018 | 4/5 |
| Hausse | 0,103 ± 0,040 | 0,057 ± 0,011 | 1/5 |
- **Justesse :** résultats équivalents à scikit-learn (`verification/RESULTATS.md`).

**Données réelles, KDD Cup 1998 (18 824 donateurs de test) :**

| Tâche | Fidélia AUC-PR | RFM AUC-PR |
|---|---|---|
| Réactivation | **0,083** [0,075–0,094] | 0,053 [0,049–0,058] |
| Hausse | **0,040** [0,033–0,050] | 0,019 [0,017–0,021] |

Profit net de la relance avec 20 % des envois : **2 133 $ contre 1 413 $** pour RFM.

### 6.3 Reproduire

```bash
npm install
npm run dev
npm run calibration
npm run train
npm run evaluate
npm run robustness
./scripts/download-kdd98.sh && npm run kdd98
npm run export-rows && python3 verification/verify_sklearn.py
```

`npm run dev` lance l'application. Les autres commandes, dans l'ordre :
- vérifier la calibration du jeu synthétique ;
- entraîner et sérialiser le modèle versionné ;
- produire le rapport d'évaluation détaillé ;
- tester sur 5 jeux générés ;
- valider sur données réelles ;
- vérifier contre scikit-learn.

### 6.4 Différences entre le prototype et la solution cible

Déclarées en toute transparence :
- courriels simulés ;
- calcul côté navigateur plutôt que serveur ;
- pas d'authentification ;
- données synthétiques plutôt que CRM réel ;
- gabarits plutôt que LLM.

La solution cible reste réalisable avec le même code de modèle (section 4.5).

---

## 7. Risques

| Catégorie | Risque | Probabilité / gravité | Mesure |
|---|---|---|---|
| Données | Données réelles sales (doublons, montants saisis à la main) | Élevée / moyenne | Contrôles automatiques à l'import (RF2), rejet ou signalement |
| Données | Pas d'historique d'ouvertures (organisation sans outil de courriels) | Moyenne / moyenne | Variable d'absence ; modèle utilisable sans, avec une performance moindre |
| Modèle | Modèle appris sur synthétique, inadapté au réel | Élevée / élevée | Réentraînement obligatoire sur les données de l'organisation ; requis R1 à R6 vérifiés avant mise en service |
| Modèle | Dérive : crise, inflation, nouvelle campagne | Moyenne / moyenne | Requis R5, suivi hebdomadaire, réentraînement trimestriel, retour à la version précédente |
| Usage | Confondre propension et effet causal | Élevée / moyenne | Groupe témoin (RF14), effet traité comme hypothèse dans la page Impact |
| Usage | Automatisation excessive, envois sans relecture | Moyenne / élevée | Validation humaine par défaut (RF11) |
| Légal | Profilage sans information (Loi 25) | Moyenne / élevée | Avis de profilage, section 8.3 |
| Légal | Courriels sans consentement (LCAP) | Faible / élevée | RF13, désabonnement dans chaque courriel |
| Infrastructure | Fuite de la base de donateurs | Faible / très élevée | Prototype : rien ne quitte le navigateur. Cible : hébergement au Canada, chiffrement, comptes séparés |
| Réputation | Donateur choqué d'être « scoré » | Faible / élevée | Transparence, ton des messages, aucune donnée sensible utilisée |

---

## 8. Éthique

### 8.1 Sources de tort tout au long du cycle (Suresh et Guttag, 2021)

| Source | Dans Fidélia | Mesure |
|---|---|---|
| Biais historique | Les aînés donnent et redonnent plus : le modèle les classe plus haut pour la conversion (ratio de sélection 1,80 chez les 70 ans et plus) | Plafond de sollicitation, remerciement avant demande, suivi du ratio par âge |
| Représentation | Synthétique = nos hypothèses ; KDD 98 = Américains, vétérans, 1997 | Réentraînement sur les données de l'organisation ; limites écrites |
| Mesure | « Inactif » = 12 ou 13 mois sans don : définition arbitraire | Documentée dans la datasheet, paramétrable |
| Agrégation | Un même modèle pour tous les donateurs d'une organisation | Modèles séparés par segment (mensuel, ponctuel, inactif) |
| Apprentissage | Sans l'âge en variable, le modèle **sous-estime** les 70 ans et plus (prédit / observé = 0,54) et **sur-estime** les 35-54 ans (2,24) pour la conversion | Audit par sous-groupe (R6) ; options discutées en leçon 5 |
| Évaluation | Petits jeux de test pour les mensuels | Intervalles de confiance par bootstrap, test temporel, 5 graines, données réelles |
| Déploiement | Usage du score hors de son but (ex. retirer des services) | Fiche modèle : usages exclus ; aide à la décision seulement |

### 8.2 De la composante au tort (Rismani et al., 2025)

| Composante | Attribut | Mesure (seuil) | Danger | Tort |
|---|---|---|---|---|
| Score de conversion | Équité par âge | Ratio de sélection des 70 ans et plus > 1,5 (mesuré : 1,80) ; calibration hors de [0,67 ; 1,5] (mesuré : 0,54 et 2,24) | Sur-sollicitation des aînés, montants mal calibrés par âge | Pression financière, perte de confiance |
| Score d'attrition | Calibration | Brier < constante (R4) | Probabilités trop optimistes | Mauvaise allocation du temps de l'équipe |
| Brouillon de courriel | Fidélité aux données | 0 montant inventé (gabarits) | Message erroné | Atteinte à la réputation |
| Cycle automatique | Fréquence de contact | ≤ 1 courriel par 30 jours (RF12) | Harcèlement | Désabonnements, plaintes |
| Modèle en production | Stabilité | R5 ; AUC-PR glissante > RFM | Dérive non détectée | Décisions dégradées sans le savoir |

### 8.3 Cadre légal et normatif

- **Loi 25 (Québec)** : le scoring est un **profilage**. Mesures prévues :
  - informer les donateurs, dans la politique de confidentialité, de l'usage d'une technologie de profilage et des moyens de s'y opposer ;
  - minimiser les données : ni âge, ni région, ni quartier dans le modèle ;
  - mener une évaluation des facteurs relatifs à la vie privée avant un hébergement hors Québec ;
  - désigner un responsable de la protection des renseignements personnels dans l'organisation.
- **LCAP (Loi canadienne anti-pourriel)** : consentement, identification de l'expéditeur, désabonnement.
- **NIST AI RMF (2023)** :

| Fonction | Dans Fidélia |
|---|---|
| Gouverner | Fiche modèle, responsable désigné |
| Cartographier | Canevas, risques |
| Mesurer | Requis R1 à R6, audit d'équité |
| Gérer | Surveillance, retour arrière, groupe témoin |

- **Déclaration de Montréal pour une IA responsable** : principes d'autonomie (l'humain décide), de protection de l'intimité, de prudence et de responsabilité.

### 8.4 Humain dans la boucle

Fidélia suggère et l'équipe décide. C'est une forme d'**augmentation** plutôt que d'automatisation (Raisch et Krakowski, 2021), alignée sur l'idée d'*engaged augmentation* : l'utilisateur comprend et questionne la recommandation grâce aux raisons affichées (Lebovitz et al., 2022).

---

## 9. Estimations

### 9.1 Ressources humaines (V1, 6 mois)

| Rôle | Charge | Tâches |
|---|---|---|
| Chef de produit | 0,5 ETP | Besoins des OBNL, priorités, tests utilisateurs |
| Scientifique de données | 1 ETP | Variables, modèles, évaluation, surveillance, équité |
| Développeur web | 1 ETP | Authentification, connecteurs CRM et courriels, base de données |
| Designer UX | 0,3 ETP | Parcours des responsables des dons, accessibilité |
| Conseiller juridique (Loi 25) | Ponctuel, environ 20 h | Avis de profilage, évaluation des facteurs relatifs à la vie privée |

### 9.2 Ressources matérielles (par mois, 50 organisations clientes)

| Poste | Estimation |
|---|---|
| Base de données gérée au Canada (PostgreSQL, AWS ca-central-1 ou équivalent) | 50 à 150 $ |
| Tâches d'entraînement et de scoring (conteneurs, environ 1 min de CPU par organisation et par semaine) | 20 à 50 $ |
| Hébergement de l'interface | 0 à 20 $ |
| Fournisseur de courriels | 25 à 100 $ |
| LLM pour la reformulation (V2, environ 2 000 brouillons par mois) | 10 à 30 $ |

Aucune carte graphique n'est nécessaire : les modèles s'entraînent en quelques secondes sur un processeur.

### 9.3 Ressources financières

- **Développement V1** : environ 2,8 ETP × 6 mois, soit environ 150 000 à 190 000 $ CA chargés [à valider].
- **Exploitation** : environ 150 à 350 $ par mois pour 50 organisations.
- **Modèle d'affaires envisagé** : abonnement de 49 à 99 $ par mois par OBNL. Le seuil de rentabilité de l'exploitation est atteint dès quelques clients ; le développement est amorti autour de [x] clients sur 3 ans. Une version gratuite pourrait financer par subvention la population cible, les très petits OBNL.

### 9.4 Échéancier de la V1 (6 mois)

| Mois | Livrable |
|---|---|
| 1 | Entrevues avec 5 OBNL, connecteurs CSV, schéma de données |
| 2 | Variables et modèles en tâche serveur, contrôles de qualité |
| 3 | Interface : authentification, listes, fiches |
| 4 | Courriels réels, groupe témoin, journal des envois |
| 5 | Pilote avec 2 OBNL sur leurs données (accord écrit), audit d'équité |
| 6 | Corrections, documentation Loi 25, lancement |

**Sous-ensemble de la V1 :** RF1 à RF9 et RF11 à RF14. La reformulation par LLM (RF10) et les connecteurs API viennent en V2.

---

## 10. Leçons apprises

1. **Un modèle entraîné sur des données synthétiques apprend d'abord le générateur.** Sur nos données, l’AUC des modèles déployés atteint 0,71 à 0,82 ; sur de vrais donateurs (KDD 98), elle tombe à environ 0,62. Le synthétique est indispensable pour respecter la confidentialité et démontrer le système, mais il ne remplace pas une validation sur données réelles. Il faut écrire noir sur blanc ce qu'il prouve et ce qu'il ne prouve pas (Jarrahi et al., 2023 ; Sambasivan et al., 2021).

2. **Méfiez-vous des résultats trop beaux : nous avons trouvé deux fuites de données.**
   - Le contrôle de qualité a d'abord révélé des dons datés avant l'inscription.
   - En corrigeant ce défaut, le modèle de réactivation est passé à une AUC de 0,94, un résultat suspect.
   - L'enquête a révélé deux fuites. Un donateur inscrit le jour même de la photo était compté comme « inactif », son premier don devenant une « réactivation ». Un nouveau mensuel comptait comme une « hausse » de 0 $.
   - Après correction, l'AUC est revenue à 0,75 et la hausse ne bat plus RFM.

   Sans contrôle de qualité ni esprit critique, nous aurions présenté des performances fausses (Sculley et al., 2015 ; Kapoor et Narayanan, 2023).

3. **La règle RFM est une référence sérieuse, et l'IA n'a de valeur qu'au bon endroit.**
   - Sur KDD 98, quand on écrit à 68 % des donateurs, le modèle et RFM rapportent autant. L'avantage du modèle est de bien classer **les premiers noms** : +51 % de profit avec 20 % des envois.
   - Sur nos données, le modèle de hausse ne bat pas RFM : la règle de gouvernance garde donc RFM pour cette liste.

   L'IA doit gagner sa place cas d'usage par cas d'usage.

4. **Prédire n'est pas causer.** Un modèle de propension cible les donateurs qui allaient peut-être convertir d'eux-mêmes. Pour mesurer ce que l'action change vraiment, il faut un groupe témoin. C'est ce qui nous a fait séparer clairement, dans la page Impact, ce qui est mesuré (la qualité du ciblage) de ce qui est supposé (l'effet de l'action).

5. **Retirer l'âge du modèle ne suffit pas à le rendre équitable.**
   - Nous avons exclu l'âge des variables : minimisation des données, Loi 25.
   - Mais l'âge influence la fidélité. Le modèle sous-estime donc les 70 ans et plus et sur-estime les 35-54 ans (R6 non validé).
   - Corriger demanderait d'utiliser l'âge, au moins pour recalibrer par groupe. C'est un arbitrage entre vie privée et calibration.
   - Les critères d'équité sont en général mathématiquement incompatibles (Kleinberg, Mullainathan et Raghavan, 2017).

   Nous documentons l'écart, le surveillons et laissons la décision à l'organisation.

6. **La façon de comparer compte autant que le modèle.**
   - Comparer deux intervalles de confiance qui se chevauchent est trop conservateur : notre modèle de conversion, 2,6 fois meilleur que RFM, aurait été rejeté. Le bon test est un **bootstrap apparié** de l'écart, sur les mêmes donateurs.
   - Inversement, un test temporel sur 2 dates seulement (environ 180 exemples) donnait des résultats erratiques ; nous l'avons élargi à 4 dates.
   - Fixer les requis **avant** de voir les résultats nous a empêchés d'ajuster les seuils pour qu'ils passent.

7. **[Optionnel] Ingénierie : pré-entraîner et versionner le modèle.** L'entraînement complet prend environ 20 s dans le navigateur. Sérialiser un modèle versionné (`model.json`) donne une application instantanée, un retour arrière simple et une traçabilité, des pratiques MLOps vues en séance 7 (Kreuzberger, Kühl et Hirschl, 2023).

---

## Références

**Académiques**
1. Agrawal, A., Gans, J. et Goldfarb, A. (2018). *Prediction Machines: The Simple Economics of Artificial Intelligence*. Harvard Business Review Press.
2. Fader, P. S., Hardie, B. G. S. et Lee, K. L. (2005). RFM and CLV: Using iso-value curves for customer base analysis. *Journal of Marketing Research*, 42(4), 415-430.
3. Friedman, J. H. (2001). Greedy function approximation: A gradient boosting machine. *Annals of Statistics*, 29(5), 1189-1232.
4. Gebru, T. et al. (2021). Datasheets for datasets. *Communications of the ACM*, 64(12), 86-92.
5. Jarrahi, M. H., Memariani, A. et Guha, S. (2023). The principles of data-centric AI. *Communications of the ACM*, 66(8). [vérifier les pages]
6. Kapoor, S. et Narayanan, A. (2023). Leakage and the reproducibility crisis in machine-learning-based science. *Patterns*, 4(9), 100804.
7. Kleinberg, J., Mullainathan, S. et Raghavan, M. (2017). Inherent trade-offs in the fair determination of risk scores. *Proceedings of ITCS 2017*.
8. Kreuzberger, D., Kühl, N. et Hirschl, S. (2023). Machine learning operations (MLOps): Overview, definition, and architecture. *IEEE Access*, 11, 31866-31879.
9. Lebovitz, S., Lifshitz-Assaf, H. et Levina, N. (2022). To engage or not to engage with AI for critical judgments. *Organization Science*, 33(1), 126-148.
10. Mitchell, M. et al. (2019). Model cards for model reporting. *Proceedings of FAT\* 2019*, 220-229.
11. Raisch, S. et Krakowski, S. (2021). Artificial intelligence and management: The automation–augmentation paradox. *Academy of Management Review*, 46(1), 192-210.
12. Rismani, S. et al. (2025). Measuring what matters: Connecting AI ethics evaluations to system attributes, hazards, and harms. *AIES 2025*. [vérifier le titre exact dans le fichier du cours]
13. Saito, T. et Rehmsmeier, M. (2015). The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets. *PLoS ONE*, 10(3), e0118432.
14. Sambasivan, N. et al. (2021). "Everyone wants to do the model work, not the data work": Data cascades in high-stakes AI. *CHI 2021*.
15. Sargeant, A. (2001). Relationship fundraising: How to keep donors loyal. *Nonprofit Management and Leadership*, 12(2), 177-192.
16. Sculley, D. et al. (2015). Hidden technical debt in machine learning systems. *NeurIPS 2015*.
17. Strong, D. M., Lee, Y. W. et Wang, R. Y. (1997). Data quality in context. *Communications of the ACM*, 40(5), 103-110.
18. Suresh, H. et Guttag, J. (2021). A framework for understanding sources of harm throughout the machine learning life cycle. *EAAMO '21*.
19. Varoquaux, G., Luccioni, A. S. et Whittaker, M. (2025). Hype, sustainability, and the price of the bigger-is-better paradigm in AI. *FAccT 2025*. [vérifier le titre exact dans le fichier du cours]

**Non académiques**
20. AFP et GivingTuesday (2026). *Fundraising Effectiveness Project, Quarterly Report Q4 2025*.
21. Huyen, C. (2022). *Designing Machine Learning Systems*. O'Reilly (ch. 2 et 8).
22. NIST (2023). *Artificial Intelligence Risk Management Framework (AI RMF 1.0)*.
23. Gouvernement du Québec (2021). *Loi modernisant des dispositions législatives en matière de protection des renseignements personnels* (Loi 25).
24. Université de Montréal (2018). *Déclaration de Montréal pour un développement responsable de l'intelligence artificielle*.
25. UCI KDD Archive. *KDD Cup 1998 Data*. https://kdd.ics.uci.edu/databases/kddcup98/kddcup98.html
