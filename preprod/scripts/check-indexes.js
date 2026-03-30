import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  console.log('=== QUERY BENCHMARKS (date range: 2025-01-01 to 2026-01-01) ===\n')
  
  const t0 = Date.now()
  await p.$queryRawUnsafe(`SELECT COALESCE(SUM(ca),0) as ca, COUNT(DISTINCT facture) as tickets, COUNT(DISTINCT carte) as clients FROM transactions WHERE date >= '2025-01-01' AND date < '2026-01-01'`)
  console.log(`1. KPIs: ${Date.now()-t0}ms`)

  const t1 = Date.now()
  await p.$queryRawUnsafe(`SELECT COUNT(*) as total FROM clients c WHERE EXISTS (SELECT 1 FROM transactions tx WHERE tx.date >= '2025-01-01' AND tx.date < '2026-01-01' AND tx.carte = c.carte)`)
  console.log(`2. Stats clients (EXISTS): ${Date.now()-t1}ms`)
  
  const t2 = Date.now()
  await p.$queryRawUnsafe(`SELECT p.id, SUM(t.ca) as ca FROM transactions t JOIN produits p ON p.id = t.produit WHERE t.date >= '2025-01-01' AND t.date < '2026-01-01' GROUP BY p.id ORDER BY ca DESC LIMIT 10`)
  console.log(`3. Top produits: ${Date.now()-t2}ms`)

  const t3 = Date.now()
  await p.$queryRawUnsafe(`SELECT TO_CHAR(date, 'YYYY-MM') as mois, SUM(ca) as ca FROM transactions WHERE date >= '2025-01-01' AND date < '2026-01-01' GROUP BY TO_CHAR(date, 'YYYY-MM') ORDER BY mois`)
  console.log(`4. Evolution mensuelle: ${Date.now()-t3}ms`)

  const t4 = Date.now()
  await p.$queryRawUnsafe(`SELECT c.carte, SUM(t.ca) as ca FROM transactions t JOIN clients c ON c.carte = t.carte WHERE t.date >= '2025-01-01' AND t.date < '2026-01-01' AND t.carte IS NOT NULL AND t.carte != '' AND t.carte != '0' GROUP BY c.carte ORDER BY ca DESC LIMIT 10`)
  console.log(`5. Top clients: ${Date.now()-t4}ms`)

  const t5 = Date.now()
  await p.$queryRawUnsafe(`SELECT m.code, SUM(t.ca) as ca FROM transactions t JOIN magasins m ON m.code = t.depot WHERE t.date >= '2025-01-01' AND t.date < '2026-01-01' GROUP BY m.code ORDER BY ca DESC LIMIT 10`)
  console.log(`6. Top magasins: ${Date.now()-t5}ms`)

  const t6 = Date.now()
  await p.$queryRawUnsafe(`SELECT COALESCE(p.famille, 'NC') as f, SUM(t.ca) as ca FROM transactions t JOIN produits p ON p.id = t.produit WHERE t.date >= '2025-01-01' AND t.date < '2026-01-01' GROUP BY p.famille ORDER BY ca DESC LIMIT 8`)
  console.log(`7. Top familles: ${Date.now()-t6}ms`)

  const t7 = Date.now()
  await p.$queryRawUnsafe(`SELECT EXTRACT(DOW FROM date) as d, SUM(ca) as ca FROM transactions WHERE date >= '2025-01-01' AND date < '2026-01-01' GROUP BY EXTRACT(DOW FROM date)`)
  console.log(`8. Jours semaine: ${Date.now()-t7}ms`)

  console.log(`\nTotal séquentiel: ${Date.now()-t0}ms`)

  await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
