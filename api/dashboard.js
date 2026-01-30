import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export default async function handler(req, res) {
  const { year } = req.query
  
  try {
    // Test de connexion
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured')
    }
    
    if (year === 'all') {
      // Toutes les périodes
      const kpis = await prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT carte)::int as "totalClients",
          COUNT(*)::int as "totalTransactions",
          SUM(ca)::float as "totalCA",
          AVG(ca)::float as "panierMoyen"
        FROM transactions
      `
      
      const topProduits = await prisma.$queryRaw`
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
      `
      
      const topMagasins = await prisma.$queryRaw`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume,
          COUNT(DISTINCT t.facture)::int as "nbTickets",
          AVG(t.ca)::float as "panierMoyen"
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `
      
      const topClients = await prisma.$queryRaw`
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
      `
      
      const evolutionMensuelle = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::float as ca,
          COUNT(*)::int as tickets
        FROM transactions
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `
      
      return res.status(200).json(serializeJSON({
        year: 'all',
        kpis: {
          totalCA: kpis[0].totalCA || 0,
          totalCAMagasin: kpis[0].totalCA || 0,
          totalCAWeb: 0,
          totalTransactions: kpis[0].totalTransactions || 0,
          totalTransactionsMag: kpis[0].totalTransactions || 0,
          totalTransactionsWeb: 0,
          totalClients: kpis[0].totalClients || 0,
          panierMoyen: kpis[0].panierMoyen || 0,
          panierMoyenMag: kpis[0].panierMoyen || 0,
          panierMoyenWeb: 0
        },
        topProduits: topProduits.map(p => ({
          code: p.code,
          nom: p.nom,
          famille: p.famille,
          sous_famille: p.sous_famille,
          ca: p.ca,
          volume: p.volume
        })),
        topMagasins: topMagasins.map(m => ({
          code: m.code,
          nom: m.nom,
          zone: m.zone,
          ca: m.ca,
          volume: m.volume,
          nbTickets: m.nbTickets,
          panierMoyen: m.panierMoyen
        })),
        topClients: topClients.map(c => ({
          carte: c.carte,
          ville: c.ville,
          ca: c.ca,
          nbCommandes: c.nbCommandes
        })),
        evolutionMensuelle: evolutionMensuelle.map(e => ({
          mois: e.mois,
          ca: e.ca,
          tickets: e.tickets
        }))
      }))
    }
    
    // Année spécifique
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    
    const kpis = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        COUNT(DISTINCT carte)::int as "totalClients",
        COUNT(*)::int as "totalTransactions",
        SUM(ca)::float as "totalCA",
        AVG(ca)::float as "panierMoyen"
      FROM transactions
      WHERE date >= ${startDate}::timestamp AND date <= ${endDate}::timestamp
    `)
    
    const topProduits = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        p.id as code,
        p.id as nom,
        p.famille,
        p.sous_famille,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.date >= ${startDate}::timestamp AND t.date <= ${endDate}::timestamp
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca DESC
      LIMIT 10
    `)
    
    const topMagasins = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        m.code,
        m.nom,
        m.zone,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume,
        COUNT(DISTINCT t.facture)::int as "nbTickets",
        AVG(t.ca)::float as "panierMoyen"
      FROM transactions t
      JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
      WHERE t.date >= ${startDate}::timestamp AND t.date <= ${endDate}::timestamp
      GROUP BY m.code, m.nom, m.zone
      ORDER BY ca DESC
      LIMIT 5
    `)
    
    const topClients = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        c.carte,
        c.ville,
        SUM(t.ca)::float as ca,
        COUNT(DISTINCT t.facture)::int as "nbCommandes"
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      WHERE t.date >= ${startDate}::timestamp AND t.date <= ${endDate}::timestamp
      GROUP BY c.carte, c.ville
      ORDER BY ca DESC
      LIMIT 10
    `)
    
    const evolutionMensuelle = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as mois,
        SUM(ca)::float as ca,
        COUNT(*)::int as tickets
      FROM transactions
      WHERE date >= ${startDate}::timestamp AND date <= ${endDate}::timestamp
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY mois
    `)
    
    res.status(200).json(serializeJSON({
      year: parseInt(year),
      kpis: {
        totalCA: kpis[0].totalCA || 0,
        totalCAMagasin: kpis[0].totalCA || 0,
        totalCAWeb: 0,
        totalTransactions: kpis[0].totalTransactions || 0,
        totalTransactionsMag: kpis[0].totalTransactions || 0,
        totalTransactionsWeb: 0,
        totalClients: kpis[0].totalClients || 0,
        panierMoyen: kpis[0].panierMoyen || 0,
        panierMoyenMag: kpis[0].panierMoyen || 0,
        panierMoyenWeb: 0
      },
      topProduits: topProduits.map(p => ({
        code: p.code,
        nom: p.nom,
        famille: p.famille,
        sous_famille: p.sous_famille,
        ca: p.ca,
        volume: p.volume
      })),
      topMagasins: topMagasins.map(m => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ca: m.ca,
        volume: m.volume,
        nbTickets: m.nbTickets,
        panierMoyen: m.panierMoyen
      })),
      topClients: topClients.map(c => ({
        carte: c.carte,
        ville: c.ville,
        ca: c.ca,
        nbCommandes: c.nbCommandes
      })),
      evolutionMensuelle: evolutionMensuelle.map(e => ({
        mois: e.mois,
        ca: e.ca,
        tickets: e.tickets
      }))
    }))
  } catch (error) {
    console.error('Dashboard error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  } finally {
    await prisma.$disconnect()
  }
}
