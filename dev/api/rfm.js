import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// Sérialisation JSON pour BigInt
const serializeJSON = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  )
}

/**
 * Construit la clause WHERE pour les transactions selon le filtre magasin.
 * - WEB : uniquement les transactions web
 * - MAGASIN : uniquement les transactions magasin (exclut WEB et dépôt 41 = tri)
 * - TOUS (défaut) : toutes les transactions sauf le dépôt 41
 */
function buildWhereClause(magasin) {
  if (magasin === 'WEB') {
    return "t.depot = 'WEB' AND c.carte != '0'"
  } else if (magasin === 'MAGASIN') {
    return "t.depot != 'WEB' AND t.depot != '41' AND c.carte != '0'"
  } else {
    return "c.carte != '0' AND t.depot != '41'"
  }
}

/**
 * Segmentation RFM basée sur les scores R, F, M (1-5).
 * Ordre : du plus spécifique au plus général.
 */
function assignSegment(R, F, M) {
  if (R === 5 && F === 5 && M === 5) return 'Ultra Champions'
  if (R >= 4 && F >= 4 && M >= 4) return 'Champions'
  if (F >= 4 && R <= 2) return 'À Risque'
  if (F >= 4) return 'Loyaux'
  if (F <= 2 && R >= 4) return 'Nouveaux'
  if (R <= 2) return 'Perdus'
  return 'Occasionnels'
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

  try {
    const { magasin } = req.query
    const whereClause = buildWhereClause(magasin)
    
    console.log(`🔍 RFM Analysis - Filtre: ${magasin || 'TOUS'} | WHERE: ${whereClause}`)

    // Calcul RFM optimisé : une seule requête SQL avec NTILE
    const clientsData = await prisma.$queryRawUnsafe(`
      WITH client_metrics AS (
        SELECT 
          c.carte::text,
          c.nom::text as nom,
          c.prenom::text as prenom,
          c.email::text as email,
          c.telephone::text as telephone,
          c.sexe::text,
          c.ville::text,
          c.cp::text,
          c.date_naissance::text,
          COUNT(DISTINCT t.facture)::int as frequency,
          SUM(t.ca)::numeric as monetary,
          EXTRACT(DAY FROM (CURRENT_DATE - MAX(t.date)))::int as recency,
          EXTRACT(DAY FROM (CURRENT_DATE - MIN(t.date)))::int as days_since_first,
          MAX(t.date)::text as last_date,
          MIN(t.date)::text as first_date
        FROM clients c
        INNER JOIN transactions t ON c.carte = t.carte
        WHERE ${whereClause}
        GROUP BY c.carte, c.nom, c.prenom, c.email, c.telephone, c.sexe, c.ville, c.cp, c.date_naissance
        HAVING SUM(t.ca) > 0
      ),
      rfm_scores AS (
        SELECT 
          carte, nom, prenom, email, telephone, sexe, ville, cp, date_naissance,
          frequency, monetary, recency, days_since_first, last_date, first_date,
          (6 - NTILE(5) OVER (ORDER BY recency ASC))::int as r,
          (6 - NTILE(5) OVER (ORDER BY frequency DESC))::int as f,
          (6 - NTILE(5) OVER (ORDER BY monetary DESC))::int as m
        FROM client_metrics
      )
      SELECT * FROM rfm_scores ORDER BY carte
    `)

    const clientsArray = serializeJSON(clientsData)
    console.log(`✅ ${clientsArray.length} clients chargés avec scores R, F, M`)

    if (clientsArray.length === 0) {
      return res.status(200).json({ 
        clients: [],
        stats: {
          totalClients: 0,
          totalCA: 0,
          segments: {}
        }
      })
    }

    // Assigner les segments RFM
    const clients = clientsArray.map(client => {
      const R = client.r
      const F = client.f
      const M = client.m
      const RFM = R * 100 + F * 10 + M
      const segment = assignSegment(R, F, M)

      return {
        carte: client.carte,
        nom: client.nom || null,
        prenom: client.prenom || null,
        email: client.email || null,
        telephone: client.telephone || null,
        sexe: client.sexe || null,
        ville: client.ville || '-',
        cp: client.cp || '-',
        date_naissance: client.date_naissance || null,
        recency: client.recency,
        frequency: client.frequency,
        monetary: parseFloat(client.monetary),
        daysSinceFirst: client.days_since_first,
        firstDate: client.first_date,
        lastDate: client.last_date,
        R,
        F,
        M,
        RFM,
        segment
      }
    })

    // Agréger les statistiques par segment
    const segmentStats = {}
    clients.forEach(client => {
      if (!segmentStats[client.segment]) {
        segmentStats[client.segment] = {
          count: 0,
          ca: 0,
          clients: [],
          avecAge: 0,
          ageTotal: 0
        }
      }
      const seg = segmentStats[client.segment]
      seg.count++
      seg.ca += client.monetary
      seg.clients.push(client)
      
      // Calcul de l'âge si date_naissance est valide
      if (client.date_naissance && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(client.date_naissance)) {
        const birthDate = new Date(client.date_naissance)
        const ageDiff = Date.now() - birthDate.getTime()
        const ageDate = new Date(ageDiff)
        const age = Math.abs(ageDate.getUTCFullYear() - 1970)
        
        if (age >= 0 && age <= 120) {
          seg.avecAge++
          seg.ageTotal += age
        }
      }
    })
    
    // Calculer l'âge moyen pour chaque segment
    Object.keys(segmentStats).forEach(segment => {
      const stats = segmentStats[segment]
      stats.ageMoyen = stats.avecAge > 0 ? Math.round(stats.ageTotal / stats.avecAge) : null
      stats.pctAge = stats.count > 0 ? Math.round((stats.avecAge / stats.count) * 100) : 0
      delete stats.ageTotal
    })

    // Distribution des scores pour debug
    const rDist = {}, fDist = {}, segDist = {}
    clients.forEach(c => {
      rDist[c.R] = (rDist[c.R] || 0) + 1
      fDist[c.F] = (fDist[c.F] || 0) + 1
      segDist[c.segment] = (segDist[c.segment] || 0) + 1
    })

    console.log('📊 Distribution R:', rDist)
    console.log('📊 Distribution F:', fDist)
    console.log('📊 Distribution Segments:', segDist)

    const totalClients = clients.length
    const totalCA = clients.reduce((sum, c) => sum + c.monetary, 0)

    console.log(`✅ RFM calculé: ${totalClients} clients, ${Math.round(totalCA)}€ CA total`)

    return res.status(200).json({
      clients,
      stats: {
        totalClients,
        totalCA,
        segments: segmentStats
      }
    })

  } catch (error) {
    console.error('❌ Erreur RFM:', error)
    console.error('Stack:', error.stack)
    return res.status(500).json({ 
      error: 'Erreur lors du calcul RFM',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  } finally {
    await prisma.$disconnect()
  }
}
