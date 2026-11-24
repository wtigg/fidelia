# Fidélia : annexes du rapport

Ces annexes complètent le rapport principal. Elles donnent les détails de calcul, les commandes et les éléments secondaires. Les références renvoient à la liste du rapport. Les chiffres viennent de `reports/`.

## Annexe A. Statistiques complémentaires (section 1.2)

- **Coût du recrutement.** Recruter coûte jusqu’à 1,50 $ par dollar recueilli, contre 0,20 $ ou moins auprès des donateurs existants, soit jusqu’à 7,5 fois moins cher (Johnson, 2023).
- **Fidélité acquise.** 59,3 % des donateurs réguliers redonnent l’année suivante, contre 18,9 % des nouveaux (Bloomerang, s. d.-a, d’après le FEP du 4ᵉ trimestre 2025).
- **Compétences en données.** Seuls 13 % des petits organismes canadiens ont une personne dédiée à la technologie et aux données, contre 25 % des grands (Gandhi, 2024). Un organisme sur quatre juge faibles ses compétences pour gérer et analyser ses données, et 23 % peinent à s’en servir pour décider (Nguyen, 2024).
- **Capacité.** La demande dépasse la capacité dans 65 % des organismes canadiens en 2026 (Charity Insights Canada Project, 2026).
- **Usage de l’IA.** 62 % des OBNL utilisent l’IA pour les communications aux donateurs ; 47 % n’ont aucune politique d’encadrement (Virtuous et Fundraising.AI, 2026).

**Source du 43,3 %.** Le chiffre porte sur l’année 2025. Il vient du rapport du Fundraising Effectiveness Project du 4ᵉ trimestre 2025, publié en 2026 par AFP et GivingTuesday.

## Annexe B. Volume minimal et groupe témoin (section 5.4)

### B.1 Courbes d’apprentissage complètes

Source : `reports/evaluate-42.txt`. Positifs estimés = exemples (entraînement et validation) × taux de base. RD1 compte, lui, les positifs sur tout l’historique.

**Tableau B1.** *Courbes d’apprentissage complètes*

| Modèle | Exemples (entraînement et validation) | Positifs (environ) | AUC-PR | Seuil R1 (2 × taux de base) |
|---|---|---|---|---|
| Attrition | 321 | 22 | 0,129 | 0,134 : **échoue** |
| Attrition | 802 | 54 | 0,174 | réussit |
| Attrition | 1 603 | 108 | 0,225 | réussit |
| Attrition | 3 207 | 216 | 0,243 | réussit |
| Réactivation | 464 | 18 | 0,063 | 0,079 : **échoue** |
| Réactivation | 2 311 | 91 | 0,111 | réussit |
| Réactivation | 4 624 | 182 | 0,123 | réussit |

Vers 100 positifs, l’attrition atteint 93 % de son AUC-PR finale (0,225 sur 0,243) et la réactivation 90 % (0,111 sur 0,123). Sous un minimum technique (10 positifs à l’entraînement, 3 en validation et 3 en test), aucun modèle n’est entraîné : la liste n’est pas proposée et un message l’explique.

### B.2 Calcul de puissance du groupe témoin

- OBNL de 300 mensuels, 6,7 % de départs par 90 jours : environ 20 départs par trimestre.
- Témoin de 10 % : 30 donateurs, soit environ 2 départs par trimestre (30 × 6,7 %).
- Hypothèse : la relance réduit les départs de 30 % (valeur par défaut de la page Impact). Le taux passerait de 6,7 % à 4,7 %.
- Test de deux proportions, risque de 5 %, puissance de 80 % (calcul de l’équipe) : environ **2 100 mensuels par groupe** à parts égales.
- Avec un témoin de 10 % (1 témoin pour 9 relancés) : environ **1 100 à 1 300 mensuels témoins**. 1 100 avec la variance commune sous l’hypothèse nulle ; 1 300 avec les variances propres à chaque groupe (6,7 % et 4,7 %).
- Soit environ 11 000 à 13 000 mensuels suivis pendant un trimestre. Un OBNL seul n’y arrive pas, même en plusieurs années.
- **Mise en commun :** environ 40 clients de 300 mensuels, avec 10 % de témoin, donnent environ 1 200 témoins en un trimestre. Si l’effet réel est plus faible que 30 %, il en faut davantage.
- Agrandir le témoin ne suffit pas : à 50 % chez 2 OBNL de 300 mensuels, il faudrait environ 7 trimestres.
- La conversion est plus difficile encore : taux de base de 1,8 % et horizon de 6 mois.

