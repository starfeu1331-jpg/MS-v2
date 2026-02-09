import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
})

const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

async function testAll() {
  try {
    console.log('🔍 TEST SECTION ALL - Début')
    
    console.log('\n1. KPIs...')
    const kpis = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT carte)::int as "totalClients",
        COUNT(*)::int as "totalTransactions",
        SUM(ca)::float as "totalCA",
        (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
      FROM transactions
    `)
    console.log('✅ KPIs:', kpis[0])
    
    console.log('\n2. Stats Clients...')
    const statsClients = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN sexe = 'H' THEN 1 END)::int as hommes,
        COUNT(CASE WHEN sexe = 'F' THEN 1 END)::int as femmes,
        COUNT(CASE WHEN nom IS NOT NULL AND nom != '' THEN 1 END)::int as avec_nom,
        COUNT(CASE WHEN prenom IS NOT NULL AND prenom != '' THEN 1 END)::int as avec_prenom,
        COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END)::int as avec_email,
        COUNT(CASE WHEN telephone IS NOT NULL AND telephone != '' THEN 1 END)::int as avec_telephone
      FROM clients
    `)
    console.log('✅ Stats Clients:', statsClients[0])
    
    console.log('\n3. Top Produits...')
    const topProduits = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id as code,
        p.id as nom,
        p.famille,
        p.sous_famille,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca DESC
      LIMIT 10
    `)
    console.log(`✅ Top Produits: ${topProduits.length} produits`)
    
    console.log('\n4. Top Magasins...')
    const topMagasins = await prisma.$queryRawUnsafe(`
      SELECT 
        m.code,
        m.nom,
        m.zone,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume,
        COUNT(DISTINCT t.facture)::int as "nbTickets",
        (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as "panierMoyen"
      FROM transactions t
      JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
      GROUP BY m.code, m.nom, m.zone
      ORDER BY ca DESC
      LIMIT 5
    `)
    console.log(`✅ Top Magasins: ${topMagasins.length} magasins`)
    
    console.log('\n5. Top Clients...')
    const topClients = await prisma.$queryRawUnsafe(`
      SELECT 
        c.carte,
        c.ville,
        SUM(t.ca)::float as ca,
        COUNT(DISTINCT t.facture)::int as "nbCommandes"
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      GROUP BY c.carte, c.ville
      ORDER BY ca DESC
      LIMIT 10
    `)
    console.log(`✅ Top Clients: ${topClients.length} clients`)
    
    console.log('\n6. Evolution Mensuelle...')
    const evolutionMensuelle = await prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as mois,
        SUM(ca)::float as ca,
        COUNT(*)::int as tickets
      FROM transactions
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY mois
    `)
    console.log(`✅ Evolution: ${evolutionMensuelle.length} mois`)
    
    console.log('\n7. Sérialisation JSON...')
    const response = serializeJSON({
      year: 'all',
      kpis: {
        totalCA: (kpis[0]?.totalCA) || 0,
        totalCAMagasin: (kpis[0]?.totalCA) || 0,
        totalCAWeb: 0,
        totalTransactions: (kpis[0]?.totalTransactions) || 0,
        totalTransactionsMag: (kpis[0]?.totalTransactions) || 0,
        totalTransactionsWeb: 0,
        totalClients: (kpis[0]?.totalClients) || 0,
        panierMoyen: (kpis[0]?.panierMoyen) || 0,
        panierMoyenMag: (kpis[0]?.panierMoyen) || 0,
        panierMoyenWeb: 0
      },
      statsClients: {
        total: (statsClients[0]?.total) || 0,
        hommes: (statsClients[0]?.hommes) || 0,
        femmes: (statsClients[0]?.femmes) || 0
      },
      topProduits: topProduits.slice(0, 3).map(p => ({
        code: p.code,
        nom: p.nom,
        ca: p.ca
      }))
    })
    
    console.log('✅ Sérialisation OK')
    console.log('\n✅✅✅ TOUS LES TESTS PASSENT !')
    console.log('CA Total:', response.kpis.totalCA, '€')
    console.log('Transactions:', response.kpis.totalTransactions)
    console.log('Clients:', response.kpis.totalClients)
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testAll()
