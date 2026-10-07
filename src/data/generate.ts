import { HISTORY_MONTHS, HISTORY_START, REF_DATE, addDays, addMonths, iso } from '../lib/dates.ts'
import { niceMonthly } from '../lib/nice.ts'
import { clamp, rng, sigmoid, type Rng } from '../lib/random.ts'
import type { Dataset, Donation, Donor, GiftKind } from '../lib/types.ts'

const FIRST = ['Camille', 'Léa', 'Manon', 'Chloé', 'Inès', 'Sarah', 'Julie', 'Emma', 'Louise', 'Alice', 'Claire', 'Anne', 'Marie', 'Sophie', 'Nathalie', 'Isabelle', 'Hélène', 'Lucie', 'Thomas', 'Lucas', 'Hugo', 'Louis', 'Nicolas', 'Julien', 'Antoine', 'Pierre', 'Paul', 'Mathieu', 'Olivier', 'Philippe', 'Jean', 'Michel', 'François', 'Karim', 'Mehdi', 'Yanis', 'Moussa', 'Awa', 'Fatou', 'Nadia']
const LAST = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Benali', 'Diallo', 'Nguyen', 'Haddad', 'Traoré', 'Perrin', 'Gauthier']
const CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Bordeaux', 'Lille', 'Rennes', 'Strasbourg', 'Montpellier', 'Grenoble', 'Nice', 'Angers', 'Dijon', 'Brest']

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Date aléatoire dans le mois m de l'historique */
function dateInMonth(r: Rng, m: number): Date {
  return addDays(addMonths(HISTORY_START, m), r.int(0, 27))
}

/**
 * Simule l'historique de dons mois par mois.
 * Chaque donateur a un attachement latent (a) et une humeur qui évolue (mood).
 * Ces variables cachées pilotent dons, ouvertures d'emails, churn et conversion :
 * le modèle doit les retrouver à partir des seuls signaux observables.
 */
