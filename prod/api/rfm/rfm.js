import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error', 'warn'] })

// ─── Cache mémoire serveur (évite de relire la BDD à chaque requête) ──
const memoryCache = new Map()      // clé → { data, ts }
const MEMORY_TTL = 10 * 60 * 1000  // 10 minutes

function memGet(key) {
  const entry = memoryCache.get(key)
  if (entry && Date.now() - entry.ts < MEMORY_TTL) return entry.data
  if (entry) memoryCache.delete(key)
  return null
}
function memSet(key, data) {
  memoryCache.set(key, { data, ts: Date.now() })
}

// ─── Upsert cache BDD ──────────────────────────────────────────────
async function upsertCache(periodType, periodValue, data, ttlHours = 12) {
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000)
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO application_cache (module, period_type, period_value, store_code, data, computed_at, expires_at, version)
       VALUES ('rfm', $1, $2, '__global__', $3::jsonb, NOW(), $4, 2)
       ON CONFLICT ON CONSTRAINT uq_cache_entry
       DO UPDATE SET data = $3::jsonb, computed_at = NOW(), expires_at = $4, version = 2`,
      periodType, periodValue, JSON.stringify(data), expiresAt
    )
  } catch (e) {
    console.error('⚠️ Erreur upsert cache RFM:', e.message)
  }
}

// ─── Sérialisation BigInt ──────────────────────────────────────────
const serialize = (obj) =>
  JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)))

// ─── Segmentation RFM ─────────────────────────────────────────────
function assignSegment(R, F, M) {
  if (R === 5 && F === 5 && M === 5) return 'Ultra Champions'
  if (R >= 4 && F >= 4 && M >= 4) return 'Champions'
  if (F >= 4 && R <= 2) return 'À Risque'
  if (F >= 4) return 'Loyaux'
  if (F <= 2 && R >= 4) return 'Nouveaux'
  if (R <= 2) return 'Perdus'
  return 'Occasionnels'
}

// ─── WHERE clause globale ──────────────────────────────────────────
const WHERE_CLAUSE = "c.carte != '0' AND t.depot != '41'"

// ─── Period helpers ────────────────────────────────────────────────
function getPeriodDates(periodType, periodValue) {
  if (!periodType || periodType === 'all') return null
  const now = new Date()
  let startDate, endDate
  if (periodType === 'months') {
    const months = parseInt(periodValue)
    if (isNaN(months) || months < 1 || months > 120) return null
    startDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
    endDate = now
  } else if (periodType === 'year') {
    const year = parseInt(periodValue)
    if (isNaN(year) || year < 2000 || year > 2100) return null
    startDate = new Date(year, 0, 1)
    endDate = new Date(year, 11, 31)
  } else if (periodType === 'custom') {
    const parts = String(periodValue).split('_')
    if (parts.length !== 2) return null
    startDate = new Date(parts[0])
    endDate = new Date(parts[1])
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null
  } else {
    return null
  }
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

// ─── CTE commune pour calcul RFM dynamique sur période ────────────
// $1 = startDate, $2 = endDate (toujours les 2 premiers params)
const PERIOD_RFM_CTE = `
  raw_rfm AS (
    SELECT
      c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp, c.date_naissance,
      EXTRACT(DAY FROM CURRENT_DATE - MAX(t.date))::int AS recency,
      COUNT(DISTINCT t.facture)::int AS frequency,
      ROUND(SUM(t.ca)::numeric, 2)::float AS monetary,
      MIN(t.date)::text AS first_date,
      MAX(t.date)::text AS last_date
    FROM clients c
    INNER JOIN transactions t ON c.carte = t.carte
    WHERE c.carte != '0' AND t.depot != '41'
      AND t.date >= $1::date AND t.date <= $2::date
    GROUP BY c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp, c.date_naissance
    HAVING SUM(t.ca) > 0
  ),
  scored_rfm AS (
    SELECT *,
      NTILE(5) OVER (ORDER BY recency DESC) AS rfm_r,
      NTILE(5) OVER (ORDER BY frequency ASC) AS rfm_f,
      NTILE(5) OVER (ORDER BY monetary ASC) AS rfm_m
    FROM raw_rfm
  ),
  period_rfm AS (
    SELECT *,
      CASE
        WHEN rfm_r = 5 AND rfm_f = 5 AND rfm_m = 5 THEN 'Ultra Champions'
        WHEN rfm_r >= 4 AND rfm_f >= 4 AND rfm_m >= 4 THEN 'Champions'
        WHEN rfm_f >= 4 AND rfm_r <= 2 THEN 'À Risque'
        WHEN rfm_f >= 4 THEN 'Loyaux'
        WHEN rfm_f <= 2 AND rfm_r >= 4 THEN 'Nouveaux'
        WHEN rfm_r <= 2 THEN 'Perdus'
        ELSE 'Occasionnels'
      END AS segment,
      (rfm_r * 100 + rfm_f * 10 + rfm_m) AS rfm_score
    FROM scored_rfm
  )
