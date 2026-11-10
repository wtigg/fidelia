# Fidélia : qui relancer, remercier ou solliciter

**TECH60711, Réalisation d'applications d'intelligence artificielle, HEC Montréal, automne 2026**
**Équipe 4 :** Geoffrey Carel, Juliette Ponce, Juliette Violon, Paul Soubigou  
**Démonstration en ligne :** https://wtigg.github.io/fidelia/ (aucune installation)  
**Dépôt du code :** https://github.com/wtigg/fidelia

## Résumé

Fidélia aide un petit OBNL à choisir chaque semaine qui relancer, remercier ou solliciter. Quatre petits modèles prédisent l'attrition, le passage au mensuel, la hausse et la réactivation. Un modèle n'est déployé que s'il bat nettement le hasard (R1) et la règle RFM (R2) ; sinon, l'outil garde RFM. Sur le jeu synthétique, 3 modèles sur 4 passent. Sur de vrais donateurs (KDD Cup 1998), la méthode de classement rapporte 51 % de plus que RFM avec 20 % des envois, mais ce modèle n'atteint pas notre requis R1 (0,083 < 0,102) : nous ne le déploierions pas. Ce résultat valide la méthode, pas un modèle prêt à l'emploi. La performance sur les données d'un vrai OBNL se vérifiera au pilote. L'effet causal des relances et la rentabilité ne se mesureront qu'après la V1, sur plusieurs organisations (section 11).

> Tous les chiffres de performance viennent des rapports générés par les scripts du dépôt (`reports/`, `verification/`). Ils sont reproductibles avec les commandes de la section 6.3. Les estimations de coûts (section 9) sont des hypothèses, et leurs sources sont indiquées.

---

## 1. Idée

### 1.1 Description

Fidélia est un outil web pour les OBNL de petite taille (1 à 5 personnes à la collecte de fonds, sans analyste de données). Il lit l'historique des dons et produit chaque semaine **quatre listes d'actions** :

| Liste | Question | Méthode |
|---|---|---|
| **Relancer** | Quel donateur mensuel risque d'arrêter son don dans les 90 jours ? | Modèle d'attrition |
| **Proposer le mensuel** | Quel donateur ponctuel ou annuel passerait au don mensuel dans les 6 mois ? | Modèle de conversion |
| **Solliciter plus** | Quel donateur mensuel fidèle augmenterait son don ? Quel inactif redonnerait ? | Réactivation : modèle. Hausse : modèle évalué, **règle RFM conservée** tant que R1 et R2 échouent (section 4.3) |
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

**Le type d'IA.** Fidélia relève de l'**analyse cognitive** (*cognitive insight*) au sens de Davenport et Ronanki (2018) : détecter des régularités dans des données pour prédire un comportement. Ces auteurs conseillent de commencer par des projets modestes et utiles plutôt que par des « projets lune ». Ng (2019) va dans le même sens : un premier projet d'IA doit être petit, propre au secteur, et donner une victoire rapide, idéalement en 6 à 12 mois. Fidélia suit ce conseil : quatre prédictions simples, sur des données que l'OBNL possède déjà.

**La méthode traditionnelle.** Le secteur utilise la **segmentation RFM** (récence, fréquence, montant ; Fader, Hardie et Lee, 2005). Elle classe tout le monde sur trois variables, avec des seuils fixes. RFM est simple, lisible et gratuite. C'est donc une référence sérieuse, que l'IA doit battre.

**Ce que le modèle ajoute.** Deux choses, mesurées :
1. **Des signaux que RFM ignore.** Les variables les plus utiles au modèle d'attrition sont le taux d'ouverture des courriels sur 3 mois, la récence, les échecs de paiement sur 90 jours et le canal de recrutement (importance par permutation, `reports/evaluate-42.txt`). RFM n'en voit qu'une, la récence.
2. **Un meilleur classement des premiers noms.** Sur le jeu de test synthétique, l'AUC-PR de l'attrition passe de 0,091 avec RFM à 0,243 avec le modèle. L'écart apparié vaut +0,152, IC 95 % [0,058 ; 0,255]. Sur les 50 premiers noms, 34 % sont de vrais départs, contre 8 % avec RFM (section 6.2).

**Ce que le modèle n'ajoute pas.** Deux arguments souvent avancés ne tiennent pas ici :
- *La calibration.* Une probabilité calibrée est utile pour la valeur attendue, mais RFM peut aussi être calibrée. Fidélia le fait d'ailleurs pour sa règle de repli (section 4.3). L'avantage de l'IA est le classement, pas la calibration.
- *L'explication.* RFM est plus lisible qu'un modèle : trois variables, des seuils connus. Le modèle doit donc afficher ses trois raisons principales pour compenser sa complexité. Ce n'est pas un avantage sur RFM.

**Sur de vrais donateurs (KDD Cup 1998)**, le modèle de réactivation bat RFM de façon significative : AUC-PR 0,083 contre 0,053, écart apparié IC 95 % [0,022 ; 0,039] (`reports/kdd98.json`). Il **n'atteint pourtant pas le requis R1** : 0,083 est inférieur à 2 × le taux de base (2 × 0,051 = 0,102). Selon notre propre règle, ce modèle ne serait donc pas déployé (leçon 3).

**Le garde-fou.** Nous l'avons fixé dès la séance 6 : **on ne garde un modèle que s'il fait au moins deux fois mieux que le hasard (R1) et bat RFM de façon significative (R2)**. L'application l'applique automatiquement. Sur le jeu synthétique, c'est le cas pour 3 des 4 modèles : attrition, passage au mensuel et réactivation. Pour le 4e, la hausse, Fidélia garde la règle RFM (section 6).

### 1.4 Solutions existantes

Des outils de prédiction pour la collecte de fonds existent déjà. Voici trois exemples, consultés en novembre 2026 :

