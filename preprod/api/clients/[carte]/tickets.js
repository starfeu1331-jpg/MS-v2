import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const { carte } = req.params

  if (!carte) {
    return res.status(400).json({ error: 'Numéro de carte requis' })
  }

  try {
    // Récupérer les infos client
    const clientQuery = `
      SELECT 
        carte::text,
        nom_adresse::text as nom,
        civilite::text,
        ville::text,
        cp::text,
        date_creation::text
      FROM clients
      WHERE carte = $1
      AND nom_adresse IS NOT NULL
      LIMIT 1
    `

    const clients = await prisma.$queryRawUnsafe(clientQuery, carte)
    
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' })
    }

    const client = clients[0]

    // Récupérer les tickets du client (groupés par facture)
    const ticketsQuery = `
      SELECT 
        facture::text,
        date::text,
        depot::text,
        SUM(ca)::numeric as ca_total,
        SUM(quantite)::int as quantite_totale,
        COUNT(*)::int as nb_lignes
      FROM transactions
      WHERE carte = $1
      GROUP BY facture, date, depot
      ORDER BY date DESC
    `

    const tickets = await prisma.$queryRawUnsafe(ticketsQuery, carte)

    return res.status(200).json({
      client,
      tickets,
      total: tickets.length
    })

  } catch (error) {
    console.error('Client tickets error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des tickets',
      details: error.message 
    })
  }
}