`

// ═══════════════════════════════════════════════════════════════════
//  Lecture du cache BDD (application_cache)
//  → Contient les stats agrégées + top 20 (quelques Ko)
// ═══════════════════════════════════════════════════════════════════
async function getStatsFromCache() {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT data FROM application_cache
       WHERE module = 'rfm' AND period_type = 'filter' AND period_value = 'TOUS'
         AND store_code = '__global__' AND expires_at > NOW()`
    )
    if (rows.length > 0) {
      console.log(`📦 RFM stats cache hit`)
      return rows[0].data
    }
    return null
  } catch (e) {
    console.error('⚠️ Erreur lecture cache RFM:', e.message)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Fallback live : stats agrégées (si cache vide/expiré)
// ═══════════════════════════════════════════════════════════════════
async function computeStatsLive() {
  console.log(`⚡ RFM stats live (cache manquant)...`)
  const where = WHERE_CLAUSE

  const segmentRows = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered AS (
      SELECT c.carte, c.rfm_r, c.rfm_f, c.rfm_m, c.rfm_monetary, c.date_naissance
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${where} AND c.rfm_segment IS NOT NULL
      GROUP BY c.carte, c.rfm_r, c.rfm_f, c.rfm_m, c.rfm_monetary, c.date_naissance
      HAVING SUM(t.ca) > 0
    )
    SELECT
      CASE
        WHEN rfm_r = 5 AND rfm_f = 5 AND rfm_m = 5 THEN 'Ultra Champions'
        WHEN rfm_r >= 4 AND rfm_f >= 4 AND rfm_m >= 4 THEN 'Champions'
        WHEN rfm_f >= 4 AND rfm_r <= 2 THEN 'À Risque'
        WHEN rfm_f >= 4 THEN 'Loyaux'
        WHEN rfm_f <= 2 AND rfm_r >= 4 THEN 'Nouveaux'
        WHEN rfm_r <= 2 THEN 'Perdus'
        ELSE 'Occasionnels'
      END AS segment,
      COUNT(*)::int AS count,
      ROUND(SUM(rfm_monetary)::numeric, 2) AS ca,
      COUNT(CASE WHEN date_naissance IS NOT NULL AND date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 1 END)::int AS avec_age,
      ROUND(AVG(
        CASE WHEN date_naissance IS NOT NULL AND date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance::date))
        END
      ))::int AS age_moyen
    FROM filtered
    GROUP BY 1
    ORDER BY ca DESC
  `))

  const segments = {}
  let totalClients = 0
  let totalCA = 0

  segmentRows.forEach(row => {
    const count = row.count
    const ca = parseFloat(row.ca)
    totalClients += count
    totalCA += ca
    segments[row.segment] = {
      count,
      ca,
      ageMoyen: row.age_moyen || null,
      avecAge: row.avec_age,
      pctAge: count > 0 ? Math.round((row.avec_age / count) * 100) : 0
    }
  })

  // Top 20
  const top20 = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered_cartes AS (
      SELECT DISTINCT c.carte
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${where} AND c.rfm_segment IS NOT NULL
      GROUP BY c.carte
      HAVING SUM(t.ca) > 0
    )
    SELECT
      c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp,
      c.rfm_r AS "R", c.rfm_f AS "F", c.rfm_m AS "M", c.rfm_score AS "RFM",
      c.rfm_segment AS segment,
      c.rfm_recency AS recency, c.rfm_frequency AS frequency,
      c.rfm_monetary::float AS monetary,
      c.rfm_last_date AS "lastDate", c.rfm_first_date AS "firstDate"
    FROM clients c
    INNER JOIN filtered_cartes fc ON c.carte = fc.carte
    ORDER BY c.rfm_monetary DESC NULLS LAST
    LIMIT 20
  `))

  const result = { stats: { totalClients, totalCA, segments }, top20 }
  // Sauvegarder en cache BDD pour éviter le recalcul
  await upsertCache('filter', 'TOUS', result, 12)
  console.log(`✅ RFM live: ${totalClients} clients, ${Math.round(totalCA)}€ (sauvé en cache BDD)`)
  return result
}

