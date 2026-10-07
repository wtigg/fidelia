import { HISTORY_MONTHS, HISTORY_START, REF_DATE, addDays, addMonths, iso } from '../lib/dates.ts'
import { niceMonthly } from '../lib/nice.ts'
import { clamp, rng, sigmoid, type Rng } from '../lib/random.ts'
import type { Channel, Dataset, Donation, Donor, GiftKind } from '../lib/types.ts'

const FIRST = ['Camille', 'Léa', 'Florence', 'Rosalie', 'Chloé', 'Emma', 'Alice', 'Juliette', 'Béatrice', 'Charlotte', 'Marie', 'Sophie', 'Nathalie', 'Isabelle', 'Julie', 'Geneviève', 'Mélanie', 'Catherine', 'Louise', 'Ginette', 'Thomas', 'William', 'Félix', 'Olivier', 'Samuel', 'Gabriel', 'Mathieu', 'Alexandre', 'Jean', 'Pierre', 'Michel', 'François', 'Luc', 'Martin', 'Sylvain', 'Réjean', 'Karim', 'Mamadou', 'Wei', 'Fatima', 'Nadia', 'Ahmed', 'Sofia', 'Daniel', 'Marc-André', 'Josée']
const LAST = ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagné', 'Ouellet', 'Pelletier', 'Bélanger', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette', 'Girard', 'Simard', 'Boucher', 'Caron', 'Beaulieu', 'Cloutier', 'Dubé', 'Poirier', 'Fournier', 'Lapointe', 'Leclerc', 'Lefebvre', 'Poulin', 'Thibault', 'Nadeau', 'Martin', 'Landry', 'Bédard', 'Grenier', 'Desjardins', 'Hébert', 'Nguyen', 'Haddad', 'Diallo', 'Joseph', 'Chen', 'Benali']
/** Ville et poids, proche de la répartition de la population québécoise */
const CITIES: [string, number][] = [
  ['Montréal', 26], ['Québec', 9], ['Laval', 6], ['Gatineau', 4], ['Longueuil', 4], ['Sherbrooke', 3], ['Lévis', 2], ['Saguenay', 2],
  ['Trois-Rivières', 2], ['Terrebonne', 2], ['Brossard', 1], ['Rimouski', 1], ['Drummondville', 1], ['Granby', 1], ['Saint-Jérôme', 1],
]