### B.3 Schéma minimal (RD2)

Fichiers CSV, dates au format AAAA-MM-JJ.
- Donateurs : `id` (obligatoire), `email`, `email_consent`, `kind`, `join_date`.
- Dons : `donor_id`, `date`, `amount` (obligatoires), `kind`, `status`.
- Ouvertures (facultatif) : `donor_id`, `month`, `open_rate`.

Contrôles de RF2 restés en avertissement en V1 (RD6) : courriels valides ≥ 95 %, montants aberrants ≤ 0,1 %, dons antérieurs à l’inscription ≤ 0,1 %.

## Annexe C. Reproduire le prototype (section 6.3)

**Prérequis :** Node.js 22 ou plus et npm ; Python 3.11 ou plus avec scikit-learn, pandas et numpy (`verification/requirements.txt`) ; `curl` et `unzip` pour KDD 98. Versions de l’équipe dans le `README.md`.

**Avec Docker :**

```bash
docker build -t fidelia . && docker run --rm -p 8080:80 fidelia   # appli : localhost:8080
docker build --target eval -t fidelia-eval .
docker run --rm fidelia-eval                                      # tests + reproductibilité
docker run --rm -v "$PWD/reports:/app/reports" fidelia-eval npm run evaluate 42
```

Le contrôle de reproductibilité (`npm run check:repro`) réentraîne la graine 42 dans un dossier temporaire et compare le résultat à `reports/synthetique-42.json`, à 10⁻⁹ près (horodatage et durée ignorés). Message attendu : « Reproductible : rapport graine 42 identique à reports/synthetique-42.json ». Rien n’est écrit dans `reports/`.

**Sans Docker :**

```bash
npm ci                                             # dépendances exactes du package-lock.json
npm test                                           # 25 tests
npm run check:repro                                # compare au rapport versionné
npm run dev                                        # lance l'application
npm run calibration > reports/calibration.txt      # compare le synthétique aux taux publiés
npm run train                                      # entraîne et écrit src/data/model.json
npm run evaluate 42 > reports/evaluate-42.txt      # + synthetique-42.json, impact-42.json
npm run robustness > reports/robustesse.txt        # écrit aussi reports/robustesse.json
./scripts/download-kdd98.sh
npm run kdd98 > reports/kdd98.txt                  # écrit aussi reports/kdd98.json
npm run export-rows
python3 verification/verify_sklearn.py > reports/sklearn.txt
```

**Intégration continue.** À chaque *push* sur `main` et à chaque demande de fusion (*pull request*), GitHub Actions (`.github/workflows/deploy.yml`) enchaîne :
1. `npm ci`, l’analyse statique (*lint*), puis les tests ;
2. le contrôle de reproductibilité (tolérance 10⁻⁹) ;
3. la construction du site ;
4. en parallèle après les étapes 1 à 3 : la construction des images Docker `web` et `eval`, puis l’exécution de `eval` ;
5. en parallèle de l’étape 4 : la publication sur GitHub Pages, pour un *push* sur `main` ou un lancement manuel.

Un échec de l’analyse statique, des tests ou du contrôle de reproductibilité bloque la publication ; la tâche Docker est séparée et ne la bloque pas. Le contrôle ne dépend pas de git : il fonctionne aussi dans le conteneur.

## Annexe D. Tentatives d’amélioration de l’IA (section 6.5)

**Tableau D1.** *Tentatives d’amélioration de l’IA*

| Tentative | Ce qui a été essayé | Avant (test) | Après (test) | Conclusion |
|---|---|---|---|---|
| KDD 98, plus de variables | 74 variables candidates connues avant juin 1997 (historique des codes RFA, cartes, relances, richesse du quartier…), sélection par familles et élagage sur la validation | AUC-PR 0,0825 | 0,0825 (configuration inchangée) | Aucune famille ne gagne en validation ; les 16 variables actuelles captent déjà le signal |
| KDD 98, réglage du modèle | Une trentaine de réglages : profondeur et nombre d’arbres, taux d’apprentissage, pondération des classes, interactions, ensembles | AUC-PR 0,0825 | 0,0813 | Léger recul dans le bruit ; le modèle plafonne vers 0,085 en validation (exploration non versionnée) |
| Synthétique, hausse du don | 12 nouvelles variables d’historique (tendance, régularité, ratio au don médian, saison) | AUC-PR 0,076 | 0,084 sur la graine 42 | Le gain ne tient pas sur les 5 autres jeux ; R2 échoue toujours, la règle RFM reste utilisée |

