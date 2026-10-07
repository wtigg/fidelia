import type { ActionType, Donor, DonorScore } from './types.ts'

export const ORG_NAME = 'Les Petits Pas'

/** Rédige un email personnalisé à partir de l'action et des raisons détectées par le modèle */
export function draftEmail(type: ActionType, donor: Donor, score: DonorScore): { subject: string; body: string } {
  const name = donor.firstName
  const f = score.features
  const amount = score.suggestedMonthly
  const sign = `\n\nAvec toute notre gratitude,\nL'équipe ${ORG_NAME}`
  const reasons = new Set(score.reasons.map((r) => r.feature))

  switch (type) {
    case 'churn_prevention':
      if (f.failed90d > 0)
        return {
          subject: `${name}, votre don mensuel n'a pas pu être prélevé`,
          body: `Bonjour ${name},\n\nVotre dernier prélèvement de ${donor.monthlyAmount ?? ''} € n'a pas abouti, probablement à cause d'une carte expirée. Cela arrive souvent et se règle en une minute.\n\nMettre à jour mon moyen de paiement : [lien sécurisé]\n\nGrâce à vous, ${Math.round((donor.monthlyAmount ?? 10) / 2)} enfants ont accès chaque mois à du soutien scolaire. Nous tenons beaucoup à poursuivre ce chemin avec vous.${sign}`,
        }
      return {
        subject: `${name}, voici ce que votre soutien a changé cette année`,
        body: `Bonjour ${name},\n\nCela fait ${f.tenureMonths} mois que vous nous soutenez chaque mois${donor.monthlyAmount ? ` à hauteur de ${donor.monthlyAmount} €` : ''}. Nous voulions simplement vous montrer, concrètement, ce que cela a permis : [3 chiffres clés de l'année].\n\nSi votre situation a changé, sachez que vous pouvez ajuster votre don à tout moment, ou le mettre en pause quelques mois plutôt que de l'arrêter : [gérer mon don]${sign}`,
      }
    case 'upgrade_one_time':
      return {
        subject: `${name}, et si votre générosité devenait un rendez-vous ?`,
        body: `Bonjour ${name},\n\n${reasons.has('gifts12m') && f.gifts12m > 1 ? `Vous nous avez soutenus ${f.gifts12m} fois cette année, merci !` : 'Merci pour votre don récent !'} Un don mensuel de ${amount} € nous permettrait de planifier nos actions sur l'année et de réduire nos frais de collecte.\n\nAprès réduction d'impôt de 66 %, cela ne vous coûte que ${((amount ?? 10) * 0.34).toFixed(2).replace('.', ',')} € par mois. Vous pouvez arrêter quand vous voulez.\n\nDevenir donateur mensuel : [lien]${sign}`,
      }
    case 'upgrade_annual':
      return {
        subject: `${name}, étalez votre soutien en toute simplicité`,
        body: `Bonjour ${name},\n\nChaque année, votre don fidèle fait une vraie différence. Saviez-vous que vous pouvez l'étaler en ${amount} € par mois ? C'est plus léger pour votre budget, et cela nous assure des ressources régulières toute l'année.\n\nPasser au don mensuel : [lien]${sign}`,
      }
    case 'reactivation':
      return {
        subject: `${name}, vous nous manquez`,
        body: `Bonjour ${name},\n\nVotre soutien a compté pour nous${f.recencyDays > 400 ? ' et nous ne vous avons pas oublié' : ''}. Depuis votre dernier don, voici ce que nous avons accompli ensemble : [nouvelles du terrain].\n\nUn nouveau coup de pouce, même modeste, nous aiderait à aller plus loin cet hiver : [faire un don]${sign}`,
      }
  }
}
