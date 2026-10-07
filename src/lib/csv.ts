import type { Dataset, Donation, Donor, GiftKind } from './types.ts'
import { addMonths, iso, monthIndex } from './dates.ts'

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const sep = text.split('\n')[0].includes(';') && !text.split('\n')[0].includes(',') ? ';' : ','
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x !== '')) rows.push(row)
  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map((h) => h.trim().toLowerCase())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
}

export function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportDonors(ds: Dataset): string {
  return toCsv(
    ds.donors.map((d) => ({
      id: d.id,
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      city: d.city,
      join_date: d.joinDate,
      kind: d.kind,
      monthly_amount: d.monthlyAmount ?? '',
      churn_date: d.churnDate ?? '',
      converted_at: d.convertedAt ?? '',
      converted_from: d.convertedFrom ?? '',
      email_consent: d.emailConsent ? 'oui' : 'non',
    })),
  )
}

export function exportDonations(ds: Dataset): string {
  return toCsv(ds.donations.map((g) => ({ donor_id: g.donorId, date: g.date, amount: g.amount, kind: g.kind, status: g.status })))
}

export function exportEngagement(ds: Dataset): string {
  const start = new Date(ds.historyStart)
  const rows: Record<string, unknown>[] = []
  for (const d of ds.donors)
    d.engagement.forEach((v, m) => {
      if (v >= 0) rows.push({ donor_id: d.id, month: iso(addMonths(start, m)).slice(0, 7), open_rate: v })
    })
  return toCsv(rows)
}

const KINDS: GiftKind[] = ['monthly', 'annual', 'one_time']
const asKind = (s: string, fallback: GiftKind = 'one_time'): GiftKind => {
  const v = s.toLowerCase()
  if (KINDS.includes(v as GiftKind)) return v as GiftKind
  if (v.startsWith('mens')) return 'monthly'
  if (v.startsWith('ann')) return 'annual'
  if (v.startsWith('ponc') || v === 'unique') return 'one_time'
  return fallback
}
const asDate = (s: string) => (s ? iso(new Date(s)) : undefined)

/** Construit un jeu de données à partir des fichiers CSV de l'association */
export function importCsv(donorsCsv: string, donationsCsv: string, engagementCsv?: string): Dataset {
  const donationRows = parseCsv(donationsCsv)
  const donations: Donation[] = donationRows
    .filter((r) => r.donor_id && r.date && r.amount)
    .map((r, i) => ({
      id: `g${i + 1}`,
      donorId: r.donor_id,
      date: iso(new Date(r.date)),
      amount: Number(r.amount.replace(',', '.')) || 0,
      kind: asKind(r.kind ?? ''),
      status: /fail|échou|echou|refus/i.test(r.status ?? '') ? 'failed' : 'paid',
    }))
  donations.sort((a, b) => a.date.localeCompare(b.date))
  if (!donations.length) throw new Error('Aucun don lisible : colonnes attendues donor_id, date, amount, kind, status')

  const refDate = iso(new Date())
  const first = new Date(donations[0].date)
  const historyStart = iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)))
  const months = monthIndex(new Date(refDate), new Date(historyStart)) + 1

  const engagement = new Map<string, number[]>()
  if (engagementCsv) {
    for (const r of parseCsv(engagementCsv)) {
      const m = monthIndex(new Date(`${r.month}-01`.slice(0, 10)), new Date(historyStart))
      if (m < 0 || m >= months) continue
      const arr = engagement.get(r.donor_id) ?? new Array(months).fill(-1)
      arr[m] = Number(r.open_rate.replace(',', '.'))
      engagement.set(r.donor_id, arr)
    }
  }

  const donors: Donor[] = parseCsv(donorsCsv)
    .filter((r) => r.id)
    .map((r) => {
      const kind = asKind(r.kind ?? '', 'one_time')
      const gifts = donations.filter((g) => g.donorId === r.id && g.status === 'paid')
      const last = gifts.at(-1)?.date
      const churnDate = asDate(r.churn_date)
      const sinceDays = last ? (Date.parse(refDate) - Date.parse(last)) / 86_400_000 : Infinity
      const status: Donor['status'] =
        kind === 'monthly' ? (churnDate ? 'lapsed' : 'active') : sinceDays > (kind === 'annual' ? 425 : 365) ? 'lapsed' : 'active'
      return {
        id: r.id,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        email: r.email ?? '',
        city: r.city ?? '',
        kind,
        status,
        joinDate: asDate(r.join_date) ?? gifts[0]?.date ?? refDate,
        churnDate,
        convertedAt: asDate(r.converted_at),
        convertedFrom: r.converted_from ? asKind(r.converted_from) : undefined,
        monthlyAmount: r.monthly_amount ? Number(r.monthly_amount) : undefined,
        engagement: engagement.get(r.id) ?? new Array(months).fill(-1),
        emailConsent: !/^(non|no|false|0)$/i.test(r.email_consent ?? 'oui'),
      }
    })
  if (!donors.length) throw new Error('Aucun donateur lisible : colonne id obligatoire')
  return { donors, donations, refDate, historyStart, source: 'csv' }
}
