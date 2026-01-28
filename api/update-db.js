import { PrismaClient } from '@prisma/client'
import multiparty from 'multiparty'
import fs from 'fs'
import { parse } from 'csv-parse/sync'

console.log('🔍 Initialisation Prisma...')

let prisma
try {
  prisma = new PrismaClient({ 
    log: ['error', 'warn']
  })
  console.log('✅ Prisma initialisé')
} catch (error) {
  console.error('❌ Erreur init Prisma:', error)
}

export const config = {
  api: {
    bodyParser: false,
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

  // 🔍 Récupérer la date maximale actuelle dans la BDD
  const maxDateResult = await prisma.transactions.findFirst({
    select: { date: true },
    orderBy: { date: 'desc' }
  })
  
  const maxDate = maxDateResult?.date
  console.log(`📅 Date max actuelle dans la BDD: ${maxDate ? maxDate.toISOString().split('T')[0] : 'aucune'}`)

  let totalInserted = 0
  let totalFiltered = 0

  // 1. Clients (optionnel)
  if (files.clients) {
    const clientsData = parseCSV(files.clients[0].path)
    console.log(`📥 ${clientsData.length} clients à insérer...`)
    
    // Utiliser createMany avec skipDuplicates
    await prisma.clients.createMany({
      data: clientsData.map(row => ({
        carte: row.carte,
        ville: row.ville,
        cp: row.cp
      })),
      skipDuplicates: true
    })
  }

  // 2. Produits (optionnel)
  if (files.produits) {
    const produitsData = parseCSV(files.produits[0].path)
    console.log(`📥 ${produitsData.length} produits à insérer...`)
    
    // Utiliser createMany avec skipDuplicates
    await prisma.produits.createMany({
      data: produitsData.map(row => ({
        id: row.id,
        famille: row.famille,
        sous_famille: row.sous_famille,
        sous_sous_famille: row.sous_sous_famille,
        sous_sous_sous_famille: row.sous_sous_sous_famille
      })),
      skipDuplicates: true
    })
  }

  // 3. Transactions (obligatoire) - FILTRER PAR DATE
  const transactionsData = parseCSV(files.transactions[0].path)
  console.log(`📥 ${transactionsData.length} transactions dans le CSV...`)
  
  // Filtrer: ne garder que les transactions APRÈS la date max
  const newTransactions = maxDate 
    ? transactionsData.filter(row => {
        const rowDate = new Date(row.date)
        return rowDate > maxDate
      })
    : transactionsData // Si pas de date max, tout charger

  totalFiltered = transactionsData.length - newTransactions.length
  console.log(`🔍 ${newTransactions.length} nouvelles transactions (${totalFiltered} ignorées car déjà présentes)`)
  
  if (newTransactions.length === 0) {
    console.log('✅ Aucune nouvelle transaction à ajouter')
    return { inserted: 0, filtered: totalFiltered, maxDate }
  }

  // Utiliser createMany pour insérer par batch (beaucoup plus rapide)
  const batchSize = 500
  for (let i = 0; i < newTransactions.length; i += batchSize) {
    const batch = newTransactions.slice(i, i + batchSize)
    
    await prisma.transactions.createMany({
      data: batch.map(row => ({
        facture: row.facture,
        date: new Date(row.date),
        carte: row.carte,
        depot: row.depot,
        produit: row.produit,
        ca: parseFloat(row.ca),
        quantite: parseInt(row.quantite)
      })),
      skipDuplicates: true // Sécurité supplémentaire
    })
    
    totalInserted += batch.length
    console.log(`  ✅ ${totalInserted}/${newTransactions.length}`)
  }

  // Récupérer la nouvelle date max
  const newMaxDateResult = await prisma.transactions.findFirst({
    select: { date: true },
    orderBy: { date: 'desc' }
  })

  return { 
    inserted: totalInserted, 
    filtered: totalFiltered,
    maxDate: newMaxDateResult?.date 
  }
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
  
  await prisma.clients.createMany({
    data: clientsData.map(row => ({
      carte: row.carte,
      ville: row.ville,
      cp: row.cp
    }))
  })
  totals.clients = clientsData.length

  // 3. Charger produits
  const produitsData = parseCSV(files.produits[0].path)
  console.log(`📥 ${produitsData.length} produits...`)
  
  await prisma.produits.createMany({
    data: produitsData.map(row => ({
      id: row.id,
      famille: row.famille,
      sous_famille: row.sous_famille,
      sous_sous_famille: row.sous_sous_famille,
      sous_sous_sous_famille: row.sous_sous_sous_famille
    }))
  })
  totals.produits = produitsData.length

  // 4. Charger dépôts (optionnel)
  if (files.depots) {
    const depotsData = parseCSV(files.depots[0].path)
    console.log(`📥 ${depotsData.length} dépôts...`)
    
    await prisma.depots.createMany({
      data: depotsData.map(row => ({
        code: row.code,
        nom: row.nom
      }))
    })
    totals.depots = depotsData.length
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
  console.log('📥 Request reçue, method:', req.method)
  console.log('🔍 Prisma disponible?', !!prisma)
  
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

  if (!prisma) {
    console.error('❌ Prisma non disponible')
    return res.status(500).json({ 
      error: 'Prisma non initialisé', 
      message: 'Le client Prisma n\'a pas pu être créé' 
    })
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
        inserted: result.inserted,
        filtered: result.filtered,
        maxDate: result.maxDate
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
