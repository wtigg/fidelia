# Présentation du 3 décembre : affiche et démonstration

- **Où et quand :** Atrium Hydro-Québec, 15 h 30 à 18 h 30.
- **Format :** babillard de 72 po × 48 po, 4 juges, 5 à 10 minutes par équipe.
- **Grille orale (15 points) :** clarté 4, arguments 3, usage de l'affiche 3, appréciation globale 5.

## Message en une phrase

**Fidélia dit à une petite équipe qui relancer, remercier ou solliciter en premier, et ne garde l'IA que là où elle fait mieux que la méthode habituelle.**

Vocabulaire à l'oral (zéro jargon) :

| Ne pas dire | Dire |
|---|---|
| AUC-PR | précision pour trouver les bons donateurs |
| règle RFM | méthode habituelle (dernier don, fréquence, montant) |
| R1 et R2 | nos deux conditions pour utiliser le modèle |
| gradient boosting, régression logistique | modèle qui apprend des dons passés |
| IC à 95 %, bootstrap, Brier | seulement si un juge demande : fiche technique (`docs/affiche/Fiche-technique.pdf`) |

## Affiche : structure (paysage, 5 blocs, 220 mots, un seul message)

**Message unique de l'affiche :** *L'IA n'est utilisée que là où elle gagne : 3 modèles sur 4.* Notre différence : l'IA seulement si elle fait 2 fois mieux que le hasard **et** mieux que la méthode habituelle. Le 3 sur 4 vaut pour nos donateurs fictifs ; la réactivation reste « à l'essai », car elle n'a pas fait ses preuves sur de vrais donateurs.

**Modèles à suivre :** les exemples du cours, surtout `files/Poster_Exemple 2.pdf` : peu de blocs, gros visuels, beaucoup d'air. Fichier final : `docs/affiche/Affiche-Fidelia.pdf` (48 × 36 po paysage). Source : `docs/affiche/affiche.html` ; aperçu : `docs/affiche/apercu.png`. Régénérer chiffres, graphique, captures recadrées, QR code et PDF depuis `reports/` : `python3 docs/affiche/build_affiche.py` (QR : `pip install segno`, sinon `qr.svg` est réutilisé). Le script affiche le nombre de mots (cible : 150 à 220 ; texte des graphiques non compté).

**Règles :** 5 blocs au plus, aucun paragraphe de plus de 2 lignes, titre ≥ 160 px, chiffres clés ≥ 200 px, texte ≥ 44 px (page de 4608 × 3456 px). Deux couleurs (vert, or) et un neutre ; orange seulement pour « méthode habituelle gardée ».

**Bandeau :** *Fidélia* ; *Qui relancer, remercier ou solliciter ? L'IA répond aux petits OBNL.* ; les 4 noms, HEC Montréal, TECH 60711. Un seul chiffre : *43,3 %* des donateurs seulement redonnent l'année suivante (FEP 2025 : données 2025, rapport AFP et GivingTuesday publié en 2026).

**Colonne gauche, 1 · Avant :** Sophie débordée. « J'ai 2 heures par semaine pour 4 000 donateurs. Par qui je commence ? »

**Colonne centre, 2 · Avec Fidélia :** 4 étapes (historique des dons → l'IA classe et explique → l'équipe valide → courriel personnalisé), puis la fiche d'un donateur à relancer, en grand, avec le badge rouge **Démo 1** : risque de 35 %, « Relancer (risque d'arrêt) », dons espérés 63 $, et les 3 raisons (dernier don il y a 101 jours, 3 paiements échoués sur 90 jours, donne moins qu'il y a un an). Captures : `fiche-risque.png` et `fiche-raisons.png` (donateur fictif Olivier Gauthier), recadrées en `*-affiche.png`.

**Colonne droite, 3 · Résultat :** titre *L'IA n'est utilisée que là où elle gagne : 3 modèles sur 4* et la règle (battre nettement la méthode habituelle **et** faire 2 fois mieux que le hasard). Petit graphique à 4 barres (précision du modèle ÷ méthode habituelle) : Relancer ×2,7, Proposer le mensuel ×2,6, Réactiver ×3,1 « (à l'essai) » en vert (IA utilisée) ; Solliciter plus ×1,2 en orange (méthode habituelle gardée). Sous les barres : « ×2,7 = 2,7 fois mieux que la méthode habituelle (donateurs fictifs) ». Une ligne sur les 18 824 vrais donateurs : « l'IA repère qui dépassera son dernier don ; réactiver n'est pas encore prouvé (« à l'essai ») ». Puis *×3* avec le badge **Démo 2** : « de dons menacés visés, même effort ; liste Relancer, 300 contacts, donateurs fictifs, contre la méthode habituelle » (`reports/impact-42.json`, bloc app, Relancer à 300 contacts : ×3,13). Ce chiffre ne dépend pas de l'effet supposé des courriels. Enfin les garde-fous avec le badge **Démo 3** : un humain valide chaque envoi, Loi 25 (droit de refuser le profilage, prévu en V1, pas dans le prototype), au plus 1 courriel par 30 jours.

**Pied :** coûts (30 à 33 k$ pour la V1 en 2 mois et le pilote, réserve comprise, puis ≈ 28 k$/an), revenus (99 $/mois, rentable vers 35 clients ; concurrents dès 125 $/mois chez Bloomerang), feuille de route, grand QR « Essayez la démo », une ligne de sources.

**Fiche technique (à poser sur la table) :** `docs/affiche/Fiche-technique.pdf`, 1 page lettre, source `fiche-technique.html`, régénérée par le même script. Elle reprend tout ce qui a quitté l'affiche : canevas d'IA (4 cases), nos deux conditions (R1, R2) avec AUC-PR et intervalles, graphique « L'IA fait-elle mieux ? » (×2,7, ×2,6, ×3,1 « utilisé, à l'essai », ×1,2), ciblage (liste Relancer ×3,1 avec 300 contacts et ×6,1 avec 100, quel que soit l'effet ; les 4 listes ×3 et ×4,8 si l'effet supposé se vérifie ; ×3,3 et ×4,9 contre le hasard), 41 % des dons à risque avec 10 % des mensuels (méthode habituelle : 7 %), robustesse 15 sur 20, KDD 98 (réactivation : pas encore validée ; don plus élevé : R1 et R2 remplies, AUC-PR 0,040 contre 0,0186, 2,2 fois mieux), équité (ratio 1,80, IC 1,51 à 2,10), garde-fous, limites, rentabilité (33 à 36 clients, V1 30 000 à 33 000 $), références (mêmes formes que le rapport).

