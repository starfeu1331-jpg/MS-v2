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
        COALESCE(SUM(t.ca) / NULLIF(COUNT(DISTINCT t.facture), 0), 0)::numeric as panier_moyen,
        MIN(t.date)::text as premiere_visite,
        MAX(t.date)::text as derniere_visite,
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as jours_depuis_dernier,
        COUNT(DISTINCT t.depot)::int as nb_depots,
        STRING_AGG(DISTINCT t.depot, ', ' ORDER BY t.depot) as depots_frequentes
      FROM transactions t
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

    // RFM pré-calculé en BDD (mêmes règles que le module Segmentation RFM)
    const rfmQuery = `
      SELECT
        c.rfm_r::int       as r,
        c.rfm_f::int       as f,
        c.rfm_m::int       as m,
        c.rfm_score::int   as score,
        c.rfm_segment::text as segment,
        c.rfm_recency::int as recency,
        c.rfm_frequency::int as frequency,
        c.rfm_monetary::numeric as monetary,
        c.rfm_last_date::text as last_date,
        c.rfm_first_date::text as first_date
      FROM clients c
      WHERE c.carte = $1
    `

    const [stats, topProduits, depots, rfm] = await Promise.all([
      prisma.$queryRawUnsafe(statsQuery, carte),
      prisma.$queryRawUnsafe(topProduitsQuery, carte),
      prisma.$queryRawUnsafe(depotsQuery, carte),
      prisma.$queryRawUnsafe(rfmQuery, carte)
    ])

    const rfmRow = rfm[0] || {}
    const rfmData = {
      r: rfmRow.r ?? null,
      f: rfmRow.f ?? null,
      m: rfmRow.m ?? null,
      score: rfmRow.score ?? null,
      segment: rfmRow.segment || 'Inconnu',
      recency: rfmRow.recency ?? null,
      frequency: rfmRow.frequency ?? null,
      monetary: Number(rfmRow.monetary) || 0,
      last_date: rfmRow.last_date || null,
      first_date: rfmRow.first_date || null,
    }

    return res.status(200).json({
      client,
      tickets,
      total: tickets.length,
      stats: stats[0] || {},
      topProduits,
      depots,
      rfm: rfmData
    })

  } catch (error) {
    console.error('Client tickets error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des tickets',
      details: error.message 
    })
  }
}
