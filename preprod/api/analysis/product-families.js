import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  try {
    // TEMPORAIRE: La table transactions n'a pas de colonnes famille/sous_famille
    // Retourner une structure vide pour l'instant
    // TODO: Intégrer avec une table produits séparée si elle existe
    
    const familles = []
    const hierarchy = {}

    return res.status(200).json({
      familles,
      hierarchy,
      total: 0,
      note: "Product family data not available in current schema. Configure product categories separately if needed."
    })

  } catch (error) {
    console.error('Product families error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des familles',
      details: error.message 
    })
  }
}
