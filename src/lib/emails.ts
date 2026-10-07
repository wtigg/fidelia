import type { ActionType, Donor, DonorScore } from './types.ts'

export const ORG_NAME = 'Les Petits Pas'

/**
 * Rédige un brouillon de courriel à partir de l'action et des raisons détectées par le modèle.
 * Gabarits fixes : aucun montant ni fait n'est inventé, tout vient des données du donateur.
 * En production, un LLM pourrait reformuler ces gabarits, toujours avec validation humaine.
 */
export function draftEmail(type: ActionType, donor: Donor, score: DonorScore): { subject: string; body: string } {
  const name = donor.firstName
  const f = score.features
  const amount = score.suggestedMonthly
  const sign = `\n\nAvec toute notre reconnaissance,\nL'équipe ${ORG_NAME}\n\nVous recevez ce courriel parce que vous soutenez ${ORG_NAME}. Se désabonner : [lien]`
  const monthly = donor.monthlyAmount

  switch (type) {
    case 'churn_prevention':
      if (f.failed90d > 0)
        return {
          subject: `${name}, votre don mensuel n'a pas pu être prélevé`,
          body: `Bonjour ${name},\n\nVotre dernier prélèvement${monthly ? ` de ${monthly} $` : ''} n'a pas abouti, souvent à cause d'une carte expirée. Cela se règle en une minute.\n\nMettre à jour mon moyen de paiement : [lien sécurisé]\n\nVotre soutien mensuel nous permet d'accompagner des enfants toute l'année. Nous tenons à poursuivre ce chemin avec vous.${sign}`,
        }
      return {
        subject: `${name}, voici ce que votre soutien a changé cette année`,
        body: `Bonjour ${name},\n\nCela fait ${f.tenureMonths} mois que vous nous soutenez chaque mois${monthly ? ` (${monthly} $)` : ''}. Voici concrètement ce que cela a permis : [3 chiffres clés de l'année].\n\nSi votre situation a changé, vous pouvez ajuster votre don ou le mettre en pause quelques mois plutôt que de l'arrêter : [gérer mon don]${sign}`,
      }
    case 'upgrade_amount':
      return {
        subject: `${name}, merci pour votre fidélité`,
        body: `Bonjour ${name},\n\nDepuis ${f.tenureMonths} mois, votre don mensuel fait une vraie différence. Les besoins augmentent cette année : passer de ${monthly ?? '…'} $ à ${amount} $ par mois nous permettrait d'accueillir une famille de plus.\n\nAjuster mon don : [lien]\n\nAucune obligation : votre soutien actuel compte déjà énormément.${sign}`,
      }
    case 'upgrade_one_time':
      return {
        subject: `${name}, et si votre générosité devenait un rendez-vous ?`,
        body: `Bonjour ${name},\n\n${f.gifts12m > 1 ? `Vous nous avez soutenus ${f.gifts12m} fois cette année, merci !` : 'Merci pour votre don récent !'} Un don mensuel de ${amount} $ nous permettrait de planifier nos actions sur l'année et de réduire nos frais de collecte.\n\nVous recevrez un reçu officiel aux fins de l'impôt pour le total de l'année, et vous pouvez arrêter quand vous voulez.\n\nDevenir donateur mensuel : [lien]${sign}`,
      }
    case 'upgrade_annual':
      return {
        subject: `${name}, étalez votre soutien en toute simplicité`,
        body: `Bonjour ${name},\n\nChaque année, votre don fidèle fait une vraie différence. Vous pouvez l'étaler en ${amount} $ par mois : plus léger pour votre budget, et des ressources régulières pour nous toute l'année.\n\nPasser au don mensuel : [lien]${sign}`,
      }
    case 'reactivation':
      return {
        subject: `${name}, vous nous manquez`,
        body: `Bonjour ${name},\n\nVotre soutien a compté pour nous. Depuis votre dernier don, voici ce que nous avons accompli ensemble : [nouvelles du terrain].\n\nUn nouveau coup de pouce, même modeste, nous aiderait à aller plus loin cet hiver : [faire un don]${sign}`,
      }
    case 'thank':
      return {
        subject: `Merci, ${name} !`,
        body: `Bonjour ${name},\n\n${score.thankReason?.startsWith('Premier') ? `Bienvenue parmi les donateurs de ${ORG_NAME} ! Votre premier don vient d'arriver et nous voulions vous dire merci, simplement.` : score.thankReason?.startsWith('Don inhabituel') ? 'Votre don récent nous a beaucoup touchés. Merci pour cette générosité exceptionnelle.' : `Cela fait ${score.thankReason?.split(' ')[0] ?? ''} an(s) que vous donnez chaque mois. Merci pour cette fidélité.`}\n\nVoici à quoi servira votre soutien : [histoire concrète].\n\nAucune demande dans ce message : juste merci.${sign}`,
      }
  }
}
