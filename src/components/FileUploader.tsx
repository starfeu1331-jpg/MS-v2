import { useState } from 'react'
import { FileText, CheckCircle, Database } from 'lucide-react'
import Papa from 'papaparse'

interface FileUploaderProps {
  onDataLoaded: (data: any) => void
}

export default function FileUploader({ onDataLoaded }: FileUploaderProps) {
  const [files, setFiles] = useState<{
    fileTransactions: File | null
    fileClients: File | null
    fileProduits: File | null
    fileMagasins: File | null
  }>({
    fileTransactions: null,
    fileClients: null,
    fileProduits: null,
    fileMagasins: null,
  })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)

  const handleFileChange = (
    fileType: 'fileTransactions' | 'fileClients' | 'fileProduits' | 'fileMagasins',
    file: File | null
  ) => {
    setFiles((prev) => ({ ...prev, [fileType]: file }))
  }

  const handleDragOver = (e: React.DragEvent, fileType: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(fileType)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
  }

  const handleDrop = (
    e: React.DragEvent,
    fileType: 'fileTransactions' | 'fileClients' | 'fileProduits' | 'fileMagasins'
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFile = droppedFiles.find(
      (file) => file.name.endsWith('.csv') || file.name.endsWith('.xlsx')
    )

    if (validFile) {
      handleFileChange(fileType, validFile)
    }
  }

  const parseExcelFile = async (file: File): Promise<any[]> => {
    // Lazy load XLSX uniquement quand nécessaire
    const XLSX = await import('xlsx')
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(firstSheet)
          resolve(jsonData)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const parseCSVFile = (file: File, encoding: string = 'utf-8'): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        delimiter: ';',
        encoding: encoding,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      })
    })
  }

  const processData = async (
    transactions: any[],
    clients: any[],
    produits: any[],
    magasins: any[]
  ) => {
    setProgress('🔄 Construction des maps de référence...')

    // Maps de référence
    const clientsMap = new Map()
    const produitsMap = new Map()
    const magasinsMap = new Map()

    console.log('📊 Données reçues:')
    console.log('  Transactions:', transactions.length)
    console.log('  Clients:', clients.length)
    console.log('  Produits:', produits.length)
    console.log('  Magasins:', magasins.length)

    // Indexer les clients FIDELES uniquement (carte != 0)
    // Les non-fidèles n'ont pas d'infos client à joindre
    clients.forEach((client, idx) => {
      const clientKeys = Object.keys(client)
      
      // Debug première ligne
      if (idx === 0) {
        console.log('🔍 Clés client CSV:', clientKeys)
        console.log('🔍 Premier client:', client)
      }
      
      // Détecter les colonnes dynamiquement
      const carteColKey = clientKeys.find(k => k.includes('Carte') && k.includes('lit')) || clientKeys[0]
      const dateCreationKey = clientKeys.find(k => k.includes('Date') && k.includes('ation')) || clientKeys[1]
      const sexeKey = clientKeys.find(k => k.includes('Sexe')) || clientKeys[6]
      const dateNaissanceKey = clientKeys.find(k => k.includes('naissance')) || clientKeys[5]
      const cpKey = clientKeys.find(k => k.includes('C.P') || k.includes('CP')) || clientKeys[11]
      const villeKey = clientKeys.find(k => k.includes('Ville')) || clientKeys[12]
      
      const carteKey = String(client[carteColKey] || '').trim()
      
      if (idx === 0) {
        console.log('🔍 Extraction client:', {
          carteKey,
          sexe: client[sexeKey],
          cp: client[cpKey],
          ville: client[villeKey]
        })
      }
      
      if (carteKey && carteKey !== '0' && carteKey !== '') {
        clientsMap.set(carteKey, {
          carte: carteKey,
          dateCreation: client[dateCreationKey] || '',
          sexe: client[sexeKey] || '',
          dateNaissance: client[dateNaissanceKey] || '',
          cp: String(client[cpKey] || '').trim(),
          ville: client[villeKey] || '',
        })
      }
    })

    // Indexer les produits
    produits.forEach((produit) => {
      const produitId = String(produit['N° Produit'] || '').trim()
      if (produitId) {
        produitsMap.set(produitId, {
          id: produitId,
          famille: produit['Famille'] || 'Inconnu',
          sousFamille: produit['Sous famille'] || '',
          sousSousFamille: produit['Sous sous famille'] || '',
          sousSousSousFamille: produit['Sous sous sous famille'] || '',
        })
      }
    })

    // Indexer les magasins
    magasins.forEach((mag) => {
      const depotId = String(mag['N° Dépôt'] || '').trim()
      if (depotId) {
        magasinsMap.set(depotId, {
          code: depotId,
          nom: mag['Intitulé dépôt'] || `M${depotId}`,
          zone: mag['Zones magasin'] || '',
          ville: mag['Ville'] || '',
          cp: mag['CP'] || '',
        })
      }
    })

    console.log('📋 Maps créées:')
    console.log('  Clients indexés:', clientsMap.size)
    console.log('  Produits indexés:', produitsMap.size)
    console.log('  Magasins indexés:', magasinsMap.size)
    console.log('  Exemples de clés magasins:', Array.from(magasinsMap.keys()).slice(0, 5))
    console.log('  Exemple mapping:', Array.from(magasinsMap.entries()).slice(0, 2))

    setProgress('🔄 Traitement des transactions...')

    const processed = {
      allTickets: [] as any[],
      allClients: new Map(),
      familles: {} as any,
      famillesMag: {} as any,
      famillesWeb: {} as any,
      sousFamilles: {} as any,
      sousFamillesMag: {} as any,
      sousFamillesWeb: {} as any,
      fidelite: { oui: 0, non: 0, oui_ca: 0, non_ca: 0 },
      fideliteMag: { oui: 0, non: 0, oui_ca: 0, non_ca: 0 },
      fideliteWeb: { oui: 0, non: 0, oui_ca: 0, non_ca: 0 },
      geo: { cp: {} as any, magasins: {} as any },
      webStats: { ca: 0, volume: 0, tickets: new Set(), ticketsUniques: 0 },
      catalogueWeb: {} as any,
      crossSell: {} as any,
      crossSellMag: {} as any,
      crossSellWeb: {} as any,
      saison: {} as any,
      saisonMag: {} as any,
      saisonWeb: {} as any,
      villes: {} as any,
      produits: {} as any,
      produitsMag: {} as any,
      produitsWeb: {} as any,
      produitsByMonth: {} as any,
      produitsByMonthMag: {} as any,
      produitsByMonthWeb: {} as any,
      locomotives: {} as any,
      sousFamillesLoco: {} as any,
      cohortes: {} as any,
      clientsFirstPurchase: new Map(),
      dateRange: { min: 'N/A', max: 'N/A' },
      lastImportDate: '',
    }

    let minDate: Date | null = null
    let maxDate: Date | null = null
    const ticketsMap = new Map() // Pour grouper par N° Facture
    let lignesIgnorees = 0

    // Traiter les transactions
    for (let i = 0; i < transactions.length; i++) {
      if (i % 50000 === 0) {
        setProgress(`🔄 Traitement: ${Math.round((i / transactions.length) * 100)}%`)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      const row = transactions[i]
      
      // Debug: afficher les clés exactes de la première ligne
      if (i === 0) {
        console.log('🔍 Clés disponibles dans row:', Object.keys(row))
        console.log('🔍 Premier row complet:', row)
        console.log('🔍 Test accès facture avec clé attendue:', row['N° Facture client'])
        console.log('🔍 Test accès avec première clé:', row[Object.keys(row)[1]])
      }
      
      // Utiliser les clés EXACTES telles qu'elles sont dans le CSV
      const rowKeys = Object.keys(row)
      const carteKey = rowKeys.find(k => k.includes('Carte') && k.includes('lit')) || rowKeys[0]
      const factureKey = rowKeys.find(k => k.includes('Facture')) || rowKeys[1]
      const depotKey = rowKeys.find(k => k.includes('p�t') || k.includes('Dépôt')) || rowKeys[2]
      const dateKey = rowKeys.find(k => k.includes('Date') && k.includes('facture')) || rowKeys[3]
      const produitKey = rowKeys.find(k => k.includes('Produit')) || rowKeys[4]
      const quantiteKey = rowKeys.find(k => k.includes('Quantit') || k.includes('unitaire')) || rowKeys[5]
      const prixKey = rowKeys.find(k => k.includes('Prix') || k.includes('vente')) || rowKeys[6]
      
      const carteStr = String(row[carteKey] || '0').trim()
      const factureStr = String(row[factureKey] || '').trim()
      const depotStr = String(row[depotKey] || '').trim()
      const dateStr = row[dateKey] || ''
      const produitStr = String(row[produitKey] || '').trim()
      const quantiteStr = String(row[quantiteKey] || '0').replace(',', '.')
      const prixStr = String(row[prixKey] || '0').replace(',', '.')
      
      // 🔍 DEBUG: Log premiers mappings
      if (i < 3) {
        console.log(`🔍 Transaction #${i + 1}: depotStr="${depotStr}", magasinInfo:`, magasinsMap.get(depotStr))
      }
      
      if (i === 0) {
        console.log('🔍 Extraction:', { carteStr, factureStr, depotStr, dateStr, produitStr, quantiteStr, prixStr })
      }

      if (!factureStr || !dateStr) {
        lignesIgnorees++
        if (lignesIgnorees <= 5) {
          console.log('❌ Ligne ignorée:', { factureStr, dateStr, row })
        }
        continue
      }

      const quantite = parseFloat(quantiteStr) || 0
      const prix = parseFloat(prixStr) || 0
      const ca = quantite * prix

      // Dates min/max
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        if (!minDate || date < minDate) minDate = date
        if (!maxDate || date > maxDate) maxDate = date
      }

      // Enrichir avec infos client
      const clientInfo = clientsMap.get(carteStr) || null
      const estFidele = carteStr !== '0' && carteStr !== '' && clientInfo !== null

      // Enrichir avec infos produit
      const produitInfo = produitsMap.get(produitStr) || {
        id: produitStr,
        famille: 'Inconnu',
        sousFamille: '',
        sousSousFamille: '',
        sousSousSousFamille: '',
      }

      // Enrichir avec infos magasin
      const magasinInfo = magasinsMap.get(depotStr) || {
        code: depotStr,
        nom: `M${depotStr}`,
        zone: 'Inconnu',
        ville: 'Inconnu',
        cp: '',
      }

      // Construire la ligne de ticket enrichie
      const ticketLine = {
        date: dateStr,
        famille: produitInfo.famille,
        ticket: factureStr,
        produit: produitStr,
        sousFamille: produitInfo.sousFamille,
        sousSousFamille: produitInfo.sousSousFamille,
        sousSousSousFamille: produitInfo.sousSousSousFamille,
        magasin: magasinInfo.nom,
        magasinCode: depotStr,
        magasinZone: magasinInfo.zone,
        fidelite: estFidele ? 'Oui' : 'Non',
        carte: carteStr,
        ville: clientInfo?.ville || magasinInfo.ville || '',
        cp: clientInfo?.cp || magasinInfo.cp || '',
        ca: ca,
        quantite: quantite,
        prix: prix,
        dateNaissance: clientInfo?.dateNaissance || '',
        sexe: clientInfo?.sexe || '',
      }

      processed.allTickets.push(ticketLine)

      // Grouper par ticket (facture) pour calculer nb refs
      if (!ticketsMap.has(factureStr)) {
        ticketsMap.set(factureStr, {
          carte: carteStr,
          date: dateStr,
          magasin: magasinInfo.nom,
          refs: new Set(),
          ca: 0,
          fidelite: estFidele,
          cp: clientInfo?.cp || '',
          ville: clientInfo?.ville || '',
        })
      }
      const ticket = ticketsMap.get(factureStr)
      ticket.refs.add(produitStr)
      ticket.ca += ca

      // Agrégations par client
      if (estFidele && carteStr !== '0') {
        if (!processed.allClients.has(carteStr)) {
          processed.allClients.set(carteStr, {
            carte: carteStr,
            cp: clientInfo?.cp || '',
            ville: clientInfo?.ville || '',
            dateNaissance: clientInfo?.dateNaissance || '',
            sexe: clientInfo?.sexe || '',
            achats: [],
            familles: new Set(),
            sousFamilles: new Set(),
          })
        }
        const client = processed.allClients.get(carteStr)
        client.achats.push({
          date: dateStr,
          ticket: factureStr,
          ca: ca,
          famille: produitInfo.famille,
          sousFamille: produitInfo.sousFamille,
          magasin: magasinInfo.nom,
        })
        client.familles.add(produitInfo.famille)
        client.sousFamilles.add(produitInfo.sousFamille)
      }

      // Stats familles (TOTAL: Web + Magasin)
      if (!processed.familles[produitInfo.famille]) {
        processed.familles[produitInfo.famille] = { ca: 0, volume: 0 }
      }
      processed.familles[produitInfo.famille].ca += ca
      processed.familles[produitInfo.famille].volume += quantite

      // Stats familles MAGASIN PHYSIQUE uniquement (pas WEB)
      if (magasinInfo.nom !== 'WEB') {
        if (!processed.famillesMag[produitInfo.famille]) {
          processed.famillesMag[produitInfo.famille] = { ca: 0, volume: 0 }
        }
        processed.famillesMag[produitInfo.famille].ca += ca
        processed.famillesMag[produitInfo.famille].volume += quantite
      } else {
        // Stats familles WEB uniquement
        if (!processed.famillesWeb[produitInfo.famille]) {
          processed.famillesWeb[produitInfo.famille] = { ca: 0, volume: 0 }
        }
        processed.famillesWeb[produitInfo.famille].ca += ca
        processed.famillesWeb[produitInfo.famille].volume += quantite
      }

      // Sous-familles (TOTAL)
      if (produitInfo.sousFamille) {
        if (!processed.sousFamilles[produitInfo.sousFamille]) {
          processed.sousFamilles[produitInfo.sousFamille] = { ca: 0, volume: 0, famille: produitInfo.famille }
        }
        processed.sousFamilles[produitInfo.sousFamille].ca += ca
        processed.sousFamilles[produitInfo.sousFamille].volume += quantite

        // Sous-familles MAGASIN uniquement
        if (magasinInfo.nom !== 'WEB') {
          if (!processed.sousFamillesMag[produitInfo.sousFamille]) {
            processed.sousFamillesMag[produitInfo.sousFamille] = { ca: 0, volume: 0, famille: produitInfo.famille }
          }
          processed.sousFamillesMag[produitInfo.sousFamille].ca += ca
          processed.sousFamillesMag[produitInfo.sousFamille].volume += quantite
        } else {
          // Sous-familles WEB uniquement
          if (!processed.sousFamillesWeb[produitInfo.sousFamille]) {
            processed.sousFamillesWeb[produitInfo.sousFamille] = { ca: 0, volume: 0, famille: produitInfo.famille }
          }
          processed.sousFamillesWeb[produitInfo.sousFamille].ca += ca
          processed.sousFamillesWeb[produitInfo.sousFamille].volume += quantite
        }
      }

      // Stats fidélité (TOTAL)
      if (estFidele) {
        processed.fidelite.oui++
        processed.fidelite.oui_ca += ca
        
        // Séparation Mag/Web
        if (magasinInfo.nom !== 'WEB') {
          processed.fideliteMag.oui++
          processed.fideliteMag.oui_ca += ca
        } else {
          processed.fideliteWeb.oui++
          processed.fideliteWeb.oui_ca += ca
        }
      } else {
        processed.fidelite.non++
        processed.fidelite.non_ca += ca
        
        // Séparation Mag/Web
        if (magasinInfo.nom !== 'WEB') {
          processed.fideliteMag.non++
          processed.fideliteMag.non_ca += ca
        } else {
          processed.fideliteWeb.non++
          processed.fideliteWeb.non_ca += ca
        }
      }

      // Géo
      const cpKey = clientInfo?.cp || magasinInfo.cp || 'Inconnu'
      if (!processed.geo.cp[cpKey]) {
        processed.geo.cp[cpKey] = { ca: 0, count: 0 }
      }
      processed.geo.cp[cpKey].ca += ca
      processed.geo.cp[cpKey].count++

      if (!processed.geo.magasins[magasinInfo.nom]) {
        processed.geo.magasins[magasinInfo.nom] = { ca: 0, count: 0 }
      }
      processed.geo.magasins[magasinInfo.nom].ca += ca
      processed.geo.magasins[magasinInfo.nom].count++
      
      // Villes
      const villeKey = clientInfo?.ville || magasinInfo.ville || 'Inconnu'
      if (!processed.villes[villeKey]) {
        processed.villes[villeKey] = { ca: 0, count: 0 }
      }
      processed.villes[villeKey].ca += ca
      processed.villes[villeKey].count++
      
      // Produits (TOTAL)
      if (!processed.produits[produitStr]) {
        processed.produits[produitStr] = { ca: 0, volume: 0, famille: produitInfo.famille, sousFamille: produitInfo.sousFamille, nom: produitInfo.nom || produitStr }
      }
      processed.produits[produitStr].ca += ca
      processed.produits[produitStr].volume += quantite
      
      // Produits MAGASIN uniquement
      if (magasinInfo.nom !== 'WEB') {
        if (!processed.produitsMag[produitStr]) {
          processed.produitsMag[produitStr] = { ca: 0, volume: 0, famille: produitInfo.famille, sousFamille: produitInfo.sousFamille, nom: produitInfo.nom || produitStr }
        }
        processed.produitsMag[produitStr].ca += ca
        processed.produitsMag[produitStr].volume += quantite
      } else {
        // Produits WEB uniquement
        if (!processed.produitsWeb[produitStr]) {
          processed.produitsWeb[produitStr] = { ca: 0, volume: 0, famille: produitInfo.famille, sousFamille: produitInfo.sousFamille, nom: produitInfo.nom || produitStr }
        }
        processed.produitsWeb[produitStr].ca += ca
        processed.produitsWeb[produitStr].volume += quantite
        
        // WebStats
        processed.webStats.ca += ca
        processed.webStats.volume += quantite
        processed.webStats.tickets.add(factureStr)
      }
    }

    setProgress('🔄 Finalisation...')
    
    // Finaliser webStats
    processed.webStats.ticketsUniques = processed.webStats.tickets.size
    
    // Calculer locomotives (top produits par famille)
    Object.keys(processed.produits).forEach(prodId => {
      const prod = processed.produits[prodId]
      const famille = prod.famille
      if (!processed.locomotives[famille]) {
        processed.locomotives[famille] = []
      }
      processed.locomotives[famille].push({ id: prodId, ...prod })
    })
    
    // Trier et garder top 10 par famille
    Object.keys(processed.locomotives).forEach(famille => {
      processed.locomotives[famille] = processed.locomotives[famille]
        .sort((a: any, b: any) => b.ca - a.ca)
        .slice(0, 10)
    })

    // Convertir clients en array avec toutes les métriques
    const clientsArray = Array.from(processed.allClients.values()).map((client: any) => {
      const ticketsUniques = new Set(client.achats.map((a: any) => a.ticket)).size
      const caTotal = client.achats.reduce((sum: number, a: any) => sum + a.ca, 0)
      const dateAchats = client.achats.map((a: any) => new Date(a.date)).filter((d: Date) => !isNaN(d.getTime()))
      
      const premierAchat = dateAchats.length > 0 ? new Date(Math.min(...dateAchats.map((d: Date) => d.getTime()))) : null
      const dernierAchat = dateAchats.length > 0 ? new Date(Math.max(...dateAchats.map((d: Date) => d.getTime()))) : null
      
      let joursSinceLast = 9999
      if (dernierAchat && maxDate) {
        joursSinceLast = Math.floor((maxDate.getTime() - dernierAchat.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        ...client,
        familles: Array.from(client.familles),
        sousFamilles: Array.from(client.sousFamilles),
        nbTickets: ticketsUniques,
        caTotal: caTotal,
        premierAchat: premierAchat ? premierAchat.toISOString().split('T')[0] : '',
        dernierAchat: dernierAchat ? dernierAchat.toISOString().split('T')[0] : '',
        joursSinceLast: joursSinceLast,
      }
    })

    processed.allClients = new Map(clientsArray.map((c) => [c.carte, c]))

    // Date range
    if (minDate && maxDate) {
      processed.dateRange = {
        min: minDate.toISOString().split('T')[0],
        max: maxDate.toISOString().split('T')[0],
      }
    }

    processed.lastImportDate = new Date().toISOString()

    console.log('✅ Traitement terminé:')
    console.log('  Lignes tickets:', processed.allTickets.length)
    console.log('  Lignes ignorées:', lignesIgnorees)
    console.log('  Clients fidèles:', processed.allClients.size)
    console.log('  Familles:', Object.keys(processed.familles).length)
    console.log('  Sous-familles:', Object.keys(processed.sousFamilles).length)
    console.log('  Produits uniques:', Object.keys(processed.produits).length)
    console.log('  Magasins:', Object.keys(processed.geo.magasins).length)
    console.log('  Villes:', Object.keys(processed.villes).length)
    console.log('  Date range:', processed.dateRange)
    console.log('  CA total:', Object.values(processed.familles).reduce((sum: number, f: any) => sum + f.ca, 0).toFixed(2), '€')

    return processed
  }

  const loadFiles = async () => {
    if (!files.fileTransactions || !files.fileClients || !files.fileProduits || !files.fileMagasins) {
      alert('⚠️ Veuillez charger les 4 fichiers requis')
      return
    }

    setLoading(true)
    setProgress('📂 Chargement des fichiers...')

    try {
      setProgress('📄 Lecture des transactions...')
      const transactions = await parseCSVFile(files.fileTransactions, 'utf-8')

      setProgress('📄 Lecture des clients...')
      const clients = await parseCSVFile(files.fileClients, 'utf-8')

      setProgress('📄 Lecture des produits...')
      const produits = await parseExcelFile(files.fileProduits)

      setProgress('📄 Lecture des magasins...')
      const magasins = await parseExcelFile(files.fileMagasins)

      const processedData = await processData(transactions, clients, produits, magasins)
      onDataLoaded(processedData)
      setProgress('✅ Données chargées avec succès!')
    } catch (error) {
      console.error('❌ Erreur:', error)
      
      let errorMessage = 'Erreur lors du chargement'
      
      if (error instanceof Error) {
        if (error.name === 'NotReadableError' || error.message.includes('could not be read')) {
          errorMessage = '❌ Impossible de lire un ou plusieurs fichiers.\n\n' +
            '📌 Causes possibles :\n' +
            '• Un fichier est ouvert dans Excel ou une autre application\n' +
            '• Les permissions ont changé\n' +
            '• Le fichier a été déplacé ou supprimé\n\n' +
            '✅ Solution : Fermez tous les fichiers Excel et réessayez'
        } else {
          errorMessage = `❌ Erreur: ${error.message}`
        }
      }
      
      setProgress(errorMessage)
      alert(errorMessage)
    } finally {
      setTimeout(() => setLoading(false), 500)
    }
  }

  const allFilesLoaded =
    files.fileTransactions && files.fileClients && files.fileProduits && files.fileMagasins

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6 shadow-lg">
            <Database className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-semibold text-white mb-3">Importez vos données V2</h2>
          <p className="text-zinc-400 text-base max-w-2xl mx-auto">
            Nouvelle structure de données avec jointures automatiques
            <br />
            <span className="text-sm text-zinc-500 mt-2 inline-block">
              4 fichiers requis: Transactions (CSV), Clients (CSV), Produits (Excel), Magasins (Excel)
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Fichier Transactions */}
          <div
            className={`glass rounded-3xl p-6 border transition-all duration-300 group ${
              dragOver === 'fileTransactions'
                ? 'border-blue-500 bg-blue-500/10 scale-105'
                : 'border-zinc-800 hover:border-blue-500/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'fileTransactions')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'fileTransactions')}
          >
            <label
              htmlFor="fileTransactions"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl group-hover:from-blue-500/20 group-hover:to-cyan-500/20 transition-all duration-300">
                  {files.fileTransactions ? (
                    <CheckCircle className="w-12 h-12 text-blue-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-blue-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileTransactions ? files.fileTransactions.name : 'Transactions'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileTransactions ? 'Fichier chargé' : 'détail transactions.csv'}
                </p>
              </div>
            </label>
            <input
              id="fileTransactions"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange('fileTransactions', e.target.files?.[0] || null)}
            />
          </div>

          {/* Fichier Clients */}
          <div
            className={`glass rounded-3xl p-6 border transition-all duration-300 group ${
              dragOver === 'fileClients'
                ? 'border-green-500 bg-green-500/10 scale-105'
                : 'border-zinc-800 hover:border-green-500/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'fileClients')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'fileClients')}
          >
            <label
              htmlFor="fileClients"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl group-hover:from-green-500/20 group-hover:to-emerald-500/20 transition-all duration-300">
                  {files.fileClients ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-green-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileClients ? files.fileClients.name : 'Clients'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileClients ? 'Fichier chargé' : 'client.csv'}
                </p>
              </div>
            </label>
            <input
              id="fileClients"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange('fileClients', e.target.files?.[0] || null)}
            />
          </div>

          {/* Fichier Produits */}
          <div
            className={`glass rounded-3xl p-6 border transition-all duration-300 group ${
              dragOver === 'fileProduits'
                ? 'border-purple-500 bg-purple-500/10 scale-105'
                : 'border-zinc-800 hover:border-purple-500/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'fileProduits')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'fileProduits')}
          >
            <label
              htmlFor="fileProduits"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-all duration-300">
                  {files.fileProduits ? (
                    <CheckCircle className="w-12 h-12 text-purple-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-purple-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileProduits ? files.fileProduits.name : 'Produits'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileProduits ? 'Fichier chargé' : 'Produits.xlsx'}
                </p>
              </div>
            </label>
            <input
              id="fileProduits"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChange('fileProduits', e.target.files?.[0] || null)}
            />
          </div>

          {/* Fichier Magasins */}
          <div
            className={`glass rounded-3xl p-6 border transition-all duration-300 group ${
              dragOver === 'fileMagasins'
                ? 'border-orange-500 bg-orange-500/10 scale-105'
                : 'border-zinc-800 hover:border-orange-500/50'
            }`}
            onDragOver={(e) => handleDragOver(e, 'fileMagasins')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'fileMagasins')}
          >
            <label
              htmlFor="fileMagasins"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl group-hover:from-orange-500/20 group-hover:to-red-500/20 transition-all duration-300">
                  {files.fileMagasins ? (
                    <CheckCircle className="w-12 h-12 text-orange-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-orange-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileMagasins ? files.fileMagasins.name : 'Points de vente'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileMagasins ? 'Fichier chargé' : 'Points de vente.xlsx'}
                </p>
              </div>
            </label>
            <input
              id="fileMagasins"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChange('fileMagasins', e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {allFilesLoaded && (
          <div className="space-y-4">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold py-4 px-8 rounded-2xl hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              <span className="relative z-10 flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {progress}
                  </>
                ) : (
                  <>Analyser les données V2</>
                )}
              </span>
            </button>

            {loading && (
              <div className="glass rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Traitement en cours...</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Jointure et agrégation des données
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