| Solution | Ce qu'elle prédit | Prix publié | Limites pour un petit OBNL québécois |
|---|---|---|---|
| **Dataro** (spécialiste de l'IA pour la collecte de fonds) | Attrition et hausse des mensuels, réactivation, dons majeurs (Dataro, s. d.-b) | À partir de 15 000 $ par an, plus 0,10 $ par donateur actif (forfait Essentials ; Dataro, s. d.-a) | Coût hors de portée d'un OBNL de 1 à 5 personnes. Pas d'essai libre. Hébergement possible au Canada. Français non mentionné |
| **Keela** (CRM canadien) | *Donor Score* et *Smart Ask* : score et montant suggéré, à partir de l'historique, du filtrage de richesse et de données démographiques (Keela, s. d.-b) | De 164 $ à 489 $ par mois selon le nombre de contacts, facturation annuelle (Keela, s. d.-a) | Méthode non décrite. Utilise des données démographiques et de richesse, ce que Fidélia exclut. Données hébergées au Canada |
| **Bloomerang** (CRM américain) | « Prédictions de dons » et suivi du sentiment des donateurs (Bloomerang, s. d.) | CRM à partir de 125 $ par mois, facturation annuelle ; fonctions d'IA avancées sur devis | Méthode et performance non publiées. Hébergement et français non précisés |

**Ce que ces outils ne font pas.** Aucun ne publie sa performance face à une méthode simple comme RFM. Aucun ne retire son modèle quand il ne fait pas mieux. Les deux premiers coûtent plus cher que le budget d'un très petit OBNL. Fidélia vise ce vide : un outil en français, peu coûteux, qui mesure et affiche honnêtement sa valeur.

### 1.5 Proposition de valeur

*Pour les responsables des dons des petits OBNL, qui n'ont ni le temps ni les compétences pour analyser leur base, Fidélia est un assistant de fidélisation. Il livre chaque semaine une courte liste priorisée de donateurs à contacter, avec la raison et un brouillon de message. Contrairement aux outils existants, Fidélia mesure sa performance face à la méthode traditionnelle, revient à cette méthode quand l'IA ne fait pas mieux, et garde l'humain aux commandes.*

### 1.6 Impact visé

La valeur d'affaires de l'IA vient d'abord d'effets de premier ordre : mieux décider et mieux utiliser le temps des employés (Enholm et al., 2022). Nous distinguons ce qui est **mesuré** de ce qui est **supposé**.

**Mesuré : la qualité du ciblage.** Sur le jeu de test synthétique (`reports/synthetique-42.json`), contacter les 10 % des mensuels les mieux classés par le modèle d'attrition capte **41 %** de la valeur à risque. La règle RFM en capte 7 %, et le hasard 10 %.

**Mesuré sur données réelles** (KDD Cup 1998, `reports/kdd98.txt`). Avec un budget limité à 20 % des envois, le profit net est de **2 133 $ avec le modèle, contre 1 413 $ avec RFM** : +51 %. C'est aussi 5 fois moins d'envois qu'un envoi à tous, pour un profit plus élevé (1 975 $). Ce chiffre valide la **méthode de classement**, pas un modèle déployable : ce modèle de réactivation échoue à R1 (section 1.3) et notre règle ne le mettrait pas en service.

**Supposé : l'effet de l'action.** La page **Impact** convertit ce ciblage en dollars récupérés. Elle suppose qu'une action change vraiment le comportement d'une part des donateurs contactés. Les valeurs par défaut sont 30 % pour l'attrition, 25 % pour la hausse et 15 % pour la conversion et la réactivation. Ce sont des hypothèses, réglables à l'écran. Les montants affichés en dépendent directement. Le groupe témoin de 10 % (RF14) servira à mesurer cet effet. Chez un seul petit OBNL, il est trop petit pour le prouver : il faudra mettre en commun les témoins de plusieurs organisations (section 11).

**Pour les donateurs**, moins de sollicitations génériques et plus de remerciements :
- un courriel au plus par 30 jours ;
- un remerciement avant toute nouvelle demande.

**Pour le secteur**, un outil accessible aux petites organisations, qui n'ont pas les moyens d'un analyste.

---

## 2. Canevas d'IA (Agrawal, Gans et Goldfarb, 2018)

Le canevas suit le gabarit du cours (`TECH 60711_S02_AI Canvas`) : sept cases, chacune répond à une question. Nous détaillons le canevas principal, l'attrition. Les trois autres ne diffèrent que sur quelques cases (section 2.2).

### 2.1 Canevas principal : relancer les mensuels à risque

| Case | Question du gabarit | Réponse pour l'attrition |
|---|---|---|
| **Prédiction** | Que faut-il savoir pour décider ? | La probabilité qu'un donateur mensuel arrête son don dans les 90 prochains jours. |
| **Jugement** | Quelle valeur donner aux résultats et aux erreurs ? | Rater un départ coûte le don annuel (environ 240 $). Relancer à tort coûte peu, mais peut agacer. L'équipe fixe le seuil et le ton. |
| **Action** | Que cherche-t-on à faire ? | Envoyer un courriel de relance : mise à jour de la carte expirée, rappel de l'impact du don, option de pause. |
| **Résultat** | Quelle mesure du succès ? | Le donateur est-il toujours mensuel 90 jours plus tard ? Comparaison avec un groupe témoin non contacté. |
| **Entrée** | Quelles données pour prédire ? | Le comportement récent du donateur, par exemple : taux d'ouverture des courriels sur 3 mois, jours depuis le dernier don, échecs de paiement sur 90 jours, canal de recrutement (rue, Web, courrier), tendance de l'engagement. 18 variables au total (section 5). Ni âge, ni région. |
| **Entraînement** | Quelles données pour entraîner ? | L'historique des dons et des ouvertures de l'organisation, en photos tous les 2 à 6 mois selon le modèle, sur 3,5 ans d'historique. Pour chaque photo : le donateur est-il parti dans les 90 jours suivants ? |
| **Rétroaction** | Comment les résultats améliorent-ils le modèle ? | Les résultats des relances et du groupe témoin de 10 % sont ajoutés à l'historique. Réentraînement chaque trimestre. |

**Lecture pour un non-spécialiste.** L'IA rend la **prédiction** bon marché. L'équipe garde le **jugement** : seuils, ton, validation. Les **résultats** des campagnes réalimentent le modèle.

### 2.2 Les trois autres canevas : ce qui change

Les cases Entrée, Entraînement et Rétroaction sont les mêmes pour les quatre canevas.

| Case | Passage au mensuel | Hausse | Réactivation |
|---|---|---|---|
| **Prédiction** | Probabilité qu'un donateur ponctuel ou annuel passe au mensuel dans les 6 mois | Probabilité qu'un mensuel augmente son don dans les 6 mois. **Modèle évalué, règle RFM conservée** tant que R1 et R2 échouent | Probabilité qu'un inactif redonne dans les 6 mois |
| **Jugement** | Solliciter trop tôt peut faire fuir. Le montant suggéré doit rester raisonnable | Ne jamais demander plus à un donateur à risque de départ | Coût d'un envoi contre le don moyen espéré |
| **Action** | Proposition de don mensuel, avec un montant suggéré | Demande de hausse de 5 ou 10 $ | Courriel « vous nous manquez » |
| **Résultat** | Conversion ou non en 6 mois | Hausse ou non en 6 mois | Nouveau don ou non en 6 mois |

---

## 3. Requis fonctionnels

Légende : **[IA]** = le requis repose sur un modèle d'apprentissage. **[P]** = démontré dans le prototype.

| # | Requis | IA | Prototype |
|---|---|---|---|
| RF1 | Importer l'historique des dons et des donateurs depuis un export CSV du CRM ou de la plateforme de dons | | P |
| RF2 | Contrôler automatiquement la qualité des données importées (complétude, validité, doublons, cohérence, actualité, consentement) | | P |
| RF3 | Calculer pour chaque donateur actif un **risque d'attrition** à 90 jours | IA | P |
| RF4 | Calculer une **propension au passage au mensuel** à 6 mois et suggérer un montant | IA | P |
| RF5 | Calculer une **propension à augmenter** le don mensuel. Modèle évalué ; règle RFM conservée tant que R1 et R2 échouent | IA (évalué) | P (règle RFM en service) |
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
| RF23 | **Opposition au profilage** (Loi 25) : un donateur peut demander à ne pas être scoré. Un drapeau, saisi à l'écran ou lu à l'import, l'exclut de tous les modèles et de toutes les listes ; il ne reçoit que les messages non ciblés | | Non |
| RF24 | **Accès, rectification, suppression et conservation.** Exporter sur demande les données et les scores d'un donateur ; les corriger ; les purger. Les scores et leur historique sont effacés au bout de 24 mois (choix de l'équipe). Les dons sont conservés selon les obligations fiscales de l'organisation, durée à confirmer par le conseiller juridique (section 9.3) | | Non |

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
| Service clé en main (section 1.4) | Coûteux pour un petit OBNL, méthode non publiée, données confiées à un tiers dont l'hébergement varie |
| LLM généraliste (ChatGPT, Gemini) | Mauvais en prédiction tabulaire calibrée, non reproductible, coût par appel |
| **Modèle personnalisé, petit** | Entraîné sur les données de l'organisation, explicable, gratuit à l'usage, exécutable localement |

Nous avons choisi des **modèles petits et frugaux** (Varoquaux, Luccioni et Whittaker, 2025). Ils sont **codés à la main** en TypeScript pour tourner dans le navigateur, sans serveur de calcul. Leur justesse est **vérifiée contre scikit-learn** sur les mêmes données (`verification/RESULTATS.md`) : la régression logistique donne la même AUC-PR à 0,003 près, le boosting le même ordre de grandeur (écart ≤ 0,03).

Un **LLM pré-entraîné**, sans entraînement supplémentaire, est prévu en V2 pour reformuler les gabarits de courriels. Il reste sous validation humaine, ne reçoit que des champs non libres (pas de notes du CRM, contre l'injection de requêtes) et n'a aucun droit d'inventer un montant. Ce choix crée un transfert de données vers un fournisseur. Ses risques sont traités en sections 7 et 8.

### 4.3 Requis de performance

Fixés **avant** l'entraînement (Huyen, 2022, ch. 2 : relier métrique ML et métrique d'affaires). Ils sont vérifiés automatiquement à chaque réentraînement.

| Id | Métrique et seuil | Lien avec l'affaire |
|---|---|---|
| R1 | AUC-PR ≥ 2 × taux de base | Faire nettement mieux que le hasard ; **condition de déploiement** avec R2 |
| R2 | Écart d'AUC-PR avec RFM > 0 avec 95 % de confiance (bootstrap apparié) | Justifier l'IA ; **condition de déploiement** avec R1 |
| R3 | Précision des 50 premiers noms ≥ RFM | Capacité hebdomadaire d'une petite équipe |
| R4 | Score de Brier < prédiction constante | Valeur attendue = probabilité × montant |
| R5 | AUC du test temporel ≥ AUC du test − 0,05 | Stabilité face à la dérive |
| R6 | Calibration par tranche d'âge (prédit / observé) entre 0,67 et 1,5. Seules les tranches mesurables comptent : au moins 100 cas et au moins 5 positifs | Équité (section 8) |

**Gouvernance.** Un modèle n'est déployé que s'il fait au moins 2 fois mieux que le hasard (R1) **et** bat RFM de façon significative (R2). Sinon, l'application classe les donateurs avec la règle RFM, calibrée en probabilité. La décision est affichée dans la page Modèle IA.

**Règle unique : R1 et R2 sont bloquants ; R3 à R6 sont des alertes.** L'application bloque seulement sur R1 et R2. Un échec à R3, R4, R5 ou R6 ne retire pas le modèle : il doit être examiné et levé par une personne responsable avant tout usage réel. Sur le jeu synthétique, deux modèles déployés portent une alerte : le passage au mensuel (R6, calibration par âge) et la réactivation (R5, dérive temporelle ; R6). Le prototype ne l'affiche pas encore à côté de la décision de déploiement (section 6.4).

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
   photos tous les 2 à 6 mois,    4 modèles + explications
   réglage sur validation, test,           │
   audit d'équité → model.json versionné ─▶│
                                           ▼
                    Choix de l'action (valeur attendue, garde-fous)
                                           ▼
                Brouillons de courriels → validation humaine → envoi
                                           ▼
                Résultats et groupe témoin → rétroaction au modèle
