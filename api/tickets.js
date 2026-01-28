import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export default async function handler(req, res) {
  const { facture } = req.query
  
  if (!facture) {
    return res.status(400).json({ error: 'Facture requise' })
  }
  
  try {
    const transactions = await prisma.$queryRaw`
      SELECT 
        t.*,
        c.carte as "clientCarte",
        c.ville as "clientVille",
        p.id as "produitNom",
        p.famille,
        p.sous_famille,
        m.nom as "magasinNom",
        m.ville as "magasinVille"
      FROM transactions t
      LEFT JOIN clients c ON t.carte = c.carte
      LEFT JOIN produits p ON t.produit = p.id
      LEFT JOIN magasins m ON t.depot = m.code
      WHERE t.facture = ${facture}
    `
    
    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Facture non trouvée' })
    }
    
    res.status(200).json(serializeJSON({
      facture,
      client: {
        carte: transactions[0].clientCarte,
        ville: transactions[0].clientVille
      },
      magasin: {
        nom: transactions[0].magasinNom,
        ville: transactions[0].magasinVille
      },
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.date,
        produitNom: t.produitNom,
        famille: t.famille,
        sous_famille: t.sous_famille,
        quantite: t.quantite,
        prix: t.prix,
        ca: t.ca
      }))
    }))
  } catch (error) {
    console.error('Ticket error:', error)
    res.status(500).json({ error: error.message })
  }
}
