import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// ─── Helpers ────────────────────────────────────────────

function getPeriodFilter(periodType, periodValue) {
  if (!periodType || periodType === 'all') return ''
  if (periodType === 'months') {
    const m = parseInt(periodValue)
    if (isNaN(m) || m < 1 || m > 120) return ''
    return `AND t.date >= NOW() - INTERVAL '${m} months'`
  }
  if (periodType === 'year') {
    const y = parseInt(periodValue)
    if (isNaN(y) || y < 2000 || y > 2100) return ''
    return `AND EXTRACT(YEAR FROM t.date) = ${y}`
  }
  if (periodType === 'custom' && periodValue) {
    const [s, e] = String(periodValue).split('_')
    if (s && e) return `AND t.date >= '${s}'::date AND t.date <= '${e}'::date`
  }
  return ''
}

const DEPOT_FILTER = `AND t.depot != '41'`

// ─── Granularity config ─────────────────────────────────

function getGranularityConfig(granularity) {
  const configs = {
    famille:              { groupCol: 'p.famille',                nameCol: 'p.famille',                nullCheck: `AND p.famille IS NOT NULL AND p.famille != ''`,                           needsFreqFilter: false, minPairCount: 5 },
    sous_famille:         { groupCol: 'p.sous_famille',           nameCol: 'p.sous_famille',           nullCheck: `AND p.sous_famille IS NOT NULL AND p.sous_famille != ''`,                 needsFreqFilter: false, minPairCount: 5 },
    sous_sous_famille:    { groupCol: 'p.sous_sous_famille',      nameCol: 'p.sous_sous_famille',      nullCheck: `AND p.sous_sous_famille IS NOT NULL AND p.sous_sous_famille != ''`,       needsFreqFilter: true, minPairCount: 5 },
    sous_sous_sous_famille:{ groupCol: 'p.sous_sous_sous_famille', nameCol: 'p.sous_sous_sous_famille', nullCheck: `AND p.sous_sous_sous_famille IS NOT NULL AND p.sous_sous_sous_famille != ''`, needsFreqFilter: true, minPairCount: 5 },
    produit:              { groupCol: 'p.id',                     nameCol: 'p.designation',            nullCheck: `AND p.id IS NOT NULL`,                                                   needsFreqFilter: true, minPairCount: 10 },
  }
  return configs[granularity] || configs.famille
}

// ─── Mode 1 : Top associations ──────────────────────────

