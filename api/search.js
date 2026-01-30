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
    const { type, query } = req.query

    if (!type || !query) {
      return res.status(400).json({ error: 'Missing type or query parameter' })
    }

    console.log(`🔍 API Search: ${type} - "${query}"`)

    let results = []

    if (type === 'ticket') {
      // Recherche par facture
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.facture ILIKE $1
        ORDER BY t.date DESC
        LIMIT 100
      `, `%${query}%`)
    } else if (type === 'client') {
      // Recherche par carte client
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.carte = $1
        ORDER BY t.date DESC
        LIMIT 100
      `, query)
    } else if (type === 'produit') {
      // Recherche par produit
      results = await prisma.$queryRawUnsafe(`
        SELECT 
          t.facture::text,
          t.date::text,
          t.carte::text,
          c.ville::text,
          t.depot::text,
          t.produit::text,
          p.famille::text,
          p.sous_famille::text,
          t.ca::numeric,
          t.quantite::numeric
        FROM transactions t
        LEFT JOIN clients c ON t.carte = c.carte
        LEFT JOIN produits p ON t.produit = p.id
        WHERE t.produit ILIKE $1
        ORDER BY t.date DESC
        LIMIT 100
      `, `%${query}%`)
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: ticket, client, or produit' })
    }

    console.log(`✅ API Search: ${results.length} résultats`)

    res.status(200).json({
      results: results.map(r => ({
        facture: r.facture,
        date: r.date,
        carte: r.carte,
        ville: r.ville,
        depot: r.depot,
        produit: r.produit,
        famille: r.famille,
        sous_famille: r.sous_famille,
        ca: Number(r.ca),
        quantite: Number(r.quantite)
      }))
    })

  } catch (error) {
    console.error('❌ Erreur API Search:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
