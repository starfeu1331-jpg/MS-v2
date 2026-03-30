import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Normalise un numéro de téléphone : retire espaces, tirets, points, préfixe +33/0033
 * "06 84 12 35 45" → "0684123545"
 * "+33684123545"   → "0684123545"
 * "0033684123545"  → "0684123545"
 */
function normalizePhone(raw) {
  if (!raw) return ''
  let phone = raw.replace(/[\s.\-()]/g, '')
  phone = phone.replace(/^0033/, '0')
  phone = phone.replace(/^\+33/, '0')
  return phone
}

/**
 * API de recherche unifiée v3
 * 
 * Colonnes réelles en base (février 2026) :
 *   clients:      carte, nom, prenom, date_creation, statut, date_validite, civilite, date_naissance, sexe, email, telephone, nom_adresse, adresse, adresse_2, adresse_4, cp, ville
 *   produits:     id, designation, reference_interne, famille, sous_famille, sous_sous_famille, sous_sous_sous_famille, produit_web
 *   transactions: id (bigint), carte, facture, depot, date, heure, produit, quantite, prix, ca, montant_ttc
 */
export default async function handler(req, res) {
  const {
    query = '',
    page = 1,
    pageSize = 20,
    nom, prenom, adresse, carte, ville, cp, email, telephone,
    facture, dateDebut, dateFin, montantMin, montantMax, depot,
    produit,
    produit_id,
    produit_nom, produit_code, produit_famille,
    famille, sous_famille, sous_sous_famille,
    browse
  } = req.query

  try {
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const hasTicketFilters = facture || dateDebut || dateFin || montantMin || montantMax || depot
    const hasProduitFilters = produit || produit_nom || produit_code
    const hasFamilleSearch = !!produit_famille
    const hasCategoryFilters = famille || sous_famille || sous_sous_famille || browse === 'categories'
    const hasClientFilters = nom || prenom || adresse || carte || ville || cp || email || telephone

    const queryLooksLikeFacture = query && /^\d{8,}$/.test(query.trim())
    // Detect queries that look like product codes (3-6 digits only)
    const queryLooksLikeProductCode = query && /^\d{3,6}$/.test(query.trim())

    // ─── 0. NAVIGATION PAR CATÉGORIE PRODUIT ───
    if (hasCategoryFilters) {
      const conditions = []
      const params = []
      let idx = 1
      if (famille) { conditions.push(`LOWER(p.famille) = LOWER($${idx++})`); params.push(famille) }
      if (sous_famille) { conditions.push(`LOWER(p.sous_famille) = LOWER($${idx++})`); params.push(sous_famille) }
      if (sous_sous_famille) { conditions.push(`LOWER(p.sous_sous_famille) = LOWER($${idx++})`); params.push(sous_sous_famille) }
      const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

      // Mode browse=categories sans filtre → liste toutes les familles
      if (!famille && !sous_famille && !sous_sous_famille) {
        const topFamilles = await prisma.$queryRawUnsafe(`
          SELECT p.famille::text as name,
                 COUNT(DISTINCT p.id)::int as nb_produits,
                 COALESCE(SUM(t.ca), 0)::numeric as ca_total
          FROM produits p LEFT JOIN transactions t ON t.produit = p.id
          WHERE p.famille IS NOT NULL AND p.famille != ''
          GROUP BY p.famille ORDER BY ca_total DESC
        `)
        const globalStats = await prisma.$queryRawUnsafe(`
          SELECT COUNT(DISTINCT p.id)::int as nb_produits,
                 COALESCE(SUM(t.ca), 0)::numeric as ca_total,
                 COUNT(DISTINCT t.facture)::int as nb_tickets,
                 COUNT(DISTINCT t.carte)::int as nb_clients
          FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        `)
        return res.status(200).json({
          type: 'categorie',
          famille: null, sous_famille: null, sous_sous_famille: null,
          subcategories: topFamilles,
          stats: globalStats[0] || {},
          data: [],
          total: globalStats[0]?.nb_produits || 0,
          page: 1, pageSize: parseInt(pageSize),
          totalPages: 0
        })
      }

      // Sous-catégories disponibles
      let subcategories = []
      if (famille && !sous_famille) {
        subcategories = await prisma.$queryRawUnsafe(`
          SELECT p.sous_famille::text as name,
                 COUNT(DISTINCT p.id)::int as nb_produits,
                 COALESCE(SUM(t.ca), 0)::numeric as ca_total
          FROM produits p LEFT JOIN transactions t ON t.produit = p.id
          ${where} AND p.sous_famille IS NOT NULL AND p.sous_famille != ''
          GROUP BY p.sous_famille ORDER BY ca_total DESC
        `, ...params)
      } else if (sous_famille && !sous_sous_famille) {
        subcategories = await prisma.$queryRawUnsafe(`
          SELECT p.sous_sous_famille::text as name,
                 COUNT(DISTINCT p.id)::int as nb_produits,
                 COALESCE(SUM(t.ca), 0)::numeric as ca_total
          FROM produits p LEFT JOIN transactions t ON t.produit = p.id
          ${where} AND p.sous_sous_famille IS NOT NULL AND p.sous_sous_famille != ''
          GROUP BY p.sous_sous_famille ORDER BY ca_total DESC
        `, ...params)
      }

      // Produits de cette catégorie
      const produits = await prisma.$queryRawUnsafe(`
        SELECT p.id::text, p.designation::text, p.reference_interne::text,
               p.famille::text, p.sous_famille::text, p.sous_sous_famille::text,
               p.sous_sous_sous_famille::text, p.produit_web::text,
               COUNT(DISTINCT t.facture)::int as nb_tickets,
               COALESCE(SUM(t.ca), 0)::numeric as ca_total,
               COALESCE(SUM(t.quantite), 0)::int as quantite_totale
        FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        ${where}
        GROUP BY p.id, p.designation, p.reference_interne, p.famille, p.sous_famille,
                 p.sous_sous_famille, p.sous_sous_sous_famille, p.produit_web
        ORDER BY ca_total DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, ...params, limit, offset)

      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT p.id)::int as total FROM produits p ${where}
      `, ...params)

      // Stats globales de la catégorie
      const stats = await prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(t.ca), 0)::numeric as ca_total,
               COUNT(DISTINCT t.facture)::int as nb_tickets,
               COUNT(DISTINCT t.carte)::int as nb_clients,
               COALESCE(SUM(t.quantite), 0)::int as quantite_totale
        FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        ${where}
      `, ...params)

      return res.status(200).json({
        type: 'categorie',
        famille: famille || null,
        sous_famille: sous_famille || null,
        sous_sous_famille: sous_sous_famille || null,
        subcategories,
        stats: stats[0] || {},
        data: produits,
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(pageSize))
      })
    }

    // ─── 0b. RECHERCHE FAMILLE (texte libre sur famille/sous-famille) ───
    if (hasFamilleSearch) {
      const searchTerm = `%${produit_famille}%`

      // Chercher les familles correspondantes
      const matchingFamilles = await prisma.$queryRawUnsafe(`
        SELECT p.famille::text as name, 'famille' as level, NULL::text as parent_famille,
               COUNT(DISTINCT p.id)::int as nb_produits,
               COALESCE(SUM(t.ca), 0)::numeric as ca_total
        FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        WHERE p.famille IS NOT NULL AND p.famille != '' AND LOWER(p.famille) LIKE LOWER($1)
        GROUP BY p.famille
        UNION ALL
        SELECT p.sous_famille::text as name, 'sous_famille' as level, p.famille::text as parent_famille,
               COUNT(DISTINCT p.id)::int as nb_produits,
               COALESCE(SUM(t.ca), 0)::numeric as ca_total
        FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        WHERE p.sous_famille IS NOT NULL AND p.sous_famille != '' AND LOWER(p.sous_famille) LIKE LOWER($1)
        GROUP BY p.sous_famille, p.famille
        UNION ALL
        SELECT p.sous_sous_famille::text as name, 'sous_sous_famille' as level, p.famille::text as parent_famille,
               COUNT(DISTINCT p.id)::int as nb_produits,
               COALESCE(SUM(t.ca), 0)::numeric as ca_total
        FROM produits p LEFT JOIN transactions t ON t.produit = p.id
        WHERE p.sous_sous_famille IS NOT NULL AND p.sous_sous_famille != '' AND LOWER(p.sous_sous_famille) LIKE LOWER($1)
        GROUP BY p.sous_sous_famille, p.famille
        ORDER BY ca_total DESC
      `, searchTerm)

      return res.status(200).json({
        type: 'categorie_search',
        data: matchingFamilles,
        total: matchingFamilles.length,
        page: 1,
        pageSize: matchingFamilles.length,
        totalPages: 1
      })
    }

    // ─── 1. RECHERCHE TICKETS (par facture, dates, dépôt, montant) ───
    if ((hasTicketFilters || queryLooksLikeFacture) && !hasClientFilters && !hasProduitFilters) {
      const factureSearch = facture || (queryLooksLikeFacture ? query.trim() : null)
      const whereConditions = []
      const allParams = []
      let idx = 1

      if (factureSearch) {
        whereConditions.push(`t.facture ILIKE $${idx++}`)
        allParams.push(`%${factureSearch}%`)
      }
      if (dateDebut) {
        whereConditions.push(`t.date::date >= $${idx++}::date`)
        allParams.push(dateDebut.split('T')[0])
      }
      if (dateFin) {
        whereConditions.push(`t.date::date <= $${idx++}::date`)
        allParams.push(dateFin.split('T')[0])
      }
      if (depot) {
        whereConditions.push(`LOWER(t.depot) LIKE LOWER($${idx++})`)
        allParams.push(`%${depot}%`)
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

      const havingConditions = []
      if (montantMin) { havingConditions.push(`SUM(t.ca) >= $${idx++}`); allParams.push(parseFloat(montantMin)) }
      if (montantMax) { havingConditions.push(`SUM(t.ca) <= $${idx++}`); allParams.push(parseFloat(montantMax)) }
      const havingClause = havingConditions.length > 0 ? 'HAVING ' + havingConditions.join(' AND ') : ''

      const ticketsQuery = `
        SELECT
          t.facture::text,
          t.date::text,
          t.carte::text,
          t.depot::text,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale,
          COUNT(*)::int as nb_lignes
        FROM transactions t
        ${whereClause}
        GROUP BY t.facture, t.date, t.carte, t.depot
        ${havingClause}
        ORDER BY t.date DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `
      const countQuery = `
        SELECT COUNT(*)::int as total FROM (
          SELECT t.facture
          FROM transactions t
          ${whereClause}
          GROUP BY t.facture, t.date, t.carte, t.depot
          ${havingClause}
        ) sub
      `

      const [tickets, countResult] = await Promise.all([
        prisma.$queryRawUnsafe(ticketsQuery, ...allParams, limit, offset),
        prisma.$queryRawUnsafe(countQuery, ...allParams)
      ])

      return res.status(200).json({
        type: 'ticket',
        data: tickets,
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(pageSize))
      })
    }

    // ─── 2. DETAIL PRODUIT (par produit_id) ───
    if (produit_id) {
      const ticketsQuery = `
        SELECT
          t.facture::text,
          t.date::text,
          t.carte::text,
          t.depot::text,
          t.ca::numeric,
          t.quantite::int,
          c.nom::text,
          c.prenom::text,
          c.ville::text
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        WHERE t.produit = $1
        ORDER BY t.date DESC
        LIMIT $2 OFFSET $3
      `
      const countQuery = `SELECT COUNT(*)::int as total FROM transactions t WHERE t.produit = $1`
      const productQuery = `
        SELECT p.id::text,
               p.designation::text,
               p.reference_interne::text,
               p.famille::text, p.sous_famille::text, p.sous_sous_famille::text,
               p.sous_sous_sous_famille::text, p.produit_web::text,
               COUNT(t.id)::int as nb_transactions,
               COUNT(DISTINCT t.facture)::int as nb_tickets,
               SUM(t.ca)::numeric as ca_total,
               SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE p.id = $1
        GROUP BY p.id, p.designation, p.reference_interne, p.famille, p.sous_famille, p.sous_sous_famille, p.sous_sous_sous_famille, p.produit_web
      `
      const [tickets, countResult, productResult] = await Promise.all([
        prisma.$queryRawUnsafe(ticketsQuery, produit_id, limit, offset),
        prisma.$queryRawUnsafe(countQuery, produit_id),
        prisma.$queryRawUnsafe(productQuery, produit_id)
      ])
      return res.status(200).json({
        type: 'produit_detail',
        produit: productResult[0] || null,
        data: tickets,
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(pageSize))
      })
    }

    // ─── 3. RECHERCHE PRODUITS (filtre produit) ───
    if (hasProduitFilters) {
      const conditions = []
      const params = []
      let pidx = 1

      if (produit) {
        // Ancien champ unique : cherche partout
        conditions.push(`(p.id ILIKE $${pidx} OR p.famille ILIKE $${pidx+1} OR p.designation ILIKE $${pidx+2} OR p.reference_interne ILIKE $${pidx+3})`)
        params.push(`%${produit}%`, `%${produit}%`, `%${produit}%`, `%${produit}%`)
        pidx += 4
      }
      if (produit_nom) {
        conditions.push(`p.designation ILIKE $${pidx++}`)
        params.push(`%${produit_nom}%`)
      }
      if (produit_code) {
        conditions.push(`(p.id ILIKE $${pidx} OR p.reference_interne ILIKE $${pidx+1})`)
        params.push(`%${produit_code}%`, `%${produit_code}%`)
        pidx += 2
      }

      const whereClause = conditions.join(' AND ')

      const produits = await prisma.$queryRawUnsafe(`
        SELECT
          p.id::text,
          p.designation::text,
          p.reference_interne::text,
          p.famille::text,
          p.sous_famille::text,
          p.sous_sous_famille::text,
          p.sous_sous_sous_famille::text,
          p.produit_web::text,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE ${whereClause}
        GROUP BY p.id, p.designation, p.reference_interne, p.famille, p.sous_famille, p.sous_sous_famille, p.sous_sous_sous_famille, p.produit_web
        ORDER BY nb_tickets DESC
        LIMIT $${pidx} OFFSET $${pidx+1}
      `, ...params, limit, offset)

      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM produits p
        WHERE ${whereClause}
      `, ...params)

      return res.status(200).json({
        type: 'produit',
        data: produits,
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(pageSize))
      })
    }

    // ─── 3b. QUERY LOOKS LIKE PRODUCT CODE → search products first ───
    if (queryLooksLikeProductCode && !hasClientFilters && !hasTicketFilters) {
      const qTrim = query.trim()
      // First try exact match, then ILIKE
      const produits = await prisma.$queryRawUnsafe(`
        SELECT
          p.id::text,
          p.designation::text,
          p.reference_interne::text,
          p.famille::text,
          p.sous_famille::text,
          p.sous_sous_famille::text,
          p.sous_sous_sous_famille::text,
          p.produit_web::text,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE (p.id ILIKE $1 OR p.reference_interne ILIKE $1)
        GROUP BY p.id, p.designation, p.reference_interne, p.famille, p.sous_famille, p.sous_sous_famille, p.sous_sous_sous_famille, p.produit_web
        ORDER BY
          CASE WHEN p.id = $2 THEN 0 WHEN p.id ILIKE $3 THEN 1 ELSE 2 END,
          nb_tickets DESC
        LIMIT $4 OFFSET $5
      `, `%${qTrim}%`, qTrim, `${qTrim}%`, limit, offset)

      const produitCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM produits p
        WHERE (p.id ILIKE $1 OR p.reference_interne ILIKE $1)
      `, `%${qTrim}%`)

      if ((produitCount[0]?.total || 0) > 0) {
        return res.status(200).json({
          type: 'produit',
          data: produits,
          total: produitCount[0]?.total || 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil((produitCount[0]?.total || 0) / parseInt(pageSize))
        })
      }
    }

    // ─── 4. RECHERCHE CLIENTS ───
    const conditions = []
    const params = []
    let idx = 1

    if (query) {
      // Recherche globale : cherche dans toutes les colonnes texte pertinentes
      // Normaliser le téléphone dans le query aussi
      const phoneDigits = normalizePhone(query)
      const looksLikePhone = /^\d{4,}$/.test(phoneDigits)
      conditions.push(`(
        LOWER(c.nom) LIKE LOWER($${idx}) OR
        LOWER(c.prenom) LIKE LOWER($${idx + 1}) OR
        LOWER(c.nom_adresse) LIKE LOWER($${idx + 2}) OR
        LOWER(c.adresse) LIKE LOWER($${idx + 3}) OR
        LOWER(c.adresse_2) LIKE LOWER($${idx + 4}) OR
        LOWER(c.adresse_4) LIKE LOWER($${idx + 5}) OR
        LOWER(c.ville) LIKE LOWER($${idx + 6}) OR
        LOWER(c.email) LIKE LOWER($${idx + 7}) OR
        REGEXP_REPLACE(c.telephone, '[^0-9]', '', 'g') LIKE $${idx + 8} OR
        c.cp::text LIKE $${idx + 9} OR
        c.carte = $${idx + 10}
      )`)
      const q = `%${query}%`
      params.push(q, q, q, q, q, q, q, q, looksLikePhone ? `%${phoneDigits}%` : `%${query}%`, q, query)
      idx += 11
    }
    if (nom) {
      conditions.push(`(LOWER(c.nom) LIKE LOWER($${idx}) OR LOWER(c.prenom) LIKE LOWER($${idx + 1}))`)
      params.push(`%${nom}%`, `%${nom}%`)
      idx += 2
    }
    if (prenom) {
      conditions.push(`LOWER(c.prenom) LIKE LOWER($${idx++})`)
      params.push(`%${prenom}%`)
    }
    if (adresse) {
      conditions.push(`(
        LOWER(c.adresse) LIKE LOWER($${idx}) OR
        LOWER(c.adresse_2) LIKE LOWER($${idx + 1}) OR
        LOWER(c.adresse_4) LIKE LOWER($${idx + 2}) OR
        LOWER(c.nom_adresse) LIKE LOWER($${idx + 3})
      )`)
      params.push(`%${adresse}%`, `%${adresse}%`, `%${adresse}%`, `%${adresse}%`)
      idx += 4
    }
    if (carte) { conditions.push(`c.carte = $${idx++}`); params.push(carte) }
    if (ville) { conditions.push(`LOWER(c.ville) LIKE LOWER($${idx++})`); params.push(`%${ville}%`) }
    if (cp) { conditions.push(`c.cp::text LIKE $${idx++}`); params.push(`%${cp}%`) }
    if (email) { conditions.push(`LOWER(c.email) LIKE LOWER($${idx++})`); params.push(`%${email}%`) }
    if (telephone) {
      const normalizedTel = normalizePhone(telephone)
      conditions.push(`REGEXP_REPLACE(c.telephone, '[^0-9]', '', 'g') LIKE $${idx++}`)
      params.push(`%${normalizedTel}%`)
    }

    if (conditions.length === 0) {
      return res.status(400).json({ error: 'Au moins un critère de recherche requis' })
    }

    const where = 'WHERE ' + conditions.join(' AND ')

    const clientsQuery = `
      SELECT
        c.carte::text, c.nom::text, c.prenom::text,
        c.civilite::text, c.sexe::text,
        c.email::text, c.telephone::text,
        c.nom_adresse::text, c.adresse::text, c.adresse_2::text, c.adresse_4::text,
        c.ville::text, c.cp::text,
        c.date_naissance::text, c.date_creation::text
      FROM clients c
      ${where}
      ORDER BY
        CASE
          WHEN c.carte = $${idx} THEN 1
          WHEN LOWER(c.nom) = LOWER($${idx + 1}) THEN 2
          WHEN LOWER(c.prenom) = LOWER($${idx + 2}) THEN 3
          ELSE 4
        END, c.nom ASC
      LIMIT $${idx + 3} OFFSET $${idx + 4}
    `
    const countQuery = `SELECT COUNT(*)::int as total FROM clients c ${where}`

    const exactQuery = query || nom || carte || ''

    const [clients, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(clientsQuery, ...params, exactQuery, exactQuery, exactQuery, limit, offset),
      prisma.$queryRawUnsafe(countQuery, ...params)
    ])

    const clientTotal = countResult[0]?.total || 0

    // ─── 5. FALLBACK PRODUITS : si 0 clients, chercher dans les produits ───
    if (clientTotal === 0 && query && !queryLooksLikeFacture) {
      const produits = await prisma.$queryRawUnsafe(`
        SELECT
          p.id::text,
          p.designation::text,
          p.reference_interne::text,
          p.famille::text,
          p.sous_famille::text,
          p.sous_sous_famille::text,
          p.sous_sous_sous_famille::text,
          p.produit_web::text,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE (p.id ILIKE $1 OR p.famille ILIKE $2 OR p.designation ILIKE $3 OR p.reference_interne ILIKE $4)
        GROUP BY p.id, p.designation, p.reference_interne, p.famille, p.sous_famille, p.sous_sous_famille, p.sous_sous_sous_famille, p.produit_web
        ORDER BY nb_tickets DESC
        LIMIT $5 OFFSET $6
      `, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit, offset)

      const produitCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM produits p
        WHERE (p.id ILIKE $1 OR p.famille ILIKE $2 OR p.designation ILIKE $3 OR p.reference_interne ILIKE $4)
      `, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)

      if ((produitCount[0]?.total || 0) > 0) {
        return res.status(200).json({
          type: 'produit',
          data: produits,
          total: produitCount[0]?.total || 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil((produitCount[0]?.total || 0) / parseInt(pageSize))
        })
      }
    }

    return res.status(200).json({
      type: 'client',
      data: clients,
      total: clientTotal,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(clientTotal / parseInt(pageSize))
    })

  } catch (error) {
    console.error('Search V3 error:', error)
    return res.status(500).json({ error: 'Erreur de recherche', details: error.message })
  }
}
