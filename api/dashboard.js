const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

module.exports = async function handler(req, res) {
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

  const { year, startDate, endDate, months } = req.query
  
  try {
    // Test de connexion
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured')
    }
    
    let periodType, periodValue
    
    // Déterminer le type de période
    if (startDate && endDate) {
      periodType = 'custom'
      periodValue = `${startDate}_${endDate}`
    } else if (months) {
      periodType = 'months'
      periodValue = months
    } else if (year === 'all') {
      periodType = 'all'
      periodValue = 'all'
    } else {
      periodType = 'year'
      periodValue = year
    }
    
    // LECTURE DEPUIS LES SNAPSHOTS PRÉ-CALCULÉS
    const snapshot = await prisma.$queryRawUnsafe(`
      SELECT 
        period_type,
        period_value,
        total_ca,
        total_ca_magasin,
        total_ca_web,
        total_tickets,
        total_tickets_mag,
        total_tickets_web,
        total_clients,
        panier_moyen,
        panier_moyen_mag,
        panier_moyen_web,
        stats_clients,
        top_produits,
        top_magasins,
        top_clients,
        evolution_mensuelle,
        calculated_at
      FROM dashboard_snapshots
      WHERE period_type = '${periodType}' AND period_value = '${periodValue}'
      LIMIT 1
    `)
    
    if (!snapshot || snapshot.length === 0) {
      // Fallback : calculer en temps réel si snapshot pas trouvé
      return res.status(404).json({ 
        error: 'Snapshot non trouvé',
        message: `Aucun snapshot pour ${periodType}=${periodValue}. Exécutez calculate-snapshots.py`,
        available: await getAvailableSnapshots()
      })
    }
    
    const data = snapshot[0]
    
    // Construire la réponse
    const response = {
      period: {
        type: periodType,
        value: periodValue,
        calculatedAt: data.calculated_at
      },
      kpis: {
        totalCA: parseFloat(data.total_ca) || 0,
        totalCAMagasin: parseFloat(data.total_ca_magasin) || 0,
        totalCAWeb: parseFloat(data.total_ca_web) || 0,
        totalTickets: data.total_tickets || 0,
        totalTicketsMag: data.total_tickets_mag || 0,
        totalTicketsWeb: data.total_tickets_web || 0,
        totalClients: data.total_clients || 0,
        panierMoyen: parseFloat(data.panier_moyen) || 0,
        panierMoyenMag: parseFloat(data.panier_moyen_mag) || 0,
        panierMoyenWeb: parseFloat(data.panier_moyen_web) || 0
      },
      statsClients: data.stats_clients,
      topProduits: data.top_produits,
      topMagasins: data.top_magasins,
      topClients: data.top_clients,
      evolutionMensuelle: data.evolution_mensuelle,
      _meta: {
        source: 'snapshot',
        calculatedAt: data.calculated_at,
        message: 'Données pré-calculées - Mise à jour quotidienne'
      }
    }
    
    res.status(200).json(serializeJSON(response))
    
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

// Helper pour lister les snapshots disponibles
async function getAvailableSnapshots() {
  try {
    const snapshots = await prisma.$queryRaw`
      SELECT period_type, period_value, calculated_at
      FROM dashboard_snapshots
      ORDER BY period_type, period_value
    `
    return snapshots.map(s => `${s.period_type}=${s.period_value}`)
  } catch (e) {
    return []
  }
}