// ═══════════════════════════════════════════════════════════════════
//  Clients d'un segment : lecture directe table clients
//  Paginé, trié, avec les métriques déjà stockées sur la ligne
// ═══════════════════════════════════════════════════════════════════
async function getSegmentClients(segment, page = 0, pageSize = 50, sortBy = 'monetary', sortOrder = 'desc') {
  const where = WHERE_CLAUSE

  // Colonne de tri sécurisée
  const sortCols = {
    monetary:  'c.rfm_monetary',
    frequency: 'c.rfm_frequency',
    recency:   'c.rfm_recency',
    rfm:       'c.rfm_score'
  }
  const orderCol = sortCols[sortBy] || sortCols.monetary
  const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC'
  const offset = page * pageSize

  // Segment : on filtre les cartes qui ont des transactions valides
  const clients = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered_cartes AS (
      SELECT DISTINCT c.carte
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${where} AND c.rfm_segment = $1
      GROUP BY c.carte
      HAVING SUM(t.ca) > 0
    )
    SELECT
      c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp,
      c.date_naissance,
      c.rfm_r AS "R", c.rfm_f AS "F", c.rfm_m AS "M", c.rfm_score AS "RFM",
      c.rfm_segment AS segment,
      c.rfm_recency AS recency, c.rfm_frequency AS frequency,
      c.rfm_monetary::float AS monetary,
      c.rfm_last_date AS "lastDate", c.rfm_first_date AS "firstDate",
      ROW_NUMBER() OVER (ORDER BY c.rfm_monetary DESC NULLS LAST) AS monetary_rank
    FROM clients c
    INNER JOIN filtered_cartes fc ON c.carte = fc.carte
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT $2 OFFSET $3
  `, segment, pageSize, offset))

  return clients
}

// ═══════════════════════════════════════════════════════════════════
//  Lecture cache KPI segment (application_cache)
//  Clé : module='rfm', period_type='segment', period_value=segment, store_code='__global__'
// ═══════════════════════════════════════════════════════════════════
async function getSegmentStatsFromCache(segment) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT data FROM application_cache
       WHERE module = 'rfm' AND period_type = 'segment' AND period_value = $1
         AND store_code = '__global__' AND expires_at > NOW()`,
      segment
    )
    if (rows.length > 0) {
      console.log(`📦 RFM segment cache hit : ${segment}`)
      return rows[0].data
    }
    return null
  } catch (e) {
    console.error('⚠️ Erreur lecture cache segment RFM:', e.message)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Fallback live : stats agrégées d'un segment (si cache vide/expiré)
// ═══════════════════════════════════════════════════════════════════
async function computeSegmentStatsLive(segment) {
  console.log(`⚡ RFM segment stats live : ${segment}...`)
  const where = WHERE_CLAUSE

  const rows = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered AS (
      SELECT c.carte, c.rfm_recency, c.rfm_frequency, c.rfm_monetary
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${where} AND c.rfm_segment = $1
      GROUP BY c.carte, c.rfm_recency, c.rfm_frequency, c.rfm_monetary
      HAVING SUM(t.ca) > 0
    )
    SELECT
      COUNT(*)::int                                              AS count,
      ROUND(SUM(rfm_monetary)::numeric, 2)                      AS ca,
      ROUND(AVG(rfm_frequency)::numeric, 1)                     AS freq_moy,
      ROUND(AVG(rfm_recency)::numeric, 1)                       AS recence_moy,
      ROUND((SUM(rfm_monetary) / NULLIF(SUM(rfm_frequency), 0))::numeric, 2) AS panier_moy,
      MIN(rfm_recency)::int                                     AS recence_min,
      MAX(rfm_recency)::int                                     AS recence_max,
      MIN(rfm_monetary)::float                                  AS ca_min,
      MAX(rfm_monetary)::float                                  AS ca_max,
      COUNT(CASE WHEN rfm_frequency > 1 THEN 1 END)::int        AS multi_achat
    FROM filtered
  `, segment))

  if (rows.length === 0) return null
  const r = rows[0]
  const count = r.count || 0
  const ca = parseFloat(r.ca) || 0

  const stats = {
    count,
    ca,
    frequenceMoyenne: parseFloat(r.freq_moy) || 0,
    recenceMoyenne:   parseFloat(r.recence_moy) || 0,
    panierMoyen:      parseFloat(r.panier_moy) || 0,
    caParClient:      count > 0 ? ca / count : 0,
    recenceMin:       r.recence_min ?? 0,
    recenceMax:       r.recence_max ?? 0,
    caMin:            r.ca_min ?? 0,
    caMax:            r.ca_max ?? 0,
    tauxRetention:    count > 0 ? Math.round((r.multi_achat / count) * 1000) / 10 : 0,
    multiAchat:       r.multi_achat ?? 0
  }
  // Sauvegarder en cache BDD
  await upsertCache('segment', segment, stats, 12)
  return stats
}

// ═══════════════════════════════════════════════════════════════════
//  Handler API
//
// ═══════════════════════════════════════════════════════════════════
//  Lecture cache Top Produits (application_cache)
// ═══════════════════════════════════════════════════════════════════
async function getTopProductsFromCache(segment) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT data FROM application_cache
       WHERE module = 'rfm' AND period_type = 'top_products' AND period_value = $1
         AND store_code = '__global__' AND expires_at > NOW()`,
      segment
    )
    if (rows.length > 0) {
      console.log(`📦 RFM top products cache hit: ${segment}`)
      return rows[0].data
    }
    return null
  } catch (e) {
    console.error('⚠️ Erreur lecture cache top products:', e.message)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Top produits achetés par un segment (fallback live)
// ═══════════════════════════════════════════════════════════════════
async function getTopProductsBySegment(segment, limit = 15) {
  const where = WHERE_CLAUSE
  const rows = serialize(await prisma.$queryRawUnsafe(`
    SELECT
      p.id AS code,
      p.designation AS nom,
      p.famille,
      p.sous_famille,
      ROUND(SUM(t.ca)::numeric, 2)       AS ca,
      SUM(t.quantite)::int                AS volume,
      COUNT(DISTINCT t.carte)::int        AS nb_clients
    FROM transactions t
    INNER JOIN clients c ON c.carte = t.carte
    INNER JOIN produits p ON p.id = t.produit
    WHERE ${where} AND c.rfm_segment = $1 AND t.ca > 0
    GROUP BY p.id, p.designation, p.famille, p.sous_famille
    ORDER BY ca DESC
    LIMIT $2
  `, segment, limit))
  const products = rows.map(r => ({
    ...r,
    ca: parseFloat(r.ca) || 0,
    volume: r.volume || 0,
    nb_clients: r.nb_clients || 0
  }))
  // Sauvegarder en cache BDD
  await upsertCache('top_products', segment, { segment, products }, 12)
  return products
}

// ═══════════════════════════════════════════════════════════════════
//  Fonctions RFM dynamiques avec filtrage par période
//  Recalcule les quintiles R/F/M à partir des transactions de la période
// ═══════════════════════════════════════════════════════════════════

async function computeStatsWithPeriod(startDate, endDate) {
  console.log(`⚡ RFM stats période ${startDate} → ${endDate}...`)

  const segmentRows = serialize(await prisma.$queryRawUnsafe(`
    WITH ${PERIOD_RFM_CTE}
    SELECT
      segment,
      COUNT(*)::int AS count,
      ROUND(SUM(monetary)::numeric, 2) AS ca,
      COUNT(CASE WHEN date_naissance IS NOT NULL AND date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN 1 END)::int AS avec_age,
      ROUND(AVG(
        CASE WHEN date_naissance IS NOT NULL AND date_naissance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_naissance::date))
        END
      ))::int AS age_moyen
    FROM period_rfm
    GROUP BY segment
    ORDER BY ca DESC
  `, startDate, endDate))

  const segments = {}
  let totalClients = 0
  let totalCA = 0

  segmentRows.forEach(row => {
    const count = row.count
    const ca = parseFloat(row.ca)
    totalClients += count
    totalCA += ca
    segments[row.segment] = {
      count,
      ca,
      ageMoyen: row.age_moyen || null,
      avecAge: row.avec_age,
      pctAge: count > 0 ? Math.round((row.avec_age / count) * 100) : 0
    }
  })

  // Top 20
  const top20 = serialize(await prisma.$queryRawUnsafe(`
    WITH ${PERIOD_RFM_CTE}
    SELECT
      carte, nom, prenom, email, telephone, sexe, ville, cp,
      rfm_r AS "R", rfm_f AS "F", rfm_m AS "M", rfm_score AS "RFM",
      segment, recency, frequency, monetary,
      last_date AS "lastDate", first_date AS "firstDate"
    FROM period_rfm
    ORDER BY monetary DESC NULLS LAST
    LIMIT 20
  `, startDate, endDate))

  const result = { stats: { totalClients, totalCA, segments }, top20 }
  // Sauvegarder en cache BDD avec TTL adapté
  const periodLabel = getPeriodLabel(startDate, endDate)
  if (periodLabel) {
    const currentYear = new Date().getFullYear()
    const ttl = periodLabel.startsWith('last_') ? 6
      : periodLabel === `year_${currentYear}` ? 12
      : 24 * 30 // années passées : 30 jours
    await upsertCache('period_overview', periodLabel, result, ttl)
  }
  return result
}

// Détermine un label de période pour les clés de cache
function getPeriodLabel(startDate, endDate) {
  const now = new Date()
  const end = new Date(endDate)
  const start = new Date(startDate)
  // Rolling months: vérifier si c'est 3m, 6m ou 12m
  for (const m of [3, 6, 12]) {
    const expected = new Date(now.getFullYear(), now.getMonth() - m, now.getDate())
    if (Math.abs(start - expected) < 2 * 86400000 && Math.abs(end - now) < 2 * 86400000) {
      return `last_${m}m`
    }
  }
  // Année complète
  if (start.getMonth() === 0 && start.getDate() === 1 && end.getMonth() === 11 && end.getDate() === 31 && start.getFullYear() === end.getFullYear()) {
    return `year_${start.getFullYear()}`
  }
  return null // Période custom, pas de cache BDD
}

async function getSegmentClientsWithPeriod(segment, startDate, endDate, page = 0, pageSize = 50, sortBy = 'monetary', sortOrder = 'desc') {
  const sortCols = { monetary: 'monetary', frequency: 'frequency', recency: 'recency', rfm: 'rfm_score' }
  const orderCol = sortCols[sortBy] || 'monetary'
  const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC'
  const offset = page * pageSize

  const clients = serialize(await prisma.$queryRawUnsafe(`
    WITH ${PERIOD_RFM_CTE}
    SELECT
      carte, nom, prenom, email, telephone, sexe, ville, cp, date_naissance,
      rfm_r AS "R", rfm_f AS "F", rfm_m AS "M", rfm_score AS "RFM",
      segment, recency, frequency, monetary,
      last_date AS "lastDate", first_date AS "firstDate",
      ROW_NUMBER() OVER (ORDER BY monetary DESC NULLS LAST) AS monetary_rank
    FROM period_rfm
    WHERE segment = $3
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT $4 OFFSET $5
  `, startDate, endDate, segment, pageSize, offset))

  return clients
}

async function computeSegmentStatsWithPeriod(segment, startDate, endDate) {
  console.log(`⚡ RFM segment stats période: ${segment} (${startDate} → ${endDate})...`)

  const rows = serialize(await prisma.$queryRawUnsafe(`
    WITH ${PERIOD_RFM_CTE}
    SELECT
      COUNT(*)::int                                              AS count,
      ROUND(SUM(monetary)::numeric, 2)                           AS ca,
      ROUND(AVG(frequency)::numeric, 1)                          AS freq_moy,
      ROUND(AVG(recency)::numeric, 1)                            AS recence_moy,
      ROUND((SUM(monetary) / NULLIF(SUM(frequency), 0))::numeric, 2) AS panier_moy,
      MIN(recency)::int                                          AS recence_min,
      MAX(recency)::int                                          AS recence_max,
      MIN(monetary)::float                                       AS ca_min,
      MAX(monetary)::float                                       AS ca_max,
      COUNT(CASE WHEN frequency > 1 THEN 1 END)::int             AS multi_achat
    FROM period_rfm
    WHERE segment = $3
  `, startDate, endDate, segment))

  if (rows.length === 0) return null
  const r = rows[0]
  const count = r.count || 0
  const ca = parseFloat(r.ca) || 0

  return {
    count,
    ca,
    frequenceMoyenne: parseFloat(r.freq_moy) || 0,
    recenceMoyenne:   parseFloat(r.recence_moy) || 0,
    panierMoyen:      parseFloat(r.panier_moy) || 0,
    caParClient:      count > 0 ? ca / count : 0,
    recenceMin:       r.recence_min ?? 0,
    recenceMax:       r.recence_max ?? 0,
    caMin:            r.ca_min ?? 0,
    caMax:            r.ca_max ?? 0,
    tauxRetention:    count > 0 ? Math.round((r.multi_achat / count) * 1000) / 10 : 0,
    multiAchat:       r.multi_achat ?? 0
  }
}

async function getTopProductsBySegmentWithPeriod(segment, startDate, endDate, limit = 15) {
  const rows = serialize(await prisma.$queryRawUnsafe(`
    WITH ${PERIOD_RFM_CTE}
    SELECT
      p.id AS code,
      p.designation AS nom,
      p.famille,
      p.sous_famille,
      ROUND(SUM(t2.ca)::numeric, 2)       AS ca,
      SUM(t2.quantite)::int                AS volume,
      COUNT(DISTINCT t2.carte)::int        AS nb_clients
    FROM transactions t2
    INNER JOIN period_rfm pr ON pr.carte = t2.carte
    INNER JOIN produits p ON p.id = t2.produit
    WHERE t2.depot != '41' AND t2.ca > 0 AND t2.date >= $1::date AND t2.date <= $2::date
      AND pr.segment = $3
    GROUP BY p.id, p.designation, p.famille, p.sous_famille
    ORDER BY ca DESC
    LIMIT $4
  `, startDate, endDate, segment, limit))

  return rows.map(r => ({
    ...r,
    ca: parseFloat(r.ca) || 0,
    volume: r.volume || 0,
    nb_clients: r.nb_clients || 0
  }))
}

// ─── Ultra Ultra Champions (segment caché) ────────────────────────
function getUltraUltraSemesters() {
  const now = new Date()
  const semesters = []
  for (let i = 0; i < 4; i++) {
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() - i * 6)
    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - (i + 1) * 6)
    semesters.unshift({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    })
  }
  return semesters
}

