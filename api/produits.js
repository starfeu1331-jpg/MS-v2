import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper pour convertir BigInt en Number pour JSON
const serializeJSON = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ))
}

export default async function handler(req, res) {
  const { produit } = req.query
  
  if (!produit) {
    return res.status(400).json({ error: 'Code produit requis' })
  }
  
  try {
    // Infos produit
    const produitInfo = await prisma.produit.findUnique({
      where: { id: produit }
    })
    
    if (!produitInfo) {
      return res.status(404).json({ error: 'Produit non trouvé' })
    }
    
    // Stats globales
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::int as "nbTransactions",
        SUM(ca)::float as "caTotal",
        SUM(quantite)::float as "volumeTotal",
        AVG(ca)::float as "caMoyen",
        COUNT(DISTINCT carte)::int as "nbClients",
        COUNT(DISTINCT depot)::int as "nbMagasins"
      FROM transactions
      WHERE produit = ${produit}
    `
    
    // Top magasins
    const topMagasins = await prisma.$queryRaw`
      SELECT 
        m.nom,
        m.ville,
        SUM(t.ca)::float as ca,
        SUM(t.quantite)::float as volume,
        COUNT(*)::int as "nbVentes"
      FROM transactions t
      JOIN magasins m ON t.depot = m.code
      WHERE t.produit = ${produit}
      GROUP BY m.nom, m.ville
      ORDER BY ca DESC
      LIMIT 5
    `
    
    // Évolution mensuelle
    const evolutionMensuelle = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as mois,
        SUM(ca)::float as ca,
        SUM(quantite)::float as volume,
        COUNT(*)::int as "nbVentes"
      FROM transactions
      WHERE produit = ${produit}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY mois DESC
      LIMIT 12
    `
    
    // Dernières transactions
    const dernieresTransactions = await prisma.$queryRaw`
      SELECT 
        t.facture,
        t.date,
        t.ca,
        t.quantite,
        c.carte as "clientCarte",
        c.ville as "clientVille",
        m.nom as "magasinNom"
      FROM transactions t
      LEFT JOIN clients c ON t.carte = c.carte
      LEFT JOIN magasins m ON t.depot = m.code
      WHERE t.produit = ${produit}
      ORDER BY t.date DESC
      LIMIT 10
    `
    
    res.status(200).json(serializeJSON({
      produit: produitInfo,
      stats: stats[0],
      topMagasins,
      evolutionMensuelle,
      dernieresTransactions
    }))
  } catch (error) {
    console.error('Produit error:', error)
    res.status(500).json({ error: error.message })
  } finally {
    await prisma.$disconnect()
  }
}
