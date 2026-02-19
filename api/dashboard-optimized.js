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
    
    let whereClause = "depot NOT IN ('1', '41', '42') AND ca > 0"
    let dateFilter = ""
    
    // Gestion des périodes
    if (startDate && endDate) {
      dateFilter = `date >= '${startDate}' AND date <= '${endDate}' AND `
    } else if (months) {
      const monthsNum = parseInt(months)
      const endDateCalc = new Date()
      const startDateCalc = new Date()
      startDateCalc.setMonth(startDateCalc.getMonth() - monthsNum)
      const startDateStr = startDateCalc.toISOString().split('T')[0]
      const endDateStr = endDateCalc.toISOString().split('T')[0]
      dateFilter = `date >= '${startDateStr}' AND date <= '${endDateStr}' AND `
    } else if (year === 'all') {
      // OPTIMISATION: Pour "all", on limite aux 2 dernières années pour éviter le timeout
      dateFilter = `date >= '2024-01-01' AND `
    } else {
      const startDateYear = `${year}-01-01`
      const endDateYear = `${year}-12-31`
      dateFilter = `date >= '${startDateYear}' AND date <= '${endDateYear}' AND `
    }
    
    const fullWhere = dateFilter + whereClause
    
    // OPTIMISATION: Une seule requête avec CTEs pour tous les KPIs
    const results = await prisma.$queryRawUnsafe(`
      WITH 
      -- KPIs de base
      base_kpis AS (
        SELECT 
          COUNT(DISTINCT carte)::int as total_clients,
          COUNT(DISTINCT facture)::int as total_tickets,
          SUM(ca)::float as total_ca,
          (SUM(ca) / NULLIF(COUNT(DISTINCT facture), 0))::float as panier_moyen
        FROM transactions
        WHERE ${fullWhere}
      ),
      -- Stats clients (optimisé avec EXISTS au lieu de JOIN)
      stats_clients AS (
        SELECT 
          COUNT(DISTINCT c.carte)::int as total,
          COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
          COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
          COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
          COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
          COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
          COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone,
          COUNT(DISTINCT CASE WHEN c.date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN c.carte END)::int as avec_age,
          ROUND(AVG(CASE WHEN c.date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' 
            THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.date_naissance::date)) END))::int as age_moyen
        FROM clients c
        WHERE EXISTS (
          SELECT 1 FROM transactions t 
          WHERE t.carte = c.carte AND ${fullWhere}
        )
      )
      SELECT 
        (SELECT total_clients FROM base_kpis) as total_clients,
        (SELECT total_tickets FROM base_kpis) as total_tickets,
        (SELECT total_ca FROM base_kpis) as total_ca,
        (SELECT panier_moyen FROM base_kpis) as panier_moyen,
        (SELECT total FROM stats_clients) as stats_total,
        (SELECT hommes FROM stats_clients) as stats_hommes,
        (SELECT femmes FROM stats_clients) as stats_femmes,
        (SELECT avec_nom FROM stats_clients) as stats_avec_nom,
        (SELECT avec_prenom FROM stats_clients) as stats_avec_prenom,
        (SELECT avec_email FROM stats_clients) as stats_avec_email,
        (SELECT avec_telephone FROM stats_clients) as stats_avec_telephone,
        (SELECT avec_age FROM stats_clients) as stats_avec_age,
        (SELECT age_moyen FROM stats_clients) as stats_age_moyen
    `)
    
    const mainData = results[0] || {}
    
    // Top produits (en parallèle)
    const [topProduits, topMagasins, topClients, evolutionMensuelle] = await Promise.all([
      // Top produits
      prisma.$queryRawUnsafe(`
        SELECT 
          p.id as code,
          COALESCE(p.nom, p.id) as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE ${fullWhere}
        GROUP BY p.id, p.nom, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Top magasins
      prisma.$queryRawUnsafe(`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          (SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0))::float as panier_moyen
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE ${fullWhere}
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Top clients
      prisma.$queryRawUnsafe(`
        SELECT 
          t.carte,
          c.ville,
          SUM(t.ca)::float as ca,
          COUNT(DISTINCT t.facture)::int as nb_commandes
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE ${fullWhere} AND t.carte IS NOT NULL AND t.carte != '0'
        GROUP BY t.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `),
      
      // Évolution mensuelle
      prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::float as ca,
          COUNT(DISTINCT facture)::int as tickets
        FROM transactions
        WHERE ${fullWhere}
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `)
    ])
    
    // Construire la réponse
    const response = {
      period: year === 'all' ? { type: 'all', label: 'Toutes périodes (2024+)' } :
              months ? { type: 'months', value: parseInt(months) } :
              startDate && endDate ? { type: 'custom', startDate, endDate } :
              { type: 'year', value: parseInt(year) },
      kpis: {
        totalCA: mainData.total_ca || 0,
        totalCAMagasin: mainData.total_ca || 0,
        totalCAWeb: 0,
        totalTickets: mainData.total_tickets || 0,
        totalTicketsMag: mainData.total_tickets || 0,
        totalTicketsWeb: 0,
        totalClients: mainData.total_clients || 0,
        panierMoyen: mainData.panier_moyen || 0,
        panierMoyenMag: mainData.panier_moyen || 0,
        panierMoyenWeb: 0
      },
      statsClients: {
        total: mainData.stats_total || 0,
        hommes: mainData.stats_hommes || 0,
        femmes: mainData.stats_femmes || 0,
        avecNom: mainData.stats_avec_nom || 0,
        avecPrenom: mainData.stats_avec_prenom || 0,
        avecEmail: mainData.stats_avec_email || 0,
        avecTelephone: mainData.stats_avec_telephone || 0,
        avecAge: mainData.stats_avec_age || 0,
        ageMoyen: mainData.stats_age_moyen || 0,
        pctHommes: mainData.stats_total > 0 ? (mainData.stats_hommes / mainData.stats_total * 100) : 0,
        pctFemmes: mainData.stats_total > 0 ? (mainData.stats_femmes / mainData.stats_total * 100) : 0,
        pctEmail: mainData.stats_total > 0 ? (mainData.stats_avec_email / mainData.stats_total * 100) : 0,
        pctTelephone: mainData.stats_total > 0 ? (mainData.stats_avec_telephone / mainData.stats_total * 100) : 0,
        pctAge: mainData.stats_total > 0 ? (mainData.stats_avec_age / mainData.stats_total * 100) : 0
      },
      topProduits: topProduits.map(p => ({
        code: p.code,
        nom: p.nom,
        famille: p.famille,
        sous_famille: p.sous_famille,
        ca: p.ca,
        volume: p.volume
      })),
      topMagasins: topMagasins.map(m => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ca: m.ca,
        volume: m.volume,
        nbTickets: m.nb_tickets,
        panierMoyen: m.panier_moyen
      })),
      topClients: topClients.map(c => ({
        carte: c.carte,
        ville: c.ville,
        ca: c.ca,
        nbCommandes: c.nb_commandes
      })),
      evolutionMensuelle: evolutionMensuelle.map(e => ({
        mois: e.mois,
        ca: e.ca,
        tickets: e.tickets
      }))
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
