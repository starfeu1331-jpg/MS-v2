import { PrismaClient } from '@prisma/client'
import multiparty from 'multiparty'
import fs from 'fs'
import { parse } from 'csv-parse/sync'

const prisma = new PrismaClient({ log: ['error', 'warn'] })

export const config = {
  api: {
    bodyParser: false, // Désactiver pour gérer multipart/form-data
  },
}

const parseCSV = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parse(content, { columns: true, skip_empty_lines: true })
}

const handleDailyUpdate = async (files) => {
  console.log('📅 Mise à jour quotidienne...')
  
  if (!files.transactions) {
    throw new Error('Fichier transactions.csv manquant')
  }

  let totalInserted = 0

  // 1. Clients (optionnel)
  if (files.clients) {
    const clientsData = parseCSV(files.clients[0].path)
    console.log(`📥 ${clientsData.length} clients à insérer...`)
    
    for (const row of clientsData) {
      try {
        await prisma.clients.upsert({
          where: { carte: row.carte },
          update: { ville: row.ville, cp: row.cp },
          create: { carte: row.carte, ville: row.ville, cp: row.cp }
        })
      } catch (e) {
        // Ignorer les doublons
      }
    }
  }

  // 2. Produits (optionnel)
  if (files.produits) {
    const produitsData = parseCSV(files.produits[0].path)
    console.log(`📥 ${produitsData.length} produits à insérer...`)
    
    for (const row of produitsData) {
      try {
        await prisma.produits.upsert({
          where: { id: row.id },
          update: {
            famille: row.famille,
            sous_famille: row.sous_famille,
            sous_sous_famille: row.sous_sous_famille,
            sous_sous_sous_famille: row.sous_sous_sous_famille
          },
          create: {
            id: row.id,
            famille: row.famille,
            sous_famille: row.sous_famille,
            sous_sous_famille: row.sous_sous_famille,
            sous_sous_sous_famille: row.sous_sous_sous_famille
          }
        })
      } catch (e) {
        // Ignorer les doublons
      }
    }
  }

  // 3. Transactions (obligatoire)
  const transactionsData = parseCSV(files.transactions[0].path)
  console.log(`📥 ${transactionsData.length} transactions à insérer...`)
  
  for (const row of transactionsData) {
    await prisma.transactions.create({
      data: {
        facture: row.facture,
        date: new Date(row.date),
        carte: row.carte,
        depot: row.depot,
        produit: row.produit,
        ca: parseFloat(row.ca),
        quantite: parseInt(row.quantite)
      }
    })
    totalInserted++
  }

  return { inserted: totalInserted }
}

const handleWeeklyUpdate = async (files) => {
  console.log('🗓️ Mise à jour hebdomadaire (complète)...')
  
  if (!files.transactions || !files.clients || !files.produits) {
    throw new Error('Fichiers manquants: transactions, clients et produits requis')
  }

  // 1. Supprimer toutes les tables
  console.log('🗑️ Suppression des données existantes...')
  await prisma.transactions.deleteMany({})
  await prisma.clients.deleteMany({})
  await prisma.produits.deleteMany({})
  
  if (files.depots) {
    await prisma.depots.deleteMany({})
  }

  let totals = {
    clients: 0,
    produits: 0,
    depots: 0,
    transactions: 0
  }

  // 2. Charger clients
  const clientsData = parseCSV(files.clients[0].path)
  console.log(`📥 ${clientsData.length} clients...`)
  
  for (const row of clientsData) {
    await prisma.clients.create({
      data: {
        carte: row.carte,
        ville: row.ville,
        cp: row.cp
      }
    })
    totals.clients++
  }

  // 3. Charger produits
  const produitsData = parseCSV(files.produits[0].path)
  console.log(`📥 ${produitsData.length} produits...`)
  
  for (const row of produitsData) {
    await prisma.produits.create({
      data: {
        id: row.id,
        famille: row.famille,
        sous_famille: row.sous_famille,
        sous_sous_famille: row.sous_sous_famille,
        sous_sous_sous_famille: row.sous_sous_sous_famille
      }
    })
    totals.produits++
  }

  // 4. Charger dépôts (optionnel)
  if (files.depots) {
    const depotsData = parseCSV(files.depots[0].path)
    console.log(`📥 ${depotsData.length} dépôts...`)
    
    for (const row of depotsData) {
      await prisma.depots.create({
        data: {
          code: row.code,
          nom: row.nom
        }
      })
      totals.depots++
    }
  }

  // 5. Charger transactions
  const transactionsData = parseCSV(files.transactions[0].path)
  console.log(`📥 ${transactionsData.length} transactions...`)
  
  // Charger par batch de 1000 pour éviter les timeouts
  const batchSize = 1000
  for (let i = 0; i < transactionsData.length; i += batchSize) {
    const batch = transactionsData.slice(i, i + batchSize)
    
    await prisma.transactions.createMany({
      data: batch.map(row => ({
        facture: row.facture,
        date: new Date(row.date),
        carte: row.carte,
        depot: row.depot,
        produit: row.produit,
        ca: parseFloat(row.ca),
        quantite: parseInt(row.quantite)
      }))
    })
    
    totals.transactions += batch.length
    console.log(`  ✅ ${totals.transactions}/${transactionsData.length}`)
  }

  return totals
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    // Parser les fichiers multipart
    const form = new multiparty.Form()
    
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ fields, files })
      })
    })

    const mode = fields.mode?.[0]

    if (mode === 'daily') {
      const result = await handleDailyUpdate(files)
      res.status(200).json({
        success: true,
        message: 'Mise à jour quotidienne réussie',
        inserted: result.inserted
      })
    } else if (mode === 'weekly') {
      const totals = await handleWeeklyUpdate(files)
      res.status(200).json({
        success: true,
        message: 'Recréation complète réussie',
        total: totals.transactions,
        details: totals
      })
    } else {
      throw new Error('Mode invalide (daily ou weekly)')
    }

    // Nettoyer les fichiers temporaires
    Object.values(files).flat().forEach(file => {
      fs.unlinkSync(file.path)
    })

  } catch (error) {
    console.error('❌ Erreur update-db:', error)
    res.status(500).json({
      error: 'Erreur lors de la mise à jour',
      message: error.message
    })
  }
}
