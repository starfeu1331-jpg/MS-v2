import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '&connection_limit=8&pool_timeout=30'
    }
  }
})

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

// ═══════════════════════════════════════════════════════
// Cache en mémoire (TTL 5 minutes) pour éviter de 
// recalculer 8 requêtes lourdes à chaque page load
// ═══════════════════════════════════════════════════════
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function getCacheKey(query) {
  return JSON.stringify(query)
}

function getCached(key) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
  if (entry) cache.delete(key)
  return null
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
  // Nettoyage périodique (max 50 entrées)
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)
    for (let i = 0; i < 10; i++) cache.delete(oldest[i][0])
  }
}

// ═══════════════════════════════════════════════════════
// Cache persistent en BDD (application_cache)
// Survit aux redémarrages du serveur — TTL long
// ═══════════════════════════════════════════════════════
function getDbCacheKey(year, startDate, endDate, months) {
  if (months) return { periodType: `last_${months}m`, periodValue: 'rolling' }
  if (year && year !== 'all') return { periodType: 'year', periodValue: String(year) }
  if (!startDate && !endDate) return { periodType: 'all', periodValue: 'all' }
  return null // plages personnalisées non cachées en BDD
}

function getDbCacheTTL(periodType, periodValue) {
  if (periodType === 'year') {
    const currentYear = new Date().getFullYear()
    return parseInt(periodValue) < currentYear
      ? 30 * 24 * 60 * 60 * 1000  // 30 jours — années passées (données figées)
      : 6 * 60 * 60 * 1000         // 6h — année en cours
  }
  if (periodType === 'all') return 24 * 60 * 60 * 1000  // 24h
  return 6 * 60 * 60 * 1000  // 6h — périodes glissantes
}

