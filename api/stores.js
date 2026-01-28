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
    console.log('🔄 API Stores: Calcul en cours...')

    // Stats par magasin (depot)
    const magasinsData = await prisma.$queryRawUnsafe(`
      SELECT 
        depot::text,
        SUM(ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions
      WHERE ca > 0 AND depot IS NOT NULL AND depot != 'WEB'
      GROUP BY depot
      ORDER BY SUM(ca) DESC
    `)

    // Stats par ville client
    const villesData = await prisma.$queryRawUnsafe(`
      SELECT 
        c.ville::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume,
        COUNT(DISTINCT t.carte)::int as clients
      FROM transactions t
      INNER JOIN clients c ON t.carte = c.carte
      WHERE t.ca > 0 AND c.ville IS NOT NULL AND t.carte != '0'
      GROUP BY c.ville
      ORDER BY SUM(t.ca) DESC
    `)

    // Formater en objet comme attendu
    const magasins = {}
    magasinsData.forEach(row => {
      magasins[row.depot] = {
        ca: Number(row.ca),
        volume: Number(row.volume)
      }
    })

    const villes = {}
    villesData.forEach(row => {
      villes[row.ville] = {
        ca: Number(row.ca),
        volume: Number(row.volume),
        clients: Number(row.clients)
      }
    })

    console.log(`✅ API Stores: ${Object.keys(magasins).length} magasins, ${Object.keys(villes).length} villes`)

    res.status(200).json({
      geo: {
        magasins,
        villes
      }
    })

  } catch (error) {
    console.error('❌ Erreur API Stores:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