/** Effets du canal d'acquisition (calibrés qualitativement sur la littérature professionnelle) */
const CHANNELS: Record<Channel, { weight: number; kinds: [GiftKind, number][]; age: [number, number]; attachment: number }> = {
  web: { weight: 0.45, kinds: [['monthly', 0.12], ['one_time', 0.8], ['annual', 0.08]], age: [28, 60], attachment: 0 },
  evenement: { weight: 0.2, kinds: [['monthly', 0.08], ['one_time', 0.88], ['annual', 0.04]], age: [25, 70], attachment: -0.6 },
  rue: { weight: 0.08, kinds: [['monthly', 0.9], ['one_time', 0.1], ['annual', 0]], age: [20, 45], attachment: -0.2 },
  courrier: { weight: 0.27, kinds: [['monthly', 0.08], ['one_time', 0.6], ['annual', 0.32]], age: [55, 88], attachment: 0.35 },
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

function dateInMonth(r: Rng, m: number): Date {
  return addDays(addMonths(HISTORY_START, m), r.int(0, 27))
}

/** Mois calendaire (0 = janvier) du mois m de l'historique */
const calendarMonth = (m: number) => addMonths(HISTORY_START, m).getUTCMonth()
/** Saisonnalité des dons ponctuels : pic de décembre (fin d'année fiscale), mardi je donne en novembre, creux d'été */
const SEASON = [0.8, 0.7, 0.8, 0.8, 0.9, 0.9, 0.6, 0.6, 0.8, 1, 1.8, 5]

/**
 * Simule l'historique d'un OBNL québécois mois par mois sur 4 ans.
 * Chaque donateur a des variables cachées : attachement (stable) et humeur (qui évolue).
 * Elles pilotent les dons, les ouvertures de courriels, l'attrition, les conversions et les hausses.
 * Le modèle ne les voit jamais : il doit les retrouver à partir des signaux observables.
 * Les taux obtenus sont vérifiés par `npm run calibration` contre des ordres de grandeur publiés.
 */
export function generateDemo(count = 4000, seed = 42): Dataset {
  const r = rng(seed)
  const donors: Donor[] = []
  const donations: Donation[] = []
  let gid = 0

  for (let i = 0; i < count; i++) {
    const channel = r.weighted(Object.entries(CHANNELS).map(([k, v]) => [k as Channel, v.weight]))
    const ch = CHANNELS[channel]
    const age = Math.round(clamp(ch.age[0] + r.next() * (ch.age[1] - ch.age[0]) + r.normal() * 5, 18, 95))
    const firstName = r.pick(FIRST)
    const lastName = r.pick(LAST)
    const joinMonth = r.int(0, HISTORY_MONTHS - 2)
    // les donateurs plus âgés sont en moyenne plus fidèles (effet documenté), d'où un lien âge → attachement
    const a = r.normal() + ch.attachment + 0.25 * ((age - 50) / 15)
    const emailConsent = r.chance(0.86)
    const cardExpiry = r.int(0, 35)
    const autoUpdater = r.chance(0.5)
    let mood = r.normal() * 0.5

    let kind: GiftKind = r.weighted(ch.kinds)
    let active = true
    let monthlyAmount = r.weighted([[10, 0.25], [15, 0.15], [20, 0.25], [25, 0.1], [30, 0.12], [50, 0.1], [100, 0.03]] as [number, number][])
    const oneTimeBase = Math.max(10, Math.round(Math.exp(Math.log(60) + r.normal() * 0.6) / 5) * 5)
    const annualAmount = r.pick([100, 120, 150, 200, 250, 300, 500])
    let monthlyStart = joinMonth
    let churnDate: string | undefined
    let convertedAt: string | undefined
    let convertedFrom: GiftKind | undefined
    const fails: number[] = []
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
      // sans consentement, l'OBNL n'envoie pas de courriels : pas de donnée d'ouverture (valeur manquante)
      if (emailConsent) engagement[m] = Math.round(clamp(sigmoid(-0.4 + 0.6 * a + 1.4 * mood) * 0.8 * (active ? 1 : 0.6) + r.normal() * 0.04, 0, 1) * 100) / 100
      const lastGift = giftMonths.length ? giftMonths[giftMonths.length - 1] : -99
      const gifts12 = giftMonths.filter((g) => g > m - 12).length
      const season = SEASON[calendarMonth(m)]

      if (kind === 'monthly' && active) {
        if (m < monthlyStart) continue
        const expiring = (m - cardExpiry) % 36 === 0 && !autoUpdater
        const failed = r.chance(0.012 + (expiring ? 0.6 : 0) + (mood < -1 ? 0.04 : 0) + (fails.at(-1) ? 0.45 : 0))
        give(m, monthlyAmount, 'monthly', failed)
        fails.push(failed ? 1 : 0)
        const recentFails = fails.slice(-3).reduce((s, x) => s + x, 0)
        const streak = fails.length >= 2 && fails.slice(-2).every((x) => x === 1)
        const tenure = m - monthlyStart
        const hazard = sigmoid(-4.8 - 0.6 * a - 1.3 * mood + 1.2 * recentFails + (streak ? 1.8 : 0) + (tenure < 6 ? 0.6 : 0) + (channel === 'rue' && tenure < 12 ? 0.8 : 0))
        if (m > monthlyStart && r.chance(hazard)) {
          active = false
          churnDate = iso(addDays(addMonths(HISTORY_START, m), 28))
        } else if (r.chance(sigmoid(-5.6 + 0.6 * a + 0.9 * mood + (tenure >= 12 && tenure <= 36 ? 0.5 : 0) - (recentFails ? 1 : 0)))) {
          monthlyAmount += monthlyAmount >= 30 ? 10 : 5
        }
      } else if (kind === 'monthly' && !active) {
        const since = m - Math.max(lastGift, monthlyStart)
        if (r.chance(sigmoid(-3.6 + 0.5 * a + 1.3 * mood - 0.07 * since) * season)) give(m, Math.round((monthlyAmount * 3) / 5) * 5 || 20, 'one_time')
      } else if (kind === 'one_time') {
        const since = m - lastGift
        // « one-and-done » : la majorité des nouveaux donateurs ne redonnent jamais
        const gave = m === joinMonth || r.chance(clamp(sigmoid(-4.0 + 0.9 * a + 1.0 * mood - 0.05 * Math.max(0, since - 3) - (giftMonths.length <= 1 ? 1.1 : 0)) * season, 0, 0.95))
        if (gave) {
          const big = r.chance(0.03) ? 3 : 1
          give(m, Math.max(10, Math.round((oneTimeBase * big * (0.8 + r.next() * 0.5)) / 5) * 5), 'one_time')
        }
        const z = -7.2 + 0.8 * a + 1.2 * mood + 0.5 * Math.min(gifts12, 4) + (gave ? 0.8 : 0) - (since > 12 ? 1.5 : 0) + (channel === 'web' ? 0.3 : 0)
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
        if (anniversary && (m === joinMonth || r.chance(sigmoid(-0.3 + 0.9 * a + 1.2 * mood - 0.6 * Math.max(0, m - lastGift - 13) / 12)))) give(m, annualAmount, 'annual')
        const soon = (m - joinMonth) % 12 >= 10
        const z = -7.3 + 0.8 * a + 1.2 * mood + (anniversary ? 1.4 : soon ? 0.7 : 0) + 0.3 * years
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
      city: r.weighted(CITIES),
      kind,
      status,
      // inscription au 1er du mois du premier don : aucun don ne peut précéder l'inscription
      joinDate: iso(addMonths(HISTORY_START, joinMonth)),
      churnDate,
      convertedAt,
      convertedFrom,
      monthlyAmount: kind === 'monthly' ? monthlyAmount : undefined,
      engagement,
      emailConsent,
      age,
      channel,
    })
  }

  donations.sort((x, y) => x.date.localeCompare(y.date))
  return { donors, donations, refDate: iso(REF_DATE), historyStart: iso(HISTORY_START), source: 'demo' }
}