async function getDbCache(periodType, periodValue) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT data FROM application_cache WHERE module = 'dashboard' AND period_type = $1 AND period_value = $2 AND store_code = '__global__' AND expires_at > NOW()`,
      periodType, periodValue
    )
    if (rows.length > 0) {
      console.log(`📦 DB cache hit: dashboard/${periodType}/${periodValue}`)
      return rows[0].data
    }
    return null
  } catch (e) {
    console.error('DB cache read error:', e.message)
    return null
  }
}

async function setDbCache(periodType, periodValue, data, ttlMs) {
  try {
    const expiresAt = new Date(Date.now() + ttlMs)
    await prisma.$queryRawUnsafe(
      `INSERT INTO application_cache (module, period_type, period_value, store_code, data, computed_at, expires_at, version)
       VALUES ('dashboard', $1, $2, '__global__', $3::jsonb, NOW(), $4, 1)
       ON CONFLICT ON CONSTRAINT uq_cache_entry 
       DO UPDATE SET data = $3::jsonb, computed_at = NOW(), expires_at = $4`,
      periodType, periodValue, JSON.stringify(data), expiresAt
    )
    console.log(`💾 DB cache saved: dashboard/${periodType}/${periodValue} (TTL ${Math.round(ttlMs / 3600000)}h)`)
  } catch (e) {
    console.error('DB cache write error:', e.message)
  }
}

// ═══════════════════════════════════════════════════════
// Préchargement du cache au démarrage du serveur
// Toutes les périodes standard sont pré-calculées
// pour que chaque utilisateur ait une réponse instantanée
// ═══════════════════════════════════════════════════════
let _prewarmPromise = null
export function prewarmCache(force = false) {
  if (_prewarmPromise && !force) return _prewarmPromise
  if (force) cache.clear()
  _prewarmPromise = (async () => {
    console.log('🔥 Préchauffage de toutes les périodes standard...')
    const periods = [
      { year: '2025' }, { year: '2024' }, { year: '2023' }, { year: '2022' },
      { year: 'all' },
      { months: '3' }, { months: '6' }, { months: '12' },
    ]
    
    for (const params of periods) {
      try {
        const fakeReq = { method: 'GET', query: params }
        const fakeRes = {
          _statusCode: 200,
          _body: null,
          status(code) { this._statusCode = code; return this },
          json(data) { this._body = data; return this },
          end() { return this }
        }
        await handler(fakeReq, fakeRes)
        const label = params.year ? `year=${params.year}` : `months=${params.months}`
        console.log(`  ✅ ${label}`)
      } catch (err) {
        const label = params.year ? `year=${params.year}` : `months=${params.months}`
        console.error(`  ❌ ${label}:`, err.message)
      }
    }
    console.log(`📦 Cache mémoire: ${cache.size} entrées | Cache BDD: 8 entrées`)
  })()
  return _prewarmPromise
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { year, startDate, endDate, months } = req.query

  // 1. Cache mémoire (TTL 5 min)
  const cacheKey = getCacheKey({ year, startDate, endDate, months })
  const cached = getCached(cacheKey)
  if (cached) {
    return res.status(200).json(cached)
  }

  // 2. Cache BDD persistent (TTL heures/jours)
  const dbKey = getDbCacheKey(year, startDate, endDate, months)
  if (dbKey) {
    const dbCached = await getDbCache(dbKey.periodType, dbKey.periodValue)
    if (dbCached) {
      setCache(cacheKey, dbCached) // repopuler le cache mémoire
      return res.status(200).json(dbCached)
    }
  }

  try {
    // ═══════════════════════════════════════════════════════
    // Construction de la clause WHERE sur les dates
    // ═══════════════════════════════════════════════════════
    let dateCondition = 'WHERE 1=1'
    const params = []
    let paramIdx = 1

    if (startDate && endDate) {
      dateCondition = `WHERE 1=1 AND t.date >= $${paramIdx}::timestamp AND t.date <= $${paramIdx + 1}::timestamp`
      params.push(startDate, endDate)
      paramIdx += 2
    } else if (months) {
      dateCondition = `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '1 month' * $${paramIdx}::int)`
      params.push(parseInt(months))
      paramIdx += 1
    } else if (year && year !== 'all') {
      // Use range condition to leverage idx_transactions_date B-tree index
      // EXTRACT(YEAR FROM date) = X cannot use the index → full table scan on 6M+ rows
      const y = parseInt(year)
      dateCondition = `WHERE 1=1 AND t.date >= $${paramIdx}::date AND t.date < $${paramIdx + 1}::date`
      params.push(`${y}-01-01`, `${y + 1}-01-01`)
      paramIdx += 2
    }
    // si year === 'all', pas de condition de date

    // Exclure le dépôt 41 (dépôt virtuel, données fantômes facture='0', carte='0')
    dateCondition += " AND t.depot != '41'"

    // ═══════════════════════════════════════════════════════
    // Construction de la clause WHERE pour la période N-1
    // (mêmes mois, un an plus tôt — pour les % d'évolution KPI)
    // ═══════════════════════════════════════════════════════
    let prevDateCondition = null
    const prevParams = []

    if (startDate && endDate) {
      // Custom range → même plage 1 an avant
      const start = new Date(startDate)
      const end = new Date(endDate)
      const prevStart = new Date(start)
      prevStart.setFullYear(prevStart.getFullYear() - 1)
      const prevEnd = new Date(end)
      prevEnd.setFullYear(prevEnd.getFullYear() - 1)
      prevDateCondition = `WHERE 1=1 AND t.date >= $1::timestamp AND t.date <= $2::timestamp AND t.depot != '41'`
      prevParams.push(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0])
    } else if (months) {
      // N derniers mois → mêmes N mois un an avant
      // Ex: 3 derniers mois (déc 2025 - fév 2026) → (déc 2024 - fév 2025)
      const m = parseInt(months)
      prevDateCondition = `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '1 month' * $1::int - INTERVAL '12 months') AND t.date < (CURRENT_DATE - INTERVAL '12 months') AND t.depot != '41'`
      prevParams.push(m)
    } else if (year && year !== 'all') {
      // Année X → année X-1
      const y = parseInt(year)
      prevDateCondition = `WHERE 1=1 AND t.date >= $1::date AND t.date < $2::date AND t.depot != '41'`
      prevParams.push(`${y - 1}-01-01`, `${y}-01-01`)
    } else {
      // all → on compare les 12 derniers mois vs les mêmes 12 mois un an avant
      prevDateCondition = `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '24 months') AND t.date < (CURRENT_DATE - INTERVAL '12 months') AND t.depot != '41'`
    }

    // ═══════════════════════════════════════════════════════
    // 1. KPIs principaux — 3 requêtes séparées en parallèle
    //    La requête combinée faisait 4.1s car COUNT(DISTINCT)
    //    x2 + SUM dans un seul scan. En splitant, chaque 
    //    sous-requête est ~1.5s et elles tournent en parallèle.
    // ═══════════════════════════════════════════════════════
    const kpiCaQuery = `
      SELECT COALESCE(SUM(t.ca), 0)::numeric as total_ca
      FROM transactions t ${dateCondition}
    `
    const kpiTicketsQuery = `
      SELECT COUNT(DISTINCT t.facture)::int as total_tickets
      FROM transactions t ${dateCondition}
    `
    const kpiClientsQuery = `
      SELECT COUNT(DISTINCT t.carte)::int as total_clients
      FROM transactions t ${dateCondition}
    `

    // ═══════════════════════════════════════════════════════
    // 2. Statistiques clients (qualité des données)
    // ═══════════════════════════════════════════════════════
    const clientDateCondition = dateCondition.replace(/\bt\./g, 'tx.')
    const statsClientsQuery = `
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN c.sexe = 'H' THEN 1 END)::int as hommes,
        COUNT(CASE WHEN c.sexe = 'F' THEN 1 END)::int as femmes,
        COUNT(CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN 1 END)::int as avec_nom,
        COUNT(CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN 1 END)::int as avec_prenom,
        COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END)::int as avec_email,
        COUNT(CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN 1 END)::int as avec_telephone,
        COUNT(CASE WHEN c.date_naissance IS NOT NULL AND c.date_naissance != '' THEN 1 END)::int as avec_age,
        COALESCE(AVG(
          CASE WHEN c.date_naissance IS NOT NULL AND c.date_naissance != '' AND c.date_naissance ~ '^\\d{4}-\\d{2}-\\d{2}$'
          THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.date_naissance::date))
          ELSE NULL END
        ), 0)::numeric as age_moyen
      FROM clients c
      WHERE EXISTS (
        SELECT 1 FROM transactions tx ${clientDateCondition} AND tx.carte = c.carte
      )
    `

    // ═══════════════════════════════════════════════════════
    // 3. Top 10 produits par CA (excl. Divers Facture Compta)
    // ═══════════════════════════════════════════════════════
    const topProduitsQuery = `
      SELECT 
        p.id as code,
        COALESCE(p.designation, p.id) as nom,
        COALESCE(p.sous_famille, '') as sous_famille,
        COALESCE(p.famille, '') as famille,
        SUM(t.ca)::numeric as ca,
        SUM(t.quantite)::int as volume,
        COUNT(DISTINCT t.facture)::int as nb_tickets
      FROM transactions t
      JOIN produits p ON p.id = t.produit
      ${dateCondition}
      AND UPPER(COALESCE(p.famille, '')) NOT LIKE '%DIVERS%'
      AND p.id != '800001'
      GROUP BY p.id, p.designation, p.sous_famille, p.famille
      ORDER BY ca DESC
      LIMIT 10
    `

    // ═══════════════════════════════════════════════════════
    // 4. Top magasins par CA
    // ═══════════════════════════════════════════════════════
    const topMagasinsQuery = `
      SELECT 
        m.code,
        m.nom,
        COALESCE(m.zone, '') as zone,
        COALESCE(m.ville, '') as ville,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_tickets,
        COUNT(DISTINCT t.carte)::int as nb_clients
      FROM transactions t
      JOIN magasins m ON m.code = t.depot
      ${dateCondition}
      GROUP BY m.code, m.nom, m.zone, m.ville
      ORDER BY ca DESC
      LIMIT 10
    `

    // ═══════════════════════════════════════════════════════
    // 5. Top 10 clients par CA (avec noms)
    // ═══════════════════════════════════════════════════════
    const topClientsQuery = `
      SELECT 
        c.carte,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, ''))), ''), 'Client ' || c.carte) as nom_complet,
        COALESCE(c.ville, '') as ville,
        COALESCE(c.email, '') as email,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_commandes,
        MAX(t.date)::text as derniere_visite
      FROM transactions t
      JOIN clients c ON c.carte = t.carte
      ${dateCondition}
      AND t.carte IS NOT NULL AND t.carte != '' AND t.carte != '0'
      GROUP BY c.carte, c.nom, c.prenom, c.ville, c.email
      ORDER BY ca DESC
      LIMIT 10
    `

    // ═══════════════════════════════════════════════════════
    // 6. Évolution mensuelle du CA
    // ═══════════════════════════════════════════════════════
    const evolutionQuery = `
      SELECT 
        TO_CHAR(t.date, 'YYYY-MM') as mois,
        TO_CHAR(t.date, 'Mon YYYY') as mois_label,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as tickets,
        COUNT(DISTINCT t.carte)::int as clients,
        CASE 
          WHEN COUNT(DISTINCT t.facture) > 0 
          THEN (SUM(t.ca) / COUNT(DISTINCT t.facture))::numeric 
          ELSE 0 
        END as panier_moyen
      FROM transactions t
      ${dateCondition}
      GROUP BY TO_CHAR(t.date, 'YYYY-MM'), TO_CHAR(t.date, 'Mon YYYY')
      ORDER BY mois ASC
    `

    // ═══════════════════════════════════════════════════════
    // 7. Répartition par famille produit (excl. Divers)
    // ═══════════════════════════════════════════════════════
    const famillesQuery = `
      SELECT 
        COALESCE(p.famille, 'Non classé') as famille,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_tickets,
        SUM(t.quantite)::int as volume
      FROM transactions t
      JOIN produits p ON p.id = t.produit
      ${dateCondition}
      AND UPPER(COALESCE(p.famille, '')) NOT LIKE '%DIVERS%'
      GROUP BY p.famille
      ORDER BY ca DESC
      LIMIT 8
    `

    // ═══════════════════════════════════════════════════════
    // 7b. Nouveaux clients (cartes fidélité créées sur la période)
    // ═══════════════════════════════════════════════════════
    let nouveauxClientsQuery
    const ncParams = []
    const NC_DATE_FILTER = `date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`
    if (startDate && endDate) {
      nouveauxClientsQuery = `
        SELECT COUNT(*)::int as nb
        FROM clients
        WHERE ${NC_DATE_FILTER}
          AND date_creation::date >= $1::date AND date_creation::date <= $2::date
      `
      ncParams.push(startDate, endDate)
    } else if (months) {
      nouveauxClientsQuery = `
        SELECT COUNT(*)::int as nb
        FROM clients
        WHERE ${NC_DATE_FILTER}
          AND date_creation::date >= (CURRENT_DATE - INTERVAL '1 month' * $1::int)
      `
      ncParams.push(parseInt(months))
    } else if (year && year !== 'all') {
      const y = parseInt(year)
      nouveauxClientsQuery = `
        SELECT COUNT(*)::int as nb
        FROM clients
        WHERE ${NC_DATE_FILTER}
          AND date_creation::date >= $1::date AND date_creation::date < $2::date
      `
      ncParams.push(`${y}-01-01`, `${y + 1}-01-01`)
    } else {
      nouveauxClientsQuery = `
        SELECT COUNT(*)::int as nb
        FROM clients
        WHERE ${NC_DATE_FILTER}
      `
    }

    // ═══════════════════════════════════════════════════════
    // 8. Répartition par jour de la semaine  
    // ═══════════════════════════════════════════════════════
    const joursSemaineQuery = `
      SELECT 
        EXTRACT(DOW FROM t.date)::int as jour_num,
        CASE EXTRACT(DOW FROM t.date)::int
          WHEN 0 THEN 'Dim'
          WHEN 1 THEN 'Lun'
          WHEN 2 THEN 'Mar'
          WHEN 3 THEN 'Mer'
          WHEN 4 THEN 'Jeu'
          WHEN 5 THEN 'Ven'
          WHEN 6 THEN 'Sam'
        END as jour,
        SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as tickets
      FROM transactions t
      ${dateCondition}
      GROUP BY EXTRACT(DOW FROM t.date)
      ORDER BY jour_num
    `

    // ═══════════════════════════════════════════════════════
    // Execute all queries in 2 batches of 5 (connection_limit=8)
    // Batch 1: 3 KPI sub-queries + 2 light queries (~2s)
    // Batch 2: heavy queries + remaining light queries (~1.3s)
    // Total estimated: ~3.3s vs 8.6s before
    // ═══════════════════════════════════════════════════════

    // Requêtes KPI période précédente (pour % évolution)
    const prevKpiCaQuery = `SELECT COALESCE(SUM(t.ca), 0)::numeric as total_ca FROM transactions t ${prevDateCondition}`
    const prevKpiTicketsQuery = `SELECT COUNT(DISTINCT t.facture)::int as total_tickets FROM transactions t ${prevDateCondition}`
    const prevKpiClientsQuery = `SELECT COUNT(DISTINCT t.carte)::int as total_clients FROM transactions t ${prevDateCondition}`

    // Nouveaux clients période précédente (pour % évolution)
    let prevNouveauxClientsQuery
    const prevNcParams = []
    if (startDate && endDate) {
      const start = new Date(startDate); const end = new Date(endDate)
      const prevStart = new Date(start); prevStart.setFullYear(prevStart.getFullYear() - 1)
      const prevEnd = new Date(end); prevEnd.setFullYear(prevEnd.getFullYear() - 1)
      prevNouveauxClientsQuery = `SELECT COUNT(*)::int as nb FROM clients WHERE ${NC_DATE_FILTER} AND date_creation::date >= $1::date AND date_creation::date <= $2::date`
      prevNcParams.push(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0])
    } else if (months) {
      prevNouveauxClientsQuery = `SELECT COUNT(*)::int as nb FROM clients WHERE ${NC_DATE_FILTER} AND date_creation::date >= (CURRENT_DATE - INTERVAL '1 month' * $1::int - INTERVAL '12 months') AND date_creation::date < (CURRENT_DATE - INTERVAL '12 months')`
      prevNcParams.push(parseInt(months))
    } else if (year && year !== 'all') {
      const y = parseInt(year)
      prevNouveauxClientsQuery = `SELECT COUNT(*)::int as nb FROM clients WHERE ${NC_DATE_FILTER} AND date_creation::date >= $1::date AND date_creation::date < $2::date`
      prevNcParams.push(`${y - 1}-01-01`, `${y}-01-01`)
    } else {
      prevNouveauxClientsQuery = `SELECT COUNT(*)::int as nb FROM clients WHERE ${NC_DATE_FILTER} AND date_creation::date >= (CURRENT_DATE - INTERVAL '24 months') AND date_creation::date < (CURRENT_DATE - INTERVAL '12 months')`
    }

    const [kpiCaResult, kpiTicketsResult, kpiClientsResult, topProduits, evolutionMensuelle] = await Promise.all([
      prisma.$queryRawUnsafe(kpiCaQuery, ...params),
      prisma.$queryRawUnsafe(kpiTicketsQuery, ...params),
      prisma.$queryRawUnsafe(kpiClientsQuery, ...params),
      prisma.$queryRawUnsafe(topProduitsQuery, ...params),
      prisma.$queryRawUnsafe(evolutionQuery, ...params),
    ])
    const [statsClients, topClients, topMagasins, topFamilles, repartitionJours, prevCaResult, prevTicketsResult, prevClientsResult, nouveauxClientsResult, prevNouveauxClientsResult] = await Promise.all([
      prisma.$queryRawUnsafe(statsClientsQuery, ...params),
      prisma.$queryRawUnsafe(topClientsQuery, ...params),
      prisma.$queryRawUnsafe(topMagasinsQuery, ...params),
      prisma.$queryRawUnsafe(famillesQuery, ...params),
      prisma.$queryRawUnsafe(joursSemaineQuery, ...params),
      prisma.$queryRawUnsafe(prevKpiCaQuery, ...prevParams),
      prisma.$queryRawUnsafe(prevKpiTicketsQuery, ...prevParams),
      prisma.$queryRawUnsafe(prevKpiClientsQuery, ...prevParams),
      prisma.$queryRawUnsafe(nouveauxClientsQuery, ...ncParams),
      prisma.$queryRawUnsafe(prevNouveauxClientsQuery, ...prevNcParams),
    ])

    const sc = statsClients[0]
    const totalCl = Math.max(sc.total, 1)

    // ═══════════════════════════════════════════════════════
    // Formatage de la réponse finale
    // ═══════════════════════════════════════════════════════
    const totalCA = parseFloat(kpiCaResult[0].total_ca) || 0
    const totalTickets = kpiTicketsResult[0].total_tickets || 0
    const totalClients = kpiClientsResult[0].total_clients || 0
    const panierMoyen = totalTickets > 0 ? totalCA / totalTickets : 0

    // Période précédente
    const prevCA = parseFloat(prevCaResult[0].total_ca) || 0
    const prevTickets = prevTicketsResult[0].total_tickets || 0
    const prevClients = prevClientsResult[0].total_clients || 0
    const prevPanierMoyen = prevTickets > 0 ? prevCA / prevTickets : 0

    const pctChange = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : null

    const nouveauxClients = nouveauxClientsResult[0]?.nb || 0
    const prevNouveauxClients = prevNouveauxClientsResult[0]?.nb || 0

    const response = {
      kpis: {
        totalCA,
        totalTickets,
        totalClients,
        panierMoyen,
        nouveauxClients,
        evolution: {
          ca: pctChange(totalCA, prevCA),
          tickets: pctChange(totalTickets, prevTickets),
          clients: pctChange(totalClients, prevClients),
          panierMoyen: pctChange(panierMoyen, prevPanierMoyen),
          nouveauxClients: pctChange(nouveauxClients, prevNouveauxClients),
        }
      },
      statsClients: {
        total: sc.total,
        hommes: sc.hommes,
        femmes: sc.femmes,
        avecNom: sc.avec_nom,
        avecPrenom: sc.avec_prenom,
        avecEmail: sc.avec_email,
        avecTelephone: sc.avec_telephone,
        avecAge: sc.avec_age,
        ageMoyen: Math.round(parseFloat(sc.age_moyen) || 0),
        pctHommes: ((sc.hommes / totalCl) * 100),
        pctFemmes: ((sc.femmes / totalCl) * 100),
        pctEmail: ((sc.avec_email / totalCl) * 100),
        pctTelephone: ((sc.avec_telephone / totalCl) * 100),
        pctAge: ((sc.avec_age / totalCl) * 100)
      },
      topProduits: topProduits.map(p => ({
        code: p.code,
        nom: p.nom,
        sous_famille: p.sous_famille,
        famille: p.famille,
        ca: parseFloat(p.ca) || 0,
        volume: p.volume,
        nbTickets: p.nb_tickets
      })),
      topMagasins: topMagasins.map(m => ({
        code: m.code,
        nom: m.nom,
        zone: m.zone,
        ville: m.ville,
        ca: parseFloat(m.ca) || 0,
        nbTickets: m.nb_tickets,
        nbClients: m.nb_clients
      })),
      topClients: topClients.map(c => ({
        carte: c.carte,
        nom: c.nom_complet,
        ville: c.ville,
        email: c.email,
        ca: parseFloat(c.ca) || 0,
        nbCommandes: c.nb_commandes,
        derniereVisite: c.derniere_visite
      })),
      evolutionMensuelle: evolutionMensuelle.map(e => ({
        mois: e.mois_label,
        moisKey: e.mois,
        ca: parseFloat(e.ca) || 0,
        tickets: e.tickets,
        clients: e.clients,
        panierMoyen: parseFloat(e.panier_moyen) || 0
      })),
      topFamilles: topFamilles.map(f => ({
        famille: f.famille,
        ca: parseFloat(f.ca) || 0,
        nbTickets: f.nb_tickets,
        volume: f.volume
      })),
      repartitionJours: repartitionJours.map(j => ({
        jour: j.jour,
        ca: parseFloat(j.ca) || 0,
        tickets: j.tickets
      })),
      _meta: {
        source: 'direct-sql',
        calculatedAt: new Date().toISOString(),
        engine: 'PostgreSQL Direct Queries'
      }
    }

    const result = serializeJSON(response)
    setCache(cacheKey, result)

    // 3. Sauvegarder en BDD pour persistence entre restarts
    if (dbKey) {
      await setDbCache(dbKey.periodType, dbKey.periodValue, result, getDbCacheTTL(dbKey.periodType, dbKey.periodValue))
    }

    return res.status(200).json(result)

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
