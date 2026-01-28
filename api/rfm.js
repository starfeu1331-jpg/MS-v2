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
    
    // Étape 1: Récupérer TOUS les clients avec leurs transactions
    // Filtrer par dépôt si nécessaire
    let whereClause = {}
    if (showWebOnly) {
      whereClause = { depot: 'WEB' }
    } else if (showMagasinOnly) {
      whereClause = { depot: { not: 'WEB' } }
    }

    console.log('📊 Chargement des clients et transactions...')
    
    // Requête optimisée : on charge tout d'un coup avec les transactions groupées
    const clientsData = await prisma.$queryRaw`
      SELECT 
        c.carte,
        c.ville,
        COUNT(t.id)::int as nb_transactions,
        SUM(t.ca)::float as ca_total,
        MAX(t.date) as last_purchase_date,
        MIN(t.date) as first_purchase_date
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      ${showWebOnly ? prisma.$queryRaw`WHERE t.depot = 'WEB'` : prisma.$queryRaw``}
      ${showMagasinOnly ? prisma.$queryRaw`WHERE t.depot != 'WEB'` : prisma.$queryRaw``}
      GROUP BY c.carte, c.ville
      HAVING SUM(t.ca) > 0
      ORDER BY c.carte
    `

    const clientsArray = serializeJSON(clientsData)
    console.log(`✅ ${clientsArray.length} clients chargés`)

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

    // Étape 2: Calculer R, F, M pour chaque client
    const clients = clientsArray.map(client => {
      const lastDate = parseDate(client.last_purchase_date)
      const firstDate = parseDate(client.first_purchase_date)
      
      const recency = lastDate 
        ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        : 9999
      
      const daysSinceFirst = firstDate
        ? Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
        : 9999

      return {
        carte: client.carte,
        ville: client.ville || '-',
        recency,
        frequency: client.nb_transactions,
        monetary: client.ca_total,
        daysSinceFirst,
        firstDate: firstDate ? firstDate.toLocaleDateString('fr-FR') : '-',
        lastDate: lastDate ? lastDate.toLocaleDateString('fr-FR') : '-'
      }
    })

    // Étape 3: Calculer les quintiles (seuils pour R, F, M)
    const recencyValues = clients.map(c => c.recency).sort((a, b) => a - b)
    const frequencyValues = clients.map(c => c.frequency).sort((a, b) => b - a)
    const monetaryValues = clients.map(c => c.monetary).sort((a, b) => b - a)

    const getQuintileThresholds = (sortedValues) => {
      const len = sortedValues.length
      return [
        sortedValues[Math.floor(len * 0.2)],
        sortedValues[Math.floor(len * 0.4)],
        sortedValues[Math.floor(len * 0.6)],
        sortedValues[Math.floor(len * 0.8)]
      ]
    }

    const recencyThresholds = getQuintileThresholds(recencyValues)
    const frequencyThresholds = getQuintileThresholds(frequencyValues)
    const monetaryThresholds = getQuintileThresholds(monetaryValues)

    console.log('📈 Seuils Récence (jours):', recencyThresholds)
    console.log('📈 Seuils Fréquence (achats):', frequencyThresholds)
    console.log('📈 Seuils Monétaire (€):', monetaryThresholds)

    // Fonction pour obtenir le score de quintile
    const getQuintile = (value, thresholds, reverse = false) => {
      if (!reverse) {
        // Pour F et M: plus la valeur est haute, plus le score est haut
        if (value >= thresholds[0]) return 5 // Top 20%
        if (value >= thresholds[1]) return 4 // 20-40%
        if (value >= thresholds[2]) return 3 // 40-60%
        if (value >= thresholds[3]) return 2 // 60-80%
        return 1 // Bottom 20%
      } else {
        // Pour R: plus la valeur est basse, plus le score est haut
        if (value <= thresholds[0]) return 5 // Top 20% (plus récents)
        if (value <= thresholds[1]) return 4
        if (value <= thresholds[2]) return 3
        if (value <= thresholds[3]) return 2
        return 1 // Bottom 20% (plus anciens)
      }
    }

    // Étape 4: Assigner les scores et segments à chaque client
    clients.forEach(client => {
      client.R = getQuintile(client.recency, recencyThresholds, true)
      client.F = getQuintile(client.frequency, frequencyThresholds)
      client.M = getQuintile(client.monetary, monetaryThresholds)
      client.RFM = client.R * 100 + client.F * 10 + client.M

      // Segmentation RFM (ordre important: du plus spécifique au plus général)
      if (client.R === 5 && client.F === 5 && client.M === 5) {
        client.segment = 'Ultra Champions'
      } else if (client.R >= 4 && client.F >= 4 && client.M >= 4) {
        client.segment = 'Champions'
      } else if (client.R >= 4 && client.F === 3) {
        client.segment = 'Nouveaux'
      } else if (client.R === 3 && client.F === 3) {
        client.segment = 'Occasionnels'
      } else if (client.R >= 3 && client.F >= 3 && client.M >= 3) {
        client.segment = 'Loyaux'
      } else if (client.F >= 3 && client.R <= 2) {
        client.segment = 'À Risque'
      } else {
        client.segment = 'Perdus'
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
      },
      thresholds: {
        recency: recencyThresholds,
        frequency: frequencyThresholds,
        monetary: monetaryThresholds
      }
    })

  } catch (error) {
    console.error('❌ Erreur RFM:', error)
    return res.status(500).json({ 
      error: 'Erreur lors du calcul RFM',
      message: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
