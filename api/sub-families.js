import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { magasin } = req.query

    console.log('🔄 API Sub-Families: Requête reçue', { magasin })

    // Construire la condition WHERE selon le filtre magasin
    let whereClause = "WHERE t.ca > 0"
    if (magasin === 'WEB') {
      whereClause += " AND t.depot = 'WEB'"
    } else if (magasin === 'MAGASIN') {
      whereClause += " AND t.depot != 'WEB'"
    }

    // Query pour obtenir les statistiques par sous-famille
    const query = `
      SELECT 
        COALESCE(p.famille, 'Non classé') as famille,
        COALESCE(p.sous_famille, 'Non classé') as sous_famille,
        SUM(t.ca) as ca,
        COUNT(*) as volume,
        COUNT(DISTINCT t.facture) as nb_tickets
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.code
      ${whereClause}
      GROUP BY p.famille, p.sous_famille
      ORDER BY 3 DESC
    `

    const results = await prisma.$queryRawUnsafe(query)

    console.log(`✅ API Sub-Families: ${results.length} sous-familles trouvées`)

    // Calculer les tickets totaux
    const totalTicketsQuery = `
      SELECT COUNT(DISTINCT facture) as total
      FROM transactions
      ${whereClause}
    `
    
    const totalTicketsResult = await prisma.$queryRawUnsafe(totalTicketsQuery)
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