function buildUltraUltraCTE(semesters) {
  const valuesClause = semesters.map((_, i) =>
    `(${i + 1}, $${i * 2 + 1}::date, $${i * 2 + 2}::date)`
  ).join(', ')

  return {
    cte: `periods(sem, start_date, end_date) AS (
      VALUES ${valuesClause}
    ),
    raw_per_sem AS (
      SELECT p.sem, t.carte,
        EXTRACT(DAY FROM p.end_date - MAX(t.date))::int AS recency,
        COUNT(DISTINCT t.facture)::int AS frequency,
        ROUND(SUM(t.ca)::numeric, 2)::float AS monetary
      FROM transactions t
      INNER JOIN periods p ON t.date >= p.start_date AND t.date <= p.end_date
      WHERE t.carte != '0' AND t.depot != '41' AND t.ca > 0
      GROUP BY p.sem, t.carte, p.end_date
      HAVING SUM(t.ca) > 0
    ),
    scored_per_sem AS (
      SELECT *,
        NTILE(5) OVER (PARTITION BY sem ORDER BY recency DESC) AS r,
        NTILE(5) OVER (PARTITION BY sem ORDER BY frequency ASC) AS f,
        NTILE(5) OVER (PARTITION BY sem ORDER BY monetary ASC) AS m
      FROM raw_per_sem
    ),
    ultra_per_sem AS (
      SELECT carte, sem FROM scored_per_sem WHERE r = 5 AND f = 5 AND m = 5
    ),
    ultra_ultra_cartes AS (
      SELECT carte FROM ultra_per_sem GROUP BY carte HAVING COUNT(DISTINCT sem) = ${semesters.length}
    )`,
    params: semesters.flatMap(s => [s.start, s.end]),
    numParams: semesters.length * 2
  }
}