async function getTopAssociations(periodFilter, granularity, limit = 50, { crossSF = false, excludeCheap = false } = {}) {
  const conf = getGranularityConfig(granularity)
  const { groupCol, nameCol, nullCheck, needsFreqFilter, minPairCount } = conf
  const MAX_FREQUENT_ITEMS = 150

  // Step 1: get total ticket count for support calculation
  const totalRes = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
    FROM transactions t
    WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
  `)
  const totalTickets = totalRes[0]?.total || 1

  // Step 2: compute pair stats entirely in SQL
  // For detailed levels: only keep the TOP N most frequent items
  const frequentItemsCte = needsFreqFilter ? `
    frequent_items AS (
      SELECT ${groupCol}::text as item_id
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter} ${nullCheck}
      GROUP BY ${groupCol}
      ORDER BY COUNT(DISTINCT (t.facture || '_' || t.date::text)) DESC
      LIMIT ${MAX_FREQUENT_ITEMS}
    ),` : ''

  const frequentFilter = needsFreqFilter ? `AND ${groupCol}::text IN (SELECT item_id FROM frequent_items)` : ''

  const sql = `
    WITH ${frequentItemsCte}
    ${excludeCheap ? `
    sf_avg_price AS (
      SELECT p.sous_famille, AVG(t.ca)::numeric as avg_ca
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
        AND p.sous_famille IS NOT NULL AND p.sous_famille != ''
      GROUP BY p.sous_famille
    ),
    product_avg_price AS (
      SELECT ${groupCol}::text as item_id, MIN(p.sous_famille) as sf,
             AVG(t.ca)::numeric as product_avg_ca
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter} ${nullCheck}
      GROUP BY ${groupCol}
    ),
    expensive_items AS (
      SELECT pa.item_id
      FROM product_avg_price pa
      JOIN sf_avg_price sa ON sa.sous_famille = pa.sf
      WHERE pa.product_avg_ca >= sa.avg_ca
    ),` : ''}
    baskets AS (
      SELECT 
        (t.facture || '_' || t.date::text) as ticket_id,
        ${groupCol}::text as item_id,
        MIN(${nameCol}::text) as item_name,
        MIN(p.sous_famille::text) as item_sf,
        SUM(t.ca)::numeric as item_ca
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter} ${nullCheck} ${frequentFilter}
        ${excludeCheap ? `AND ${groupCol}::text IN (SELECT item_id FROM expensive_items)` : ''}
      GROUP BY ticket_id, ${groupCol}
    ),
    ticket_items AS (
      SELECT ticket_id, COUNT(*) as n_items FROM baskets GROUP BY ticket_id HAVING COUNT(*) >= 2 AND COUNT(*) <= 15
    ),
    pairs AS (
      SELECT
        LEAST(a.item_id, b.item_id) as item_a,
        GREATEST(a.item_id, b.item_id) as item_b,
        MIN(CASE WHEN a.item_id <= b.item_id THEN a.item_name ELSE b.item_name END) as name_a,
        MIN(CASE WHEN a.item_id <= b.item_id THEN b.item_name ELSE a.item_name END) as name_b,
        COUNT(*)::int as pair_count,
        SUM(a.item_ca + b.item_ca)::numeric as pair_ca_total,
        AVG(a.item_ca + b.item_ca)::numeric as pair_ca_avg
      FROM baskets a
      JOIN baskets b ON a.ticket_id = b.ticket_id AND a.item_id < b.item_id
      JOIN ticket_items ti ON a.ticket_id = ti.ticket_id
      ${crossSF ? `WHERE a.item_sf IS DISTINCT FROM b.item_sf` : ''}
      GROUP BY LEAST(a.item_id, b.item_id), GREATEST(a.item_id, b.item_id)
      HAVING COUNT(*) >= ${minPairCount}
    ),
    item_support AS (
      SELECT item_id, COUNT(DISTINCT ticket_id)::int as item_tickets
      FROM baskets
      GROUP BY item_id
    )
    SELECT
      p.item_a,
      p.item_b,
      p.name_a,
      p.name_b,
      p.pair_count,
      p.pair_ca_total,
      p.pair_ca_avg,
      sa.item_tickets as tickets_a,
      sb.item_tickets as tickets_b,
      ROUND(p.pair_count * 100.0 / ${totalTickets}, 4) as support_pct,
      ROUND(p.pair_count * 100.0 / sa.item_tickets, 2) as confidence_a_to_b,
      ROUND(p.pair_count * 100.0 / sb.item_tickets, 2) as confidence_b_to_a,
      ROUND(
        (p.pair_count::numeric / ${totalTickets}) 
        / ((sa.item_tickets::numeric / ${totalTickets}) * (sb.item_tickets::numeric / ${totalTickets})),
        2
      ) as lift
    FROM pairs p
    JOIN item_support sa ON sa.item_id = p.item_a
    JOIN item_support sb ON sb.item_id = p.item_b
    ORDER BY lift DESC, pair_count DESC
    LIMIT ${parseInt(limit) || 50}
  `

  const associations = await prisma.$queryRawUnsafe(sql)

  return {
    associations: associations.map(r => ({
      itemA: r.name_a,
      itemB: r.name_b,
      idA: r.item_a,
      idB: r.item_b,
      count: Number(r.pair_count),
      totalCA: Math.round(Number(r.pair_ca_total)),
      avgCA: Math.round(Number(r.pair_ca_avg)),
      support: Number(r.support_pct),
      confidenceAB: Number(r.confidence_a_to_b),
      confidenceBA: Number(r.confidence_b_to_a),
      lift: Number(r.lift),
      ticketsA: Number(r.tickets_a),
      ticketsB: Number(r.tickets_b)
    })),
    totalTickets,
    granularity
  }
}

// ─── Mode 2 : Recherche "avec quoi se vend X ?" ─────────

async function getAssociationsFor(periodFilter, searchTerm, searchLevel) {
  const { groupCol, nameCol } = getGranularityConfig(searchLevel)

  const totalRes = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
    FROM transactions t
    WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
  `)
  const totalTickets = totalRes[0]?.total || 1

  // Find tickets containing the search term, then what else is in those tickets
  const sql = `
    WITH target_tickets AS (
      SELECT DISTINCT (t.facture || '_' || t.date::text) as ticket_id
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
        AND (
          LOWER(p.famille) LIKE LOWER($1)
          OR LOWER(p.sous_famille) LIKE LOWER($1)
          OR LOWER(p.designation) LIKE LOWER($1)
          OR LOWER(p.id) LIKE LOWER($1)
        )
    ),
    baskets AS (
      SELECT 
        (t.facture || '_' || t.date::text) as ticket_id,
        ${groupCol}::text as item_id,
        MIN(${nameCol}::text) as item_name,
        SUM(t.ca)::numeric as item_ca
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
        AND (t.facture || '_' || t.date::text) IN (SELECT ticket_id FROM target_tickets)
        AND ${groupCol} IS NOT NULL
      GROUP BY ticket_id, ${groupCol}
    ),
    -- The target item(s) matching search
    target_items AS (
      SELECT DISTINCT item_id FROM baskets
      WHERE LOWER(item_name) LIKE LOWER($1) OR LOWER(item_id) LIKE LOWER($1)
    ),
    companions AS (
      SELECT
        b.item_id,
        b.item_name,
        COUNT(DISTINCT b.ticket_id)::int as pair_count,
        SUM(b.item_ca)::numeric as companion_ca_total,
        AVG(b.item_ca)::numeric as companion_ca_avg
      FROM baskets b
      WHERE b.item_id NOT IN (SELECT item_id FROM target_items)
        AND b.ticket_id IN (
          SELECT ticket_id FROM baskets WHERE item_id IN (SELECT item_id FROM target_items)
        )
      GROUP BY b.item_id, b.item_name
      HAVING COUNT(DISTINCT b.ticket_id) >= 2
    ),
    item_support AS (
      SELECT ${groupCol}::text as item_id, COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as item_tickets
      FROM transactions t
      JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
        AND ${groupCol} IS NOT NULL
      GROUP BY ${groupCol}
    )
    SELECT
      c.item_id,
      c.item_name,
      c.pair_count,
      c.companion_ca_total,
      c.companion_ca_avg,
      COALESCE(s.item_tickets, 0)::int as item_tickets,
      (SELECT SUM(item_tickets) FROM item_support WHERE item_id IN (SELECT item_id FROM target_items))::int as target_tickets,
      ROUND(c.pair_count * 100.0 / NULLIF((SELECT SUM(item_tickets) FROM item_support WHERE item_id IN (SELECT item_id FROM target_items)), 0), 2) as confidence,
      ROUND(c.pair_count * 100.0 / ${totalTickets}, 4) as support_pct,
      ROUND(
        (c.pair_count::numeric / NULLIF((SELECT SUM(item_tickets) FROM item_support WHERE item_id IN (SELECT item_id FROM target_items)), 0))
        / NULLIF(s.item_tickets::numeric / ${totalTickets}, 0),
        2
      ) as lift
    FROM companions c
    LEFT JOIN item_support s ON s.item_id = c.item_id
    ORDER BY lift DESC, pair_count DESC
    LIMIT 30
  `

  const searchParam = `%${searchTerm}%`
  const results = await prisma.$queryRawUnsafe(sql, searchParam)

  return {
    searchTerm,
    searchLevel,
    companions: results.map(r => ({
      item: r.item_name,
      itemId: r.item_id,
      count: Number(r.pair_count),
      totalCA: Math.round(Number(r.companion_ca_total)),
      avgCA: Math.round(Number(r.companion_ca_avg)),
      confidence: Number(r.confidence),
      support: Number(r.support_pct),
      lift: Number(r.lift),
      itemTickets: Number(r.item_tickets),
      targetTickets: Number(r.target_tickets)
    })),
    totalTickets
  }
}

