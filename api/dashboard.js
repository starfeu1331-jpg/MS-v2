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
    
    // Si snapshot trouvé → retour immédiat
    if (snapshot && snapshot.length > 0) {
      const data = snapshot[0]
      
      // Construire la réponse depuis snapshot
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
          message: 'Données pré-calculées'
        }
      }
      
      return res.status(200).json(serializeJSON(response))
    }
    
    // ========================================================================
    // FALLBACK : CALCUL EN TEMPS RÉEL (périodes custom)
    // ========================================================================
    console.log(`⚠️ Snapshot non trouvé pour ${periodType}=${periodValue}, calcul en temps réel...`)
    
    // Construction du WHERE clause
    let whereClause = "depot NOT IN ('1', '41', '42') AND ca > 0"
    if (startDate && endDate) {
      whereClause = `date >= '${startDate}' AND date <= '${endDate}' AND ${whereClause}`
    } else if (months) {
      const monthsNum = parseInt(months)
      const endDateCalc = new Date()
      const startDateCalc = new Date()
      startDateCalc.setMonth(startDateCalc.getMonth() - monthsNum)
      const startStr = startDateCalc.toISOString().split('T')[0]
      const endStr = endDateCalc.toISOString().split('T')[0]
      whereClause = `date >= '${startStr}' AND date <= '${endStr}' AND ${whereClause}`
    } else if (year && year !== 'all') {
      whereClause = `date >= '${year}-01-01' AND date <= '${year}-12-31' AND ${whereClause}`
    }
    
    // Requête optimisée : KPIs + Stats de base en une seule requête
    const [kpisData] = await prisma.$queryRawUnsafe(`
      WITH base_stats AS (
        SELECT 
          COUNT(DISTINCT carte)::int as total_clients,
          COUNT(DISTINCT facture)::int as total_tickets,
          SUM(ca)::numeric as total_ca,
          (SUM(ca) / NULLIF(COUNT(DISTINCT facture), 0))::numeric as panier_moyen
        FROM transactions
        WHERE ${whereClause}
      )
      SELECT * FROM base_stats
    `)
    
    // Requêtes parallèles pour les tops (optimisées avec LIMIT)
    const [topProduits, topMagasins, topClients, evolutionMensuelle] = await Promise.all([
      // Top 10 produits
      prisma.$queryRawUnsafe(`
        SELECT 
          p.id as code,
          COALESCE(p.nom, p.id) as nom,
          p.famille,
          SUM(t.ca)::numeric as ca,
          SUM(t.quantite)::numeric as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE ${whereClause}
        GROUP BY p.id, p.nom, p.famille
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Top 10 magasins
      prisma.$queryRawUnsafe(`
        SELECT 
          m.code,
          m.nom,
          SUM(t.ca)::numeric as ca,
          COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE ${whereClause}
        GROUP BY m.code, m.nom
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Top 10 clients
      prisma.$queryRawUnsafe(`
        SELECT 
          t.carte,
          SUM(t.ca)::numeric as ca,
          COUNT(DISTINCT t.facture)::int as nb_commandes
        FROM transactions t
        WHERE ${whereClause} AND t.carte IS NOT NULL AND t.carte != '0'
        GROUP BY t.carte
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Évolution mensuelle (max 24 mois)
      prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::numeric as ca,
          COUNT(DISTINCT facture)::int as tickets
        FROM transactions
        WHERE ${whereClause}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois DESC
        LIMIT 24
      `)
    ])
    
    // Construire la réponse (stats clients simplifiées)
    const data = {
      period: {
        type: periodType,
        value: periodValue,
        calculatedAt: new Date()
      },
      kpis: {
        totalCA: parseFloat(kpisData.total_ca) || 0,
        totalCAMagasin: parseFloat(kpisData.total_ca) || 0,
        totalCAWeb: 0,
        totalTickets: kpisData.total_tickets || 0,
        totalTicketsMag: kpisData.total_tickets || 0,
        totalTicketsWeb: 0,
        totalClients: kpisData.total_clients || 0,
        panierMoyen: parseFloat(kpisData.panier_moyen) || 0,
        panierMoyenMag: parseFloat(kpisData.panier_moyen) || 0,
        panierMoyenWeb: 0
      },
      statsClients: {
        total: kpisData.total_clients || 0,
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
      topProduits: topProduits.map(p => ({
        code: p.code,
        nom: p.nom,
        famille: p.famille,
        sous_famille: null,
        ca: parseFloat(p.ca) || 0,
        volume: parseFloat(p.volume) || 0
      })),
      topMagasins: topMagasins.map(m => ({
        code: m.code,
        nom: m.nom,
        zone: null,
        ca: parseFloat(m.ca) || 0,
        volume: 0,
        nbTickets: m.nb_tickets,
        panierMoyen: m.nb_tickets > 0 ? parseFloat(m.ca) / m.nb_tickets : 0
      })),
      topClients: topClients.map(c => ({
        carte: c.carte,
        ville: null,
        ca: parseFloat(c.ca) || 0,
        nbCommandes: c.nb_commandes
      })),
      evolutionMensuelle: evolutionMensuelle.reverse().map(e => ({
        mois: e.mois,
        ca: parseFloat(e.ca) || 0,
        tickets: e.tickets
      })),
      _meta: {
        source: 'realtime',
        calculatedAt: new Date(),
        message: 'Calcul en temps réel - Pour de meilleures performances, exécutez calculate-snapshots.py'
      }
    }
    
    return res.status(200).json(serializeJSON(data))
    
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
