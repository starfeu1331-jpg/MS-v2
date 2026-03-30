import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const { carte } = req.params

  if (!carte) {
    return res.status(400).json({ error: 'Numéro de carte requis' })
  }

  try {
    // Récupérer les infos client
    const clientQuery = `
      SELECT 
        carte::text,
        nom::text,
        prenom::text,
        civilite::text,
        sexe::text,
        email::text,
        telephone::text,
        nom_adresse::text,
        adresse::text,
        adresse_2::text,
        adresse_4::text,
        ville::text,
        cp::text,
        date_naissance::text,
        date_creation::text
      FROM clients
      WHERE carte = $1
      LIMIT 1
    `

    const clients = await prisma.$queryRawUnsafe(clientQuery, carte)
    
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' })
    }

    const client = clients[0]

    // Récupérer les tickets du client (groupés par facture)
    const ticketsQuery = `
      SELECT 
        facture::text,
        date::text,
        depot::text,
        SUM(ca)::numeric as ca_total,
        SUM(quantite)::int as quantite_totale,
        COUNT(*)::int as nb_lignes
      FROM transactions
      WHERE carte = $1
      GROUP BY facture, date, depot
      ORDER BY date DESC
    `

    const tickets = await prisma.$queryRawUnsafe(ticketsQuery, carte)

    // Statistiques agrégées du client
    const statsQuery = `
      SELECT
        COUNT(DISTINCT t.facture)::int as nb_tickets,
        COUNT(*)::int as nb_lignes,
        COALESCE(SUM(t.ca), 0)::numeric as ca_total,
        COALESCE(AVG(sub.ticket_ca), 0)::numeric as panier_moyen,
        MIN(t.date)::text as premiere_visite,
        MAX(t.date)::text as derniere_visite,
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as jours_depuis_dernier,
        COUNT(DISTINCT t.depot)::int as nb_depots,
        STRING_AGG(DISTINCT t.depot, ', ' ORDER BY t.depot) as depots_frequentes
      FROM transactions t
      LEFT JOIN LATERAL (
        SELECT SUM(t2.ca) as ticket_ca
        FROM transactions t2
        WHERE t2.carte = t.carte
        GROUP BY t2.facture
      ) sub ON true
      WHERE t.carte = $1
    `
    
    // Top produits du client
    const topProduitsQuery = `
      SELECT
        t.produit::text as id,
        COALESCE(p.designation, p.famille, t.produit)::text as nom,
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        SUM(t.quantite)::int as quantite,
        COUNT(DISTINCT t.facture)::int as nb_achats
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.carte = $1
      GROUP BY t.produit, p.designation, p.famille
      ORDER BY ca DESC
      LIMIT 10
    `

    // Dépôts fréquentés
    const depotsQuery = `
      SELECT
        t.depot::text,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_tickets
      FROM transactions t
      WHERE t.carte = $1 AND t.depot IS NOT NULL AND t.depot != ''
      GROUP BY t.depot
      ORDER BY nb_tickets DESC
    `

    // RFM simple (calcul local)
    const rfmQuery = `
      SELECT
        COUNT(DISTINCT t.facture)::int as frequency,
        COALESCE(SUM(t.ca), 0)::numeric as monetary,
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency
      FROM transactions t
      WHERE t.carte = $1
    `

    const [stats, topProduits, depots, rfm] = await Promise.all([
      prisma.$queryRawUnsafe(statsQuery, carte),
      prisma.$queryRawUnsafe(topProduitsQuery, carte),
      prisma.$queryRawUnsafe(depotsQuery, carte),
      prisma.$queryRawUnsafe(rfmQuery, carte)
    ])

    // Calculer le segment RFM simplifié
    const rfmData = rfm[0] || {}
    let segment = 'Inconnu'
    const r = Number(rfmData.recency) || 9999
    const f = Number(rfmData.frequency) || 0
    const m = Number(rfmData.monetary) || 0
    if (f === 0) segment = 'Inactif'
    else if (r <= 30 && f >= 10 && m >= 1000) segment = 'Champion'
    else if (r <= 60 && f >= 5) segment = 'Fidèle'
    else if (r <= 90 && f >= 3) segment = 'Prometteur'
    else if (r <= 180) segment = 'À développer'
    else if (r <= 365 && f >= 3) segment = 'À risque'
    else if (r > 365) segment = 'Perdu'
    else segment = 'Occasionnel'

    return res.status(200).json({
      client,
      tickets,
      total: tickets.length,
      stats: stats[0] || {},
      topProduits,
      depots,
      rfm: { ...rfmData, segment }
    })

  } catch (error) {
    console.error('Client tickets error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des tickets',
      details: error.message 
    })
  }
}