Sur KDD 98, même la borne haute de l’IC (0,094) reste sous le seuil R1 de 0,102. Les signaux qui comptent le plus dans notre jeu synthétique (ouvertures de courriels, paiements échoués) n’existent pas dans KDD 98.

## Annexe E. Risques secondaires (section 7)

**Tableau E1.** *Risques secondaires*

| Catégorie | Risque | Probabilité / gravité | Mesure |
|---|---|---|---|
| Données | Pas d’historique d’ouvertures (organisation sans outil de courriels) | Moyenne / moyenne | Variable d’absence ; modèle utilisable, avec une performance moindre |
| Légal | Courriels sans consentement (LCAP) | Faible / élevée | RF13, désabonnement dans chaque courriel |
| Légal | Fournisseur de courriels hors Québec : noms, adresses et contenu transmis | Moyenne / élevée | Fournisseur hébergé au Canada en priorité ; sinon ÉFVP et contrat avant le transfert |
| Individuel | Donateur qui s’oppose au profilage | Faible / moyenne | RF23 : exclu des modèles ; RF24 : accès et suppression |
| Sociétal | Emploi : l’outil pourrait servir à justifier moins de personnel | Faible / moyenne | Outil d’augmentation (section 8.4) : il trie, l’équipe écrit et décide |
| LLM (V2) | Injection de requêtes par un champ libre | Faible / moyenne | Aucun champ libre transmis (notes du CRM exclues) |
| LLM (V2) | Démarche générale | Sans objet | Guide d’usage responsable de Meta (2024a) : définir le cas d’usage, filtrer l’entrée et la sortie, tester par attaque (*red teaming*) ; sinon modèle ouvert hébergé au Canada |
| Réputation | Donateur choqué d’être « scoré » | Faible / élevée | Transparence, ton des messages, aucune donnée sensible |

## Annexe F. Éthique : détails (sections 8.2 et 8.5)

### F.1 De la composante au tort : tableau complet (Rismani et al., 2025)

**Tableau F1.** *De la composante au tort : tableau complet*

| Composante | Attribut | Mesure (seuil) | Danger | Tort |
|---|---|---|---|---|
| Score de conversion | Équité par âge | Ratio de sélection des 70 ans et plus > 1,5 (mesuré : 1,80, IC 95 % [1,51 ; 2,10]) ; calibration hors de [0,67 ; 1,5] (mesuré : 0,54 et 2,24, sur de petits effectifs) | Sur-sollicitation des aînés, montants mal calibrés par âge | Pression financière, perte de confiance |
| Score d’attrition | Calibration | Brier < constante (R4) | Probabilités trop optimistes | Mauvaise allocation du temps de l’équipe |
| Brouillon de courriel (gabarits) | Fidélité aux données | 0 montant inventé | Message erroné | Atteinte à la réputation |
| Brouillon de courriel (LLM, V2) | Fidélité et confidentialité | 0 montant ou fait absent des données ; 0 donnée nominative envoyée au fournisseur | Hallucination, fuite de données | Donateur trompé, atteinte à la vie privée, sanction (Loi 25) |
| Cycle automatique | Fréquence de contact | ≤ 1 courriel par 30 jours (RF12) | Harcèlement | Désabonnements, plaintes |
| Modèle en production | Stabilité | R5 ; AUC-PR glissante > RFM | Dérive non détectée | Décisions dégradées sans le savoir |

### F.2 Trois questions de la séance 4 (Varoquaux et al., 2025)

- **Conséquences environnementales ?** Faibles. Aucun GPU : les modèles s’entraînent en quelques secondes sur un processeur, environ 20 s dans le navigateur pour l’entraînement complet. Le *scoring* hebdomadaire demande environ une minute de processeur par organisation. Le LLM de la V2 ajouterait un coût par brouillon : raison de plus pour le garder optionnel.
- **Plus de données, à quel risque ?** Le prototype n’utilise que les dons et les ouvertures, sans âge ni région. Le vrai risque est le modèle commun de la V2 : regrouper les donateurs de plusieurs OBNL chez un seul fournisseur augmente l’effet d’une fuite et demande un accord de partage. Nous ne le ferons que si un modèle par organisation échoue à RD1, et après une ÉFVP.
- **Concentration de pouvoir ?** Les outils prédictifs du secteur sont vendus par de grands CRM, à des prix hors de portée d’un très petit OBNL (section 1.4). Fidélia vise l’inverse : méthode publiée, modèle exportable (`model.json`), données importées et exportées en CSV. Un client peut partir avec ses données et revenir à RFM sans perte.

