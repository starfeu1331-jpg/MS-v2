import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

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
    const showWebOnly = magasin === 'WEB'
    const showMagasinOnly = magasin === 'MAGASIN'

    console.log('🔄 API Sub-Families: Requête reçue', { magasin })

    // Query avec CTE comme RFM
    let results
    
    if (showWebOnly) {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(p.famille, 'Non classé')::text as famille,
          COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
          SUM(t.ca)::numeric as ca,
          COUNT(*)::int as volume,
          COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.depot = 'WEB'
        GROUP BY p.famille, p.sous_famille
        ORDER BY SUM(t.ca) DESC
      `)
    } else if (showMagasinOnly) {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(p.famille, 'Non classé')::text as famille,
          COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
          SUM(t.ca)::numeric as ca,
          COUNT(*)::int as volume,
          COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0 AND t.depot != 'WEB'
        GROUP BY p.famille, p.sous_famille
        ORDER BY SUM(t.ca) DESC
      `)
    } else {
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(p.famille, 'Non classé')::text as famille,
          COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
          SUM(t.ca)::numeric as ca,
          COUNT(*)::int as volume,
          COUNT(DISTINCT t.facture)::int as nb_tickets
        FROM transactions t
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.ca > 0
        GROUP BY p.famille, p.sous_famille
        ORDER BY SUM(t.ca) DESC
      `)
    }

    console.log(`✅ API Sub-Families: ${results.length} sous-familles trouvées`)

    // Calculer les tickets totaux avec la même structure
    let totalTicketsResult
    
    if (showWebOnly) {
      totalTicketsResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT facture)::int as total
        FROM transactions
        WHERE ca > 0 AND depot = 'WEB'
      `)
    } else if (showMagasinOnly) {
      totalTicketsResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT facture)::int as total
        FROM transactions
        WHERE ca > 0 AND depot != 'WEB'
      `)
    } else {
      totalTicketsResult = await prisma.$queryRawUnsafe(`
        SELECT COUNT(DISTINCT facture)::int as total
        FROM transactions
        WHERE ca > 0
      `)
    }
    
    const totalTickets = Number(totalTicketsResult[0]?.total || 0)

    // Formater les résultats
    const subFamilies = results.map(row => ({
      famille: row.famille,
      sousFamille: row.sous_famille,
      ca: Number(row.ca),
      volume: Number(row.volume),
      nbTickets: Number(row.nb_tickets)
    }))

    res.status(200).json({
      subFamilies,
      totalTickets
    })

  } catch (error) {
    console.error('❌ Erreur API Sub-Families:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
