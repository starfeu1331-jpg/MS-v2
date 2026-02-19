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
    console.log('🔄 API Forecast: Calcul en cours...')

    // Données TOUS canaux - CA par mois et famille
    const saisonAll = await prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM')::text as mois,
        p.famille::text,
        SUM(t.ca)::numeric as ca
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL
      GROUP BY TO_CHAR(date, 'YYYY-MM'), p.famille
      ORDER BY mois, p.famille
    `)

    // Données MAGASIN
    const saisonMag = await prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM')::text as mois,
        p.famille::text,
        SUM(t.ca)::numeric as ca
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot != 'WEB'
      GROUP BY TO_CHAR(date, 'YYYY-MM'), p.famille
      ORDER BY mois, p.famille
    `)

    // Données WEB
    const saisonWeb = await prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM')::text as mois,
        p.famille::text,
        SUM(t.ca)::numeric as ca
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot = 'WEB'
      GROUP BY TO_CHAR(date, 'YYYY-MM'), p.famille
      ORDER BY mois, p.famille
    `)

    // Formater en objet comme attendu par le composant
    const formatData = (rows) => {
      const result = {}
      rows.forEach(row => {
        if (!result[row.mois]) {
          result[row.mois] = {}
        }
        result[row.mois][row.famille] = Number(row.ca)
      })
      return result
    }

    console.log(`✅ API Forecast: Données calculées`)

    res.status(200).json({
      saison: formatData(saisonAll),
      saisonMag: formatData(saisonMag),
      saisonWeb: formatData(saisonWeb)
    })

  } catch (error) {
    console.error('❌ Erreur API Forecast:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
