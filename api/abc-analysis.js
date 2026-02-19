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
    console.log('🔄 API ABC Analysis: Calcul en cours...')

    // Données TOUS canaux
    const famillesAll = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL
      GROUP BY p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    const sousFamillesAll = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL
      GROUP BY p.famille, p.sous_famille
      ORDER BY SUM(t.ca) DESC
    `)

    const produitsAll = await prisma.$queryRawUnsafe(`
      SELECT 
        t.produit::text,
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL
      GROUP BY t.produit, p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    // Données MAGASIN
    const famillesMag = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot != 'WEB'
      GROUP BY p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    const sousFamillesMag = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot != 'WEB'
      GROUP BY p.famille, p.sous_famille
      ORDER BY SUM(t.ca) DESC
    `)

    const produitsMag = await prisma.$queryRawUnsafe(`
      SELECT 
        t.produit::text,
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot != 'WEB'
      GROUP BY t.produit, p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    // Données WEB
    const famillesWeb = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot = 'WEB'
      GROUP BY p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    const sousFamillesWeb = await prisma.$queryRawUnsafe(`
      SELECT 
        p.famille::text,
        COALESCE(p.sous_famille, 'Non classé')::text as sous_famille,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot = 'WEB'
      GROUP BY p.famille, p.sous_famille
      ORDER BY SUM(t.ca) DESC
    `)

    const produitsWeb = await prisma.$queryRawUnsafe(`
      SELECT 
        t.produit::text,
        p.famille::text,
        SUM(t.ca)::numeric as ca,
        COUNT(*)::int as volume
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.ca > 0 AND p.famille IS NOT NULL AND t.depot = 'WEB'
      GROUP BY t.produit, p.famille
      ORDER BY SUM(t.ca) DESC
    `)

    // Formater en objet comme attendu par le composant
    const formatData = (rows) => {
      const result = {}
      rows.forEach(row => {
        const key = row.sous_famille 
          ? `${row.famille}|||${row.sous_famille}`
          : row.produit || row.famille
        result[key] = {
          ca: Number(row.ca),
          volume: Number(row.volume),
          famille: row.famille
        }
      })
      return result
    }

    console.log(`✅ API ABC Analysis: Données calculées`)

    res.status(200).json({
      familles: formatData(famillesAll),
      sousFamilles: formatData(sousFamillesAll),
      produits: formatData(produitsAll),
      famillesMag: formatData(famillesMag),
      sousFamillesMag: formatData(sousFamillesMag),
      produitsMag: formatData(produitsMag),
      famillesWeb: formatData(famillesWeb),
      sousFamillesWeb: formatData(sousFamillesWeb),
      produitsWeb: formatData(produitsWeb)
    })

  } catch (error) {
    console.error('❌ Erreur API ABC Analysis:', error)
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    })
  } finally {
    await prisma.$disconnect()
  }
}
