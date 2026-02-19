import { PrismaClient } from '@prisma/client'

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
    
    let periodType, periodValue, pStartDate = null, pEndDate = null
    
    // Déterminer le type de période
    if (startDate && endDate) {
      periodType = 'custom'
      periodValue = `${startDate}_${endDate}`
      pStartDate = startDate
      pEndDate = endDate
    } else if (months) {
      periodType = 'months'
      periodValue = months
      // Calculer les dates pour les X derniers mois
      const endDateCalc = new Date()
      const startDateCalc = new Date()
      startDateCalc.setMonth(startDateCalc.getMonth() - parseInt(months))
      pStartDate = startDateCalc.toISOString().split('T')[0]
      pEndDate = endDateCalc.toISOString().split('T')[0]
    } else if (year === 'all') {
      periodType = 'all'
      periodValue = 'all'
    } else {
      periodType = 'year'
      periodValue = year
    }
    
    // ========================================================================
    // APPEL À LA FONCTION SQL POSTGRESQL
    // ========================================================================
    // Tout le calcul se fait côté PostgreSQL, l'API est juste un proxy
    
    const result = await prisma.$queryRawUnsafe(`
      SELECT get_dashboard(
        '${periodType}'::text,
        '${periodValue}'::text,
        ${pStartDate ? `'${pStartDate}'::date` : 'NULL'},
        ${pEndDate ? `'${pEndDate}'::date` : 'NULL'}
      ) as data
    `)
    
    if (!result || result.length === 0 || !result[0].data) {
      return res.status(500).json({ 
        error: 'Erreur lors du calcul dashboard',
        message: 'La fonction SQL n\'a pas retourné de résultat'
      })
    }
    
    const dashboardData = result[0].data
    
    // Formater la réponse pour compatibilité frontend
    const response = {
      period: {
        type: periodType,
        value: periodValue,
        calculatedAt: dashboardData.calculatedAt || dashboardData.calculated_at
      },
      kpis: {
        totalCA: parseFloat(dashboardData.kpis?.totalCA || dashboardData.total_ca) || 0,
        totalCAMagasin: parseFloat(dashboardData.kpis?.totalCA || dashboardData.total_ca) || 0,
        totalCAWeb: 0,
        totalTickets: dashboardData.kpis?.totalTickets || dashboardData.total_tickets || 0,
        totalTicketsMag: dashboardData.kpis?.totalTickets || dashboardData.total_tickets || 0,
        totalTicketsWeb: 0,
        totalClients: dashboardData.kpis?.totalClients || dashboardData.total_clients || 0,
        panierMoyen: parseFloat(dashboardData.kpis?.panierMoyen || dashboardData.panier_moyen) || 0,
        panierMoyenMag: parseFloat(dashboardData.kpis?.panierMoyen || dashboardData.panier_moyen) || 0,
        panierMoyenWeb: 0
      },
      statsClients: dashboardData.stats_clients || {
        total: dashboardData.kpis?.totalClients || 0,
        hommes: 0,
        femmes: 0,
        avecNom: 0,
        avecPrenom: 0,
        avecEmail: 0,
        avecTelephone: 0,
        avecAge: 0,
        ageMoyen: 0,
        pctHommes: 0,
        pctFemmes: 0,
        pctEmail: 0,
        pctTelephone: 0,
        pctAge: 0
      },
      topProduits: dashboardData.topProduits || dashboardData.top_produits || [],
      topMagasins: dashboardData.topMagasins || dashboardData.top_magasins || [],
      topClients: dashboardData.topClients || dashboardData.top_clients || [],
      evolutionMensuelle: dashboardData.evolutionMensuelle || dashboardData.evolution_mensuelle || [],
      _meta: {
        source: dashboardData.source || 'sql-function',
        calculatedAt: dashboardData.calculatedAt || dashboardData.calculated_at || new Date(),
        message: dashboardData.source === 'snapshot' 
          ? 'Données pré-calculées (snapshot)' 
          : 'Calcul optimisé PostgreSQL (temps réel)',
        engine: 'PostgreSQL Functions'
      }
    }
    
    return res.status(200).json(serializeJSON(response))
    
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
