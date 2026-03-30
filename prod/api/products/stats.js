/**
 * Products Stats API — Statistics from BDD (transactions/produits)
 * Endpoints:
 *  - GET /api/products/stats?ids=1234,5678&period=...  → stats for given product IDs
 *  - GET /api/products/stats/category?family=SOL&subFamily=PVC&period=...  → stats for a sub-family
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

function buildDateFilter(query) {
  const { periodType, periodValue } = query
  if (!periodType || periodType === 'all') return ''
  if (periodType === 'months') {
    return `AND t.date >= NOW() - INTERVAL '${parseInt(periodValue)} months'`
  }
  if (periodType === 'year') {
    return `AND EXTRACT(YEAR FROM t.date) = ${parseInt(periodValue)}`
  }
  if (periodType === 'custom' && periodValue) {
    const [start, end] = periodValue.split('_')
    if (start && end) {
      return `AND t.date >= '${start}'::date AND t.date <= '${end}'::date`
    }
  }
  return ''
}

// Stats for a list of product IDs
export async function productStatsHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const idsParam = req.query.ids
  if (!idsParam) return res.status(400).json({ error: 'ids parameter required' })

  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean).slice(0, 200)
  if (!ids.length) return res.status(400).json({ error: 'No valid IDs' })

  const dateFilter = buildDateFilter(req.query)

  // Build parameterized placeholders for IDs
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')

  const statsQuery = `
    SELECT 
      t.produit as product_id,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(*)::int as nb_lignes,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite,
      MIN(t.date)::text as first_sale,
      MAX(t.date)::text as last_sale,
      COUNT(DISTINCT t.depot)::int as nb_depots
    FROM transactions t
    WHERE t.produit IN (${placeholders})
      AND t.ca > 0
      AND t.depot != '41'
      ${dateFilter}
    GROUP BY t.produit
  `

  const results = await prisma.$queryRawUnsafe(statsQuery, ...ids)

  const statsMap = {}
  for (const row of results) {
    statsMap[row.product_id] = {
      ca: Number(row.ca),
      nbLignes: Number(row.nb_lignes),
      nbTickets: Number(row.nb_tickets),
      quantite: Number(row.quantite),
      firstSale: row.first_sale,
      lastSale: row.last_sale,
      nbDepots: Number(row.nb_depots)
    }
  }

  res.json({ stats: statsMap })
}

// Stats for a single product (detailed)
export async function productDetailStatsHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const productId = req.params.productId
  if (!productId) return res.status(400).json({ error: 'productId required' })

  const dateFilter = buildDateFilter(req.query)

  // KPIs
  const kpiQuery = `
    SELECT 
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(*)::int as nb_lignes,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite,
      COALESCE(AVG(t.ca), 0)::numeric as ca_moyen,
      MIN(t.date)::text as first_sale,
      MAX(t.date)::text as last_sale,
      COUNT(DISTINCT t.carte)::int as nb_clients,
      COUNT(DISTINCT t.depot)::int as nb_depots
    FROM transactions t 
    WHERE t.produit = $1 AND t.ca > 0 AND t.depot != '41' ${dateFilter}
  `
  const kpi = (await prisma.$queryRawUnsafe(kpiQuery, productId))[0]

  // Monthly evolution (last 24 months)
  const evolutionQuery = `
    SELECT 
      TO_CHAR(t.date, 'YYYY-MM') as mois,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite
    FROM transactions t
    WHERE t.produit = $1 AND t.ca > 0 AND t.depot != '41'
      AND t.date >= NOW() - INTERVAL '24 months'
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
    ORDER BY mois
  `
  const evolution = await prisma.$queryRawUnsafe(evolutionQuery, productId)

  // Per-store breakdown
  const storesQuery = `
    SELECT 
      t.depot,
      COALESCE(m.nom, t.depot)::text as nom_magasin,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite
    FROM transactions t
    LEFT JOIN magasins m ON t.depot = m.code
    WHERE t.produit = $1 AND t.ca > 0 AND t.depot != '41' ${dateFilter}
    GROUP BY t.depot, m.nom
    ORDER BY SUM(t.ca) DESC
  `
  const stores = await prisma.$queryRawUnsafe(storesQuery, productId)

  // Top clients
  const clientsQuery = `
    SELECT 
      t.carte,
      COALESCE(c.nom, '')::text as nom,
      COALESCE(c.prenom, '')::text as prenom,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite
    FROM transactions t
    LEFT JOIN clients c ON t.carte = c.carte
    WHERE t.produit = $1 AND t.ca > 0 AND t.depot != '41' AND t.carte IS NOT NULL ${dateFilter}
    GROUP BY t.carte, c.nom, c.prenom
    ORDER BY SUM(t.ca) DESC
    LIMIT 20
  `
  const topClients = await prisma.$queryRawUnsafe(clientsQuery, productId)

  res.json({
    kpi: {
      ca: Number(kpi.ca),
      nbLignes: Number(kpi.nb_lignes),
      nbTickets: Number(kpi.nb_tickets),
      quantite: Number(kpi.quantite),
      caMoyen: Number(kpi.ca_moyen),
      firstSale: kpi.first_sale,
      lastSale: kpi.last_sale,
      nbClients: Number(kpi.nb_clients),
      nbDepots: Number(kpi.nb_depots)
    },
    evolution: evolution.map(r => ({
      mois: r.mois,
      ca: Number(r.ca),
      nbTickets: Number(r.nb_tickets),
      quantite: Number(r.quantite)
    })),
    stores: stores.map(r => ({
      depot: r.depot,
      nom: r.nom_magasin,
      ca: Number(r.ca),
      nbTickets: Number(r.nb_tickets),
      quantite: Number(r.quantite)
    })),
    topClients: topClients.map(r => ({
      carte: r.carte,
      nom: r.nom,
      prenom: r.prenom,
      ca: Number(r.ca),
      nbTickets: Number(r.nb_tickets),
      quantite: Number(r.quantite)
    }))
  })
}

// Stats for a category (sub-family page)
export async function categoryStatsHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { productIds } = req.body
  if (!productIds?.length) return res.status(400).json({ error: 'productIds required' })

  const dateFilter = buildDateFilter(req.query)
  const ids = productIds.slice(0, 5000)
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')

  // KPIs for category
  const kpiQuery = `
    SELECT 
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(*)::int as nb_lignes,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite,
      COUNT(DISTINCT t.produit)::int as nb_produits_vendus,
      COUNT(DISTINCT t.carte)::int as nb_clients
    FROM transactions t
    WHERE t.produit IN (${placeholders})
      AND t.ca > 0 AND t.depot != '41' ${dateFilter}
  `
  const kpi = (await prisma.$queryRawUnsafe(kpiQuery, ...ids))[0]

  // Top 10 products by CA
  const topQuery = `
    SELECT 
      t.produit as product_id,
      COALESCE(p.designation, t.produit)::text as designation,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(DISTINCT t.facture)::int as nb_tickets,
      COALESCE(SUM(t.quantite), 0)::numeric as quantite
    FROM transactions t
    LEFT JOIN produits p ON t.produit = p.id
    WHERE t.produit IN (${placeholders})
      AND t.ca > 0 AND t.depot != '41' ${dateFilter}
    GROUP BY t.produit, p.designation
    ORDER BY SUM(t.ca) DESC
    LIMIT 10
  `
  const topProducts = await prisma.$queryRawUnsafe(topQuery, ...ids)

  // Monthly evolution
  const evoQuery = `
    SELECT 
      TO_CHAR(t.date, 'YYYY-MM') as mois,
      COALESCE(SUM(t.ca), 0)::numeric as ca,
      COUNT(DISTINCT t.facture)::int as nb_tickets
    FROM transactions t
    WHERE t.produit IN (${placeholders})
      AND t.ca > 0 AND t.depot != '41'
      AND t.date >= NOW() - INTERVAL '24 months'
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
    ORDER BY mois
  `
  const evolution = await prisma.$queryRawUnsafe(evoQuery, ...ids)

  res.json({
    kpi: {
      ca: Number(kpi.ca),
      nbLignes: Number(kpi.nb_lignes),
      nbTickets: Number(kpi.nb_tickets),
      quantite: Number(kpi.quantite),
      nbProduitsVendus: Number(kpi.nb_produits_vendus),
      nbClients: Number(kpi.nb_clients)
    },
    topProducts: topProducts.map(r => ({
      productId: r.product_id,
      designation: r.designation,
      ca: Number(r.ca),
      nbTickets: Number(r.nb_tickets),
      quantite: Number(r.quantite)
    })),
    evolution: evolution.map(r => ({
      mois: r.mois,
      ca: Number(r.ca),
      nbTickets: Number(r.nb_tickets)
    }))
  })
}

// Average CA evolution for the same sub-family as a given product (for comparison)
export async function categoryAvgEvolutionHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const productId = req.params.productId
  if (!productId) return res.status(400).json({ error: 'productId required' })

  // Find the product's sous_famille
  const prodRow = await prisma.$queryRawUnsafe(
    `SELECT famille, sous_famille FROM produits WHERE id = $1 LIMIT 1`, productId
  )
  if (!prodRow.length) return res.json({ evolution: [], famille: null, sousFamille: null })

  const { famille, sous_famille } = prodRow[0]

  // Get average monthly CA per product in the same sous_famille (last 24 months)
  // We compute: total CA per month / number of distinct products that sold that month
  const filterCol = sous_famille ? 'sous_famille' : 'famille'
  const filterVal = sous_famille || famille
  if (!filterVal) return res.json({ evolution: [], famille, sousFamille: sous_famille })

  const evoQuery = `
    SELECT 
      TO_CHAR(t.date, 'YYYY-MM') as mois,
      COALESCE(SUM(t.ca), 0)::numeric as ca_total,
      COUNT(DISTINCT t.produit)::int as nb_produits
    FROM transactions t
    JOIN produits p ON t.produit = p.id
    WHERE p.${filterCol} = $1
      AND t.ca > 0 AND t.depot != '41'
      AND t.date >= NOW() - INTERVAL '24 months'
    GROUP BY TO_CHAR(t.date, 'YYYY-MM')
    ORDER BY mois
  `
  const evolution = await prisma.$queryRawUnsafe(evoQuery, filterVal)

  res.json({
    famille,
    sousFamille: sous_famille,
    evolution: evolution.map(r => ({
      mois: r.mois,
      caAvg: Number(r.nb_produits) > 0 ? Number(r.ca_total) / Number(r.nb_produits) : 0,
      caTotal: Number(r.ca_total),
      nbProduits: Number(r.nb_produits)
    }))
  })
}
