const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Sérialisation JSON pour BigInt
function serializeJSON(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  )
}

// Parse date from ISO format (YYYY-MM-DD) returned by PostgreSQL
const parseDate = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

module.exports = async (req, res) => {
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
    
    console.log(`🔍 RFM Analysis - Filtre: ${magasin || 'TOUS'}`)

    const today = new Date()

    console.log('📊 Chargement des clients et transactions...')
    
    // Stratégie optimisée: calculer les quintiles directement en SQL avec NTILE
    // Au lieu de charger tout en mémoire puis calculer côté Node
    let clientsData
    
    const baseQuery = `
      WITH client_metrics AS (
        SELECT 
          c.carte::text,
          c.ville::text,
          COUNT(t.id)::int as frequency,
          SUM(t.ca)::numeric as monetary,
          EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency,
          EXTRACT(DAY FROM (CURRENT_DATE - MIN(t.date)))::int as days_since_first,
          MAX(t.date)::text as last_date,
          MIN(t.date)::text as first_date
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        {{WHERE_CLAUSE}}
        GROUP BY c.carte, c.ville
        HAVING SUM(t.ca) > 0
      ),
      rfm_scores AS (
        SELECT 
          carte,
          ville,
          frequency,
          monetary,
          recency,
          days_since_first,
          last_date,
          first_date,
          -- Calcul des scores R, F, M avec NTILE (quintiles)
          -- NTILE(5) divise en 5 groupes égaux
          (6 - NTILE(5) OVER (ORDER BY recency ASC))::int as r,
          NTILE(5) OVER (ORDER BY frequency DESC)::int as f,
          NTILE(5) OVER (ORDER BY monetary DESC)::int as m
        FROM client_metrics
      )
      SELECT * FROM rfm_scores
      ORDER BY carte
    `
    
    if (showWebOnly) {
      const query = baseQuery.replace('{{WHERE_CLAUSE}}', "WHERE t.depot = 'WEB'")
      clientsData = await prisma.$queryRawUnsafe(query)
    } else if (showMagasinOnly) {
      const query = baseQuery.replace('{{WHERE_CLAUSE}}', "WHERE t.depot != 'WEB'")
      clientsData = await prisma.$queryRawUnsafe(query)
    } else {
      const query = baseQuery.replace('{{WHERE_CLAUSE}}', '')
      clientsData = await prisma.$queryRawUnsafe(query)
    }

    const clientsArray = serializeJSON(clientsData)
    console.log(`✅ ${clientsArray.length} clients chargés avec scores R, F, M calculés en SQL`)

    if (clientsArray.length === 0) {
      return res.status(200).json({ 
        clients: [],
        stats: {
          totalClients: 0,
          totalCA: 0,
          segments: {}
        }
      })
    }

    // Les scores R, F, M sont déjà calculés par SQL avec NTILE
    // On a juste besoin d'assigner les segments
    const clients = clientsArray.map(client => {
      const R = client.r
      const F = client.f
      const M = client.m
      const RFM = R * 100 + F * 10 + M

      let segment = ''
      
      // Segmentation RFM (ordre important: du plus spécifique au plus général)
      if (R === 5 && F === 5 && M === 5) {
        segment = 'Ultra Champions'
      } else if (R >= 4 && F >= 4 && M >= 4) {
        segment = 'Champions'
      } else if (R >= 4 && F === 3) {
        segment = 'Nouveaux'
      } else if (R === 3 && F === 3) {
        segment = 'Occasionnels'
      } else if (R >= 3 && F >= 3 && M >= 3) {
        segment = 'Loyaux'
      } else if (F >= 3 && R <= 2) {
        segment = 'À Risque'
      } else {
        segment = 'Perdus'
      }

      return {
        carte: client.carte,
        ville: client.ville || '-',
        recency: client.recency,
        frequency: client.frequency,
        monetary: parseFloat(client.monetary),
        daysSinceFirst: client.days_since_first,
        firstDate: client.first_date,
        lastDate: client.last_date,
        R,
        F,
        M,
        RFM,
        segment
      }
    })

    // Étape 5: Agréger les statistiques par segment
    const segmentStats = {}
    clients.forEach(client => {
      if (!segmentStats[client.segment]) {
        segmentStats[client.segment] = {
          count: 0,
          ca: 0,
          clients: []
        }
      }
      segmentStats[client.segment].count++
      segmentStats[client.segment].ca += client.monetary
      segmentStats[client.segment].clients.push(client)
    })

    // Distribution des scores pour debug
    const rDist = {}
    const fDist = {}
    const segDist = {}
    clients.forEach(c => {
      rDist[c.R] = (rDist[c.R] || 0) + 1
      fDist[c.F] = (fDist[c.F] || 0) + 1
      segDist[c.segment] = (segDist[c.segment] || 0) + 1
    })

    console.log('📊 Distribution R:', rDist)
    console.log('📊 Distribution F:', fDist)
    console.log('📊 Distribution Segments:', segDist)

    const totalClients = clients.length
    const totalCA = clients.reduce((sum, c) => sum + c.monetary, 0)

    console.log(`✅ RFM calculé: ${totalClients} clients, ${Math.round(totalCA)}€ CA total`)

    return res.status(200).json({
      clients,
      stats: {
        totalClients,
        totalCA,
        segments: segmentStats
      }
    })

  } catch (error) {
    console.error('❌ Erreur RFM:', error)
    console.error('Stack:', error.stack)
    return res.status(500).json({ 
      error: 'Erreur lors du calcul RFM',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  } finally {
    await prisma.$disconnect()
  }
}
