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
      // Recherche par carte client, nom, prénom, email ou téléphone
      const clientInfo = await prisma.$queryRawUnsafe(`
        SELECT 
          carte::text,
          nom::text, prenom::text,
          civilite::text,
          sexe::text,
          email::text, telephone::text,
          ville::text,
          cp::text,
          date_naissance::text,
          date_creation::text
        FROM clients
        WHERE carte = $1
           OR LOWER(nom) LIKE LOWER($2)
           OR LOWER(prenom) LIKE LOWER($2)
        ORDER BY 
          CASE 
            WHEN carte = $1 THEN 1
            WHEN LOWER(nom) = LOWER($3) THEN 2
            ELSE 3
          END
        LIMIT 100
      `, query, `%${query}%`, query)
      
      // Si plusieurs clients trouvés, retourner la liste
      if (clientInfo.length > 1) {
        return res.status(200).json({
          multipleClients: true,
          clients: clientInfo.map(c => ({
            carte: c.carte,
            nom: c.nom,
            civilite: c.civilite,
            sexe: c.sexe,
            ville: c.ville,
            cp: c.cp,
            date_naissance: c.date_naissance,
            date_creation: c.date_creation
          }))
        })
      }
      
      // Sinon, retourner les détails du client avec ses transactions
      const clientCarte = clientInfo[0]?.carte || query
      
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
      `, clientCarte)
      
      // Retourner les infos client avec les transactions
      return res.status(200).json({
        clientInfo: clientInfo[0] || null,
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
