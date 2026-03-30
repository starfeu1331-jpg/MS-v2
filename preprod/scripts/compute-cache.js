#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CALCUL COMPLET DU CACHE APPLICATION
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Script unique de pré-calcul et mise en cache de TOUTES les données
 *  nécessaires à l'application. Remplace compute-rfm.js.
 *
 *  Opérations :
 *
 *  PHASE 1 — RFM
 *    1. Met à jour la table `clients` avec scores R, F, M + métriques brutes
 *    2. Cache les stats agrégées RFM (overview + top 20 clients)
 *    3. Cache les KPIs détaillés par segment (7 entrées)
 *    4. Cache les top produits Ultra Champions
 *
 *  PHASE 2 — DASHBOARD
 *    5. Pré-calcule et cache le dashboard pour chaque période standard
 *       (2022, 2023, 2024, 2025, all, 3 mois, 6 mois, 12 mois)
 *
 *  Planification recommandée (crontab) :
 *    10 0 * * *  cd /path/to/preprod && node scripts/compute-cache.js >> logs/cache.log 2>&1
 *
 *  Exécution manuelle :
 *    node scripts/compute-cache.js
 *    node scripts/compute-cache.js --rfm-only      # Phase 1 uniquement
 *    node scripts/compute-cache.js --dashboard-only # Phase 2 uniquement
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.production' })

const prisma = new PrismaClient({ log: ['warn', 'error'] })

const args = process.argv.slice(2)
const RFM_ONLY = args.includes('--rfm-only')
const DASHBOARD_ONLY = args.includes('--dashboard-only')

// ─── Sérialisation BigInt ──────────────────────────────────────────
function serialize(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  )
}

// ─── Helper cache BDD ──────────────────────────────────────────────
async function upsertCache(module, periodType, periodValue, data, expiresAt) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO application_cache (module, period_type, period_value, store_code, data, computed_at, expires_at, version)
     VALUES ($1, $2, $3, '__global__', $4::jsonb, NOW(), $5, 2)
     ON CONFLICT ON CONSTRAINT uq_cache_entry
     DO UPDATE SET data = $4::jsonb, computed_at = NOW(), expires_at = $5, version = 2`,
    module, periodType, periodValue, JSON.stringify(data), expiresAt
  )
}

// ─── WHERE clause globale ──────────────────────────────────────────
const WHERE_CLAUSE = "c.carte != '0' AND t.depot != '41'"

// ═══════════════════════════════════════════════════════════════════
//  PHASE 1 : RFM
// ═══════════════════════════════════════════════════════════════════

async function updateClientScores() {
  console.log('📊 [RFM 1/4] Mise à jour des scores sur la table clients...')
  const t0 = Date.now()

  const result = await prisma.$executeRawUnsafe(`
    WITH client_metrics AS (
      SELECT
        c.carte,
        COUNT(DISTINCT t.facture)::int                        AS frequency,
        SUM(t.ca)::numeric                                    AS monetary,
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int   AS recency,
        MAX(t.date)::text                                     AS last_date,
        MIN(t.date)::text                                     AS first_date
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE c.carte != '0' AND t.depot != '41'
      GROUP BY c.carte
      HAVING SUM(t.ca) > 0
    ),
    rfm AS (
      SELECT
        carte, frequency, monetary, recency, last_date, first_date,
        (6 - NTILE(5) OVER (ORDER BY recency   ASC ))::int AS r,
        (6 - NTILE(5) OVER (ORDER BY frequency  DESC))::int AS f,
        (6 - NTILE(5) OVER (ORDER BY monetary   DESC))::int AS m
      FROM client_metrics
    )
    UPDATE clients c SET
      rfm_r           = s.r,
      rfm_f           = s.f,
      rfm_m           = s.m,
      rfm_score       = s.r * 100 + s.f * 10 + s.m,
      rfm_recency     = s.recency,
      rfm_frequency   = s.frequency,
      rfm_monetary    = s.monetary,
      rfm_last_date   = s.last_date,
      rfm_first_date  = s.first_date,
      rfm_segment     = CASE
        WHEN s.r = 5 AND s.f = 5 AND s.m = 5 THEN 'Ultra Champions'
        WHEN s.r >= 4 AND s.f >= 4 AND s.m >= 4 THEN 'Champions'
        WHEN s.f >= 4 AND s.r <= 2 THEN 'À Risque'
        WHEN s.f >= 4 THEN 'Loyaux'
        WHEN s.f <= 2 AND s.r >= 4 THEN 'Nouveaux'
        WHEN s.r <= 2 THEN 'Perdus'
        ELSE 'Occasionnels'
      END,
      rfm_computed_at = NOW()
    FROM rfm s
    WHERE c.carte = s.carte
  `)

  console.log(`   ✅ ${result} clients mis à jour (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

  // Nettoyer les clients orphelins
  const cleaned = await prisma.$executeRawUnsafe(`
    UPDATE clients SET
      rfm_r = NULL, rfm_f = NULL, rfm_m = NULL,
      rfm_score = NULL, rfm_segment = NULL,
      rfm_recency = NULL, rfm_frequency = NULL, rfm_monetary = NULL,
      rfm_last_date = NULL, rfm_first_date = NULL,
      rfm_computed_at = NOW()
    WHERE rfm_segment IS NOT NULL
      AND carte NOT IN (
        SELECT DISTINCT t.carte
        FROM transactions t
        WHERE t.carte IS NOT NULL AND t.carte != '0' AND t.depot != '41' AND t.ca > 0
      )
  `)
  if (cleaned > 0) console.log(`   🧹 ${cleaned} clients nettoyés`)

  // Log distribution
  const dist = serialize(await prisma.$queryRawUnsafe(`
    SELECT rfm_segment, COUNT(*)::int AS n, ROUND(SUM(rfm_monetary)::numeric)::bigint AS ca
    FROM clients WHERE rfm_segment IS NOT NULL
    GROUP BY rfm_segment ORDER BY ca DESC
  `))
  console.log('   📊 Distribution :')
  dist.forEach(d =>
    console.log(`      ${d.rfm_segment.padEnd(18)} ${String(d.n).padStart(7)} clients   ${Number(d.ca).toLocaleString('fr-FR').padStart(12)}€`)
  )
}

