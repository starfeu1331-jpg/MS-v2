import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient({ log: ['error', 'warn'] })

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Sérialisation BigInt ──────────────────────────────────────────
const serialize = (obj) =>
  JSON.parse(JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)))

// ─── Charger la population par CP depuis codes-postaux.json ────────
function loadPopulationByCP() {
  const filePath = join(__dirname, '..', 'public', 'codes-postaux.json')
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'))

  // Agréger la population par code postal (un CP peut couvrir plusieurs communes)
  const popMap = {}  // CP → { population, communes: [] }
  for (const commune of raw) {
    if (!commune.codesPostaux || !commune.population) continue
    if (commune.type === 'commune-deleguee') continue // éviter les doublons
    for (const cp of commune.codesPostaux) {
      if (!popMap[cp]) popMap[cp] = { population: 0, communes: [] }
      popMap[cp].population += commune.population
      popMap[cp].communes.push(commune.nom)
    }
  }
  return popMap
}

// ─── Style helpers ─────────────────────────────────────────────────
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
const HEADER_ALIGN = { vertical: 'middle', horizontal: 'center', wrapText: true }
const NUM_FMT_EUR = '#,##0.00 €'
const NUM_FMT_INT = '#,##0'
const NUM_FMT_PCT = '0.000%'

function styleHeader(sheet) {
  const row = sheet.getRow(1)
  row.font = HEADER_FONT
  row.fill = HEADER_FILL
  row.alignment = HEADER_ALIGN
  row.height = 28
}

function autoFilter(sheet, colCount) {
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } }
}

