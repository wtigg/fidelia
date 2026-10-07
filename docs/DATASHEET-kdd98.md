# Datasheet : KDD Cup 1998 (validation sur données réelles)

## 1. Motivation et source

- **Source :** jeu public de la compétition KDD Cup 1998, archive UCI KDD (`kdd.ics.uci.edu/databases/kddcup98`).
- **Producteur :** Epsilon, pour une organisation caritative nationale de vétérans aux États-Unis.
- **Usage dans Fidélia :** valider les algorithmes et la méthode sur de **vrais donateurs**. C'est la seule source réelle du projet.

**Conditions d'utilisation** (texte de l'archive) :
1. Ne pas nommer l'organisation commanditaire à des fins pédagogiques : on dit « une organisation nationale de vétérans ».
2. Prévenir les contacts d'Epsilon indiqués dans la documentation si des résultats sont produits ou publiés.

**Action pour l'équipe :** envoyer un court courriel de notification avant la remise du rapport.

## 2. Composition

- **Fichier :** `cup98LRN.txt`, 95 412 donateurs, 481 champs.
- **Population :** donateurs **inactifs**, sans don depuis 13 à 24 mois. Tous ont reçu la relance postale « 97NK » de juin 1997.
- **Cibles :**
  - `TARGET_B` : a répondu (5,08 % des cas) ;
  - `TARGET_D` : montant donné en $ US.

**Champs utilisés :**
- historique de dons : `LASTDATE`, `FISTDATE`, `NGIFTALL`, `RAMNTALL`, `AVGGIFT`, `LASTGIFT`, `MAXRAMNT`, `TIMELAG` ;
- historique de relances : `NUMPROM`, `CARDPROM`, `CARDGIFT`, `NUMPRM12`, `RAMNT_3` à `RAMNT_22` ;
- codes de la segmentation RFA de l'organisation : `RFA_2F`, `RFA_2A` ;
- pour l'analyse d'équité seulement : `AGE` et `STATE`.

**Champs écartés :**
- les quelque 300 variables de recensement par quartier : hors du périmètre de données d'un petit OBNL, et source possible de discrimination indirecte ;
- les champs nominatifs.

## 3. Transformation (`scripts/kdd98.ts`)

16 variables construites selon les mêmes familles que dans l'application :

| Famille | Variables |
|---|---|
| Récence | mois depuis le dernier don |
| Fréquence | dons totaux, codes de fréquence |
| Montant | don moyen, total, dernier, maximum, dernier / moyen, code de montant |
| Tendance | dons et montants de 1996 comparés à 1995 |
| Engagement | taux de réponse aux relances et aux cartes, relances reçues sur 12 mois |
| Profil | ancienneté, délai entre le 1er et le 2e don |

- Valeurs manquantes : imputation par la médiane calculée hors jeu de test. Seul le délai entre le 1er et le 2e don est concerné.
- Deux tâches :
  - **réactivation** : `TARGET_B = 1` ;
  - **hausse** : `TARGET_D > LASTGIFT`, soit 1,73 % des cas.
- Découpage par donateur : 60 % entraînement, 20 % validation, 20 % test, protocole identique à l'application.

## 4. Qualité des données (Strong, Lee et Wang, 1997)

| Dimension | Évaluation |
|---|---|
| Exactitude, crédibilité | Élevées : données transactionnelles réelles, très utilisées en recherche |
| Actualité | **Faible** : 1997, comportements et canaux datés (poste plutôt que courriel) |
| Pertinence | Partielle : pas de dons mensuels ni de courriels ; valide la réactivation et la hausse, pas l'attrition du mensuel |
| Représentativité | États-Unis, cause unique, donateurs âgés : différent d'un OBNL québécois |
| Complétude | Bonne sur l'historique ; âge manquant pour environ 25 % des donateurs |
| Accessibilité | Publique, conditions d'usage ci-dessus ; 117 Mo non compressé |

## 5. Distribution et maintenance

- Les données brutes **ne sont pas versionnées**. Pour les récupérer : `./scripts/download-kdd98.sh`.
- Seuls les résultats agrégés sont conservés, dans `reports/kdd98.json` et `src/data/kdd98.json` : métriques, courbes, importances. Aucune ligne de donateur n'y figure.
