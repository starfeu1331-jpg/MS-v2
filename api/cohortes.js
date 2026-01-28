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
    console.log('🔄 API Cohortes: Calcul en cours...')

    // Obtenir la première transaction de chaque client (cohorte)
    const cohorteData = await prisma.$queryRawUnsafe(`
      WITH first_purchase AS (
        SELECT 
          carte,
          MIN(date) as first_date,
          TO_CHAR(MIN(date), 'YYYY-MM') as cohort_month
        FROM transactions
        WHERE carte != '0' AND ca > 0
        GROUP BY carte
      )
      SELECT 
        fp.carte::text,
        fp.cohort_month::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM first_purchase fp
      INNER JOIN transactions t ON fp.carte = t.carte
      WHERE t.ca > 0
      GROUP BY fp.carte, fp.cohort_month
      ORDER BY fp.cohort_month, fp.carte
    `)

    // Organiser par cohorte
    const cohortes = {}
    cohorteData.forEach(row => {
      const month = row.cohort_month
      if (!cohortes[month]) {
        cohortes[month] = {
          clients: new Set(),
          ca: 0,
          volume: 0
        }
      }
      cohortes[month].clients.add(row.carte)
      cohortes[month].ca += Number(row.ca)
      cohortes[month].volume += Number(row.volume)
    })

    // Convertir Set en taille pour la sérialisation
    const result = {}
    Object.entries(cohortes).forEach(([month, data]) => {
      result[month] = {
        clients: { size: data.clients.size },
        ca: data.ca,
        volume: data.volume
      }
    })

    console.log(`✅ API Cohortes: ${Object.keys(result).length} cohortes calculées`)

    res.status(200).json({
      cohortes: result
    })

  } catch (error) {
    console.error('❌ Erreur API Cohortes:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