// ═══════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('📊 Export Pénétration CP — Début')
    const t0 = Date.now()

    // ─── 1. Charger population ────────────────────────
    const popMap = loadPopulationByCP()
    console.log(`  ✅ Population chargée: ${Object.keys(popMap).length} CP`)

    // ─── 2. Charger magasins ──────────────────────────
    const magasins = serialize(await prisma.magasin.findMany({ orderBy: { nom: 'asc' } }))
    console.log(`  ✅ ${magasins.length} magasins`)

    // ─── 3. Requête SQL: TOUS les CP × magasin ───────
    // Pas de seuil HAVING, on veut TOUS les CP même avec 1 client
    const rawData = serialize(await prisma.$queryRawUnsafe(`
      SELECT
        t.depot                          AS store_code,
        c.cp::text                       AS cp,
        STRING_AGG(DISTINCT c.ville, ', ') AS ville,
        COUNT(DISTINCT t.carte)::int     AS nb_clients,
        SUM(t.ca)::numeric              AS total_ca,
        COUNT(*)::int                    AS nb_transactions,
        COUNT(DISTINCT t.facture)::int   AS nb_factures
      FROM transactions t
      INNER JOIN clients c ON t.carte = c.carte
      WHERE t.ca > 0
        AND c.cp IS NOT NULL AND c.cp != ''
        AND t.carte != '0'
        AND t.depot != '41'
      GROUP BY t.depot, c.cp
      ORDER BY t.depot, SUM(t.ca) DESC
    `))
    console.log(`  ✅ ${rawData.length} lignes CP×magasin`)

    // ─── 4. Mapping store_code → magasin info ─────────
    const storeMap = {}
    for (const m of magasins) {
      storeMap[m.code] = m
      // Aussi mapper avec préfixe M (certains dépôts sont stockés "M14" vs "14")
      storeMap[`M${m.code}`] = m
    }

    // ─── 5. Enrichir chaque ligne avec population + taux ──
    const enriched = rawData.map(row => {
      const pop = popMap[row.cp]
      const mag = storeMap[row.store_code]
      return {
        cp: row.cp,
        ville: row.ville,
        store_code: row.store_code,
        store_nom: mag?.nom || `Dépôt ${row.store_code}`,
        store_ville: mag?.ville || '',
        nb_clients: row.nb_clients,
        total_ca: parseFloat(row.total_ca),
        nb_transactions: row.nb_transactions,
        nb_factures: row.nb_factures,
        population: pop?.population || null,
        taux_penetration: pop?.population ? row.nb_clients / pop.population : null,
        ca_par_habitant: pop?.population ? parseFloat(row.total_ca) / pop.population : null,
      }
    })

    // ─── 6. Agréger par CP (tous magasins confondus) ──
    const cpAggMap = {}
    for (const row of enriched) {
      if (!cpAggMap[row.cp]) {
        cpAggMap[row.cp] = {
          cp: row.cp,
          ville: row.ville,
          nb_clients: 0,
          total_ca: 0,
          nb_transactions: 0,
          nb_factures: 0,
          population: row.population,
          magasins: new Set(),
          magasin_principal: null,
          ca_max: 0,
        }
      }
      const agg = cpAggMap[row.cp]
      agg.nb_clients += row.nb_clients
      agg.total_ca += row.total_ca
      agg.nb_transactions += row.nb_transactions
      agg.nb_factures += row.nb_factures
      agg.magasins.add(row.store_nom)
      // Le magasin principal = celui qui génère le plus de CA sur ce CP
      if (row.total_ca > agg.ca_max) {
        agg.ca_max = row.total_ca
        agg.magasin_principal = row.store_nom
      }
    }
    const cpAgg = Object.values(cpAggMap)
      .map(a => ({
        ...a,
        magasins: [...a.magasins].join(', '),
        nb_magasins: a.magasins.size,
        taux_penetration: a.population ? a.nb_clients / a.population : null,
        ca_par_habitant: a.population ? a.total_ca / a.population : null,
      }))
      .sort((a, b) => b.total_ca - a.total_ca)

    // ─── 7. Agréger par magasin (pour l'onglet résumé) ──
    const magAggMap = {}
    for (const row of enriched) {
      if (!magAggMap[row.store_code]) {
        magAggMap[row.store_code] = {
          store_code: row.store_code,
          store_nom: row.store_nom,
          store_ville: row.store_ville,
          nb_cp: 0,
          nb_clients: 0,
          total_ca: 0,
          nb_transactions: 0,
          population_couverte: 0,
        }
      }
      const agg = magAggMap[row.store_code]
      agg.nb_cp++
      agg.nb_clients += row.nb_clients
      agg.total_ca += row.total_ca
      agg.nb_transactions += row.nb_transactions
      if (row.population) agg.population_couverte += row.population
    }
    const magAgg = Object.values(magAggMap)
      .map(a => ({
        ...a,
        taux_penetration: a.population_couverte > 0 ? a.nb_clients / a.population_couverte : null,
        ca_par_habitant: a.population_couverte > 0 ? a.total_ca / a.population_couverte : null,
      }))
      .sort((a, b) => b.total_ca - a.total_ca)

    // ═══════════════════════════════════════════════════
    //  CONSTRUCTION DE L'EXCEL
    // ═══════════════════════════════════════════════════
    const today = new Date()
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Magic Système - Pénétration CP'
    workbook.created = today

    // ──────────────────────────────────────────────────
    //  ONGLET 1 : SYNTHÈSE PAR MAGASIN
    // ──────────────────────────────────────────────────
    const ws1 = workbook.addWorksheet('Synthèse Magasins', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })

    ws1.columns = [
      { header: 'Code',               key: 'store_code',          width: 8 },
      { header: 'Magasin',            key: 'store_nom',           width: 22 },
      { header: 'Ville',              key: 'store_ville',         width: 18 },
      { header: 'Nb CP',              key: 'nb_cp',               width: 8 },
      { header: 'Clients',            key: 'nb_clients',          width: 12 },
      { header: 'CA Total',           key: 'total_ca',            width: 15 },
      { header: 'Transactions',       key: 'nb_transactions',     width: 14 },
      { header: 'Population couverte',key: 'population_couverte', width: 18 },
      { header: 'Taux pénétration',   key: 'taux_penetration',    width: 16 },
      { header: 'CA / habitant',      key: 'ca_par_habitant',     width: 14 },
    ]
    styleHeader(ws1)
    autoFilter(ws1, 10)

    for (const row of magAgg) {
      const r = ws1.addRow(row)
      r.getCell('total_ca').numFmt = NUM_FMT_EUR
      r.getCell('nb_clients').numFmt = NUM_FMT_INT
      r.getCell('nb_transactions').numFmt = NUM_FMT_INT
      r.getCell('population_couverte').numFmt = NUM_FMT_INT
      r.getCell('nb_cp').numFmt = NUM_FMT_INT
      if (row.taux_penetration != null) r.getCell('taux_penetration').numFmt = NUM_FMT_PCT
      if (row.ca_par_habitant != null) r.getCell('ca_par_habitant').numFmt = NUM_FMT_EUR
    }

    // ──────────────────────────────────────────────────
    //  ONGLET 2 : TOUS LES CP (agrégé tous magasins)
    // ──────────────────────────────────────────────────
    const ws2 = workbook.addWorksheet('Tous les CP', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    })

    ws2.columns = [
      { header: 'Code Postal',         key: 'cp',                  width: 12 },
      { header: 'Ville',               key: 'ville',               width: 25 },
      { header: 'Magasin principal',    key: 'magasin_principal',   width: 22 },
      { header: 'Nb magasins',         key: 'nb_magasins',         width: 12 },
      { header: 'Tous magasins',       key: 'magasins',            width: 40 },
      { header: 'Population',          key: 'population',          width: 12 },
      { header: 'Clients',             key: 'nb_clients',          width: 10 },
      { header: 'CA Total',            key: 'total_ca',            width: 14 },
      { header: 'Transactions',        key: 'nb_transactions',     width: 14 },
      { header: 'Factures',            key: 'nb_factures',         width: 10 },
      { header: 'Taux pénétration',    key: 'taux_penetration',    width: 16 },
      { header: 'CA / habitant',       key: 'ca_par_habitant',     width: 14 },
    ]
    styleHeader(ws2)
    autoFilter(ws2, 12)

    for (const row of cpAgg) {
      const r = ws2.addRow(row)
      r.getCell('total_ca').numFmt = NUM_FMT_EUR
      r.getCell('nb_clients').numFmt = NUM_FMT_INT
      r.getCell('nb_transactions').numFmt = NUM_FMT_INT
      r.getCell('nb_factures').numFmt = NUM_FMT_INT
      if (row.population) r.getCell('population').numFmt = NUM_FMT_INT
      if (row.taux_penetration != null) r.getCell('taux_penetration').numFmt = NUM_FMT_PCT
      if (row.ca_par_habitant != null) r.getCell('ca_par_habitant').numFmt = NUM_FMT_EUR
    }

    // Colorer les taux de pénétration
    ws2.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const cell = row.getCell('taux_penetration')
      const val = cell.value
      if (val != null && typeof val === 'number') {
        if (val >= 0.05) {
          cell.font = { bold: true, color: { argb: 'FF16A34A' } } // vert
        } else if (val >= 0.01) {
          cell.font = { color: { argb: 'FFD97706' } } // orange
        } else {
          cell.font = { color: { argb: 'FFDC2626' } } // rouge
        }
      }
    })

    // ──────────────────────────────────────────────────
    //  ONGLETS 3+ : UN PAR MAGASIN (détail CP)
    // ──────────────────────────────────────────────────
    // Grouper enriched par store
    const byStore = {}
    for (const row of enriched) {
      if (!byStore[row.store_code]) byStore[row.store_code] = []
      byStore[row.store_code].push(row)
    }

    // Trier les magasins par CA total (même ordre que ws1)
    const storeOrder = magAgg.map(m => m.store_code)

    for (const storeCode of storeOrder) {
      const rows = byStore[storeCode]
      if (!rows || rows.length === 0) continue

      const mag = storeMap[storeCode]
      // Excel limite les noms de sheet à 31 caractères
      const sheetName = `M${storeCode} ${(mag?.nom || storeCode).substring(0, 25)}`.substring(0, 31)

      const ws = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      })

      ws.columns = [
        { header: 'Code Postal',       key: 'cp',                 width: 12 },
        { header: 'Ville',             key: 'ville',              width: 25 },
        { header: 'Population',        key: 'population',         width: 12 },
        { header: 'Clients',           key: 'nb_clients',         width: 10 },
        { header: 'CA Total',          key: 'total_ca',           width: 14 },
        { header: 'Transactions',      key: 'nb_transactions',    width: 12 },
        { header: 'Factures',          key: 'nb_factures',        width: 10 },
        { header: 'Taux pénétration',  key: 'taux_penetration',   width: 16 },
        { header: 'CA / habitant',     key: 'ca_par_habitant',    width: 14 },
      ]
      styleHeader(ws)
      autoFilter(ws, 9)

      // Trier par CA desc
      rows.sort((a, b) => b.total_ca - a.total_ca)

      for (const row of rows) {
        const r = ws.addRow(row)
        r.getCell('total_ca').numFmt = NUM_FMT_EUR
        r.getCell('nb_clients').numFmt = NUM_FMT_INT
        r.getCell('nb_transactions').numFmt = NUM_FMT_INT
        r.getCell('nb_factures').numFmt = NUM_FMT_INT
        if (row.population) r.getCell('population').numFmt = NUM_FMT_INT
        if (row.taux_penetration != null) r.getCell('taux_penetration').numFmt = NUM_FMT_PCT
        if (row.ca_par_habitant != null) r.getCell('ca_par_habitant').numFmt = NUM_FMT_EUR
      }

      // Colorer pénétration
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const cell = row.getCell('taux_penetration')
        const val = cell.value
        if (val != null && typeof val === 'number') {
          if (val >= 0.05) cell.font = { bold: true, color: { argb: 'FF16A34A' } }
          else if (val >= 0.01) cell.font = { color: { argb: 'FFD97706' } }
          else cell.font = { color: { argb: 'FFDC2626' } }
        }
      })
    }

    // ─── Générer et envoyer ───────────────────────────
    const buffer = await workbook.xlsx.writeBuffer()
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

    console.log(`✅ Export Pénétration CP terminé en ${elapsed}s — ${cpAgg.length} CP, ${magAgg.length} magasins, ${storeOrder.length + 2} onglets`)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=Penetration_CP_${today.toISOString().split('T')[0]}.xlsx`)
    return res.send(Buffer.from(buffer))

  } catch (error) {
    console.error('❌ Erreur Export Pénétration CP:', error)
    return res.status(500).json({ error: error.message })
  }
}
