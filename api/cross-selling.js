import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { magasin } = req.query
    const showWebOnly = magasin === 'WEB'
    const showMagasinOnly = magasin === 'MAGASIN'

    console.log('🔄 API Cross-Selling: Requête reçue', { magasin })

    // Query avec structure RFM
    let results
    
    if (showWebOnly) {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          EXTRACT(YEAR FROM t.date)::int as annee,
          EXTRACT(MONTH FROM t.date)::int as mois,
          ARRAY_AGG(DISTINCT p.famille) as familles,
          SUM(t.ca)::numeric as ca_ticket
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot = 'WEB' AND p.famille IS NOT NULL
        GROUP BY t.facture, t.date
        HAVING COUNT(DISTINCT p.famille) >= 2
        ORDER BY t.date DESC
        LIMIT 50000
      `)
    } else if (showMagasinOnly) {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          EXTRACT(YEAR FROM t.date)::int as annee,
          EXTRACT(MONTH FROM t.date)::int as mois,
          ARRAY_AGG(DISTINCT p.famille) as familles,
          SUM(t.ca)::numeric as ca_ticket
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND t.depot != 'WEB' AND p.famille IS NOT NULL
        GROUP BY t.facture, t.date
        HAVING COUNT(DISTINCT p.famille) >= 2
        ORDER BY t.date DESC
        LIMIT 50000
      `)
    } else {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          EXTRACT(YEAR FROM t.date)::int as annee,
          EXTRACT(MONTH FROM t.date)::int as mois,
          ARRAY_AGG(DISTINCT p.famille) as familles,
          SUM(t.ca)::numeric as ca_ticket
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL AND p.famille IS NOT NULL
        GROUP BY t.facture, t.date
        HAVING COUNT(DISTINCT p.famille) >= 2
        ORDER BY t.date DESC
        LIMIT 50000
      `)
    }

    console.log(`✅ API Cross-Selling: ${results.length} tickets avec cross-sell trouvés`)

    // Analyser les associations de familles
    const associations = {}
    results.forEach(row => {
      const familles = row.familles || []
      if (familles.length < 2) return

      for (let i = 0; i < familles.length; i++) {
        for (let j = i + 1; j < familles.length; j++) {
          const key = [familles[i], familles[j]].sort().join(' → ')
          if (!associations[key]) {
            associations[key] = { 
              count: 0, 
              families: [familles[i], familles[j]].sort(),
              totalCA: 0
            }
          }
          associations[key].count++
          associations[key].totalCA += Number(row.ca_ticket)
        }
      }
    })

    // Trier les associations par fréquence
    const topAssociations = Object.entries(associations)
      .map(([key, data]) => ({
        families: data.families,
        count: data.count,
        totalCA: data.totalCA
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)

    res.status(200).json({
      associations: topAssociations,
      totalTickets: results.length
    })

  } catch (error) {
    console.error('❌ Erreur API Cross-Selling:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
