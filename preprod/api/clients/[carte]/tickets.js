import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const { carte } = req.params

  if (!carte) {
    return res.status(400).json({ error: 'Numéro de carte requis' })
  }

  const { startDate, endDate } = req.query
  const dateFilter = (startDate && endDate) ? `AND t.date >= '${startDate.replace(/[^0-9-]/g, '')}' AND t.date <= '${endDate.replace(/[^0-9-]/g, '')}'` : ''

  try {
    // Récupérer les infos client + magasin préféré
    const clientQuery = `
      SELECT 
        c.carte::text,
        c.nom::text,
        c.prenom::text,
        c.civilite::text,
        c.sexe::text,
        c.email::text,
        c.telephone::text,
        c.nom_adresse::text,
        c.adresse::text,
        c.adresse_2::text,
        c.adresse_4::text,
        c.ville::text,
        c.cp::text,
        c.date_naissance::text,
        c.date_creation::text,
        pref.depot::text as magasin_code,
        pref.depot_nom::text as magasin_nom
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT t.depot, m.nom as depot_nom
        FROM transactions t
        LEFT JOIN magasins m ON m.code = t.depot
        WHERE t.carte = c.carte AND t.depot IS NOT NULL AND t.depot != ''
        GROUP BY t.depot, m.nom
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) pref ON true
      WHERE c.carte = $1
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
      WHERE carte = $1 ${dateFilter.replace(/t\.date/g, 'date')}
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
      WHERE t.carte = $1 ${dateFilter}
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
      WHERE t.carte = $1 ${dateFilter}
      GROUP BY t.produit, p.designation, p.famille
      ORDER BY ca DESC
      LIMIT 10
    `

    // Dépôts fréquentés (enrichis avec nom magasin)
    const depotsQuery = `
      SELECT
        t.depot::text,
        m.nom::text as depot_nom,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_tickets
      FROM transactions t
      LEFT JOIN magasins m ON m.code = t.depot
      WHERE t.carte = $1 AND t.depot IS NOT NULL AND t.depot != '' ${dateFilter}
      GROUP BY t.depot, m.nom
      ORDER BY nb_tickets DESC
    `

    // CA par famille de produits (pour camembert)
    const familleCAQuery = `
      SELECT
        COALESCE(p.famille, 'Autre')::text as famille,
        SUM(t.ca)::numeric as ca
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.carte = $1 ${dateFilter}
      GROUP BY p.famille
      HAVING SUM(t.ca) > 0
      ORDER BY ca DESC
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

    // RFM dynamique sur la période (quintiles recalculés sur tous les clients de la période)
    let periodRfmPromise = Promise.resolve(null)
    if (startDate && endDate) {
      const safeStart = startDate.replace(/[^0-9-]/g, '')
      const safeEnd = endDate.replace(/[^0-9-]/g, '')
      const periodRfmQuery = `
        WITH raw_rfm AS (
          SELECT
            c.carte,
            EXTRACT(DAY FROM CURRENT_DATE - MAX(t.date))::int AS recency,
            COUNT(DISTINCT t.facture)::int AS frequency,
            ROUND(SUM(t.ca)::numeric, 2)::float AS monetary
          FROM clients c
          INNER JOIN transactions t ON c.carte = t.carte
          WHERE c.carte != '0' AND t.depot != '41'
            AND t.date >= $1::date AND t.date <= $2::date
          GROUP BY c.carte
          HAVING SUM(t.ca) > 0
        ),
        scored_rfm AS (
          SELECT *,
            NTILE(5) OVER (ORDER BY recency DESC) AS rfm_r,
            NTILE(5) OVER (ORDER BY frequency ASC) AS rfm_f,
            NTILE(5) OVER (ORDER BY monetary ASC) AS rfm_m
          FROM raw_rfm
        )
        SELECT
          rfm_r AS r, rfm_f AS f, rfm_m AS m,
          (rfm_r * 100 + rfm_f * 10 + rfm_m) AS score,
          CASE
            WHEN rfm_r = 5 AND rfm_f = 5 AND rfm_m = 5 THEN 'Ultra Champions'
            WHEN rfm_r >= 4 AND rfm_f >= 4 AND rfm_m >= 4 THEN 'Champions'
            WHEN rfm_f >= 4 AND rfm_r <= 2 THEN 'À Risque'
            WHEN rfm_f >= 4 THEN 'Loyaux'
            WHEN rfm_f <= 2 AND rfm_r >= 4 THEN 'Nouveaux'
            WHEN rfm_r <= 2 THEN 'Perdus'
            ELSE 'Occasionnels'
          END AS segment,
          recency, frequency, monetary
        FROM scored_rfm
        WHERE carte = $3
      `
      periodRfmPromise = prisma.$queryRawUnsafe(periodRfmQuery, safeStart, safeEnd, carte)
        .then(rows => rows[0] || null)
        .catch(() => null)
    }

    const [stats, topProduits, depots, rfm, familleCA, periodRfmRow] = await Promise.all([
      prisma.$queryRawUnsafe(statsQuery, carte),
      prisma.$queryRawUnsafe(topProduitsQuery, carte),
      prisma.$queryRawUnsafe(depotsQuery, carte),
      prisma.$queryRawUnsafe(rfmQuery, carte),
      prisma.$queryRawUnsafe(familleCAQuery, carte),
      periodRfmPromise
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

    // Segmentation période (si disponible)
    let periodRfm = null
    if (periodRfmRow) {
      periodRfm = {
        r: Number(periodRfmRow.r) ?? null,
        f: Number(periodRfmRow.f) ?? null,
        m: Number(periodRfmRow.m) ?? null,
        score: Number(periodRfmRow.score) ?? null,
        segment: periodRfmRow.segment || 'Inconnu',
        recency: Number(periodRfmRow.recency) ?? null,
        frequency: Number(periodRfmRow.frequency) ?? null,
        monetary: Number(periodRfmRow.monetary) || 0,
      }
    }

    return res.status(200).json({
      client,
      tickets,
      total: tickets.length,
      stats: stats[0] || {},
      topProduits,
      depots,
      rfm: rfmData,
      periodRfm,
      familleCA
    })

  } catch (error) {
    console.error('Client tickets error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des tickets',
      details: error.message 
    })
  }
}
