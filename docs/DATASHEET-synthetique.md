# Datasheet : jeu de données synthétique Fidélia

Format inspiré de *Datasheets for Datasets* (Gebru et al., 2021). Les dimensions de qualité suivent Strong, Lee et Wang (1997).

## 1. Motivation

**Pourquoi ce jeu a-t-il été créé ?**
Pour entraîner et démontrer les modèles de Fidélia sans utiliser de données réelles d'organisation, ce que les consignes du cours interdisent sans autorisation écrite. Il imite la base de donateurs d'un petit OBNL québécois (1 à 5 employés) sur 4 ans.

**Qui l'a créé ?** L'équipe 4 du cours TECH60711 (HEC Montréal, automne 2026), avec le générateur `src/data/generate.ts`.

**Financement :** aucun.

## 2. Composition

| Élément | Valeur (graine 42) |
|---|---|
| Donateurs | 4 000 |
| Dons (prélèvements réussis et échoués) | 17 909 |
| Période | 1er octobre 2022 au 1er octobre 2026 (48 mois) |
| Date d'analyse | 1er octobre 2026 |
| Segments à la date d'analyse | 489 mensuels, 894 ponctuels, 274 annuels, 2 343 inactifs |

**Une instance = un donateur fictif.** Champs :
- identifiant, prénom, nom, courriel en `@example.org`, ville du Québec ;
- date d'inscription, type de don (mensuel, annuel, ponctuel), montant mensuel ;
- date d'arrêt du mensuel, date et origine d'un passage au mensuel ;
- canal d'acquisition (en ligne, événement, rue, courrier) ;
- âge, utilisé uniquement pour l'analyse d'équité ;
- consentement courriel ;
- taux d'ouverture des courriels mois par mois.

**Une transaction = un don** : donateur, date, montant en $ CA, type, statut (payé ou échoué).

**Étiquettes** (calculées, pas stockées) :

| Modèle | Population à la date T | Étiquette = 1 si… |
|---|---|---|
| Attrition | mensuels actifs | le don mensuel s'arrête dans les 90 jours |
| Hausse | mensuels actifs | le montant mensuel augmente dans les 180 jours |
| Passage au mensuel | ponctuels et annuels actifs | passage au mensuel dans les 180 jours |
| Réactivation | inactifs | nouveau don payé dans les 180 jours |

**Règle anti-fuite :** un donateur inscrit à la date T ou après n'appartient à aucune population à T, et le modèle de hausse exige un prélèvement mensuel antérieur à T. Ces deux règles corrigent deux fuites trouvées pendant le projet.

Définition d'un donateur **inactif** : mensuel arrêté, ou aucun don depuis 12 mois (13 mois pour un donateur annuel). Cette définition est proche de la proposition « 13 mois sans don » de la fiche de suivi S6.

**Données manquantes.** Les donateurs sans consentement (environ 14 %) n'ont pas de taux d'ouverture. Le modèle reçoit alors une valeur imputée (30 %) et un indicateur `emailOptOut`. Le manque est donc visible par le modèle, au lieu d'être maquillé.

**Données sensibles.** Aucune personne réelle. Les noms sont tirés au hasard dans des listes de prénoms et noms courants au Québec. Toutes les adresses courriel sont en `example.org`, un domaine réservé qui ne reçoit aucun courrier.

## 3. Processus de génération

Simulation mois par mois (`generateDemo(count, seed)`, déterministe pour une graine donnée). Chaque donateur a deux **variables cachées** que le modèle ne voit jamais :
- **attachement** : stable, dépend du canal et légèrement de l'âge ;
- **humeur** : processus autorégressif, `humeur(t) = 0,8 × humeur(t-1) + bruit`.

Elles pilotent :
- l'ouverture des courriels ;
- la probabilité de donner, avec saisonnalité (décembre × 5, novembre × 1,8, été × 0,6) ;
- l'attrition des mensuels, avec des effets de carte expirée (échecs de prélèvement en série), de début de relation et de recrutement dans la rue ;
- les hausses de montant ;
- les passages au mensuel, plus probables autour de la date anniversaire des donateurs annuels ;
- les retours des inactifs.

Le modèle doit retrouver ces variables cachées à partir des seuls signaux observables. C'est ce qui rend l'exercice non trivial.

**Calibration** (`npm run calibration`), comparée à des ordres de grandeur publiés :