```

### 4.5 Déploiement et technologies

La solution cible suit le schéma du scénario 4 de la séance 5 : une API, un conteneur Docker, un déploiement infonuagique. Tous les services sont dans la région AWS ca-central-1 (Montréal), pour garder les données au Canada.

| | Prototype (livré) | Solution cible |
|---|---|---|
| Interface | React 19 + TypeScript + Tailwind, site statique (GitHub Pages) ; image Docker nginx (étape `web` du `Dockerfile`) | Identique, servie par la même image nginx, derrière l'authentification |
| API | Aucune : tout tourne dans le navigateur | **FastAPI** (Python), dans un conteneur Docker : lit les listes et les scores, enregistre les validations et les envois |
| Calcul des modèles | Dans le navigateur (Web Worker) ; modèle pré-entraîné `model.json` | **Python et scikit-learn** (`LogisticRegression`, `HistGradientBoostingClassifier`), dans un conteneur Docker sur **AWS ECS Fargate**. Scoring hebdomadaire et réentraînement trimestriel lancés par **Amazon EventBridge Scheduler** |
| Authentification | Aucune | **Amazon Cognito** : un compte par personne, rattaché à une organisation ; double authentification ; journal des accès (RF20) |
| Données | Générées localement ou importées en CSV, jamais envoyées | **Amazon RDS for PostgreSQL**, chiffré, une base par organisation |
| Courriels | Simulés | **Amazon SES**, même région. Les données restent au Canada, mais quittent le Québec : ÉFVP avant la mise en service (section 8.3) |
| Vérification | `npm test` (19 tests), contrôle de reproductibilité et script scikit-learn | Tests et contrôle de reproductibilité dans l'intégration continue (GitHub Actions, déjà en place) |

Le prototype exécute le modèle **côté client** (edge). Coût d'hébergement nul, et les données de l'organisation ne quittent jamais le poste. Contrepartie : maintenance et surveillance plus difficiles, ce qui justifie le passage à une tâche serveur en production.

**Un seul langage pour le ML cible : Python.** L'interface reste en TypeScript, mais elle n'affiche que des scores calculés par le serveur. Les variables, l'entraînement et le scoring sont tous en Python : un seul calcul de variables, donc pas de décalage entre entraînement et service.

**Pourquoi ne pas garder les modèles maison ?** Pour le prototype, les coder en TypeScript avait deux avantages : tout tourne dans le navigateur, sans serveur, et rien n'est « magique », car chaque ligne du calcul est lisible. Mais c'est une entorse au principe KISS : une bibliothèque maison doit être maintenue, testée et corrigée par l'équipe, alors que scikit-learn l'est par sa communauté. En production, nous passons donc à scikit-learn. Le script de vérification (`verification/verify_sklearn.py`) sert de point de départ : il entraîne déjà les mêmes modèles sur les mêmes données. La vérification croisée devient le garde-fou de la migration : le modèle scikit-learn ne remplace le modèle maison que s'il donne la même AUC-PR, à la tolérance mesurée près (`verification/RESULTATS.md`).

**Langages :**
- TypeScript pour l'interface (prototype et cible) et pour les modèles du prototype.
- Python et scikit-learn pour la vérification indépendante aujourd'hui, et pour le ML de la solution cible.

---

## 5. Requis relatifs aux données

### 5.1 Sources

| Source | Rôle | Format | Disponibilité |
|---|---|---|---|
| **S1. Jeu synthétique** (`src/data/generate.ts`) | Entraînement et démonstration, 4 cas d'usage | Objets JSON ; export CSV | Généré, reproductible (graine) |
| **S2. KDD Cup 1998** (archive UCI) | Validation de la **méthode** sur **vrais donateurs**, sur deux tâches voisines : réactivation et don plus élevé que le dernier | Texte délimité, 95 412 lignes × 481 champs | Public, sous conditions (`docs/DATASHEET-kdd98.md`) |
| **S3. CRM de l'organisation** (production) | Entraînement et scoring réels | Export CSV : donateurs, dons, consentement | Accord de l'organisation ; Loi 25 |
| **S4. Outil de courriels** (production) | Ouvertures mensuelles | CSV ou API | Uniquement pour les donateurs consentants |

Aucune donnée réelle d'organisation n'est utilisée dans le projet, conformément aux consignes. S2 est un jeu public de recherche.

**Ce que KDD 98 valide, et ce qu'il ne valide pas.** La « hausse » n'a pas la même définition dans les deux sources. Dans le jeu synthétique, c'est un mensuel actif qui augmente son prélèvement dans les 180 jours. Dans KDD 98, c'est un donateur inactif dont la réponse à la relance dépasse son dernier don (`TARGET_D > LASTGIFT`). KDD 98 valide donc la méthode sur une tâche voisine, pas le modèle de hausse du mensuel. Ce dernier n'est d'ailleurs pas déployé.

### 5.2 Transformation

1. **Photos temporelles :** pour chaque date T (tous les 2 à 6 mois selon le modèle, au plus 42 mois en arrière ; `src/ml/pipeline.ts`), on ne garde que les dons antérieurs à T, ce qui évite les fuites. On calcule 18 variables puis l'étiquette sur l'horizon.
2. **Transformations :** logarithme des variables asymétriques (montants, récence, ancienneté). Imputation explicite du taux d'ouverture manquant, avec un indicateur dédié. Standardisation pour la régression logistique, découpage en quantiles pour le boosting.
3. **Découpage par donateur :** 60 % entraînement, 20 % validation, 20 % test. Un donateur photographié à plusieurs dates reste dans un seul jeu.
4. **Test temporel :** entraînement sur les dates anciennes, test sur les plus récentes.

Détail des variables : `docs/DATASHEET-synthetique.md`, section 4.

### 5.3 Qualité des données, par source (Strong, Lee et Wang, 1997)

| Dimension | S1 synthétique | S2 KDD 98 | S3 CRM réel (anticipé) | S4 outil de courriels (anticipé) |
|---|---|---|---|---|
| Exactitude | Exacte par construction | Élevée (transactionnel) | Risque de saisie manuelle, doublons | **Moyenne** : l'ouverture est mesurée par un pixel invisible. Images bloquées = ouverture non comptée ; préchargement automatique par certains logiciels de messagerie = ouverture comptée à tort |
| Crédibilité | Moyenne (calibrée) | Élevée (référence en recherche) | Élevée | Moyenne : bon signal de tendance, mauvais signal individuel exact |
| Actualité | Configurable | Faible (1997) | Bonne si synchronisation hebdomadaire | Agrégat mensuel par donateur ; export hebdomadaire suffisant |
| Complétude | 14 % sans ouvertures (documenté) | Âge manquant à 25 % | Ouvertures absentes sans consentement | Absente pour les donateurs sans courriel ou sans consentement au suivi ; parfois absente si l'organisation n'a pas d'outil de courriels |
| Pertinence | 4 cas d'usage | Tâches voisines de la réactivation et de la hausse | Totale | Élevée : source de la variable la plus utile au modèle d'attrition (section 1.3) |
| Représentativité | Hypothèses du générateur | États-Unis, cause unique, aînés | Propre à l'organisation | Biaisée vers les donateurs qui ont une adresse courriel et qui consentent |
| Accessibilité | Locale | Publique, conditions d'usage | Export CSV, consentement, Loi 25 ; voir ci-dessous | Export CSV ou API selon l'outil ; certains outils n'exportent que par campagne, pas par donateur |
| Interprétabilité | Dictionnaire de données | Dictionnaire fourni (`cup98dic.txt`) | Variable selon le CRM | Définition de « ouverture » propre à chaque outil |

**S4 demande une prudence propre.** Le taux d'ouverture est la variable la plus utile au modèle d'attrition, mais c'est aussi la mesure la moins fiable : un pixel ne prouve pas qu'un courriel a été lu. Nous l'utilisons donc comme une tendance (sur 3 mois), jamais comme un fait sur une personne. Il n'est lu que pour les donateurs qui ont consenti au suivi (ligne Collecte de la section 8.1, requis RD5 ci-dessous). Sans S4, le modèle reste utilisable grâce à la variable d'absence, avec une performance moindre (risque « pas d'historique d'ouvertures », section 7).

**L'accessibilité est le vrai risque pour un petit OBNL.** Vial et al. (2021) montrent que de nombreux projets d'IA restent bloqués au laboratoire parce que les données ne sont pas accessibles en production. Ce n'est pas d'abord un problème technique, mais un problème de gestion. Chez un OBNL de 1 à 5 personnes, les dons sont souvent dans un CRM, les ouvertures dans un outil de courriels, et personne n'est chargé de les relier. Fidélia réduit ce frein : un simple export CSV par source, un gabarit de fichier fourni et des contrôles automatiques à l'import.

**La provenance compte aussi.** Longpre et al. (2025), lus en séance 3, montrent que la licence et l'origine des jeux de données publics sont souvent mal documentées. Pour KDD 98, nous avons donc remonté jusqu'à la source (archive UCI) et noté ses conditions d'usage : ne pas nommer l'organisation commanditaire, prévenir Epsilon en cas de publication (`docs/DATASHEET-kdd98.md`).

Les contrôles mesurables sont **automatisés** dans la page **Données** : courriels valides, ouvertures, montants aberrants, dates futures, doublons d'identifiants et de courriels, dons orphelins, dons antérieurs à l'inscription, actualité du dernier don, taux de consentement. Le principe directeur est « fit for use » : une donnée est de qualité si elle convient à l'usage visé.

### 5.4 Volume minimal de données et démarrage à froid

« Y a rien de magique » : un modèle n'apprend rien sans assez d'exemples. Les courbes d'apprentissage (`reports/evaluate-42.txt`) donnent un ordre de grandeur. Le nombre de positifs ci-dessous est estimé : exemples d'entraînement × taux de base.

| Modèle | Exemples d'entraînement | Positifs (environ) | AUC-PR | Seuil R1 (2 × taux de base) |
|---|---|---|---|---|
| Attrition | 321 | 21 | 0,129 | 0,134 : **échoue** |
| Attrition | 802 | 54 | 0,174 | réussit |
| Attrition | 1 603 | 107 | 0,225 | réussit |
| Attrition | 3 207 | 215 | 0,243 | réussit |
| Réactivation | 464 | 18 | 0,063 | 0,078 : **échoue** |
| Réactivation | 2 311 | 90 | 0,111 | réussit |
| Réactivation | 4 624 | 180 | 0,123 | réussit |

**Requis de données (RD1).** Un modèle n'est entraîné que si l'historique contient **au moins 100 événements positifs** pour ce modèle (par exemple 100 départs de mensuels). Vers 100 positifs, l'attrition atteint 93 % de son AUC-PR finale (0,225 sur 0,243) et la réactivation 90 % (0,111 sur 0,123). Autour de 20 positifs, les deux échouent à R1. Ce seuil est une règle prudente tirée de nos courbes ; il sera revu avec les données du pilote.

**Ce que cela veut dire pour un petit OBNL.** Avec 300 mensuels et un taux de départ de 6,7 % par 90 jours, on observe environ 20 départs par trimestre. Il faut donc environ 5 trimestres d'historique pour atteindre 100 départs.

**Le même calcul vaut pour le groupe témoin.** « Y a rien de magique » s'applique aussi à notre propre mesure. Avec 300 mensuels, un témoin de 10 % compte 30 donateurs, soit environ 2 départs par trimestre (30 × 6,7 %). Supposons que la relance réduise les départs de 30 % (hypothèse par défaut de la page Impact) : le taux passerait de 6,7 % à 4,7 %. Pour détecter cet écart (test de deux proportions, risque de 5 %, puissance de 80 % ; calcul de l'équipe), il faut environ **2 100 mensuels par groupe** à parts égales. Avec un témoin de 10 %, il faut environ **1 160 mensuels témoins**, soit environ 11 600 mensuels suivis pendant un trimestre. Un OBNL seul n'y arrive pas, même en plusieurs années. La conversion est encore plus difficile à mesurer : taux de base de 1,8 % et horizon de 6 mois.

Conséquence : le pilote ne peut pas prouver l'effet causal. Il faut **mettre en commun les témoins de plusieurs organisations**. Par exemple, environ 40 clients de 300 mensuels chacun, avec 10 % de témoin, donnent environ 1 200 témoins en un trimestre. Si l'effet réel est plus faible que 30 %, il en faut davantage. Agrandir le témoin pendant le pilote ne suffit pas : à 50 % chez 2 OBNL de 300 mensuels, il faudrait environ 7 trimestres.

**Liste des requis de données.** RD1 découle des courbes ci-dessus. Les autres reprennent les exigences des sections 5.1 à 5.3 et de RF2. La dernière colonne dit si le requis vaut pour l'entraînement (trimestriel), pour le scoring (hebdomadaire) ou pour les deux.

| # | Requis | Vérification | Vaut pour |
|---|---|---|---|
| RD1 | Au moins **100 événements positifs** par modèle dans l'historique | Compté avant chaque entraînement ; sinon repli sur RFM | Entraînement |
| RD2 | **Schéma minimal** en CSV, dates au format AAAA-MM-JJ. Donateurs : `id` (obligatoire), `email`, `email_consent`, `kind`, `join_date`. Dons : `donor_id`, `date`, `amount` (obligatoires), `kind`, `status`. Ouvertures (facultatif) : `donor_id`, `month`, `open_rate` | Import : lignes illisibles ou mal datées écartées et comptées (`src/lib/csv.ts`) | Les deux |
| RD3 | **Historique** assez long pour atteindre RD1 : environ 5 trimestres pour 300 mensuels. Les photos remontent au plus à 42 mois | Calculé à l'import | Entraînement |
| RD4 | **Fraîcheur** : export hebdomadaire ; dernier don enregistré il y a moins de 31 jours | Contrôle « Actualité » de la page Données | Scoring |
| RD5 | **Consentement** : aucun courriel sans consentement (LCAP) ; ouvertures (S4) lues seulement pour les donateurs qui ont consenti au suivi ; drapeau d'opposition au profilage respecté (RF23) | Contrôle « Accessibilité » ; filtre avant le calcul des variables | Les deux |
| RD6 | **Seuils de qualité bloquants** (V1) : 0 identifiant en double, 0 don orphelin, 0 don daté dans le futur. Les autres contrôles de RF2 (courriels valides ≥ 95 %, montants aberrants ≤ 0,1 %, dons antérieurs à l'inscription ≤ 0,1 %, etc.) restent des avertissements | Page Données (`src/lib/quality.ts`) | Les deux |

Dans le prototype, les contrôles de RF2 signalent sans bloquer, et un champ `email_consent` absent vaut « oui ». En V1, RD6 bloquera l'import et un consentement absent vaudra « non ».

**Sous le seuil : trois options.**
1. **Repli sur RFM.** C'est le comportement par défaut. La gouvernance R1 + R2 le prévoit déjà : sans modèle valable, la liste est classée par la règle RFM calibrée.
2. **Attendre.** L'historique s'accumule ; le modèle est réévalué à chaque trimestre.
3. **Modèle initial commun (V2).** Pré-entraîner un modèle sur les données de plusieurs organisations clientes, avec leur accord, puis l'ajuster à chaque OBNL. Cette option demande un accord de partage de données et une ÉFVP (section 8.3). Le modèle commun doit lui aussi passer R1 et R2 sur les données de l'organisation avant d'être utilisé.

### 5.5 Documentation

- `docs/DATASHEET-synthetique.md` et `docs/DATASHEET-kdd98.md` (Gebru et al., 2021) : motivation, composition, processus, prétraitement, usages, distribution, maintenance.
- `docs/MODEL_CARD.md` (Mitchell et al., 2019) : usage prévu, performances, équité, limites, surveillance.

---

## 6. Prototype

### 6.1 Ce qu'il démontre

Application web complète, en français, disponible en local, dans un conteneur Docker et en ligne, sans installation : https://wtigg.github.io/fidelia/ (code : https://github.com/wtigg/fidelia).

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

**Requis de performance R1 à R6 validés par le meilleur candidat : 17 sur 24 (6 requis × 4 modèles).** Les requis portent sur le meilleur modèle candidat de chaque tâche, pas sur ce qui est livré : pour la hausse, c'est la règle RFM qui classe, et ses 4 échecs portent sur un modèle non déployé.

| Modèle | Requis non validés |
|---|---|
| Attrition | aucun (6/6) |
| Hausse | R1, R2, R4, R6 : modèle remplacé par la règle RFM |
| Passage au mensuel | R6 (calibration par âge) |
| Réactivation | R5 (dérive temporelle), R6 |

Les échecs sont discutés en sections 8 et 10 ; nous ne les avons pas « corrigés » en modifiant les seuils ou le générateur.

- **Robustesse :** sur 5 autres jeux générés (`npm run robustness`), le modèle a une AUC-PR supérieure à RFM dans **20 cas sur 20**. Il remplit la condition de déploiement (R1 + R2) dans **15 cas sur 20** :

| Modèle | Fidélia AUC-PR | RFM AUC-PR | Déployé (R1 + R2) |
|---|---|---|---|
| Attrition | 0,209 ± 0,032 | 0,097 ± 0,007 | 5/5 |
| Réactivation | 0,215 ± 0,032 | 0,087 ± 0,012 | 5/5 |
| Passage au mensuel | 0,106 ± 0,065 | 0,042 ± 0,018 | 4/5 |
| Hausse | 0,103 ± 0,040 | 0,057 ± 0,011 | 1/5 |

- **Justesse :** résultats équivalents à scikit-learn (`verification/RESULTATS.md`).

**Données réelles, KDD Cup 1998 (18 824 donateurs de test, sur 95 412) :**

| Tâche | Taux de base | Fidélia AUC-PR [IC 95 %] | RFM AUC-PR [IC 95 %] | Écart apparié [IC 95 %] | R1 (≥ 2 × taux de base) | Déployable (R1 + R2) |
|---|---|---|---|---|---|---|
| Réactivation | 5,08 % | **0,083** [0,075–0,094] | 0,053 [0,049–0,058] | [0,022 ; 0,039] | 0,083 < 0,102 : **échoue** | Non |
| Don plus élevé que le dernier | 1,73 % | **0,040** [0,033–0,050] | 0,019 [0,017–0,021] | [0,016 ; 0,031] | 0,040 ≥ 0,035 : réussit | Oui |

Le modèle de réactivation bat RFM de façon significative, mais reste trop faible face au hasard pour notre propre règle (leçon 3). Profit net de la relance avec 20 % des envois : **2 133 $ contre 1 413 $** pour RFM.

### 6.3 Reproduire

**Prérequis :** Node.js 22 ou plus et npm ; Python 3.11 ou plus avec scikit-learn, pandas et numpy ; `curl` et `unzip` pour télécharger KDD 98. Le détail des versions est dans le `README.md`.

**Avec Docker (sans installer Node) :** le `Dockerfile` fige la version de Node et installe les dépendances exactes du `package-lock.json` (`npm ci`). C'est la démarche de portabilité vue en séance 5 (scénario 4).

```bash
docker build -t fidelia . && docker run --rm -p 8080:80 fidelia     # application sur http://localhost:8080
docker build --target eval -t fidelia-eval .
docker run --rm fidelia-eval                                        # 19 tests, puis contrôle de reproductibilité
```

La cible `eval` lance les 19 tests, puis le contrôle de reproductibilité (`npm run check:repro`). Celui-ci réentraîne la graine 42 dans un dossier temporaire et compare le résultat au rapport versionné `reports/synthetique-42.json`, à 1e-9 près (seuls l'horodatage et la durée sont ignorés). Message attendu : « Reproductible : rapport graine 42 identique à reports/synthetique-42.json ». Rien n'est écrit dans `reports/`.

Pour régénérer le rapport sur le poste, il faut une commande à part :

```bash
docker run --rm -v "$PWD/reports:/app/reports" fidelia-eval npm run evaluate 42
```

**Sans Docker :**

```bash
npm ci                                             # dépendances exactes du package-lock.json
npm test                                           # 19 tests : métriques, RFM, pipeline, requis, CSV
npm run check:repro                                # réentraîne la graine 42 et compare au rapport versionné
npm run dev                                        # lance l'application
npm run calibration > reports/calibration.txt      # compare le synthétique aux taux publiés
npm run train                                      # entraîne et écrit src/data/model.json
npm run evaluate 42 > reports/evaluate-42.txt      # écrit aussi reports/synthetique-42.json
npm run robustness > reports/robustesse.txt        # écrit aussi reports/robustesse.json
./scripts/download-kdd98.sh
npm run kdd98 > reports/kdd98.txt                  # écrit aussi reports/kdd98.json
npm run export-rows
python3 verification/verify_sklearn.py > reports/sklearn.txt
```

**Intégration continue.** À chaque push et à chaque pull request, GitHub Actions (`.github/workflows/deploy.yml`) enchaîne :
1. `npm ci`, le linter, puis les tests ;
2. le contrôle de reproductibilité (`npm run check:repro`, tolérance 1e-9) ;
3. la construction du site ;
4. la construction des deux images Docker (`web` et `eval`), puis l'exécution de l'image `eval` ;
5. la publication sur GitHub Pages, seulement pour un push sur `main`.

Une étape qui échoue bloque la publication. Le contrôle ne dépend pas de git : il fonctionne aussi dans le conteneur.

### 6.4 Différences entre le prototype et la solution cible

Déclarées en toute transparence :
- courriels simulés ;
- calcul côté navigateur plutôt que serveur ;
- pas d'authentification ;
- données synthétiques plutôt que CRM réel ;
- gabarits plutôt que LLM ;
- modèles maison en TypeScript plutôt que scikit-learn ;
- pas d'opposition au profilage ni de purge des données (RF23, RF24) ;
- alertes R3 à R6 visibles dans la liste des requis, mais pas encore à côté de la décision de déploiement (section 4.3).

La solution cible reprend les mêmes variables et les mêmes algorithmes, réécrits avec scikit-learn et validés par la vérification croisée (section 4.5).

---

## 7. Risques

| Catégorie | Risque | Probabilité / gravité | Mesure |
|---|---|---|---|
| Données | Données réelles sales (doublons, montants saisis à la main) | Élevée / moyenne | Contrôles automatiques à l'import (RF2), rejet ou signalement |
| Données | Historique trop court : moins de 100 événements positifs (petit OBNL, nouvelle organisation) | Élevée / moyenne | Requis RD1 (section 5.4) : repli automatique sur RFM ; modèle commun en V2 |
| Données | Pas d'historique d'ouvertures (organisation sans outil de courriels) | Moyenne / moyenne | Variable d'absence ; modèle utilisable sans, avec une performance moindre |
| Modèle | Modèle appris sur synthétique, inadapté au réel | Élevée / élevée | Réentraînement obligatoire sur les données de l'organisation ; R1 et R2 bloquants ; alertes R3 à R6 examinées et levées par un humain avant mise en service (section 4.3) |
| Modèle | Signal trop faible sur données réelles (comme la réactivation sur KDD 98, qui échoue à R1) | Moyenne / moyenne | Gouvernance R1 + R2 : la liste reste classée par RFM |
| Modèle | Dérive : crise, inflation, nouvelle campagne | Moyenne / moyenne | Requis R5, suivi hebdomadaire, réentraînement trimestriel, retour à la version précédente |
| Usage | Confondre propension et effet causal | Élevée / moyenne | Groupe témoin (RF14), effet traité comme hypothèse dans la page Impact |
| Usage | Automatisation excessive, envois sans relecture | Moyenne / élevée | Validation humaine par défaut (RF11) |
| Légal | Profilage sans information ni droit d'opposition (Loi 25) | Moyenne / élevée | Avis de profilage, opposition (RF23), accès et purge (RF24), section 8.3 |
| Légal | Courriels sans consentement (LCAP) | Faible / élevée | RF13, désabonnement dans chaque courriel |
| Légal | Fournisseur de courriels hors Québec : noms, adresses et contenu des messages transmis | Moyenne / élevée | Fournisseur hébergé au Canada en priorité ; sinon ÉFVP et contrat avant le transfert (section 8.3) |
| Infrastructure | Fuite de la base de donateurs | Faible / très élevée | Prototype : rien ne quitte le navigateur. Cible : hébergement au Canada, chiffrement, comptes séparés |
| Individuel | Donateur sans adresse courriel ou sans consentement au suivi : jamais contacté par l'outil, ou mal classé (variable d'ouverture manquante) | Moyenne / moyenne | Variable d'absence dans le modèle ; listes « hors courriel » à traiter par téléphone ou par la poste ; part des donateurs exclus affichée dans la page Données |
| Individuel | Donateur qui s'oppose au profilage | Faible / moyenne | RF23 : exclu des modèles, jamais scoré ; RF24 : accès et suppression |
| Sociétal | Fatigue de sollicitation : si tous les OBNL ciblent les mêmes « bons » donateurs, ceux-ci reçoivent plus de demandes | Moyenne / moyenne | Plafond d'un courriel par 30 jours (RF12), remerciement avant demande ; limite propre à chaque organisation, rien entre organisations |
| Sociétal | Emploi dans les petites équipes : l'outil pourrait servir à justifier moins de personnel | Faible / moyenne | Outil d'augmentation, pas d'automatisation (section 8.4) : il trie, l'équipe écrit et décide |
| LLM (V2) | Fuite : données de donateurs envoyées à un fournisseur de LLM, souvent hors Canada | Moyenne / élevée | Envoyer seulement le gabarit et des champs non nominatifs (prénom remplacé par un jeton) ; ÉFVP ; sinon modèle ouvert hébergé au Canada ou localement. Démarche du guide d'usage responsable de Meta (2024) : définir le cas d'usage, filtrer l'entrée et la sortie, tester par attaque (*red teaming*) |
| LLM (V2) | Hallucination : montant, fait ou promesse inventés dans un courriel | Moyenne / élevée | Contrôle automatique de la sortie (Meta, 2024) : tout montant ou date du brouillon doit venir des données ; validation humaine obligatoire |
| LLM (V2) | Injection de requêtes par un champ libre | Faible / moyenne | Aucun champ libre transmis (notes du CRM exclues) |
| Réputation | Donateur choqué d'être « scoré » | Faible / élevée | Transparence, ton des messages, aucune donnée sensible utilisée |

---

## 8. Éthique

### 8.1 Sources de tort tout au long du cycle (Suresh et Guttag, 2021)

La consigne demande de couvrir tout le cycle de vie. La première colonne situe chaque source de tort dans ce cycle. Les lignes Collecte et Maintenance complètent le cadre de Suresh et Guttag.

| Étape du cycle | Source | Dans Fidélia | Mesure |
|---|---|---|---|
| Collecte | Suivi des ouvertures | La variable la plus utile au modèle d'attrition, le taux d'ouverture, vient d'un pixel invisible dans les courriels. Le donateur ne sait pas toujours qu'il est suivi | Ouvertures utilisées seulement pour les donateurs qui ont consenti au suivi ; mention dans l'avis de profilage (section 8.3) ; sinon, variable d'absence |
| Données | Biais historique | Dans nos données, les aînés donnent et redonnent plus : le modèle les classe plus haut pour la conversion (ratio de sélection 1,80 chez les 70 ans et plus). **Attention :** cet effet vient d'une hypothèse du générateur, qui lie l'attachement à l'âge (`src/data/generate.ts`). Il ne prouve rien sur de vrais donateurs | Plafond de sollicitation, remerciement avant demande, suivi du ratio par âge ; audit à refaire sur les données réelles de l'organisation |
| Collecte | Représentation | Synthétique = nos hypothèses ; KDD 98 = Américains, vétérans, 1997 | Réentraînement sur les données de l'organisation ; limites écrites |
| Données | Mesure | « Inactif » = 12 ou 13 mois sans don : définition arbitraire | Documentée dans la datasheet, paramétrable |
| Modèle | Agrégation | Un même modèle pour tous les donateurs d'une organisation | Modèles séparés par segment (mensuel, ponctuel, inactif) |
| Modèle | Apprentissage | Sans l'âge en variable, le modèle de conversion **sous-estime** les 70 ans et plus (prédit / observé = 0,54, sur environ 38 conversions) et **sur-estime** les 35-54 ans (2,24, sur environ 8 conversions seulement) | Audit par sous-groupe (R6) ; options discutées en leçon 5 |
| Évaluation | Évaluation | Petits jeux de test pour les mensuels ; petits effectifs par tranche d'âge | Intervalles de confiance par bootstrap pour les métriques globales, test temporel, 5 graines, données réelles. Les ratios par âge n'ont pas encore d'intervalle de confiance |
| Utilisation | Déploiement | Usage du score hors de son but (ex. retirer des services) | Fiche modèle : usages exclus ; aide à la décision seulement |
| Maintenance | Boucle de rétroaction | Le modèle est réentraîné sur des données que ses propres relances ont changées. Un donateur relancé qui reste semble « peu à risque » ; le modèle apprend alors à ne plus le cibler. La dérive (crise, inflation) s'ajoute | Groupe témoin de 10 % jamais contacté (RF14) : seul échantillon non biaisé par les relances ; R5 et AUC-PR glissante (section 8.2) ; retour à la version précédente |

**Prudence sur l'audit d'équité.** Les ratios de calibration par âge reposent sur peu de cas positifs. Le ratio de 2,24 des 35-54 ans s'appuie sur environ 8 conversions parmi 1 290 exemples (taux observé 0,62 %, `reports/synthetique-42.json`). Une ou deux conversions de plus ou de moins changeraient beaucoup ce ratio. Ces écarts reflètent surtout les hypothèses du générateur. L'audit devra être refait sur les données réelles de chaque organisation, avec des intervalles de confiance.

### 8.2 De la composante au tort (Rismani et al., 2025)

| Composante | Attribut | Mesure (seuil) | Danger | Tort |
|---|---|---|---|---|
| Score de conversion | Équité par âge | Ratio de sélection des 70 ans et plus > 1,5 (mesuré : 1,80) ; calibration hors de [0,67 ; 1,5] (mesuré : 0,54 et 2,24, sur de petits effectifs) | Sur-sollicitation des aînés, montants mal calibrés par âge | Pression financière, perte de confiance |
| Score d'attrition | Calibration | Brier < constante (R4) | Probabilités trop optimistes | Mauvaise allocation du temps de l'équipe |
| Brouillon de courriel (gabarits) | Fidélité aux données | 0 montant inventé | Message erroné | Atteinte à la réputation |
| Brouillon de courriel (LLM, V2) | Fidélité et confidentialité | 0 montant ou fait absent des données ; 0 donnée nominative envoyée au fournisseur | Hallucination, fuite de données | Donateur trompé, atteinte à la vie privée, sanction (Loi 25) |
| Cycle automatique | Fréquence de contact | ≤ 1 courriel par 30 jours (RF12) | Harcèlement | Désabonnements, plaintes |
| Modèle en production | Stabilité | R5 ; AUC-PR glissante > RFM | Dérive non détectée | Décisions dégradées sans le savoir |

### 8.3 Cadre légal et normatif

- **Loi 25 (Québec)** : le scoring est un **profilage**. Vial, Crowe et Mesana (2024) rappellent que protéger la vie privée en analytique est un arbitrage : plus on protège, moins la donnée est utile. Le risque de réidentification vient aussi des quasi-identifiants, comme l'âge ou le quartier. Mesures prévues :
  - informer les donateurs, dans la politique de confidentialité, de l'usage d'une technologie de profilage et des moyens de s'y opposer (RF23) ;
  - permettre l'accès aux données et aux scores, leur rectification et leur suppression, avec une durée de conservation définie (RF24) ;
  - minimiser les données : ni âge, ni région, ni quartier dans le modèle ;
  - mener une évaluation des facteurs relatifs à la vie privée (ÉFVP) avant tout transfert hors Québec : hébergement, fournisseur de courriels, fournisseur de LLM en V2 ;
  - désigner un responsable de la protection des renseignements personnels dans l'organisation.
- **LCAP (Loi canadienne anti-pourriel)** : consentement, identification de l'expéditeur, désabonnement.
- **NIST AI RMF (NIST, 2023)** :

| Fonction | Dans Fidélia |
|---|---|
| Gouverner | Fiche modèle, responsable désigné |
| Cartographier | Canevas, risques |
| Mesurer | Requis R1 à R6, audit d'équité |
| Gérer | Surveillance, retour arrière, groupe témoin |

- **Déclaration de Montréal pour une IA responsable** : principes d'autonomie (l'humain décide), de protection de l'intimité, de prudence et de responsabilité.

### 8.4 Humain dans la boucle

Fidélia suggère et l'équipe décide. C'est une forme d'**augmentation** plutôt que d'automatisation (Raisch et Krakowski, 2021), alignée sur l'idée d'*engaged augmentation* : l'utilisateur comprend et questionne la recommandation grâce aux raisons affichées (Lebovitz et al., 2022).

### 8.5 Trois questions de la séance 4

La séance 4 pose trois questions à partir de Varoquaux, Luccioni et Whittaker (2025).

- **Conséquences environnementales ?** Faibles. Aucun GPU : les modèles s'entraînent en quelques secondes sur un processeur (section 9.2), environ 20 s dans le navigateur pour l'entraînement complet (leçon 8). Le scoring hebdomadaire demande environ une minute de CPU par organisation. Le LLM de la V2 ajouterait un coût par brouillon ; c'est une raison de plus de le garder optionnel.
- **Plus de données, à quel risque ?** Le prototype n'utilise que l'historique des dons et des ouvertures, sans âge ni région. Le vrai risque est le modèle commun de la V2 (section 5.4) : regrouper les donateurs de plusieurs OBNL chez un seul fournisseur augmente l'effet d'une fuite et demande un accord de partage. Nous ne le ferons que si un modèle par organisation échoue à RD1, et après une ÉFVP.
- **Concentration de pouvoir ?** Les outils prédictifs du secteur sont vendus par de grands CRM, à des prix hors de portée d'un très petit OBNL (section 1.4). Fidélia vise l'inverse : méthode publiée, modèle exportable (`model.json`), données importées et exportées en CSV. Un client peut partir avec ses données et revenir à RFM sans perte.

---

## 9. Estimations

### 9.1 Ressources humaines (V1, 6 mois)

**Taux de référence.** Salaire horaire médian dans la région de Montréal, selon le Guichet-Emplois (données 2023-2024) :
- scientifique de données (CNP 21211) : 45,64 $ ;
- programmeur en développement de logiciels (CNP 21232) : 45,67 $.

Nous retenons le même taux, 45,65 $, pour le chef de produit et le designer UX (hypothèse simplificatrice). Nous ajoutons 25 % pour les charges sociales et les avantages (hypothèse de l'équipe). Un ETP compte 1 820 heures par an (35 h × 52 semaines), soit 910 heures sur 6 mois.

| Rôle | Charge | Heures (6 mois) | Taux | Coût salarial | Tâches |
|---|---|---|---|---|---|
| Chef de produit | 0,5 ETP | 455 | 45,65 $ | 20 771 $ | Besoins des OBNL, priorités, tests utilisateurs |
| Scientifique de données | 1 ETP | 910 | 45,64 $ | 41 532 $ | Variables, modèles, évaluation, surveillance, équité |
| Développeur web | 1 ETP | 910 | 45,67 $ | 41 560 $ | Authentification, connecteurs CRM et courriels, base de données |
| Designer UX | 0,3 ETP | 273 | 45,65 $ | 12 462 $ | Parcours des responsables des dons, accessibilité |
| **Total** | **2,8 ETP** | **2 548** | | **116 325 $** | |
| **Total chargé** (+ 25 %) | | | | **145 406 $** | |

### 9.2 Ressources matérielles

**Exploitation, par mois, pour 50 organisations clientes :**

| Poste | Estimation |
|---|---|
| Base de données gérée au Canada (PostgreSQL, AWS ca-central-1 ou équivalent) | 50 à 150 $ |
| Tâches d'entraînement et de scoring (conteneurs, environ 1 min de CPU par organisation et par semaine) | 20 à 50 $ |
| Hébergement de l'interface | 0 à 20 $ |
| Fournisseur de courriels | 25 à 100 $ |
| LLM pour la reformulation (V2, environ 2 000 brouillons par mois) | 10 à 30 $ |
| **Total** | **105 à 350 $** |

**Stockage.** Le jeu de démonstration compte 4 000 donateurs et 17 909 dons (`reports/evaluate-42.txt`). Cela représente quelques mégaoctets. Nous prévoyons au plus 50 Mo par organisation, historique des scores et des envois compris, soit moins de 3 Go pour 50 organisations. Le stockage n'est donc pas un poste de coût important.

**Au-delà de 50 organisations.** Le seuil de rentabilité (section 9.3) demande 90 à 330 clients. Nous supposons que l'infrastructure croît de façon à peu près linéaire : 2,10 à 7 $ par organisation et par mois, soit 2 268 à 7 560 $ par an pour 90 clients et 5 040 à 16 800 $ par an pour 200 clients (hypothèse de l'équipe). Le seuil de rentabilité ci-dessous utilise ce coût par client, pas le total pour 50.

**Calcul.** Aucune carte graphique n'est nécessaire : les modèles s'entraînent en quelques secondes sur un processeur.

**Environnement de développement.** Les ordinateurs portables de l'équipe, GitHub et son intégration continue (offre gratuite) suffisent. Coût supplémentaire : nul.

### 9.3 Ressources financières

**Coût de la V1 (6 mois) :**

| Poste | Montant | Source |
|---|---|---|
| Équipe, charges comprises | 145 406 $ | Section 9.1 |
| Conseiller juridique (Loi 25), environ 20 h | 4 000 $ | Hypothèse : 200 $/h, à confirmer par soumission |
| Pilote avec 2 OBNL (3 mois d'hébergement et de courriels, borne haute) | 1 050 $ | 3 × 350 $ (section 9.2) |
| **Sous-total V1** | **environ 150 000 $** | |
| Réserve pour imprévus, 10 à 20 % | 15 000 à 30 000 $ | Hypothèse de l'équipe |
| **Total V1** | **environ 165 000 à 180 000 $** | |

**Coût annuel récurrent après le lancement :**

| Poste | Montant par an | Calcul |
|---|---|---|
| Maintenance du modèle et corrections (0,5 ETP : scientifique de données et développeur) | 51 927 $ | 910 h × 45,65 $ × 1,25 |
| Vente, acquisition de clients et support aux OBNL (0,5 ETP) | 51 927 $ | Hypothèse de l'équipe, même calcul |
| Obligations légales récurrentes : mise à jour de l'ÉFVP, appui au responsable de la protection des renseignements personnels, environ 10 h | 2 000 $ | Hypothèse : 200 $/h, comme en V1 |
| Assurance responsabilité et cyberrisques | non chiffrée | À obtenir par soumission |
| **Coûts fixes** | **environ 106 000 $** (8 821 $ par mois) | Hors assurance |
| Infrastructure | 2,10 à 7 $ par client et par mois | Section 9.2, croissance linéaire supposée |

**Seuil de rentabilité.** Prix envisagé : abonnement de 49 à 99 $ par mois par OBNL. L'infrastructure coûte 2,10 à 7 $ par organisation et par mois. La marge par client est donc d'environ 42 à 47 $ par mois à 49 $, et 92 à 97 $ par mois à 99 $.
- **Exploitation seule** (coûts fixes d'environ 8 821 $ par mois, hors assurance) : rentable à partir d'environ 90 à 100 clients à 99 $, ou 190 à 210 clients à 49 $.
- **Avec amortissement de la V1 sur 3 ans** (165 000 à 180 000 $ ÷ 36 = 4 583 à 5 000 $ par mois, soit environ 13 400 à 13 800 $ de coûts fixes par mois) : rentable à partir d'environ 140 à 150 clients à 99 $, ou 290 à 330 clients à 49 $.

Ces seuils restent optimistes : ils excluent l'assurance et supposent que 0,5 ETP suffit à vendre et à soutenir plus de 100 clients. Ils sont élevés pour un marché de niche. Une subvention ou un partenariat avec une fédération d'OBNL pourrait financer la V1 et offrir une version gratuite aux très petits OBNL.

### 9.4 Échéancier de la V1 (6 mois)

L'échéancier suit la logique de feuille de route d'Anderson et Coveyduc (2020), vue en séance 2 : partir du besoin d'affaires, valider les données, puis piloter avant de lancer.

| Mois | Livrable | Requis |
|---|---|---|
| 1 | Entrevues avec 5 OBNL, connecteurs CSV, schéma de données | RF1, RF2 |
| 2 | Variables et modèles en Python et scikit-learn, tâche serveur planifiée, API | RF3 à RF9, RF18 |
| 3 | Interface : authentification, listes, fiches, tableau de bord, pages Impact et Modèle. Opposition au profilage, accès et purge, prêts **avant** de scorer de vrais donateurs | RF15 à RF17, RF20 à RF24 |
| 4 | Courriels réels, validation, plafond, consentement, groupe témoin, journal des envois. **Début du pilote** avec 2 OBNL sur leurs données (accord écrit) | RF11 à RF14, RF19, RD1 à RD6 |
| 5 | Pilote (suite) : audit d'équité sur données réelles, R1 et R2 sur les données de chaque OBNL | RF17 (équité) |
| 6 | Fin du pilote (3 mois), documentation Loi 25, corrections, lancement | |
| Après le lancement | Suivi de la cohorte du pilote jusqu'à 6 mois, pour la conversion. Effet causal mesuré sur les témoins mis en commun (section 5.4) | RF14 |

**V1 :** RF1 à RF9 et RF11 à RF24. RF18 y est en version simple : scoring hebdomadaire automatique, réentraînement trimestriel lancé à la main. R1 et R2 bloquent automatiquement ; une personne examine et lève les alertes R3 à R6 avant la mise en service. RF10 reste en gabarits.

**V2 :** reformulation des courriels par LLM (RF10), connecteurs API vers les CRM, modèle initial commun (section 5.4).

---

## 10. Leçons apprises

1. **Un modèle entraîné sur des données synthétiques apprend d'abord le générateur.** Sur nos données, l'AUC des modèles déployés atteint 0,71 à 0,82 ; sur de vrais donateurs (KDD 98), elle tombe à environ 0,62. Le synthétique est indispensable pour respecter la confidentialité et démontrer le système, mais il ne remplace pas une validation sur données réelles. Il faut écrire noir sur blanc ce qu'il prouve et ce qu'il ne prouve pas (Jarrahi, Memariani et Guha, 2023 ; Sambasivan et al., 2021).

2. **Méfiez-vous des résultats trop beaux : nous avons trouvé deux fuites de données.**
   - Le contrôle de qualité a d'abord révélé des dons datés avant l'inscription.
   - En corrigeant ce défaut, le modèle de réactivation est passé à une AUC de 0,94, un résultat suspect.
   - L'enquête a révélé deux fuites. Un donateur inscrit le jour même de la photo était compté comme « inactif », son premier don devenant une « réactivation ». Un nouveau mensuel comptait comme une « hausse » de 0 $.
   - Après correction, l'AUC est revenue à 0,75 et la hausse ne bat plus RFM.

   Sans contrôle de qualité ni esprit critique, nous aurions présenté des performances fausses (Sculley et al., 2015 ; Kapoor et Narayanan, 2023).

3. **La règle RFM est une référence sérieuse, et l'IA n'a de valeur qu'au bon endroit.**
   - Sur KDD 98, quand on écrit à 68 % des donateurs (12 894 envois), RFM fait même un peu mieux : 2 422 $ contre 2 320 $ (`reports/kdd98.txt`). L'avantage du modèle est de bien classer **les premiers noms** : +51 % de profit avec 20 % des envois.
   - Sur KDD 98, le modèle de réactivation bat RFM de façon significative, mais **échoue à notre requis R1** (0,083 contre un seuil de 0,102). Plus de données n'y change rien : sa courbe d'apprentissage est plate, de 0,082 avec 7 660 exemples à 0,083 avec 76 588. La limite vient donc des variables disponibles, pas du volume. Battre RFM ne suffit pas ; il faut aussi battre nettement le hasard.
   - Sur nos données, le modèle de hausse ne bat pas RFM : la règle de gouvernance garde donc RFM pour cette liste.

   L'IA doit gagner sa place cas d'usage par cas d'usage.

4. **Prédire n'est pas causer.** Un modèle de propension cible les donateurs qui allaient peut-être convertir d'eux-mêmes. Pour mesurer ce que l'action change vraiment, il faut un groupe témoin. C'est ce qui nous a fait séparer clairement, dans la page Impact, ce qui est mesuré (la qualité du ciblage) de ce qui est supposé (l'effet de l'action).

5. **Retirer l'âge du modèle ne suffit pas à le rendre équitable.**
   - Nous avons exclu l'âge des variables : minimisation des données, Loi 25.
   - Mais, dans notre générateur, l'âge influence la fidélité. Le modèle sous-estime donc les 70 ans et plus et sur-estime les 35-54 ans (R6 non validé).
   - Ces écarts reposent sur de petits effectifs et sur nos hypothèses. Il faudra les mesurer à nouveau sur des données réelles.
   - Corriger demanderait d'utiliser l'âge, au moins pour recalibrer par groupe. C'est un arbitrage entre vie privée et calibration (Vial, Crowe et Mesana, 2024).
   - Les critères d'équité sont en général mathématiquement incompatibles (Kleinberg, Mullainathan et Raghavan, 2017).

   Nous documentons l'écart, le surveillons et laissons la décision à l'organisation.

6. **La façon de comparer compte autant que le modèle.**
   - Comparer deux intervalles de confiance qui se chevauchent est trop conservateur : notre modèle de conversion, 2,6 fois meilleur que RFM, aurait été rejeté. Le bon test est un **bootstrap apparié** de l'écart, sur les mêmes donateurs.
   - Inversement, un test temporel sur 2 dates seulement (environ 180 exemples) donnait des résultats erratiques ; nous l'avons élargi à 4 dates.
   - Fixer les requis **avant** de voir les résultats nous a empêchés d'ajuster les seuils pour qu'ils passent.

7. **Un petit OBNL a peu de données : la faisabilité se calcule avant de coder.** Nos courbes d'apprentissage montrent qu'autour de 20 événements positifs, l'attrition et la réactivation échouent à R1. Un OBNL de 300 mensuels observe environ 20 départs par trimestre. Il lui faut donc plus d'un an d'historique avant qu'un modèle soit utile. Nous en avons tiré un requis de données (RD1) et un repli explicite sur RFM (section 5.4). C'est le conseil de Ng (2019) : vérifier tôt, par de petites expériences, que les données suffisent. C'est aussi le constat de Vial et al. (2021) : le frein principal est souvent l'accès aux données, pas l'algorithme.

8. **Pré-entraîner et versionner le modèle simplifie tout.** L'entraînement complet prend environ 20 s dans le navigateur. Sérialiser un modèle versionné (`model.json`) donne une application instantanée, un retour arrière simple et une traçabilité. Ce sont des pratiques MLOps vues en séance 7 (Kreuzberger, Kühl et Hirschl, 2023).

---

## 11. Conclusion et viabilité

**Ce qui est prouvé.** La méthode classe mieux que la règle RFM. Sur le jeu synthétique, 3 modèles sur 4 remplissent la condition de déploiement (R1 + R2), et 15 cas sur 20 sur 5 autres jeux générés. Sur de vrais donateurs (KDD Cup 1998), la méthode de classement rapporte 2 133 $ contre 1 413 $ pour RFM avec 20 % des envois (+51 %), mais ce modèle de réactivation échoue à R1 : c'est une validation de la méthode, pas un modèle que nous déploierions. La gouvernance fonctionne : elle garde RFM pour la hausse.

**Ce qui ne l'est pas.** L'effet causal des relances : la page Impact le suppose ; seuls des témoins mis en commun entre organisations le mesureront, après la V1. La performance sur les données d'un vrai OBNL québécois : nos modèles ont appris un générateur (leçon 1). Et le modèle de réactivation échoue à R1 sur KDD 98 : nous ne le déploierions pas.

**Trois menaces pour la pérennité.**
1. **Le volume de données.** Un OBNL de 300 mensuels doit accumuler environ 5 trimestres d'historique avant qu'un modèle d'attrition soit utile (section 5.4). Les plus petits clients resteront sur RFM ; la valeur ajoutée de l'IA sera alors nulle pour eux.
2. **Le seuil de rentabilité.** Il faut environ 140 à 150 clients à 99 $ par mois pour couvrir l'exploitation, la vente, le support et amortir la V1 (section 9.3). C'est beaucoup pour un marché de niche.
3. **La Loi 25.** Profilage, opposition, ÉFVP, purge : ces obligations ajoutent du travail juridique et technique (RF23, RF24). Une organisation peut renoncer par prudence.

**Dans la vraie vie**, Fidélia pourrait donc ne pas être réalisable comme produit vendu seul. Un financement par subvention ou par une fédération d'OBNL est plus réaliste.

**Condition de poursuite.** Un pilote de 3 mois (mois 4 à 6 de la V1, section 9.4) avec 2 OBNL, sur leurs propres données. On continue seulement si, chez chacun, au moins un modèle valide R1 et R2, et si l'équipe utilise réellement les listes chaque semaine. Sinon, l'outil reste une aide RFM simple, ce qui a déjà une valeur.

**Ce que le pilote ne peut pas prouver.** L'effet causal des relances. Chez un OBNL de 300 mensuels, le témoin de 10 % compte 30 donateurs et environ 2 départs par trimestre. Pour détecter une baisse de 30 % des départs, il faut environ 1 160 mensuels témoins (section 5.4). La conversion se mesure sur 6 mois, au-delà du pilote. L'effet sera donc mesuré **après la V1**, en mettant en commun les témoins d'environ 40 organisations de 300 mensuels, avec leur accord. D'ici là, la page Impact reste une simulation fondée sur une hypothèse.

---

## Références

Format APA 7. Les DOI ont été vérifiés sur Crossref ; les pages Web ont été consultées le 9 novembre 2026.

**Académiques** (revues et actes avec comité de lecture)
1. Enholm, I. M., Papagiannidis, E., Mikalef, P. et Krogstie, J. (2022). Artificial intelligence and business value: A literature review. *Information Systems Frontiers*, *24*(5), 1709-1734. https://doi.org/10.1007/s10796-021-10186-w
2. Fader, P. S., Hardie, B. G. S. et Lee, K. L. (2005). RFM and CLV: Using iso-value curves for customer base analysis. *Journal of Marketing Research*, *42*(4), 415-430. https://doi.org/10.1509/jmkr.2005.42.4.415
3. Friedman, J. H. (2001). Greedy function approximation: A gradient boosting machine. *The Annals of Statistics*, *29*(5), 1189-1232. https://doi.org/10.1214/aos/1013203451
4. Gebru, T., Morgenstern, J., Vecchione, B., Vaughan, J. W., Wallach, H., Daumé, H., III et Crawford, K. (2021). Datasheets for datasets. *Communications of the ACM*, *64*(12), 86-92. https://doi.org/10.1145/3458723
5. Jarrahi, M. H., Memariani, A. et Guha, S. (2023). The principles of data-centric AI. *Communications of the ACM*, *66*(8), 84-92. https://doi.org/10.1145/3571724
6. Kapoor, S. et Narayanan, A. (2023). Leakage and the reproducibility crisis in machine-learning-based science. *Patterns*, *4*(9), Article 100804. https://doi.org/10.1016/j.patter.2023.100804
7. Kleinberg, J., Mullainathan, S. et Raghavan, M. (2017). Inherent trade-offs in the fair determination of risk scores. Dans *8th Innovations in Theoretical Computer Science Conference (ITCS 2017)* (Leibniz International Proceedings in Informatics, vol. 67, p. 43:1-43:23). Schloss Dagstuhl. https://doi.org/10.4230/LIPIcs.ITCS.2017.43
8. Kreuzberger, D., Kühl, N. et Hirschl, S. (2023). Machine learning operations (MLOps): Overview, definition, and architecture. *IEEE Access*, *11*, 31866-31879. https://doi.org/10.1109/ACCESS.2023.3262138
9. Lebovitz, S., Lifshitz-Assaf, H. et Levina, N. (2022). To engage or not to engage with AI for critical judgments: How professionals deal with opacity when using AI for medical diagnosis. *Organization Science*, *33*(1), 126-148. https://doi.org/10.1287/orsc.2021.1549
10. Longpre, S., Singh, N., Cherep, M., Tiwary, K., Materzynska, J., Brannon, W., Mahari, R., Obeng-Marnu, N., Dey, M., Hamdy, M., Saxena, N., Anis, A. M., Alghamdi, E. A., Chien, V. M., Yin, D., Qian, K., Li, Y., Liang, M., Dinh, A., … Kabbara, J. (2025). Bridging the data provenance gap across text, speech and video. *Thirteenth International Conference on Learning Representations (ICLR 2025)*. https://doi.org/10.48550/arXiv.2412.17847
11. Mitchell, M., Wu, S., Zaldivar, A., Barnes, P., Vasserman, L., Hutchinson, B., Spitzer, E., Raji, I. D. et Gebru, T. (2019). Model cards for model reporting. Dans *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)* (p. 220-229). ACM. https://doi.org/10.1145/3287560.3287596
12. Raisch, S. et Krakowski, S. (2021). Artificial intelligence and management: The automation–augmentation paradox. *Academy of Management Review*, *46*(1), 192-210. https://doi.org/10.5465/amr.2018.0072
13. Rismani, S., Shelby, R., Davis, L., Rostamzadeh, N. et Moon, A. (2025). Measuring what matters: Connecting AI ethics evaluations to system attributes, hazards, and harms. *Proceedings of the AAAI/ACM Conference on AI, Ethics, and Society*, *8*(3), 2199-2213. https://doi.org/10.1609/aies.v8i3.36706
14. Saito, T. et Rehmsmeier, M. (2015). The precision-recall plot is more informative than the ROC plot when evaluating binary classifiers on imbalanced datasets. *PLOS ONE*, *10*(3), Article e0118432. https://doi.org/10.1371/journal.pone.0118432
15. Sambasivan, N., Kapania, S., Highfill, H., Akrong, D., Paritosh, P. et Aroyo, L. M. (2021). "Everyone wants to do the model work, not the data work": Data cascades in high-stakes AI. Dans *Proceedings of the 2021 CHI Conference on Human Factors in Computing Systems* (p. 1-15). ACM. https://doi.org/10.1145/3411764.3445518
16. Sargeant, A. (2001). Relationship fundraising: How to keep donors loyal. *Nonprofit Management and Leadership*, *12*(2), 177-192. https://doi.org/10.1002/nml.12204
17. Sculley, D., Holt, G., Golovin, D., Davydov, E., Phillips, T., Ebner, D., Chaudhary, V., Young, M., Crespo, J.-F. et Dennison, D. (2015). Hidden technical debt in machine learning systems. Dans *Advances in Neural Information Processing Systems 28* (p. 2503-2511). Curran Associates. https://proceedings.neurips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html
18. Strong, D. M., Lee, Y. W. et Wang, R. Y. (1997). Data quality in context. *Communications of the ACM*, *40*(5), 103-110. https://doi.org/10.1145/253769.253804
19. Suresh, H. et Guttag, J. (2021). A framework for understanding sources of harm throughout the machine learning life cycle. Dans *Equity and Access in Algorithms, Mechanisms, and Optimization (EAAMO '21)* (p. 1-9). ACM. https://doi.org/10.1145/3465416.3483305
20. Varoquaux, G., Luccioni, A. S. et Whittaker, M. (2025). Hype, sustainability, and the price of the bigger-is-better paradigm in AI. Dans *Proceedings of the 2025 ACM Conference on Fairness, Accountability, and Transparency* (p. 61-75). ACM. https://doi.org/10.1145/3715275.3732006

**Revues professionnelles et ouvrages** (lectures du cours)
21. Agrawal, A., Gans, J. et Goldfarb, A. (2018, 17 avril). A simple tool to start making decisions with the help of AI. *Harvard Business Review* (article numérique, réimpression H04ABS).
22. Anderson, J. L. et Coveyduc, J. L. (2020). *Artificial intelligence for business: A roadmap for getting started with AI*. Wiley.
23. Davenport, T. H. et Ronanki, R. (2018). Artificial intelligence for the real world. *Harvard Business Review*, *96*(1), 108-116.
24. Ng, A. (2019, 6 février). How to choose your first AI project. *Harvard Business Review* (article numérique, réimpression H04S3S).
25. Vial, G., Crowe, J. et Mesana, P. (2024). Managing data privacy risk in advanced analytics. *MIT Sloan Management Review*, *65*(4), 47-51.
26. Vial, G., Jiang, J., Giannelia, T. et Cameron, A.-F. (2021). The data problem stalling AI. *MIT Sloan Management Review*, *62*(2), 47-53.

**Autres sources**
27. AFP et GivingTuesday (2026). *Fundraising Effectiveness Project, Quarterly Report Q4 2025*. https://data.givingtuesday.org/fep-report/
28. Bloomerang (s. d.). *Pricing*. Consulté le 9 novembre 2026, à https://bloomerang.com/pricing/
29. Dataro (s. d.-a). *Plans and pricing*. Consulté le 9 novembre 2026, à https://dataro.io/pricing/
30. Dataro (s. d.-b). *Available Dataro Predict models*. Consulté le 9 novembre 2026, à https://support.dataro.io/knowledge/available-dataro-predict-models
31. Gouvernement du Canada (2025). *Guichet-Emplois : salaires des scientifiques de données (CNP 21211) et des programmeurs en développement de logiciels (CNP 21232), région de Montréal*. Consulté le 9 novembre 2026, à https://www.guichetemplois.gc.ca/rapportmarche/salaire-profession/17887/geo25154 et https://www.guichetemplois.gc.ca/rapportmarche/salaire-profession/22531/22446
32. Huyen, C. (2022). *Designing machine learning systems*. O'Reilly (ch. 2 et 8).
33. Keela (s. d.-a). *Pricing*. Consulté le 9 novembre 2026, à https://keela.co/pricing
34. Keela (s. d.-b). *Nonprofit intelligence*. Consulté le 9 novembre 2026, à https://www.keela.co/solutions/nonprofit-intelligence
35. *Loi modernisant des dispositions législatives en matière de protection des renseignements personnels*, L.Q. 2021, c. 25 (Loi 25). https://www.publicationsduquebec.gouv.qc.ca/fileadmin/Fichiers_client/lois_et_reglements/LoisAnnuelles/fr/2021/2021C25F.PDF
36. Meta (2024). *Meta Llama responsible use guide: Resources and best practices for responsible development of products built with large language models*. https://ai.meta.com/static-resource/responsible-use-guide
37. National Institute of Standards and Technology [NIST] (2023). *Artificial intelligence risk management framework (AI RMF 1.0)* (NIST AI 100-1). https://doi.org/10.6028/NIST.AI.100-1
38. UCI KDD Archive (s. d.). *KDD Cup 1998 data*. https://kdd.ics.uci.edu/databases/kddcup98/kddcup98.html
39. Université de Montréal (2018). *Déclaration de Montréal pour un développement responsable de l'intelligence artificielle*. https://declarationmontreal-iaresponsable.com/la-declaration/
