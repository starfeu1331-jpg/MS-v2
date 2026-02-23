import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const {
    query = '',
    page = 1,
    pageSize = 20,
    nom, prenom, carte, email, telephone, ville,
    facture, dateDebut, dateFin, heureDebut, heureFin, montantMin, montantMax, depot,
    produit,
    produit_id
  } = req.query

  try {
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const limit = parseInt(pageSize)

    const hasTicketFilters = facture || dateDebut || dateFin || heureDebut || heureFin || montantMin || montantMax || depot
    const hasProduitFilters = produit
    const hasClientFilters = nom || prenom || carte || email || telephone || ville

    const queryLooksLikeFacture = query && /^\d{8,}$/.test(query.trim())

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
      // Filtre heure supprimé (colonne inexistante - utiliser EXTRACT(HOUR FROM date) si besoin)
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

    if (produit_id) {
      const ticketsQuery = `
        SELECT
          t.facture::text,
          t.date::text,
          t.carte::text,
          t.depot::text,
          t.ca::numeric,
          t.quantite::int,
          c.nom_adresse::text as nom,
          c.ville::text
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte AND c.nom_adresse IS NOT NULL
        WHERE t.produit = $1
        ORDER BY t.date DESC
        LIMIT $2 OFFSET $3
      `
      const countQuery = `SELECT COUNT(*)::int as total FROM transactions t WHERE t.produit = $1`
      const productQuery = `
        SELECT p.id::text, p.id::text as nom, NULL::text as reference_interne,
               p.famille::text, p.sous_famille::text, p.sous_sous_famille::text,
               COUNT(t.id)::int as nb_transactions,
               COUNT(DISTINCT t.facture)::int as nb_tickets,
               SUM(t.ca)::numeric as ca_total,
               SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE p.id = $1
        GROUP BY p.id, p.famille, p.sous_famille, p.sous_sous_famille
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

    if ((hasProduitFilters || (query && !queryLooksLikeFacture)) && !hasClientFilters && !hasTicketFilters && hasProduitFilters) {
      const search = produit
      const params = [`%${search}%`]

      const produits = await prisma.$queryRawUnsafe(`
        SELECT
          p.id::text,
          p.id::text as nom,
          NULL::text as reference_interne,
          p.famille::text,
          p.sous_famille::text,
          p.sous_sous_famille::text,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE (p.id ILIKE $1)
        GROUP BY p.id, p.famille, p.sous_famille, p.sous_sous_famille
        ORDER BY nb_tickets DESC
        LIMIT $2 OFFSET $3
      `, ...params, limit, offset)

      const countResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM produits p
        WHERE (p.id ILIKE $1)
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

    const conditions = []
    const params = []
    let idx = 1

    if (query) {
      // Recherche optimisée : NOM uniquement (pas dans adresse pour éviter faux positifs)
      conditions.push(`(
        LOWER(c.nom_adresse) LIKE LOWER($${idx}) OR
        LOWER(c.ville) LIKE LOWER($${idx + 1}) OR
        c.cp::text LIKE $${idx + 2} OR
        c.carte = $${idx + 3}
      )`)
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, query)
      idx += 4
    }
    if (nom) {
      // Filtre nom corrigé : cherche uniquement dans nom_adresse
      conditions.push(`LOWER(c.nom_adresse) LIKE LOWER($${idx})`)
      params.push(`%${nom}%`)
      idx += 1
    }
    if (prenom) {
      // Filtre prenom : cherche uniquement dans nom_adresse
      conditions.push(`LOWER(c.nom_adresse) LIKE LOWER($${idx})`)
      params.push(`%${prenom}%`)
      idx += 1
    }
    if (carte) { conditions.push(`c.carte = $${idx++}`); params.push(carte) }
    if (ville) { conditions.push(`LOWER(c.ville) LIKE LOWER($${idx++})`); params.push(`%${ville}%`) }

    if (conditions.length === 0) {
      return res.status(400).json({ error: 'Au moins un critère de recherche requis' })
    }

    const queryLooksLikeProduct = query && !/[@]/.test(query) && !/^\d+$/.test(query.trim())

    const where = 'WHERE ' + conditions.join(' AND ')

    const clientsQuery = `
      SELECT
        c.carte::text, c.nom_adresse::text as nom,
        c.civilite::text, c.sexe::text,
        c.ville::text, c.cp::text, c.date_naissance::text, c.date_creation::text
      FROM clients c
      ${where}
      AND c.nom_adresse IS NOT NULL
      ORDER BY
        CASE
          WHEN c.carte = $${idx} THEN 1
          WHEN LOWER(c.nom_adresse) = LOWER($${idx + 1}) THEN 2
          ELSE 3
        END, c.nom_adresse ASC
      LIMIT $${idx + 2} OFFSET $${idx + 3}
    `
    const countQuery = `SELECT COUNT(*)::int as total FROM clients c ${where} AND c.nom_adresse IS NOT NULL`

    const exactQuery = query || nom || carte || ''
    const [clients, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(clientsQuery, ...params, exactQuery, exactQuery, limit, offset),
      prisma.$queryRawUnsafe(countQuery, ...params)
    ])

    const clientTotal = countResult[0]?.total || 0

    if (clientTotal === 0 && queryLooksLikeProduct) {
      const produits = await prisma.$queryRawUnsafe(`
        SELECT
          p.id::text,
          p.id::text as nom,
          NULL::text as reference_interne,
          p.famille::text,
          p.sous_famille::text,
          p.sous_sous_famille::text,
          COUNT(DISTINCT t.facture)::int as nb_tickets,
          SUM(t.ca)::numeric as ca_total,
          SUM(t.quantite)::int as quantite_totale
        FROM produits p
        LEFT JOIN transactions t ON t.produit = p.id
        WHERE (p.id ILIKE $1)
        GROUP BY p.id, p.famille, p.sous_famille, p.sous_sous_famille
        ORDER BY nb_tickets DESC
        LIMIT $2 OFFSET $3
      `, `%${query}%`, limit, offset)

      const produitCount = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total FROM produits p
        WHERE (p.id ILIKE $1)
      `, `%${query}%`)

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