| Indicateur | Jeu synthétique | Repère |
|---|---|---|
| Rétention globale d'une année sur l'autre | 42,9 % | 43,3 % (Fundraising Effectiveness Project, 2025) |
| Rétention des nouveaux donateurs | 29,6 % | environ 20 % (ordre de grandeur, à vérifier) |
| Rétention des donateurs réguliers | 68,6 % | 60 à 70 % (ordre de grandeur, à vérifier) |
| Rétention des mensuels sur 12 mois | 77,2 % | 75 à 85 % (ordre de grandeur) |
| Part des dons ponctuels en décembre | 16,1 % | pic de fin d'année documenté |
| Taux d'échec des prélèvements | 3,1 % | quelques % |

La rétention des nouveaux donateurs reste plus haute que le repère. C'est une **limite connue** : les nouveaux donateurs mensuels, très fidèles, tirent la moyenne vers le haut.

## 4. Prétraitement et variables

18 variables calculées à chaque date T, **uniquement avec les données antérieures à T**, pour éviter toute fuite du futur (`src/ml/features.ts`) :

| Famille | Variables |
|---|---|
| Récence, fréquence, montant | jours depuis le dernier don, dons et montant sur 12 mois, dons depuis le début, don moyen, dernier don / don moyen, tendance des montants |
| Paiement | paiements échoués sur 90 jours |
| Engagement | taux d'ouverture sur 3 mois, tendance d'engagement, absence de consentement |
| Profil | ancienneté, donateur annuel, canal d'acquisition (3 indicateurs) |
| Contexte | date anniversaire proche, décembre dans l'horizon |

Les variables très asymétriques passent au logarithme (`log1p`). Les variables sont standardisées pour la régression logistique, découpées en intervalles par quantiles pour le boosting.

**Exclusions volontaires :**
- âge, ville et région ne sont jamais des variables du modèle (équité, minimisation, Loi 25) ;
- le nom et le courriel ne sont pas utilisés.

## 5. Usages

**Prévu :**
- démontrer et tester l'application ;
- comparer des algorithmes à méthode égale ;
- servir de support pédagogique.

**Déconseillé :**
- conclure sur l'efficacité réelle d'une campagne de dons ;
- en tirer des chiffres d'affaires pour une vraie organisation ;
- étudier des comportements humains réels.

Un modèle entraîné sur ce jeu apprend d'abord les règles du générateur. D'où la validation complémentaire sur KDD Cup 1998 (voir `DATASHEET-kdd98.md`) et le test de robustesse sur 5 graines.

## 6. Distribution

- **Où :** produit à la volée dans le navigateur ou par les scripts. Aucun fichier de données n'est versionné, seulement le code, ce qui garantit la reproductibilité.
- **Comment l'exporter :** page Données, bouton « Modèles de fichiers » (CSV).
- **Licence :** celle du dépôt.

## 7. Maintenance

- Le générateur, ses paramètres et les repères de calibration sont dans le code et versionnés avec git.
- Toute modification doit être suivie de `npm run calibration`, `npm run train` et `npm run robustness`.
- **Responsable :** le responsable technique de l'équipe.

## 8. Qualité des données (Strong, Lee et Wang, 1997)

| Catégorie | Dimension | Évaluation |
|---|---|---|
| Intrinsèque | Exactitude, objectivité | Exact par construction, mais ne reflète que les hypothèses du générateur |
| Intrinsèque | Crédibilité, réputation | Moyenne : calibré sur un repère publié, mais synthétique |
| Contextuelle | Valeur ajoutée, pertinence | Bonne : couvre les 4 cas d'usage, y compris le mensuel, absent de KDD 98 |
| Contextuelle | Actualité | Configurable (date d'analyse) |
| Contextuelle | Complétude | Contrôlée : 14 % sans donnée d'ouverture, documenté |
| Contextuelle | Quantité | 4 000 donateurs ; courbes d'apprentissage dans `reports/` |
| Intrinsèque | Cohérence (défaut trouvé) | La première version du générateur datait 10 % des dons avant l'inscription ; détecté par le contrôle qualité, corrigé (inscription au 1er du mois du premier don) |
| Représentationnelle | Interprétabilité, facilité de compréhension | Champs nommés en clair, dictionnaire ci-dessus |
| Représentationnelle | Cohérence, concision | Contrôles automatiques dans la page Données |
| Accessibilité | Accessibilité, sécurité | Aucune donnée personnelle réelle, génération locale |

Les contrôles mesurables sont recalculés à chaque chargement, dans la page **Données → Qualité des données** : complétude, validité, unicité, cohérence, actualité, consentement.