## Démonstration : script de 5 minutes avec la visite guidée

Dans l'application, cliquer sur **« Visite guidée »**. Elle enchaîne 6 étapes, une par écran, dans l'ordre ci-dessous (même ordre que `src/components/tour/GuidedTour.tsx`). Pour chaque étape : lire la bulle, dire une phrase, pointer l'affiche, puis « Suivant ». Les badges rouges **Démo 1**, **Démo 2** et **Démo 3** de l'affiche marquent les trois moments à montrer dans l'application.

0. **(20 s) Accroche, avant la visite.** *Affiche : bandeau (43,3 %) et bloc 1 (Sophie).* « Moins d'un donateur sur deux redonne l'année suivante. Or aller chercher un dollar chez un donateur fidèle coûte jusqu'à 7 fois moins cher que chez un nouveau (Johnson, 2023, université d'État de l'Arizona). Au Canada, plus de la moitié des organismes de moins de 1 M$ confient leurs données à quelqu'un qui n'a ni formation ni mandat pour ça. Fidélia leur dit par qui commencer, et n'utilise l'IA que là où elle fait mieux que la méthode habituelle. » Cliquer sur « Visite guidée ».
1. **(30 s) Étape 1 : tableau de bord.** *Affiche : bloc 1, Sophie et ses 4 000 donateurs.* « 4 000 donateurs. Voici la valeur des dons mensuels à risque et les priorités du jour. » Lire le montant affiché à l'écran.
2. **(30 s) Étape 2 : recommandations.** *Affiche : bloc 2, les 4 étapes.* « Fidélia dit par où commencer : qui relancer, qui remercier, qui solliciter. Les listes sont classées par dollars à gagner. »
3. **(60 s) Étape 3 : fiche d'un donateur à relancer.** *Affiche : badge **Démo 1**, la fiche du donateur.* Montrer le risque d'arrêter son don, les raisons en mots simples, l'historique sur 24 mois (paiements échoués en rouge). La visite ouvre toujours le donateur de l'affiche, Olivier Gauthier : risque de 35 %, « Relancer (risque d'arrêt) », dons espérés 63 $, dernier don il y a 101 jours, 3 paiements échoués sur 90 jours (barres rouges de l'historique). Rien à chercher : la fiche s'ouvre seule. (Seule exception : si on a importé un autre fichier de donateurs, la visite ouvre un autre donateur à relancer ; « Remettre la démo à zéro », page Données, revient à la démo.) « Le modèle explique sa décision. Vous décidez : un clic prépare le courriel. »
4. **(60 s) Étape 4 : impact.** *Affiche : badge **Démo 2**, le ×3.* La visite descend jusqu'au curseur « Donateurs contactés » ; la bulle se place à gauche pour laisser voir le curseur et l'encadré vert foncé « soit … fois plus » (sur téléphone, ce résultat est répété sous le curseur). Partir de 300 contacts, puis glisser à 100. « Regardez la petite ligne : pour la liste Relancer, 3,1 fois plus de dons menacés visés que la méthode habituelle, même effort, quel que soit l'effet des courriels. C'est le ×3 de l'affiche. Avec 100 contacts, 6,1 fois. Le grand total au-dessus (environ 3 fois avec 300 contacts, 4,8 fois avec 100, toutes listes réunies) suppose que les courriels ont l'effet réglé ici. Ce sont des donateurs fictifs. » Chiffres de l'écran : « soit 3,0 fois plus » (4 listes) et la petite ligne « Pour « Relancer » seul : 3,1 fois plus, quel que soit l'effet » ; identiques à `reports/impact-42.json` (bloc app : ×2,98 et ×4,76 pour le total, ×3,13 et ×6,06 pour Relancer ; modèle v20261110.0138) ; `npm run check:browser` le vérifie dans Chrome. « On mesure bien le ciblage. L'effet d'un courriel, lui, est une hypothèse, réglable ici. Les donateurs mis de côté le mesureront. »
5. **(60 s) Étape 5 : modèle IA (facultative si le temps manque).** *Affiche : titre et graphique à 4 barres du bloc 3 (3 vertes, 1 orange) ; détail sur la fiche technique.* « Le modèle apprend des dons passés. On ne l'utilise que s'il remplit nos deux conditions : trouver les bons donateurs 2 fois mieux que le hasard, et mieux que la méthode habituelle. » Onglet Hausse du don : « Ici, il ne fait pas mieux, donc l'outil garde la méthode habituelle. » Onglet Données réelles : « Sur 18 824 vrais donateurs, le modèle repère qui donnera plus que son dernier don 2,2 fois mieux que la méthode habituelle : nos deux conditions sont remplies. Pour la réactivation, pas encore : dans l'application, ce modèle reste donc « à l'essai ». Nous le disons. » Dans cet onglet, la tâche s'appelle « Don supérieur au dernier » pour ne pas la confondre avec « Hausse du don » mensuel. Dans les onglets Passage au mensuel et Réactivation, la case Décision passe en orange et liste les points à surveiller (stabilité dans le temps, équilibre entre tranches d'âge). Si un juge objecte que la méthode habituelle est faible : l'écran le dit (« à peine mieux, ou moins bien, que le hasard »), et c'est pourtant ce que font la plupart des OBNL.
6. **(45 s) Étape 6 : lundi matin, les courriels.** *Affiche : badge **Démo 3**, les garde-fous.* La visite ouvre Courriels avec un brouillon prêt. « Le courriel parle de la carte expirée, sans montant inventé. Je relis, j'approuve, j'envoie. Rien ne part sans un humain. »
7. **(30 s) Après la visite : équité.** *Fiche technique : encadré Équité.* « Pour proposer le don mensuel, le modèle choisit 1,8 fois plus souvent les 70 ans et plus. C'est moins que leur vrai taux de passage au mensuel : il les sous-estime un peu, et surestime les 35 à 54 ans, qu'on risque de trop solliciter. L'âge n'est pas utilisé, mais d'autres indices le reflètent. C'est l'alerte « équilibre entre tranches d'âge » affichée dans l'application : on la mesure et on la revérifiera sur de vraies données. »
8. **(15 s) Conclusion.** « Simple, mesurable, responsable. Un humain décide toujours. »

Si un juge veut les chiffres techniques : tendre la fiche technique (`Fiche-technique.pdf`), ou le volet « Voir le détail » de l'application.

## Les 5 questions probables des juges

1. **Pourquoi ne pas utiliser ChatGPT ?** ChatGPT écrit bien, mais il ne sait pas qui va partir. Notre modèle apprend des dons passés, donne toujours la même réponse, coûte peu et protège la confidentialité (§4.2).
2. **Vos données sont fausses ?** Oui, par obligation : pas de vraies données d'OBNL. C'est pourquoi on a testé la méthode sur 18 824 vrais donateurs (KDD 98) et sur 5 autres jeux fictifs (§6.2).
3. **Un OBNL de 3 personnes a-t-il assez de données ?** Il faut environ 100 cas par liste (par exemple 100 départs). En dessous, l'outil classe automatiquement avec la méthode habituelle. Avec très peu de cas (moins de 100 exemples d'apprentissage, ou moins de 10 cas à l'apprentissage, 3 en validation ou 3 en test), la liste n'est pas proposée et un message l'explique (§5.4).
4. **Combien ça coûte ?** 99 $ par mois par OBNL. Hébergement : 2,10 à 7 $ par OBNL et par mois. Frais fixes : environ 28 000 $ par an (un quart de poste pour la maintenance et le support, plus les obligations légales). Première version : 30 000 à 33 000 $, 2 mois de travail, pilote de 3 mois et réserve compris, car le prototype existe déjà. Rentable vers 35 clients (33 à 36), soit environ 0,6 % des 5 962 organismes de bienfaisance québécois de 100 000 $ à 1 M$ de revenus.
5. **Comment savoir que ça marche vraiment, et si le modèle se trompe ?** Un humain valide chaque envoi. Un groupe témoin ne reçoit rien : on compare. Dans le prototype, environ 10 % des donateurs sont mis de côté, selon un tirage fixé par leur numéro : 10 % en moyenne, 11 sur 181 dans la démo (environ 6 %). Chez un seul petit OBNL, il est trop petit pour conclure ; il faut regrouper plusieurs organisations (environ 1 100 à 1 300 témoins, §5.4, §11). En cas de dérive : surveillance et retour à la méthode habituelle (§7).

## Vidéo de secours

Enregistrer la visite guidée et le script ci-dessus en capture d'écran (QuickTime, 1080p), avec voix off. La garder sur un ordinateur et sur une clé USB.