export function generateDemo(count = 2000, seed = 42): Dataset {
  const r = rng(seed)
  const donors: Donor[] = []
  const donations: Donation[] = []
  let gid = 0

  for (let i = 0; i < count; i++) {
    const firstName = r.pick(FIRST)
    const lastName = r.pick(LAST)
    const joinMonth = r.int(0, HISTORY_MONTHS - 2)
    const a = r.normal()
    const cardIssue = r.chance(0.15)
    let mood = r.normal() * 0.5
    const kind0 = r.weighted<GiftKind>([['monthly', 0.42], ['one_time', 0.43], ['annual', 0.15]])

    let kind: GiftKind = kind0
    let active = true
    let monthlyAmount = r.weighted([[5, 0.12], [10, 0.3], [15, 0.15], [20, 0.2], [30, 0.12], [50, 0.11]] as [number, number][])
    const oneTimeBase = Math.max(10, Math.round(Math.exp(Math.log(45) + r.normal() * 0.5) / 5) * 5)
    const annualAmount = r.pick([100, 120, 150, 200, 250, 300])
    let monthlyStart = joinMonth
    let churnDate: string | undefined
    let convertedAt: string | undefined
    let convertedFrom: GiftKind | undefined
    const failsByMonth: number[] = []
    const giftMonths: number[] = []
    const giftAmounts: number[] = []
    const engagement = new Array<number>(HISTORY_MONTHS).fill(-1)
    const id = `d${String(i + 1).padStart(4, '0')}`

    const give = (m: number, amount: number, k: GiftKind, failed = false) => {
      donations.push({ id: `g${++gid}`, donorId: id, date: iso(dateInMonth(r, m)), amount, kind: k, status: failed ? 'failed' : 'paid' })
      if (!failed) {
        giftMonths.push(m)
        giftAmounts.push(amount)
      }
    }

    for (let m = joinMonth; m < HISTORY_MONTHS; m++) {
      mood = 0.8 * mood + r.normal() * 0.4
      const open = clamp(sigmoid(-0.4 + 0.6 * a + 1.4 * mood) * 0.8 * (active ? 1 : 0.6) + r.normal() * 0.04, 0, 1)
      engagement[m] = Math.round(open * 100) / 100
      const lastGift = giftMonths.length ? giftMonths[giftMonths.length - 1] : -99
      const gifts12 = giftMonths.filter((g) => g > m - 12).length

      if (kind === 'monthly' && active) {
        if (m < monthlyStart) continue
        const failed = r.chance(0.02 + (cardIssue ? 0.12 : 0) + (mood < -0.8 ? 0.05 : 0))
        give(m, monthlyAmount, 'monthly', failed)
        failsByMonth.push(failed ? 1 : 0)
        const recentFails = failsByMonth.slice(-3).reduce((s, x) => s + x, 0)
        const streak = failsByMonth.slice(-2).every((x) => x === 1) && failsByMonth.length >= 2
        const tenure = m - monthlyStart
        const hazard = sigmoid(-4.1 - 0.6 * a - 1.4 * mood + 1.5 * recentFails + (tenure < 6 ? 0.7 : 0) + (streak ? 1.5 : 0))
        if (m > monthlyStart && r.chance(hazard)) {
          active = false
          churnDate = iso(addDays(addMonths(HISTORY_START, m), 28))
        } else if (r.chance(0.008 + 0.01 * Math.max(0, a))) {
          monthlyAmount += 5
        }
      } else if (kind === 'monthly' && !active) {
        // Ancien mensuel : don ponctuel de retour possible
        const since = m - Math.max(lastGift, monthlyStart)
        if (r.chance(sigmoid(-3.4 + 0.5 * a + 1.3 * mood - 0.08 * since))) give(m, Math.round((monthlyAmount * 3) / 5) * 5 || 20, 'one_time')
      } else if (kind === 'one_time') {
        const gave = m === joinMonth || r.chance(sigmoid(-2.1 + 0.6 * a + 1.0 * mood - 0.1 * Math.max(0, m - lastGift - 3)))
        if (gave) give(m, Math.max(10, Math.round((oneTimeBase * (0.8 + r.next() * 0.5)) / 5) * 5), 'one_time')
        const z = -5.4 + 0.7 * a + 1.2 * mood + 0.4 * Math.min(gifts12, 4) + (gave ? 0.8 : 0) - (m - lastGift > 12 ? 1.5 : 0)
        if (m > joinMonth && r.chance(sigmoid(z))) {
          const avg = giftAmounts.reduce((s, x) => s + x, 0) / Math.max(1, giftAmounts.length)
          kind = 'monthly'
          convertedFrom = 'one_time'
          convertedAt = iso(dateInMonth(r, m))
          monthlyAmount = niceMonthly(clamp(avg / 4, 5, 50))
          monthlyStart = m + 1
        }
      } else if (kind === 'annual') {
        const years = Math.floor((m - joinMonth) / 12)
        const anniversary = (m - joinMonth) % 12 === 0
        if (anniversary && (m === joinMonth || r.chance(sigmoid(1.4 + 0.8 * a + 1.2 * mood - 0.6 * Math.max(0, m - lastGift - 13) / 12)))) give(m, annualAmount, 'annual')
        const z = -5.6 + 0.7 * a + 1.2 * mood + (anniversary ? 1.2 : 0) + 0.3 * years
        if (m > joinMonth && r.chance(sigmoid(z))) {
          kind = 'monthly'
          convertedFrom = 'annual'
          convertedAt = iso(dateInMonth(r, m))
          monthlyAmount = niceMonthly(clamp(annualAmount / 12 + 2, 5, 50))
          monthlyStart = m + 1
        }
      }
    }

    const lastGift = giftMonths.length ? giftMonths[giftMonths.length - 1] : joinMonth
    const sinceLast = HISTORY_MONTHS - lastGift
    const status: Donor['status'] =
      kind === 'monthly' ? (active ? 'active' : 'lapsed') : sinceLast > (kind === 'annual' ? 14 : 12) ? 'lapsed' : 'active'

    donors.push({
      id,
      firstName,
      lastName,
      email: `${slug(firstName)}.${slug(lastName)}${i + 1}@example.org`,
      city: r.pick(CITIES),
      kind,
      status,
      joinDate: iso(dateInMonth(r, joinMonth)),
      churnDate,
      convertedAt,
      convertedFrom,
      monthlyAmount: kind === 'monthly' ? monthlyAmount : undefined,
      engagement,
      emailConsent: r.chance(0.88),
    })
  }

  donations.sort((x, y) => x.date.localeCompare(y.date))
  return { donors, donations, refDate: iso(REF_DATE), historyStart: iso(HISTORY_START), source: 'demo' }
}