async function getUltraUltraData(page = 0, pageSize = 50, sortBy = 'monetary', sortOrder = 'desc') {
  const semesters = getUltraUltraSemesters()
  const { cte, params, numParams } = buildUltraUltraCTE(semesters)
  const sortCols = { monetary: 'monetary', frequency: 'frequency', recency: 'recency', rfm: '"RFM"' }
  const orderCol = sortCols[sortBy] || 'monetary'
  const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC'
  const offset = page * pageSize

  const statsPromise = page === 0
    ? prisma.$queryRawUnsafe(`
        WITH ${cte},
        uu_data AS (
          SELECT uu.carte,
            EXTRACT(DAY FROM CURRENT_DATE - MAX(t.date))::int AS recency,
            COUNT(DISTINCT t.facture)::int AS frequency,
            ROUND(SUM(t.ca)::numeric, 2)::float AS monetary
          FROM ultra_ultra_cartes uu
          INNER JOIN transactions t ON uu.carte = t.carte
          WHERE t.depot != '41' AND t.ca > 0
          GROUP BY uu.carte
        )
        SELECT
          COUNT(*)::int AS count,
          ROUND(SUM(monetary)::numeric, 2)::float AS ca,
          ROUND(AVG(frequency)::numeric, 1)::float AS freq_moy,
          ROUND(AVG(recency)::numeric, 1)::float AS recence_moy,
          ROUND(AVG(monetary)::numeric, 2)::float AS monetary_moy,
          ROUND((SUM(monetary) / NULLIF(SUM(frequency), 0))::numeric, 2)::float AS panier_moy,
          MIN(recency)::int AS recence_min,
          MAX(recency)::int AS recence_max,
          MIN(monetary)::float AS ca_min,
          MAX(monetary)::float AS ca_max,
          COUNT(*) FILTER (WHERE frequency > 1)::int AS multi_achat
        FROM uu_data
      `, ...params)
    : Promise.resolve(null)

  const clientsPromise = prisma.$queryRawUnsafe(`
    WITH ${cte},
    uu_full AS (
      SELECT
        c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp, c.date_naissance,
        EXTRACT(DAY FROM CURRENT_DATE - MAX(t.date))::int AS recency,
        COUNT(DISTINCT t.facture)::int AS frequency,
        ROUND(SUM(t.ca)::numeric, 2)::float AS monetary,
        MIN(t.date)::text AS first_date,
        MAX(t.date)::text AS last_date,
        c.rfm_r AS "R", c.rfm_f AS "F", c.rfm_m AS "M",
        c.rfm_score AS "RFM"
      FROM clients c
      INNER JOIN ultra_ultra_cartes uu ON c.carte = uu.carte
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE t.depot != '41'
      GROUP BY c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp, c.date_naissance,
        c.rfm_r, c.rfm_f, c.rfm_m, c.rfm_score
      HAVING SUM(t.ca) > 0
    )
    SELECT *, ROW_NUMBER() OVER (ORDER BY monetary DESC NULLS LAST) AS monetary_rank
    FROM uu_full
    ORDER BY ${orderCol} ${orderDir} NULLS LAST
    LIMIT $${numParams + 1} OFFSET $${numParams + 2}
  `, ...params, pageSize, offset)

  const [statsRows, clientsRaw] = await Promise.all([statsPromise, clientsPromise])
  const clients = serialize(clientsRaw)

  let stats = null
  if (statsRows) {
    const s = serialize(statsRows)
    const r = s[0] || {}
    const count = r.count || 0
    stats = {
      count, ca: r.ca || 0,
      frequenceMoyenne: r.freq_moy || 0,
      recenceMoyenne: r.recence_moy || 0,
      panierMoyen: r.panier_moy || 0,
      caParClient: r.monetary_moy || 0,
      recenceMin: r.recence_min || 0, recenceMax: r.recence_max || 0,
      caMin: r.ca_min || 0, caMax: r.ca_max || 0,
      tauxRetention: count > 0 ? Math.round((r.multi_achat / count) * 1000) / 10 : 0,
      multiAchat: r.multi_achat || 0
    }
  }

  return {
    ultraUltra: true,
    semesters,
    ...(stats && { stats }),
    clients,
    page, pageSize
  }
}

