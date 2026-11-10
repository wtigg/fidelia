# Présentation du 3 décembre : affiche et démonstration

- **Où et quand :** Atrium Hydro-Québec, 15 h 30 à 18 h 30.
- **Format :** babillard de 72 po × 48 po, 4 juges, 5 à 10 minutes par équipe.
- **Grille orale (15 points) :** clarté 4, arguments 3, usage de l'affiche 3, appréciation globale 5.

## Affiche : structure proposée (paysage, 3 colonnes)

**Modèles à suivre :** les deux exemples d'affiches fournis par le cours, `files/Poster_Exemple 1.pdf` et `files/Poster_Exemple 2.pdf`. Trois visuels obligatoires : le canevas S02 en image, le graphique AUC-PR modèle contre RFM, l'encadré KDD 98 nuancé. Fichier final : à indiquer dans `docs/GRILLE.md`.

**Bandeau :** *Fidélia : qui relancer, remercier ou solliciter.* Sous-titre : *Moins d'un donateur sur deux redonne l'année suivante. Une petite équipe ne peut pas tout lire. L'IA lui dit par où commencer.*

**Colonne 1 : Problème et idée**
- Chiffre choc : 43,3 % de rétention (FEP 2025).
- Persona : responsable des dons d'un OBNL de 3 personnes, 2 heures par semaine.
- Les 4 listes : relancer, proposer le mensuel, solliciter plus, remercier.
- Canevas d'IA en version réduite.

**Colonne 2 : Comment ça marche (centre, la plus grande)**
- Schéma : photo à la date T → 18 variables → 4 modèles → valeur attendue → brouillon → validation humaine → groupe témoin.
- Graphique principal : AUC-PR de Fidélia contre la règle RFM sur les 4 modèles, avec barres d'erreur, et le badge « déployé » ou « RFM conservée ».
- Encadré « Testé sur de vrais donateurs », en une phrase : « Sur KDD 98, la méthode de classement rapporte 51 % de plus que RFM avec 20 % des envois, mais ce modèle n'atteint pas notre requis R1 (0,083 < 0,102) : nous ne le déploierions pas. » C'est une validation de la méthode, pas d'un modèle déployable.
- Encadré « Honnêteté » : à gros volume (68 % des envois), RFM fait même un peu mieux (2 422 $ contre 2 320 $) ; pour « solliciter plus », RFM est conservée ; deux fuites de données trouvées et corrigées ; prédire n'est pas causer.

**Colonne 3 : Impact et responsabilité**
- Courbe de valeur captée (attrition) : avec 10 % des contacts, 41 % de la valeur captée, contre 7 % pour RFM et 10 % au hasard.
- Garde-fous : un courriel par 30 jours, remerciement d'abord, validation humaine, Loi 25, audit d'équité par âge.
- 3 leçons apprises, en une phrase chacune.
- QR code vers l'application en ligne.

**Pied :** équipe, références clés (Agrawal 2018, Gebru 2021, Suresh et Guttag 2021, Strong 1997), mention « Données synthétiques ; aucune donnée réelle d'organisation ».

## Démonstration : script de 5 minutes

1. **(30 s) Tableau de bord.** « 4 000 donateurs. Voici la valeur des dons mensuels à risque et les priorités du jour. » Lire le montant affiché à l'écran.
2. **(60 s) Fiche d'un donateur à risque.** Ouvrir un donateur « Relancer » avec un paiement échoué. Montrer le risque, les trois raisons, l'historique sur 24 mois (baisse des ouvertures, barre rouge). « Le modèle explique sa décision. »
3. **(45 s) Recommandations, puis courriels.** Préparer les courriels de l'onglet Relancer, en ouvrir un : il mentionne la carte expirée. « Un humain valide toujours. Aucun montant inventé. »
4. **(60 s) Impact.** Partir de 300 contacts, puis faire glisser la capacité à 100. Lire à voix haute l'écart affiché à l'écran entre le modèle et la règle RFM, à 300 puis à 100 contacts (aucun multiplicateur n'est encore exporté dans `reports/`). « Le ciblage est mesuré. L'effet de l'action est une hypothèse, réglable ici, et on la mesurera avec le groupe témoin. »
5. **(60 s) Modèle IA.** Attrition : 6 requis sur 6, écart significatif avec RFM, courbe précision-rappel. Puis l'onglet Hausse du don : « Ici, le modèle ne bat pas RFM, donc l'outil garde RFM. On ne déploie l'IA que là où elle prouve son utilité. » Enfin, l'onglet Données réelles : « Sur 18 824 vrais donateurs de test, tirés de 95 412, le modèle de réactivation bat RFM de façon significative. Mais il ne fait pas 2 fois mieux que le hasard : selon notre propre règle, on ne le déploierait pas. »
6. **(30 s) Équité.** « Dans nos données synthétiques, le modèle classe les aînés plus haut pour les sollicitations. On le mesure, on le limite, et l'audit sera refait sur les données réelles. »
7. **(15 s) Conclusion.** « Simple, mesurable, responsable. »

**Questions probables des juges**
- *Pourquoi ne pas utiliser ChatGPT ?* Prédiction tabulaire calibrée, reproductibilité, coût, confidentialité (§4.2).
- *Vos données sont fausses ?* Oui, par obligation. C'est pourquoi on a testé la méthode sur KDD 98 et sur 5 jeux générés (§6.2, leçon 1).
- *Et un OBNL de 3 personnes a-t-il assez de données ?* Il faut environ 100 événements positifs par modèle. Sinon, l'outil reste sur la règle RFM (§5.4, leçon 7).
- *Combien ça coûte ?* Infrastructure : 2,10 à 7 $ par OBNL et par mois. Coûts fixes : environ 106 000 $ par an (maintenance, vente et support, légal ; assurance non chiffrée). Développement de la V1 : environ 165 000 à 180 000 $, réserve comprise (§9). Rentable vers 140 à 150 clients à 99 $ par mois.
- *Votre groupe témoin prouve-t-il l'effet ?* Pas chez un seul OBNL : 30 témoins, environ 2 départs par trimestre. Il faut environ 1 160 témoins, donc mettre en commun plusieurs organisations, après la V1 (§5.4, §11).
- *Et si le modèle se trompe ?* Validation humaine, groupe témoin, surveillance, retour arrière (§7).

## Vidéo de secours

Enregistrer le script ci-dessus en capture d'écran (QuickTime, 1080p), avec voix off. La garder sur un ordinateur et sur une clé USB.
