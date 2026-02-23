import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  const { facture } = req.params

  if (!facture) {
    return res.status(400).json({ error: 'Numéro de facture requis' })
  }

  try {
    // Récupérer toutes les transactions du ticket
    const transactionsQuery = `
      SELECT 
        t.facture::text,
        t.date::text,
        t.carte::text,
        t.depot::text,
        t.produit::text,
        p.id::text as produit_nom,
        p.famille::text,
        p.sous_famille::text,
        t.ca::numeric,
        NULL::numeric as montant_ttc,
        t.quantite::int,
        t.prix::numeric
      FROM transactions t
      LEFT JOIN produits p ON t.produit = p.id
      WHERE t.facture = $1
      ORDER BY t.produit
    `

    const transactions = await prisma.$queryRawUnsafe(transactionsQuery, facture)

    if (transactions.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' })
    }

    // Infos client
    const carteNum = transactions[0].carte
    let client = null
    if (carteNum) {
      const clientRes = await prisma.$queryRawUnsafe(`
        SELECT carte::text, nom_adresse::text as nom, civilite::text,
               ville::text, cp::text
        FROM clients 
        WHERE carte = $1 
        AND nom_adresse IS NOT NULL
        LIMIT 1
      `, carteNum)
      client = clientRes[0] || null
    }

    // Info résumée du ticket
    const ticketInfo = {
      facture: transactions[0].facture,
      date: transactions[0].date,
      carte: transactions[0].carte,
      depot: transactions[0].depot,
      ca_total: transactions.reduce((sum, t) => sum + parseFloat(t.ca || 0), 0),
      quantite_totale: transactions.reduce((sum, t) => sum + parseInt(t.quantite || 0), 0),
      nb_lignes: transactions.length
    }

    return res.status(200).json({
      ticket: ticketInfo,
      client,
      transactions
    })

  } catch (error) {
    console.error('Ticket transactions error:', error)
    return res.status(500).json({ 
      error: 'Erreur lors de la récupération des transactions',
      details: error.message 
    })
  }
}
