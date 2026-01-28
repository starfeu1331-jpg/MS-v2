import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export default async function handler(req, res) {
  const { carte } = req.query
  
  if (!carte) {
    return res.status(400).json({ error: 'Carte requise' })
  }
  
  try {
    const client = await prisma.clients.findUnique({
      where: { carte: carte }
    })
    
    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' })
    }
    
    const transactions = await prisma.$queryRaw`
      SELECT 
        t.facture,
        t.date,
        t.ca,
        t.quantite,
        p.id as "produitNom",
        p.famille,
        p.sous_famille,
        m.nom as "magasinNom",
        m.ville as "magasinVille"
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      LEFT JOIN magasins m ON t.depot = m.code
      WHERE t.carte = ${carte}
      ORDER BY t.date DESC
      LIMIT 100
    `
    
    res.status(200).json(serializeJSON({
      client,
      transactions: transactions.map(t => ({
        facture: t.facture,
        date: t.date,
        ca: t.ca,
        quantite: t.quantite,
        produitNom: t.produitNom,
        famille: t.famille,
        sous_famille: t.sous_famille,
        magasinNom: t.magasinNom,
        magasinVille: t.magasinVille
      }))
    }))
  } catch (error) {
    console.error('Client error:', error)
    res.status(500).json({ error: error.message })
  }
}
