import type { ActionType, Dataset, Donation, Donor, DonorScore } from './types.ts'

export const ORG_NAME = 'Les Petits Pas'
/** Formes contractées du nom de l'organisme */
const ORG_OF = 'des Petits Pas'
const ORG_TO = 'aux Petits Pas'

/**
 * Contexte facultatif : le jeu de données courant, pour retrouver le dernier don réel
 * (montant et date). Enregistré par l'interface (Layout). Sans contexte, les brouillons
 * restent corrects mais n'affichent pas ces deux détails.
 */
let ctx: { ds: Dataset; last: Map<string, Donation> } | undefined

export function setEmailContext(ds: Dataset): void {
  if (ctx?.ds === ds) return
  const last = new Map<string, Donation>()
  for (const g of ds.donations) {
    if (g.status !== 'paid' || g.date >= ds.refDate) continue
    const prev = last.get(g.donorId)
    if (!prev || g.date >= prev.date) last.set(g.donorId, g)
  }
  ctx = { ds, last }
}

const longDate = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const money = (n: number) => `${Math.round(n).toLocaleString('fr-CA')} $`

/** « 3 ans », « 1 an et 4 mois », « 8 mois » */
function tenure(months: number): string {
  if (months < 12) return `${Math.max(1, months)} mois`
  const y = Math.floor(months / 12)
  const m = months % 12
  return `${y} an${y > 1 ? 's' : ''}${m ? ` et ${m} mois` : ''}`
}

/** « votre don de 50 $ du 12 septembre 2026 », à partir des données réelles uniquement */
function lastGift(donor: Donor): string {
  const g = ctx?.last.get(donor.id)
  return g ? `votre don de ${money(g.amount)} du ${longDate.format(new Date(g.date))}` : ''
}

/**
 * Rédige un brouillon de courriel à partir de l'action et des raisons détectées par le modèle.
 * Gabarits fixes, sans IA générative : prénom, montants, dates et ancienneté viennent tous
 * des données du donateur. Rien n'est inventé. Un humain relit toujours avant l'envoi.
 */