## Annexe G. Leçons complémentaires (section 10)

**Retirer l’âge du modèle ne suffit pas à le rendre équitable.**
- Nous avons exclu l’âge des variables : minimisation des données, Loi 25.
- Mais, dans notre générateur, l’âge influence la fidélité. Le modèle de conversion sous-estime donc les 70 ans et plus et surestime les 35-54 ans (R6 non validé).
- Ces écarts reposent sur de petits effectifs (environ 8 conversions chez les 35-54 ans, sur 1 290 exemples ; `reports/synthetique-42.json`) et sur nos hypothèses. Il faudra les mesurer à nouveau sur des données réelles, avec des IC.
- Corriger demanderait d’utiliser l’âge, au moins pour recalibrer par groupe. C’est un arbitrage entre vie privée et calibration (Vial et al., 2024).
- Les critères d’équité sont en général mathématiquement incompatibles (Kleinberg et al., 2017).

Nous documentons l’écart, le surveillons et laissons la décision à l’organisation.

**Pré-entraîner et versionner le modèle simplifie tout.** L’entraînement complet prend environ 20 s dans le navigateur. Sérialiser un modèle versionné (`model.json`) donne une application instantanée, un retour arrière simple et une traçabilité. Ce sont des pratiques MLOps vues en séance 7 (Kreuzberger et al., 2023).

## Annexe H. Estimations : détails (section 9)

**Taux de référence.** Salaire horaire médian dans la région de Montréal, Guichet-Emplois, données 2023-2024 (Gouvernement du Canada, 2025a, 2025b) :
- scientifique de données (Classification nationale des professions [CNP] 21211) : 45,64 $ ;
- programmeur en développement de logiciels (CNP 21232) : 45,67 $ ;
- chef de produit et designer UX : 45,65 $ retenus (hypothèse simplificatrice).

Charges sociales et avantages : + 25 % (hypothèse de l’équipe). Un ETP compte 1 820 heures par an (35 h × 52 semaines), soit environ 303 heures sur 2 mois.

**Tableau H1.** *Coût salarial de la V1*

| Rôle | Charge | Heures (2 mois) | Taux | Coût salarial |
|---|---|---|---|---|
| Développeur web | 1 ETP | 303 | 45,67 $ | 13 838 $ |
| Scientifique de données | 0,25 ETP | 76 | 45,64 $ | 3 469 $ |
| Chef de produit et designer UX | 0,15 ETP | 45 | 45,65 $ | 2 054 $ |
| **Total** | **1,4 ETP** | **424** | | **19 361 $** (24 201 $ chargé) |

**Infrastructure par client.** 105 à 350 $ par mois pour 50 organisations, soit 2,10 à 7 $ par organisation. Pour 35 clients : 882 à 2 940 $ par an ; pour 78 clients : 1 966 à 6 552 $ par an (croissance linéaire supposée).

**Stockage.** Le jeu de démonstration compte 4 000 donateurs et 17 909 dons (`reports/evaluate-42.txt`), soit quelques mégaoctets. Au plus 50 Mo par organisation, historique des scores et des envois compris : moins de 3 Go pour 50 organisations.

**Sous-total V1 :** 24 201 $ + 2 000 $ + 1 050 $ = 27 251 $ ; avec 10 à 20 % de réserve, environ 30 000 à 33 000 $.

**Sensibilité du support.** Coûts fixes de base : 25 963 $ + 2 000 $ ≈ 28 000 $ par an (2 330 $ par mois). Si le support double (0,5 ETP) : 51 926 $ + 2 000 $ ≈ 53 900 $ par an (4 494 $ par mois).

**Tableau H2.** *Seuil de rentabilité selon le coût du support*

| Coûts fixes par mois | Marge par client à 99 $ | Seuil, exploitation seule | Seuil, V1 amortie sur 3 ans (+ 833 à 908 $) |
|---|---|---|---|
| 2 330 $ (0,25 ETP) | 92 à 97 $ | 25 à 26 clients | 33 à 36 clients |
| 4 494 $ (0,5 ETP) | 92 à 97 $ | 47 à 49 clients | 55 à 59 clients |