async function buildRfmOverview() {
  const t0 = Date.now()
  const segmentRows = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered AS (
      SELECT c.carte, c.rfm_r, c.rfm_f, c.rfm_m, c.rfm_monetary, c.date_naissance
      FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${WHERE_CLAUSE} AND c.rfm_segment IS NOT NULL
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
    GROUP BY 1 ORDER BY ca DESC
  `))

  const segments = {}
  let totalClients = 0, totalCA = 0
  segmentRows.forEach(row => {
    totalClients += row.count
    totalCA += parseFloat(row.ca)
    segments[row.segment] = {
      count: row.count, ca: parseFloat(row.ca),
      ageMoyen: row.age_moyen || null, avecAge: row.avec_age,
      pctAge: row.count > 0 ? Math.round((row.avec_age / row.count) * 100) : 0
    }
  })

  const top20 = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered_cartes AS (
      SELECT DISTINCT c.carte FROM clients c
      INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${WHERE_CLAUSE} AND c.rfm_segment IS NOT NULL
      GROUP BY c.carte HAVING SUM(t.ca) > 0
    )
    SELECT c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp,
      c.rfm_r AS "R", c.rfm_f AS "F", c.rfm_m AS "M", c.rfm_score AS "RFM",
      c.rfm_segment AS segment, c.rfm_recency AS recency, c.rfm_frequency AS frequency,
      c.rfm_monetary::float AS monetary, c.rfm_last_date AS "lastDate", c.rfm_first_date AS "firstDate"
    FROM clients c INNER JOIN filtered_cartes fc ON c.carte = fc.carte
    ORDER BY c.rfm_monetary DESC NULLS LAST LIMIT 20
  `))

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1)
  expiresAt.setHours(1, 0, 0, 0)

  await upsertCache('rfm', 'filter', 'TOUS', { stats: { totalClients, totalCA, segments }, top20 }, expiresAt)
  console.log(`   📦 Overview: ${totalClients.toLocaleString('fr-FR')} clients, ${Math.round(totalCA).toLocaleString('fr-FR')}€ (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

async function buildRfmSegmentStats() {
  const t0 = Date.now()
  const rows = serialize(await prisma.$queryRawUnsafe(`
    WITH filtered AS (
      SELECT c.carte, c.rfm_segment, c.rfm_recency, c.rfm_frequency, c.rfm_monetary
      FROM clients c INNER JOIN transactions t ON c.carte = t.carte
      WHERE ${WHERE_CLAUSE} AND c.rfm_segment IS NOT NULL
      GROUP BY c.carte, c.rfm_segment, c.rfm_recency, c.rfm_frequency, c.rfm_monetary
      HAVING SUM(t.ca) > 0
    )
    SELECT
      rfm_segment AS segment, COUNT(*)::int AS count,
      ROUND(SUM(rfm_monetary)::numeric, 2) AS ca,
      ROUND(AVG(rfm_frequency)::numeric, 1) AS freq_moy,
      ROUND(AVG(rfm_recency)::numeric, 1) AS recence_moy,
      ROUND((SUM(rfm_monetary) / NULLIF(SUM(rfm_frequency), 0))::numeric, 2) AS panier_moy,
      MIN(rfm_recency)::int AS recence_min, MAX(rfm_recency)::int AS recence_max,
      MIN(rfm_monetary)::float AS ca_min, MAX(rfm_monetary)::float AS ca_max,
      COUNT(CASE WHEN rfm_frequency > 1 THEN 1 END)::int AS multi_achat
    FROM filtered GROUP BY rfm_segment
  `))

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1)
  expiresAt.setHours(1, 0, 0, 0)

  for (const row of rows) {
    const count = row.count || 0
    const ca = parseFloat(row.ca) || 0
    await upsertCache('rfm', 'segment', row.segment, {
      count, ca,
      frequenceMoyenne: parseFloat(row.freq_moy) || 0,
      recenceMoyenne: parseFloat(row.recence_moy) || 0,
      panierMoyen: parseFloat(row.panier_moy) || 0,
      caParClient: count > 0 ? Math.round((ca / count) * 100) / 100 : 0,
      recenceMin: row.recence_min ?? 0, recenceMax: row.recence_max ?? 0,
      caMin: row.ca_min ?? 0, caMax: row.ca_max ?? 0,
      tauxRetention: count > 0 ? Math.round((row.multi_achat / count) * 1000) / 10 : 0,
      multiAchat: row.multi_achat ?? 0
    }, expiresAt)
  }
  console.log(`   📊 ${rows.length} segments cachés (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

async function buildRfmTopProducts() {
  const t0 = Date.now()
  const rows = serialize(await prisma.$queryRawUnsafe(`
    SELECT p.id AS code, p.designation AS nom, p.famille, p.sous_famille,
      ROUND(SUM(t.ca)::numeric, 2) AS ca, SUM(t.quantite)::int AS volume,
      COUNT(DISTINCT t.carte)::int AS nb_clients
    FROM transactions t
    INNER JOIN clients c ON c.carte = t.carte
    INNER JOIN produits p ON p.id = t.produit
    WHERE ${WHERE_CLAUSE} AND c.rfm_segment = 'Ultra Champions' AND t.ca > 0
    GROUP BY p.id, p.designation, p.famille, p.sous_famille
    ORDER BY ca DESC LIMIT 15
  `))

  const products = rows.map(r => ({ ...r, ca: parseFloat(r.ca) || 0 }))
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 1)
  expiresAt.setHours(1, 0, 0, 0)

  await upsertCache('rfm', 'top_products', 'Ultra Champions', { segment: 'Ultra Champions', products }, expiresAt)
  console.log(`   🏆 ${products.length} top produits Ultra Champions (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 2 : DASHBOARD — Pré-calcul de chaque période standard
// ═══════════════════════════════════════════════════════════════════

async function computeDashboardPeriod(label, dateCondition, params, prevDateCondition, prevParams, ncCondition, ncParams, prevNcCondition, prevNcParams, periodType, periodValue, ttlMs) {
  const t0 = Date.now()

  // KPIs
  const [kpiCa, kpiTickets, kpiClients] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(t.ca), 0)::numeric as v FROM transactions t ${dateCondition}`, ...params),
    prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT t.facture)::int as v FROM transactions t ${dateCondition}`, ...params),
    prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT t.carte)::int as v FROM transactions t ${dateCondition}`, ...params),
  ])

  const totalCA = parseFloat(kpiCa[0].v) || 0
  const totalTickets = kpiTickets[0].v || 0
  const totalClients = kpiClients[0].v || 0
  const panierMoyen = totalTickets > 0 ? totalCA / totalTickets : 0

  // Clients stats, top data, previous period KPIs, nouveaux clients — tout en parallèle
  const clientDateCond = dateCondition.replace(/\bt\./g, 'tx.')
  const [statsClientsR, topProduits, topMagasins, topClients, evolution, topFamilles, joursSemaine, prevCa, prevTickets, prevClients, ncResult, prevNcResult] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total,
        COUNT(CASE WHEN c.sexe = 'H' THEN 1 END)::int as hommes,
        COUNT(CASE WHEN c.sexe = 'F' THEN 1 END)::int as femmes,
        COUNT(CASE WHEN c.nom IS NOT NULL AND c.nom != '' THEN 1 END)::int as avec_nom,
        COUNT(CASE WHEN c.prenom IS NOT NULL AND c.prenom != '' THEN 1 END)::int as avec_prenom,
        COUNT(CASE WHEN c.email IS NOT NULL AND c.email != '' THEN 1 END)::int as avec_email,
        COUNT(CASE WHEN c.telephone IS NOT NULL AND c.telephone != '' THEN 1 END)::int as avec_telephone,
        COUNT(CASE WHEN c.date_naissance IS NOT NULL AND c.date_naissance != '' THEN 1 END)::int as avec_age,
        COALESCE(AVG(CASE WHEN c.date_naissance IS NOT NULL AND c.date_naissance != '' AND c.date_naissance ~ '^\\d{4}-\\d{2}-\\d{2}$'
          THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, c.date_naissance::date)) END), 0)::numeric as age_moyen
      FROM clients c WHERE EXISTS (SELECT 1 FROM transactions tx ${clientDateCond} AND tx.carte = c.carte)
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT p.id as code, COALESCE(p.designation, p.id) as nom, COALESCE(p.sous_famille, '') as sous_famille,
        COALESCE(p.famille, '') as famille, SUM(t.ca)::numeric as ca, SUM(t.quantite)::int as volume,
        COUNT(DISTINCT t.facture)::int as nb_tickets
      FROM transactions t JOIN produits p ON p.id = t.produit ${dateCondition}
      AND UPPER(COALESCE(p.famille, '')) NOT LIKE '%DIVERS%'
      AND p.id != '800001'
      GROUP BY p.id, p.designation, p.sous_famille, p.famille ORDER BY ca DESC LIMIT 10
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT m.code, m.nom, COALESCE(m.zone, '') as zone, COALESCE(m.ville, '') as ville,
        SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as nb_tickets, COUNT(DISTINCT t.carte)::int as nb_clients
      FROM transactions t JOIN magasins m ON m.code = t.depot ${dateCondition}
      GROUP BY m.code, m.nom, m.zone, m.ville ORDER BY ca DESC LIMIT 10
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT c.carte, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, ''))), ''), 'Client ' || c.carte) as nom_complet,
        COALESCE(c.ville, '') as ville, COALESCE(c.email, '') as email, SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_commandes, MAX(t.date)::text as derniere_visite
      FROM transactions t JOIN clients c ON c.carte = t.carte ${dateCondition}
      AND t.carte IS NOT NULL AND t.carte != '' AND t.carte != '0'
      GROUP BY c.carte, c.nom, c.prenom, c.ville, c.email ORDER BY ca DESC LIMIT 10
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT TO_CHAR(t.date, 'YYYY-MM') as mois, TO_CHAR(t.date, 'Mon YYYY') as mois_label,
        SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as tickets,
        COUNT(DISTINCT t.carte)::int as clients,
        CASE WHEN COUNT(DISTINCT t.facture) > 0 THEN (SUM(t.ca) / COUNT(DISTINCT t.facture))::numeric ELSE 0 END as panier_moyen
      FROM transactions t ${dateCondition}
      GROUP BY TO_CHAR(t.date, 'YYYY-MM'), TO_CHAR(t.date, 'Mon YYYY') ORDER BY mois ASC
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT COALESCE(p.famille, 'Non classé') as famille, SUM(t.ca)::numeric as ca,
        COUNT(DISTINCT t.facture)::int as nb_tickets, SUM(t.quantite)::int as volume
      FROM transactions t JOIN produits p ON p.id = t.produit ${dateCondition}
      AND UPPER(COALESCE(p.famille, '')) NOT LIKE '%DIVERS%'
      GROUP BY p.famille ORDER BY ca DESC LIMIT 8
    `, ...params),
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(DOW FROM t.date)::int as jour_num,
        CASE EXTRACT(DOW FROM t.date)::int
          WHEN 0 THEN 'Dim' WHEN 1 THEN 'Lun' WHEN 2 THEN 'Mar' WHEN 3 THEN 'Mer'
          WHEN 4 THEN 'Jeu' WHEN 5 THEN 'Ven' WHEN 6 THEN 'Sam' END as jour,
        SUM(t.ca)::numeric as ca, COUNT(DISTINCT t.facture)::int as tickets
      FROM transactions t ${dateCondition}
      GROUP BY EXTRACT(DOW FROM t.date) ORDER BY jour_num
    `, ...params),
    prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(t.ca), 0)::numeric as v FROM transactions t ${prevDateCondition}`, ...prevParams),
    prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT t.facture)::int as v FROM transactions t ${prevDateCondition}`, ...prevParams),
    prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT t.carte)::int as v FROM transactions t ${prevDateCondition}`, ...prevParams),
    prisma.$queryRawUnsafe(ncCondition, ...ncParams),
    prisma.$queryRawUnsafe(prevNcCondition, ...prevNcParams),
  ])

  const prevCA = parseFloat(prevCa[0].v) || 0
  const prevTix = prevTickets[0].v || 0
  const prevCli = prevClients[0].v || 0
  const prevPM = prevTix > 0 ? prevCA / prevTix : 0
  const nouveauxClients = ncResult[0]?.nb || 0
  const prevNouveauxClients = prevNcResult[0]?.nb || 0
  const pctChange = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : null

  const sc = statsClientsR[0]
  const totalCl = Math.max(sc.total, 1)

  const response = serialize({
    kpis: {
      totalCA, totalTickets, totalClients, panierMoyen, nouveauxClients,
      evolution: {
        ca: pctChange(totalCA, prevCA), tickets: pctChange(totalTickets, prevTix),
        clients: pctChange(totalClients, prevCli), panierMoyen: pctChange(panierMoyen, prevPM),
        nouveauxClients: pctChange(nouveauxClients, prevNouveauxClients),
      }
    },
    statsClients: {
      total: sc.total, hommes: sc.hommes, femmes: sc.femmes,
      avecNom: sc.avec_nom, avecPrenom: sc.avec_prenom, avecEmail: sc.avec_email,
      avecTelephone: sc.avec_telephone, avecAge: sc.avec_age,
      ageMoyen: Math.round(parseFloat(sc.age_moyen) || 0),
      pctHommes: (sc.hommes / totalCl) * 100, pctFemmes: (sc.femmes / totalCl) * 100,
      pctEmail: (sc.avec_email / totalCl) * 100, pctTelephone: (sc.avec_telephone / totalCl) * 100,
      pctAge: (sc.avec_age / totalCl) * 100
    },
    topProduits: topProduits.map(p => ({
      code: p.code, nom: p.nom, sous_famille: p.sous_famille, famille: p.famille,
      ca: parseFloat(p.ca) || 0, volume: p.volume, nbTickets: p.nb_tickets
    })),
    topMagasins: topMagasins.map(m => ({
      code: m.code, nom: m.nom, zone: m.zone, ville: m.ville,
      ca: parseFloat(m.ca) || 0, nbTickets: m.nb_tickets, nbClients: m.nb_clients
    })),
    topClients: topClients.map(c => ({
      carte: c.carte, nom: c.nom_complet, ville: c.ville, email: c.email,
      ca: parseFloat(c.ca) || 0, nbCommandes: c.nb_commandes, derniereVisite: c.derniere_visite
    })),
    evolutionMensuelle: evolution.map(e => ({
      mois: e.mois_label, moisKey: e.mois, ca: parseFloat(e.ca) || 0,
      tickets: e.tickets, clients: e.clients, panierMoyen: parseFloat(e.panier_moyen) || 0
    })),
    topFamilles: topFamilles.map(f => ({
      famille: f.famille, ca: parseFloat(f.ca) || 0, nbTickets: f.nb_tickets, volume: f.volume
    })),
    repartitionJours: joursSemaine.map(j => ({
      jour: j.jour, ca: parseFloat(j.ca) || 0, tickets: j.tickets
    })),
    _meta: { source: 'compute-cache', calculatedAt: new Date().toISOString(), engine: 'PostgreSQL Direct Queries' }
  })

  await upsertCache('dashboard', periodType, periodValue, response, new Date(Date.now() + ttlMs))
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`   ✅ ${label.padEnd(18)} CA=${Math.round(totalCA).toLocaleString('fr-FR').padStart(12)}€  Tickets=${String(totalTickets).padStart(8)}  NvxClients=${String(nouveauxClients).padStart(6)}  (${elapsed}s)`)
}

async function computeAllDashboardPeriods() {
  const currentYear = new Date().getFullYear()
  const BASE = "WHERE 1=1 AND t.depot != '41'"

  const periods = [
    // Années
    ...([2022, 2023, 2024, 2025].map(y => ({
      label: `year=${y}`,
      dateCond: `WHERE 1=1 AND t.date >= '${y}-01-01'::date AND t.date < '${y + 1}-01-01'::date AND t.depot != '41'`,
      params: [],
      prevCond: `WHERE 1=1 AND t.date >= '${y - 1}-01-01'::date AND t.date < '${y}-01-01'::date AND t.depot != '41'`,
      prevParams: [],
      ncCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date_creation::date >= '${y}-01-01'::date AND date_creation::date < '${y + 1}-01-01'::date`,
      ncParams: [],
      prevNcCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date_creation::date >= '${y - 1}-01-01'::date AND date_creation::date < '${y}-01-01'::date`,
      prevNcParams: [],
      periodType: 'year', periodValue: String(y),
      ttl: y < currentYear ? 30 * 24 * 3600000 : 6 * 3600000
    }))),
    // All
    {
      label: 'all',
      dateCond: BASE, params: [],
      prevCond: `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '24 months') AND t.date < (CURRENT_DATE - INTERVAL '12 months') AND t.depot != '41'`,
      prevParams: [],
      ncCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`,
      ncParams: [],
      prevNcCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date_creation::date >= (CURRENT_DATE - INTERVAL '24 months') AND date_creation::date < (CURRENT_DATE - INTERVAL '12 months')`,
      prevNcParams: [],
      periodType: 'all', periodValue: 'all', ttl: 24 * 3600000
    },
    // Périodes glissantes
    ...[3, 6, 12].map(m => ({
      label: `last_${m}m`,
      dateCond: `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '${m} months') AND t.depot != '41'`,
      params: [],
      prevCond: `WHERE 1=1 AND t.date >= (CURRENT_DATE - INTERVAL '${m} months' - INTERVAL '12 months') AND t.date < (CURRENT_DATE - INTERVAL '12 months') AND t.depot != '41'`,
      prevParams: [],
      ncCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date_creation::date >= (CURRENT_DATE - INTERVAL '${m} months')`,
      ncParams: [],
      prevNcCond: `SELECT COUNT(*)::int as nb FROM clients WHERE date_creation IS NOT NULL AND date_creation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND date_creation::date >= (CURRENT_DATE - INTERVAL '${m} months' - INTERVAL '12 months') AND date_creation::date < (CURRENT_DATE - INTERVAL '12 months')`,
      prevNcParams: [],
      periodType: `last_${m}m`, periodValue: 'rolling', ttl: 6 * 3600000
    }))
  ]

  for (const p of periods) {
    await computeDashboardPeriod(
      p.label, p.dateCond, p.params, p.prevCond, p.prevParams,
      p.ncCond, p.ncParams, p.prevNcCond, p.prevNcParams,
      p.periodType, p.periodValue, p.ttl
    )
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  const start = Date.now()
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  🔄 CALCUL COMPLET DU CACHE — ${now}`)
  console.log('═══════════════════════════════════════════════════════')

  if (!DASHBOARD_ONLY) {
    console.log('')
    console.log('── PHASE 1 : RFM ──────────────────────────────────────')
    await updateClientScores()
    console.log('')
    console.log('📦 [RFM 2/4] Cache overview...')
    await buildRfmOverview()
    console.log('📦 [RFM 3/4] Cache KPI par segment...')
    await buildRfmSegmentStats()
    console.log('📦 [RFM 4/4] Cache top produits Ultra Champions...')
    await buildRfmTopProducts()
  }

  if (!RFM_ONLY) {
    console.log('')
    console.log('── PHASE 2 : DASHBOARD ────────────────────────────────')
    await computeAllDashboardPeriods()
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('')
  console.log(`✅ Calcul terminé en ${elapsed}s`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
}

main()
  .catch(e => {
    console.error('')
    console.error('❌ ERREUR FATALE :', e.message)
    console.error(e.stack)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