export function draftEmail(type: ActionType, donor: Donor, score: DonorScore): { subject: string; body: string } {
  const name = donor.firstName
  const f = score.features
  const suggested = score.suggestedMonthly ? money(score.suggestedMonthly) : '[montant]'
  const monthly = donor.monthlyAmount
  const since = tenure(f.tenureMonths)
  const last = lastGift(donor)
  const sign = `\n\nAvec toute notre reconnaissance,\n\n[Votre prénom et nom]\nResponsable des dons, ${ORG_NAME}\n\n—\nVous recevez ce courriel parce que vous soutenez ${ORG_NAME}. Pour ne plus recevoir nos messages : [se désabonner]`
  const p = (...parts: string[]) => `Bonjour ${name},\n\n${parts.filter(Boolean).join('\n\n')}${sign}`

  switch (type) {
    case 'churn_prevention':
      if (f.failed90d > 0)
        return {
          subject: `${name}, un petit souci avec votre don mensuel`,
          body: p(
            `Depuis ${since}, vous soutenez les enfants ${ORG_OF} chaque mois${monthly ? ` avec ${money(monthly)}` : ''}. Merci du fond du cœur.`,
            `Nous vous écrivons parce que ${last ? `nous avons bien reçu ${last}, mais le prélèvement suivant` : 'votre dernier prélèvement'} n'a pas pu aboutir. C'est souvent une carte expirée ou renouvelée, rien de plus.`,
            'La mise à jour prend une minute : [mettre à jour mon moyen de paiement]',
            'Nous tenons beaucoup à poursuivre ce chemin avec vous.',
          ),
        }
      return {
        subject: `${name}, merci d'être à nos côtés depuis ${since}`,
        body: p(
          `Cela fait ${since} que vous donnez${monthly ? ` ${money(monthly)}` : ''} chaque mois ${ORG_TO}. Nous voulions prendre un moment pour vous dire ce que cela a permis : [3 nouvelles concrètes de l'année].`,
          `${f.engagementTrend < 0 ? 'Nous avons remarqué que vous lisez moins nos nouvelles ces derniers mois. ' : ''}Si votre situation a changé, vous pouvez ajuster votre don ou le mettre en pause quelques mois, en toute simplicité : [gérer mon don]`,
          'Votre fidélité compte énormément pour nous.',
        ),
      }
    case 'upgrade_amount':
      return {
        subject: `${name}, merci pour ${since} de fidélité`,
        body: p(
          `Depuis ${since}, votre don mensuel${monthly ? ` de ${money(monthly)}` : ''} fait une vraie différence pour les familles que nous accompagnons. Merci.`,
          `Cette année, les besoins augmentent. Si cela vous est possible, passer à ${suggested} par mois nous permettrait d'accueillir une famille de plus.`,
          'Ajuster mon don : [lien]',
          'Aucune obligation : votre soutien actuel compte déjà énormément.',
        ),
      }
    case 'upgrade_one_time':
      return {
        subject: `${name}, et si votre générosité devenait un rendez-vous ?`,
        body: p(
          `${last ? `Merci pour ${last}. ` : ''}${f.gifts12m > 1 ? `Vous nous avez soutenus ${f.gifts12m} fois cette dernière année, et vous êtes à nos côtés depuis ${since}` : `Vous êtes à nos côtés depuis ${since}`} : c'est précieux.`,
          `Nous aimerions vous proposer une idée simple. Un don mensuel de ${suggested} nous aiderait à planifier nos actions sur toute l'année et à réduire nos frais de collecte.`,
          "Vous recevrez un seul reçu aux fins de l'impôt pour l'année, et vous pourrez arrêter quand vous voulez.",
          'Devenir donateur mensuel : [lien]',
        ),
      }
    case 'upgrade_annual':
      return {
        subject: `${name}, étalez votre soutien en toute simplicité`,
        body: p(
          `Depuis ${since}, vous êtes au rendez-vous chaque année. ${last ? `Merci encore pour ${last}.` : 'Merci pour cette fidélité.'}`,
          `${f.anniversarySoon ? "Votre prochain don annuel approche, c'est pourquoi nous vous écrivons maintenant. " : ''}Vous pouvez désormais l'étaler en ${suggested} par mois : plus léger pour votre budget, et des ressources régulières pour nous toute l'année.`,
          'Passer au don mensuel : [lien]',
        ),
      }
    case 'reactivation':
      return {
        subject: `${name}, vous nous manquez`,
        body: p(
          `${last ? `Nous n'avons pas oublié ${last}.` : "Nous n'avons pas oublié votre soutien."} Il a compté pour les enfants ${ORG_OF}.`,
          'Depuis, voici ce que nous avons accompli ensemble : [nouvelles du terrain].',
          'Si le cœur vous en dit, un nouveau coup de pouce, même modeste, nous aiderait à aller plus loin cet hiver : [faire un don]',
        ),
      }
    case 'thank': {
      const r = score.thankReason ?? ''
      const years = Number(r.split(' ')[0])
      const intro = r.startsWith('Premier')
        ? `Bienvenue parmi les donateurs ${ORG_OF} ! ${last ? `Nous avons bien reçu ${last}` : "Votre premier don vient d'arriver"} et nous voulions vous dire merci, simplement.`
        : r.startsWith('Don inhabituel')
          ? `${last ? `Nous avons bien reçu ${last}.` : 'Nous avons bien reçu votre don récent.'} Votre générosité nous a beaucoup touchés.`
          : `Cela fait ${years > 0 ? `${years} an${years > 1 ? 's' : ''}` : since} que vous donnez${monthly ? ` ${money(monthly)}` : ''} chaque mois ${ORG_TO}. Merci pour cette belle fidélité.`
      return {
        subject: `Merci, ${name} !`,
        body: p(intro, 'Voici à quoi servira votre soutien : [histoire concrète].', 'Ce message ne contient aucune demande : juste un grand merci.'),
      }
    }
  }
}
