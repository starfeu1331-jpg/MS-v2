import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { magasin } = req.query

    console.log('🔄 API Cross-Selling: Requête reçue', { magasin })

    // Construire la condition WHERE selon le filtre magasin
    let whereClause = "WHERE t.ca > 0 AND t.facture IS NOT NULL"
    if (magasin === 'WEB') {
      whereClause += " AND t.depot = 'WEB'"
    } else if (magasin === 'MAGASIN') {
      whereClause += " AND t.depot != 'WEB'"
    }

    // Query pour obtenir les associations de produits par ticket
    const query = `
      SELECT 
        t.facture,
        t.date,
        CAST(EXTRACT(YEAR FROM t.date::date) AS INTEGER) as annee,
        CAST(EXTRACT(MONTH FROM t.date::date) AS INTEGER) as mois,
        ARRAY_AGG(DISTINCT COALESCE(p.famille, 'Non classé')) FILTER (WHERE p.famille IS NOT NULL OR TRUE) as familles,
        CAST(SUM(t.ca) AS DECIMAL) as ca_ticket
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.code
      ${whereClause}
      GROUP BY t.facture, t.date
      HAVING COUNT(DISTINCT p.famille) >= 2
      ORDER BY t.date DESC
      LIMIT 50000
    `

    const results = await prisma.$queryRawUnsafe(query)

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

    // Top produits par mois
    const produitsParMois = {}
    const produitsGlobal = {}

    results.forEach(row => {
      const mois = `${row.annee}-${String(row.mois).padStart(2, '0')}`
      const produits = row.produits || []
      
      produits.forEach(produit => {
        // Par mois
        if (!produitsParMois[mois]) {
          produitsParMois[mois] = {}
        }
        if (!produitsParMois[mois][produit]) {
          produitsParMois[mois][produit] = { ca: 0, volume: 0 }
        }
        produitsParMois[mois][produit].ca += Number(row.ca_ticket) / produits.length
        produitsParMois[mois][produit].volume += 1

        // Global
        if (!produitsGlobal[produit]) {
          produitsGlobal[produit] = { ca: 0, volume: 0 }
        }
        produitsGlobal[produit].ca += Number(row.ca_ticket) / produits.length
        produitsGlobal[produit].volume += 1
      })
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
      produitsParMois,
      produitsGlobal,
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