// ─── Mode 3 : Comparaison A+B vs C+D ────────────────────

async function comparePairs(periodFilter, pairA, pairB, level) {
  const { groupCol, nameCol } = getGranularityConfig(level)

  const totalRes = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT (t.facture || '_' || t.date::text))::int as total
    FROM transactions t
    WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
  `)
  const totalTickets = totalRes[0]?.total || 1

  async function getPairStats(itemX, itemY) {
    const sql = `
      WITH baskets AS (
        SELECT 
          (t.facture || '_' || t.date::text) as ticket_id,
          ${groupCol}::text as item_id,
          MIN(${nameCol}::text) as item_name,
          SUM(t.ca)::numeric as item_ca
        FROM transactions t
        JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.facture IS NOT NULL ${DEPOT_FILTER} ${periodFilter}
          AND ${groupCol} IS NOT NULL
        GROUP BY ticket_id, ${groupCol}
      ),
      matching AS (
        SELECT DISTINCT item_id FROM baskets
        WHERE LOWER(item_name) LIKE LOWER($1) OR LOWER(item_id) LIKE LOWER($1)
      ),
      matching2 AS (
        SELECT DISTINCT item_id FROM baskets
        WHERE LOWER(item_name) LIKE LOWER($2) OR LOWER(item_id) LIKE LOWER($2)
      ),
      -- Tickets with both items
      both_tickets AS (
        SELECT a.ticket_id, (a.item_ca + b.item_ca) as combined_ca
        FROM baskets a
        JOIN baskets b ON a.ticket_id = b.ticket_id
        WHERE a.item_id IN (SELECT item_id FROM matching)
          AND b.item_id IN (SELECT item_id FROM matching2)
          AND a.item_id != b.item_id
      ),
      item_support_x AS (
        SELECT COUNT(DISTINCT ticket_id)::int as cnt FROM baskets WHERE item_id IN (SELECT item_id FROM matching)
      ),
      item_support_y AS (
        SELECT COUNT(DISTINCT ticket_id)::int as cnt FROM baskets WHERE item_id IN (SELECT item_id FROM matching2)
      )
      SELECT
        COUNT(DISTINCT ticket_id)::int as pair_count,
        COALESCE(SUM(combined_ca), 0)::numeric as total_ca,
        COALESCE(AVG(combined_ca), 0)::numeric as avg_ca,
        (SELECT cnt FROM item_support_x) as tickets_x,
        (SELECT cnt FROM item_support_y) as tickets_y,
        ROUND(COUNT(DISTINCT ticket_id) * 100.0 / ${totalTickets}, 4) as support_pct,
        CASE WHEN (SELECT cnt FROM item_support_x) > 0
          THEN ROUND(COUNT(DISTINCT ticket_id) * 100.0 / (SELECT cnt FROM item_support_x), 2)
          ELSE 0 END as confidence_x_to_y,
        CASE WHEN (SELECT cnt FROM item_support_y) > 0
          THEN ROUND(COUNT(DISTINCT ticket_id) * 100.0 / (SELECT cnt FROM item_support_y), 2)
          ELSE 0 END as confidence_y_to_x,
        CASE WHEN (SELECT cnt FROM item_support_x) > 0 AND (SELECT cnt FROM item_support_y) > 0
          THEN ROUND(
            (COUNT(DISTINCT ticket_id)::numeric / ${totalTickets})
            / (((SELECT cnt FROM item_support_x)::numeric / ${totalTickets}) * ((SELECT cnt FROM item_support_y)::numeric / ${totalTickets})),
            2)
          ELSE 0 END as lift
      FROM both_tickets
    `
    const paramX = `%${itemX}%`
    const paramY = `%${itemY}%`
    const res = await prisma.$queryRawUnsafe(sql, paramX, paramY)
    const r = res[0] || {}
    return {
      count: Number(r.pair_count || 0),
      totalCA: Math.round(Number(r.total_ca || 0)),
      avgCA: Math.round(Number(r.avg_ca || 0)),
      ticketsX: Number(r.tickets_x || 0),
      ticketsY: Number(r.tickets_y || 0),
      support: Number(r.support_pct || 0),
      confidenceXY: Number(r.confidence_x_to_y || 0),
      confidenceYX: Number(r.confidence_y_to_x || 0),
      lift: Number(r.lift || 0)
    }
  }

  const [statsA, statsB] = await Promise.all([
    getPairStats(pairA[0], pairA[1]),
    getPairStats(pairB[0], pairB[1])
  ])

  return {
    pairA: { items: pairA, ...statsA },
    pairB: { items: pairB, ...statsB },
    totalTickets,
    winner: statsA.lift > statsB.lift ? 'A' : statsB.lift > statsA.lift ? 'B' : 'equal'
  }
}

// ─── Mode 4 : Autocomplete familles / produits ──────────

async function autocomplete(periodFilter, term) {
  const searchParam = `%${term}%`

  const results = await prisma.$queryRawUnsafe(`
    (
      SELECT DISTINCT p.famille::text as name, 'famille' as level
      FROM produits p
      JOIN transactions t ON t.produit = p.id
      WHERE p.famille IS NOT NULL AND p.famille != '' 
        AND LOWER(p.famille) LIKE LOWER($1)
        AND t.ca > 0 ${DEPOT_FILTER} ${periodFilter}
      LIMIT 5
    )
    UNION ALL
    (
      SELECT DISTINCT p.sous_famille::text as name, 'sous_famille' as level
      FROM produits p
      JOIN transactions t ON t.produit = p.id
      WHERE p.sous_famille IS NOT NULL AND p.sous_famille != '' 
        AND LOWER(p.sous_famille) LIKE LOWER($1)
        AND t.ca > 0 ${DEPOT_FILTER} ${periodFilter}
      LIMIT 5
    )
    UNION ALL
    (
      SELECT DISTINCT p.sous_sous_famille::text as name, 'sous_sous_famille' as level
      FROM produits p
      JOIN transactions t ON t.produit = p.id
      WHERE p.sous_sous_famille IS NOT NULL AND p.sous_sous_famille != '' 
        AND LOWER(p.sous_sous_famille) LIKE LOWER($1)
        AND t.ca > 0 ${DEPOT_FILTER} ${periodFilter}
      LIMIT 5
    )
    UNION ALL
    (
      SELECT DISTINCT p.sous_sous_sous_famille::text as name, 'sous_sous_sous_famille' as level
      FROM produits p
      JOIN transactions t ON t.produit = p.id
      WHERE p.sous_sous_sous_famille IS NOT NULL AND p.sous_sous_sous_famille != '' 
        AND LOWER(p.sous_sous_sous_famille) LIKE LOWER($1)
        AND t.ca > 0 ${DEPOT_FILTER} ${periodFilter}
      LIMIT 5
    )
    UNION ALL
    (
      SELECT DISTINCT (p.id || ' - ' || p.designation)::text as name, 'produit' as level
      FROM produits p
      JOIN transactions t ON t.produit = p.id
      WHERE p.designation IS NOT NULL
        AND (LOWER(p.designation) LIKE LOWER($1) OR LOWER(p.id) LIKE LOWER($1))
        AND t.ca > 0 ${DEPOT_FILTER} ${periodFilter}
      LIMIT 5
    )
  `, searchParam)

  return results.map(r => ({ name: r.name, level: r.level }))
}

// ─── Main handler ────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { periodType, periodValue, mode, search, searchLevel, granularity, limit,
            pairA1, pairA2, pairB1, pairB2, compareLevel, q, crossSF, excludeCheap } = req.query

    const periodFilter = getPeriodFilter(periodType, periodValue)

    console.log('🔄 API Cross-Selling:', { mode, granularity, periodType, search })
    const startTime = Date.now()

    // Mode autocomplete
    if (mode === 'autocomplete' && q) {
      const suggestions = await autocomplete(periodFilter, q)
      return res.status(200).json({ suggestions })
    }

    // Mode recherche : "avec quoi se vend X ?"
    if (mode === 'search' && search) {
      const data = await getAssociationsFor(periodFilter, search, searchLevel || 'famille')
      return res.status(200).json({ ...data, queryTimeMs: Date.now() - startTime })
    }

    // Mode comparaison : A+B vs C+D
    if (mode === 'compare' && pairA1 && pairA2 && pairB1 && pairB2) {
      const data = await comparePairs(periodFilter, [pairA1, pairA2], [pairB1, pairB2], compareLevel || 'famille')
      return res.status(200).json({ ...data, queryTimeMs: Date.now() - startTime })
    }

    // Mode par défaut : top associations
    const data = await getTopAssociations(periodFilter, granularity || 'famille', limit || 50, {
      crossSF: crossSF === 'true',
      excludeCheap: excludeCheap === 'true'
    })
    return res.status(200).json({ ...data, queryTimeMs: Date.now() - startTime })

  } catch (error) {
    console.error('❌ Erreur API Cross-Selling:', error)
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  } finally {
    await prisma.$disconnect()
  }
}
