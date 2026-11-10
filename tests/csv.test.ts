// Import CSV : date de référence = dernier don du fichier, dates illisibles écartées.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importCsv } from '../src/lib/csv.ts'

const donors = 'id,kind\nd1,monthly\nd2,one_time\n'
const donations = 'donor_id,date,amount,kind,status\nd1,2024-01-15,20,monthly,paid\nd2,pas une date,50,one_time,paid\nd2,2024-03-10,50,one_time,paid\n'

test('date de référence = date du dernier don (indépendante du jour)', () => {
  const ds = importCsv(donors, donations)
  assert.equal(ds.refDate, '2024-03-10')
  assert.equal(ds.donations.length, 2)
})

test('message clair en français si aucune date lisible', () => {
  assert.throws(() => importCsv(donors, 'donor_id,date,amount\nd1,xx,10\n'), /Aucun don lisible.*1 ligne/)
})

test('virgule décimale (export Excel québécois) : jamais NaN', () => {
  const ds = importCsv('id;kind;monthly_amount;age\nd1;monthly;12,50;4x\n', 'donor_id;date;amount;kind;status\nd1;2024-01-15;12,50;monthly;paid\n')
  assert.equal(ds.donors[0].monthlyAmount, 12.5)
  assert.equal(ds.donors[0].age, undefined)
  assert.equal(ds.donations[0].amount, 12.5)
})

test('dates : seul AAAA-MM-JJ est accepté (03/04/2024 est ambigu)', () => {
  const ds = importCsv(donors, 'donor_id,date,amount\nd1,03/04/2024,10\nd1,2024-04-03,10\n')
  assert.deepEqual(ds.donations.map((g) => g.date), ['2024-04-03'])
  assert.throws(() => importCsv(donors, 'donor_id,date,amount\nd1,03/04/2024,10\n'), /AAAA-MM-JJ/)
})