//  GET /api/rfm                        → stats + top 20 (depuis cache)
//  GET /api/rfm?segment=Champions      → clients paginés d'un segment
//  GET /api/rfm?segment=Champions&page=2&sort=frequency&order=asc
//  GET /api/rfm?topProducts=Ultra+Champions → top produits d'un segment
//  GET /api/rfm?ultraUltra=true        → segment caché Ultra Ultra Champions
// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // ── Détection de la période ──
    const periodType = req.query.periodType || null
    const periodValue = req.query.periodValue || null
    const periodDates = getPeriodDates(periodType, periodValue)
    const hasPeriod = periodDates !== null

    // ── Mode "Ultra Ultra Champions" (segment caché) ──
    const ultraUltra = req.query.ultraUltra === 'true'
    if (ultraUltra) {
      const page = Math.max(0, parseInt(req.query.page) || 0)
      const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize) || 50))
      const sortBy = req.query.sort || 'monetary'
      const sortOrder = req.query.order || 'desc'
      const memKey = `ultraUltra:${page}:${pageSize}:${sortBy}:${sortOrder}`
      const cached = memGet(memKey)
      if (cached) {
        console.log('⚡ Ultra Ultra Champions (mémoire)')
        return res.status(200).json(cached)
      }
      console.log(`🔒 Ultra Ultra Champions | page ${page}`)
      const result = await getUltraUltraData(page, pageSize, sortBy, sortOrder)
      memSet(memKey, result)
      console.log(`✅ Ultra Ultra Champions: ${result.stats?.count || '?'} clients`)
      return res.status(200).json(result)
    }

    // ── Mode "top produits d'un segment" ──
    const topProductsSegment = req.query.topProducts || null
    if (topProductsSegment) {
      const memKey = hasPeriod
        ? `topProducts:${topProductsSegment}:${periodDates.startDate}:${periodDates.endDate}`
        : `topProducts:${topProductsSegment}`
      const mem = memGet(memKey)
      if (mem) {
        console.log(`⚡ RFM top products (mémoire): ${topProductsSegment}${hasPeriod ? ` [${periodDates.startDate}→${periodDates.endDate}]` : ''}`)
        return res.status(200).json(mem)
      }
      console.log(`🔍 RFM top products: ${topProductsSegment}${hasPeriod ? ` [${periodDates.startDate}→${periodDates.endDate}]` : ''}`)

      if (hasPeriod) {
        const result = { segment: topProductsSegment, products: await getTopProductsBySegmentWithPeriod(topProductsSegment, periodDates.startDate, periodDates.endDate, 15) }
        memSet(memKey, result)
        return res.status(200).json(result)
      }

      // Cache BDD (all period)
      const cached = await getTopProductsFromCache(topProductsSegment)
      if (cached) { memSet(memKey, cached); return res.status(200).json(cached) }
      // Fallback live
      const result = { segment: topProductsSegment, products: await getTopProductsBySegment(topProductsSegment, 15) }
      memSet(memKey, result)
      return res.status(200).json(result)
    }

    const segment = req.query.segment || null

    // ── Mode "segment detail" : renvoyer une page de clients ──
    if (segment) {
      const page = Math.max(0, parseInt(req.query.page) || 0)
      const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize) || 50))
      const sortBy = req.query.sort || 'monetary'
      const sortOrder = req.query.order || 'desc'

      console.log(`🔍 RFM segment: ${segment} | page ${page}${hasPeriod ? ` [${periodDates.startDate}→${periodDates.endDate}]` : ''}`)

      if (hasPeriod) {
        let segmentAggPromise = Promise.resolve(null)
        if (page === 0) {
          const memAggKey = `segmentStats:${segment}:${periodDates.startDate}:${periodDates.endDate}`
          const memAgg = memGet(memAggKey)
          if (memAgg) {
            segmentAggPromise = Promise.resolve(memAgg)
          } else {
            segmentAggPromise = computeSegmentStatsWithPeriod(segment, periodDates.startDate, periodDates.endDate)
              .then(data => { memSet(memAggKey, data); return data })
          }
        }
        const [clients, segmentAgg] = await Promise.all([
          getSegmentClientsWithPeriod(segment, periodDates.startDate, periodDates.endDate, page, pageSize, sortBy, sortOrder),
          segmentAggPromise
        ])
        return res.status(200).json({
          segment, page, pageSize,
          ...(segmentAgg && { segmentStats: segmentAgg }),
          clients
        })
      }

      // Page 0 → stats agrégées (depuis cache mémoire ou BDD) + clients
      let segmentAggPromise = Promise.resolve(null)
      if (page === 0) {
        const memAgg = memGet(`segmentStats:${segment}`)
        if (memAgg) {
          segmentAggPromise = Promise.resolve(memAgg)
        } else {
          segmentAggPromise = (getSegmentStatsFromCache(segment)
            .then(cached => cached || computeSegmentStatsLive(segment)))
            .then(data => { memSet(`segmentStats:${segment}`, data); return data })
        }
      }
      const [clients, segmentAgg] = await Promise.all([
        getSegmentClients(segment, page, pageSize, sortBy, sortOrder),
        segmentAggPromise
      ])

      return res.status(200).json({
        segment,
        page,
        pageSize,
        ...(segmentAgg && { segmentStats: segmentAgg }),
        clients
      })
    }

    // ── Mode "overview" : stats + top 20 ──
    if (hasPeriod) {
      const memKey = `overview:${periodDates.startDate}:${periodDates.endDate}`
      const memOverview = memGet(memKey)
      if (memOverview) {
        console.log(`⚡ RFM stats période (mémoire) [${periodDates.startDate}→${periodDates.endDate}]`)
        return res.status(200).json(memOverview)
      }
      // Cache BDD pour les périodes standard
      const pLabel = getPeriodLabel(periodDates.startDate, periodDates.endDate)
      if (pLabel) {
        try {
          const rows = await prisma.$queryRawUnsafe(
            `SELECT data FROM application_cache WHERE module = 'rfm' AND period_type = 'period_overview' AND period_value = $1 AND store_code = '__global__' AND expires_at > NOW()`, pLabel)
          if (rows.length > 0) {
            console.log(`📦 RFM période cache hit: ${pLabel}`)
            memSet(memKey, rows[0].data)
            return res.status(200).json(rows[0].data)
          }
        } catch (e) { /* fallback live */ }
      }
      console.log(`🔍 RFM stats période [${periodDates.startDate}→${periodDates.endDate}]`)
      const result = await computeStatsWithPeriod(periodDates.startDate, periodDates.endDate)
      memSet(memKey, result)
      console.log(`✅ RFM période: ${result.stats.totalClients} clients, ${Math.round(result.stats.totalCA)}€`)
      return res.status(200).json(result)
    }

    const memOverview = memGet('overview')
    if (memOverview) {
      console.log(`⚡ RFM stats (mémoire)`)
      return res.status(200).json(memOverview)
    }
    console.log(`🔍 RFM stats`)

    // 1) Cache BDD
    const cached = await getStatsFromCache()
    if (cached) {
      memSet('overview', cached)
      return res.status(200).json(cached)
    }

    // 2) Fallback live
    const result = await computeStatsLive()
    memSet('overview', result)
    console.log(`✅ RFM live: ${result.stats.totalClients} clients, ${Math.round(result.stats.totalCA)}€`)
    return res.status(200).json(result)

  } catch (error) {
    console.error('❌ Erreur RFM:', error)
    return res.status(500).json({
      error: 'Erreur lors du calcul RFM',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Préchauffage complet du cache RFM
//  Appelle les fonctions de calcul directement (pas via handler)
//  force = true → vide le cache mémoire et recalcule tout
// ═══════════════════════════════════════════════════════════════════
const ALL_SEGMENTS = ['Ultra Champions', 'Champions', 'Loyaux', 'À Risque', 'Nouveaux', 'Perdus', 'Occasionnels']

let _rfmPrewarmPromise = null
export function prewarmRFM(force = false) {
  if (_rfmPrewarmPromise && !force) return _rfmPrewarmPromise
  if (force) memoryCache.clear()
  _rfmPrewarmPromise = (async () => {
    console.log('🔥 Préchauffage complet du cache RFM...')
    const t0 = Date.now()

    // 1) Overview (stats + top 20)
    try {
      const overview = await computeStatsLive()
      memSet('overview', overview)
      console.log(`  ✅ RFM overview: ${overview.stats.totalClients} clients`)
    } catch (err) { console.error(`  ❌ RFM overview:`, err.message) }

    // 2) Stats de chaque segment
    for (const seg of ALL_SEGMENTS) {
      try {
        const stats = await computeSegmentStatsLive(seg)
        if (stats) memSet(`segmentStats:${seg}`, stats)
        console.log(`  ✅ RFM segment: ${seg} (${stats?.count || 0} clients)`)
      } catch (err) { console.error(`  ❌ RFM segment ${seg}:`, err.message) }
    }

    // 3) Top produits Ultra Champions
    try {
      const products = await getTopProductsBySegment('Ultra Champions', 15)
      memSet('topProducts:Ultra Champions', { segment: 'Ultra Champions', products })
      console.log(`  ✅ RFM top products Ultra Champions`)
    } catch (err) { console.error(`  ❌ RFM top products:`, err.message) }

    // 4) Périodes rolling (3m, 6m, 12m)
    for (const months of [3, 6, 12]) {
      try {
        const now = new Date()
        const startDate = new Date(now.getFullYear(), now.getMonth() - months, now.getDate()).toISOString().split('T')[0]
        const endDate = now.toISOString().split('T')[0]
        const result = await computeStatsWithPeriod(startDate, endDate)
        memSet(`overview:${startDate}:${endDate}`, result)
        console.log(`  ✅ RFM période last_${months}m: ${result.stats.totalClients} clients`)
      } catch (err) { console.error(`  ❌ RFM période last_${months}m:`, err.message) }
    }

    // 5) Années (2022 → année en cours)
    const currentYear = new Date().getFullYear()
    for (let y = 2022; y <= currentYear; y++) {
      try {
        const startDate = `${y}-01-01`
        const endDate = `${y}-12-31`
        const result = await computeStatsWithPeriod(startDate, endDate)
        memSet(`overview:${startDate}:${endDate}`, result)
        console.log(`  ✅ RFM année ${y}: ${result.stats.totalClients} clients`)
      } catch (err) { console.error(`  ❌ RFM année ${y}:`, err.message) }
    }

    console.log(`📦 RFM prewarm terminé en ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  })()
  return _rfmPrewarmPromise
}
