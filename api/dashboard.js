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
    
    // Gestion des périodes personnalisées (startDate/endDate)
    if (startDate && endDate) {
      const kpis = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT carte)::int as "totalClients",
          COUNT(DISTINCT facture)::int as "totalTickets",
          SUM(ca)::float as "totalCA",
          (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
        FROM transactions
        WHERE date >= '${startDate}' AND date <= '${endDate}' AND depot NOT IN ('1', '41', '42') AND ca > 0
      `)
      
      const statsClients = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT c.carte)::int as total,
          COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
          COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
          COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
          COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
          COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
          COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE t.date >= '${startDate}' AND t.date <= '${endDate}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      `)
      
      const topProduits = await prisma.$queryRawUnsafe(`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.date >= '${startDate}' AND t.date <= '${endDate}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const topMagasins = await prisma.$queryRawUnsafe(`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume,
          COUNT(DISTINCT t.facture)::int as "nbTickets",
          (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as "panierMoyen"
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE t.date >= '${startDate}' AND t.date <= '${endDate}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `)
      
      const topClients = await prisma.$queryRawUnsafe(`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca)::float as ca,
          COUNT(DISTINCT t.facture)::int as "nbCommandes"
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        WHERE t.date >= '${startDate}' AND t.date <= '${endDate}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const evolutionMensuelle = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::float as ca,
          COUNT(*)::int as tickets
        FROM transactions
        WHERE date >= '${startDate}' AND date <= '${endDate}' AND depot NOT IN ('1', '41', '42') AND ca > 0
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `)
      
      return res.status(200).json(serializeJSON({
        period: { type: 'custom', startDate, endDate },
        kpis: {
          totalCA: (kpis[0]?.totalCA) || 0,
          totalCAMagasin: (kpis[0]?.totalCA) || 0,
          totalCAWeb: 0,
          totalTickets: (kpis[0]?.totalTickets) || 0,
          totalTicketsMag: (kpis[0]?.totalTickets) || 0,
          totalTicketsWeb: 0,
          totalClients: (kpis[0]?.totalClients) || 0,
          panierMoyen: (kpis[0]?.panierMoyen) || 0,
          panierMoyenMag: (kpis[0]?.panierMoyen) || 0,
          panierMoyenWeb: 0
        },
        statsClients: {
          total: (statsClients[0]?.total) || 0,
          hommes: (statsClients[0]?.hommes) || 0,
          femmes: (statsClients[0]?.femmes) || 0,
          avecNom: (statsClients[0]?.avec_nom) || 0,
          avecPrenom: (statsClients[0]?.avec_prenom) || 0,
          avecEmail: (statsClients[0]?.avec_email) || 0,
          avecTelephone: (statsClients[0]?.avec_telephone) || 0,
          pctHommes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.hommes) / (statsClients[0]?.total) * 100) : 0,
          pctFemmes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.femmes) / (statsClients[0]?.total) * 100) : 0,
          pctEmail: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_email) / (statsClients[0]?.total) * 100) : 0,
          pctTelephone: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_telephone) / (statsClients[0]?.total) * 100) : 0
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
          nbTickets: m.nbTickets,
          panierMoyen: m.panierMoyen
        })),
        topClients: topClients.map(c => ({
          carte: c.carte,
          ville: c.ville,
          ca: c.ca,
          nbCommandes: c.nbCommandes
        })),
        evolutionMensuelle: evolutionMensuelle.map(e => ({
          mois: e.mois,
          ca: e.ca,
          tickets: e.tickets
        }))
      }))
    }
    
    // Gestion des "X derniers mois"
    if (months) {
      const monthsNum = parseInt(months)
      const endDateCalc = new Date()
      const startDateCalc = new Date()
      startDateCalc.setMonth(startDateCalc.getMonth() - monthsNum)
      
      const startDateStr = startDateCalc.toISOString().split('T')[0]
      const endDateStr = endDateCalc.toISOString().split('T')[0]
      
      const kpis = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT carte)::int as "totalClients",
          COUNT(DISTINCT facture)::int as "totalTickets",
          SUM(ca)::float as "totalCA",
          (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
        FROM transactions
        WHERE date >= '${startDateStr}' AND date <= '${endDateStr}' AND depot NOT IN ('1', '41', '42') AND ca > 0
      `)
      
      const statsClients = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT c.carte)::int as total,
          COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
          COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
          COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
          COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
          COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
          COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE t.date >= '${startDateStr}' AND t.date <= '${endDateStr}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      `)
      
      const topProduits = await prisma.$queryRawUnsafe(`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.date >= '${startDateStr}' AND t.date <= '${endDateStr}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const topMagasins = await prisma.$queryRawUnsafe(`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume,
          COUNT(DISTINCT t.facture)::int as "nbTickets",
          (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as "panierMoyen"
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE t.date >= '${startDateStr}' AND t.date <= '${endDateStr}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `)
      
      const topClients = await prisma.$queryRawUnsafe(`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca)::float as ca,
          COUNT(DISTINCT t.facture)::int as "nbCommandes"
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        WHERE t.date >= '${startDateStr}' AND t.date <= '${endDateStr}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const evolutionMensuelle = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::float as ca,
          COUNT(*)::int as tickets
        FROM transactions
        WHERE date >= '${startDateStr}' AND date <= '${endDateStr}' AND depot NOT IN ('1', '41', '42') AND ca > 0
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `)
      
      return res.status(200).json(serializeJSON({
        period: { type: 'months', value: monthsNum },
        kpis: {
          totalCA: (kpis[0]?.totalCA) || 0,
          totalCAMagasin: (kpis[0]?.totalCA) || 0,
          totalCAWeb: 0,
          totalTickets: (kpis[0]?.totalTickets) || 0,
          totalTicketsMag: (kpis[0]?.totalTickets) || 0,
          totalTicketsWeb: 0,
          totalClients: (kpis[0]?.totalClients) || 0,
          panierMoyen: (kpis[0]?.panierMoyen) || 0,
          panierMoyenMag: (kpis[0]?.panierMoyen) || 0,
          panierMoyenWeb: 0
        },
        statsClients: {
          total: (statsClients[0]?.total) || 0,
          hommes: (statsClients[0]?.hommes) || 0,
          femmes: (statsClients[0]?.femmes) || 0,
          avecNom: (statsClients[0]?.avec_nom) || 0,
          avecPrenom: (statsClients[0]?.avec_prenom) || 0,
          avecEmail: (statsClients[0]?.avec_email) || 0,
          avecTelephone: (statsClients[0]?.avec_telephone) || 0,
          pctHommes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.hommes) / (statsClients[0]?.total) * 100) : 0,
          pctFemmes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.femmes) / (statsClients[0]?.total) * 100) : 0,
          pctEmail: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_email) / (statsClients[0]?.total) * 100) : 0,
          pctTelephone: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_telephone) / (statsClients[0]?.total) * 100) : 0
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
          nbTickets: m.nbTickets,
          panierMoyen: m.panierMoyen
        })),
        topClients: topClients.map(c => ({
          carte: c.carte,
          ville: c.ville,
          ca: c.ca,
          nbCommandes: c.nbCommandes
        })),
        evolutionMensuelle: evolutionMensuelle.map(e => ({
          mois: e.mois,
          ca: e.ca,
          tickets: e.tickets
        }))
      }))
    }
    
    // === SECTION ALL ===
    if (year === 'all') {
      const kpis = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT carte)::int as "totalClients",
          COUNT(DISTINCT facture)::int as "totalTickets",
          SUM(ca)::float as "totalCA",
          (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
        FROM transactions
        WHERE depot NOT IN ('1', '41', '42') AND ca > 0
      `)
      
      const statsClients = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT c.carte)::int as total,
          COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
          COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
          COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
          COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
          COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
          COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      `)
      
      const topProduits = await prisma.$queryRawUnsafe(`
        SELECT 
          p.id as code,
          p.id as nom,
          p.famille,
          p.sous_famille,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY p.id, p.famille, p.sous_famille
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const topMagasins = await prisma.$queryRawUnsafe(`
        SELECT 
          m.code,
          m.nom,
          m.zone,
          SUM(t.ca)::float as ca,
          SUM(t.quantite)::float as volume,
          COUNT(DISTINCT t.facture)::int as "nbTickets",
          (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as "panierMoyen"
        FROM transactions t
        JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
        WHERE t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY m.code, m.nom, m.zone
        ORDER BY ca DESC
        LIMIT 5
      `)
      
      const topClients = await prisma.$queryRawUnsafe(`
        SELECT 
          c.carte,
          c.ville,
          SUM(t.ca)::float as ca,
          COUNT(DISTINCT t.facture)::int as "nbCommandes"
        FROM transactions t
        JOIN clients c ON t.carte = c.carte
        WHERE t.depot NOT IN ('1', '41', '42') AND t.ca > 0
        GROUP BY c.carte, c.ville
        ORDER BY ca DESC
        LIMIT 10
      `)
      
      const evolutionMensuelle = await prisma.$queryRawUnsafe(`
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as mois,
          SUM(ca)::float as ca,
          COUNT(*)::int as tickets
        FROM transactions
        WHERE depot NOT IN (\'1\', \'41\', \'42\') AND ca > 0
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY mois
      `)
      
      return res.status(200).json(serializeJSON({
        year: 'all',
        kpis: {
          totalCA: kpis[0]?.totalCA || 0,
          totalCAMagasin: kpis[0]?.totalCA || 0,
          totalCAWeb: 0,
          totalTickets: kpis[0]?.totalTickets || 0,
          totalTicketsMag: kpis[0]?.totalTickets || 0,
          totalTicketsWeb: 0,
          totalClients: kpis[0]?.totalClients || 0,
          panierMoyen: kpis[0]?.panierMoyen || 0,
          panierMoyenMag: kpis[0]?.panierMoyen || 0,
          panierMoyenWeb: 0
        },
        statsClients: {
          total: statsClients[0]?.total || 0,
          hommes: statsClients[0]?.hommes || 0,
          femmes: statsClients[0]?.femmes || 0,
          avecNom: statsClients[0]?.avec_nom || 0,
          avecPrenom: statsClients[0]?.avec_prenom || 0,
          avecEmail: statsClients[0]?.avec_email || 0,
          avecTelephone: statsClients[0]?.avec_telephone || 0,
          pctHommes: statsClients[0]?.total > 0 ? (statsClients[0]?.hommes / statsClients[0]?.total * 100) : 0,
          pctFemmes: statsClients[0]?.total > 0 ? (statsClients[0]?.femmes / statsClients[0]?.total * 100) : 0,
          pctEmail: statsClients[0]?.total > 0 ? (statsClients[0]?.avec_email / statsClients[0]?.total * 100) : 0,
          pctTelephone: statsClients[0]?.total > 0 ? (statsClients[0]?.avec_telephone / statsClients[0]?.total * 100) : 0
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
          nbTickets: m.nbTickets,
          panierMoyen: m.panierMoyen
        })),
        topClients: topClients.map(c => ({
          carte: c.carte,
          ville: c.ville,
          ca: c.ca,
          nbCommandes: c.nbCommandes
        })),
        evolutionMensuelle: evolutionMensuelle.map(e => ({
          mois: e.mois,
          ca: e.ca,
          tickets: e.tickets
        }))
      }))
    }
    
    // Année spécifique
    const startDateYear = `${year}-01-01`
    const endDateYear = `${year}-12-31`
    
    const kpis = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT carte)::int as "totalClients",
        COUNT(DISTINCT facture)::int as "totalTickets",
        SUM(ca)::float as "totalCA",
        (SUM(ca) / COUNT(DISTINCT facture))::float as "panierMoyen"
      FROM transactions
      WHERE date >= '${startDateYear}' AND date <= '${endDateYear}' AND depot NOT IN ('1', '41', '42') AND ca > 0
    `)
    
    // Statistiques qualité des données clients
    const statsClients = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT c.carte)::int as total,
        COUNT(DISTINCT CASE WHEN c.sexe = 'H' THEN c.carte END)::int as hommes,
        COUNT(DISTINCT CASE WHEN c.sexe = 'F' THEN c.carte END)::int as femmes,
        COUNT(DISTINCT CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN c.carte END)::int as avec_nom,
        COUNT(DISTINCT CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN c.carte END)::int as avec_prenom,
        COUNT(DISTINCT CASE WHEN c.email IS NOT NULL AND c.email != '' THEN c.carte END)::int as avec_email,
        COUNT(DISTINCT CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN c.carte END)::int as avec_telephone
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE t.date >= '${startDateYear}' AND t.date <= '${endDateYear}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
    `)
    
    const topProduits = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id as code,
        p.id as nom,
        p.famille,
        p.sous_famille,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.date >= '${startDateYear}' AND t.date <= '${endDateYear}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      GROUP BY p.id, p.famille, p.sous_famille
      ORDER BY ca DESC
      LIMIT 10
    `)
    
    const topMagasins = await prisma.$queryRawUnsafe(`
      SELECT 
        m.code,
        m.nom,
        m.zone,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume,
        COUNT(DISTINCT t.facture)::int as "nbTickets",
        (SUM(t.ca) / COUNT(DISTINCT t.facture))::float as "panierMoyen"
      FROM transactions t
      JOIN magasins m ON (t.depot = m.code OR t.depot = CONCAT('M', m.code) OR REPLACE(t.depot, 'M', '') = m.code)
      WHERE t.date >= '${startDateYear}' AND t.date <= '${endDateYear}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      GROUP BY m.code, m.nom, m.zone
      ORDER BY ca DESC
      LIMIT 5
    `)
    
    const topClients = await prisma.$queryRawUnsafe(`
      SELECT 
        c.carte,
        c.ville,
        SUM(t.ca)::float as ca,
        COUNT(DISTINCT t.facture)::int as "nbCommandes"
      FROM transactions t
      JOIN clients c ON t.carte = c.carte
      WHERE t.date >= '${startDateYear}' AND t.date <= '${endDateYear}' AND t.depot NOT IN ('1', '41', '42') AND t.ca > 0
      GROUP BY c.carte, c.ville
      ORDER BY ca DESC
      LIMIT 10
    `)
    
    const evolutionMensuelle = await prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as mois,
        SUM(ca)::float as ca,
        COUNT(*)::int as tickets
      FROM transactions
      WHERE date >= '${startDateYear}' AND date <= '${endDateYear}' AND depot NOT IN ('1', '41', '42') AND ca > 0
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY mois
    `)
    
    res.status(200).json(serializeJSON({
      year: parseInt(year),
      kpis: {
        totalCA: (kpis[0]?.totalCA) || 0,
        totalCAMagasin: (kpis[0]?.totalCA) || 0,
        totalCAWeb: 0,
        totalTickets: (kpis[0]?.totalTickets) || 0,
        totalTicketsMag: (kpis[0]?.totalTickets) || 0,
        totalTicketsWeb: 0,
        totalClients: (kpis[0]?.totalClients) || 0,
        panierMoyen: (kpis[0]?.panierMoyen) || 0,
        panierMoyenMag: (kpis[0]?.panierMoyen) || 0,
        panierMoyenWeb: 0
      },
      statsClients: {
        total: (statsClients[0]?.total) || 0,
        hommes: (statsClients[0]?.hommes) || 0,
        femmes: (statsClients[0]?.femmes) || 0,
        avecNom: (statsClients[0]?.avec_nom) || 0,
        avecPrenom: (statsClients[0]?.avec_prenom) || 0,
        avecEmail: (statsClients[0]?.avec_email) || 0,
        avecTelephone: (statsClients[0]?.avec_telephone) || 0,
        pctHommes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.hommes) / (statsClients[0]?.total) * 100) : 0,
        pctFemmes: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.femmes) / (statsClients[0]?.total) * 100) : 0,
        pctEmail: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_email) / (statsClients[0]?.total) * 100) : 0,
        pctTelephone: (statsClients[0]?.total) > 0 ? ((statsClients[0]?.avec_telephone) / (statsClients[0]?.total) * 100) : 0
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
        nbTickets: m.nbTickets,
        panierMoyen: m.panierMoyen
      })),
      topClients: topClients.map(c => ({
        carte: c.carte,
        ville: c.ville,
        ca: c.ca,
        nbCommandes: c.nbCommandes
      })),
      evolutionMensuelle: evolutionMensuelle.map(e => ({
        mois: e.mois,
        ca: e.ca,
        tickets: e.tickets
      }))
    }))
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
