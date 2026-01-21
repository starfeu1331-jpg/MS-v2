import { useState } from 'react'
import { Upload, FileText, CheckCircle } from 'lucide-react'
import Papa from 'papaparse'

interface FileUploaderProps {
  onDataLoaded: (data: any) => void
}

export default function FileUploader({ onDataLoaded }: FileUploaderProps) {
  const [files, setFiles] = useState<{ fileMagasins: File[]; fileWeb: File | null; fileCatalogueWeb: File | null }>({
    fileMagasins: [],
    fileWeb: null,
    fileCatalogueWeb: null,
  })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')

  const handleFileChange = (fileType: 'fileMagasins' | 'fileWeb' | 'fileCatalogueWeb', fileList: File[] | File | null) => {
    if (fileType === 'fileMagasins' && Array.isArray(fileList)) {
      setFiles(prev => ({ ...prev, fileMagasins: fileList }))
    } else if (fileType !== 'fileMagasins') {
      setFiles(prev => ({ ...prev, [fileType]: fileList as File | null }))
    }
  }

  const processData = (allData: any[]) => {
    setProgress('🔄 Traitement des données...')
    
    // Debug: Afficher les colonnes du CSV
    if (allData.length > 0) {
      console.log('📋 Colonnes trouvées dans le CSV:', Object.keys(allData[0]))
    }
    
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
      webStats: { ca: 0, volume: 0, tickets: new Set() },
      catalogueWeb: {} as any, // Nouveau: catalogue des produits dispo sur le web
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
      lastImportDate: ''
    }

    console.log('📊 Début traitement:', allData.length, 'lignes')
    
    allData.forEach((row: any, index: number) => {
      if (index % 10000 === 0) {
        console.log(`⏳ Traitement ligne ${index}/${allData.length}`)
      }
      
      // Détecter le format du CSV (magasin vs web)
      // Vérifier avec et sans guillemets car Papa Parse peut les inclure
      const isWebFormat = 'categorie' in row || 'magasin' in row || '"categorie"' in row || '"magasin"' in row
      
      const famille = isWebFormat ? (row['categorie'] || row['"categorie"']) : row['Famille Produit']
      const sousFamille = isWebFormat ? null : row['S/Famille Produit']
      const magasin = isWebFormat ? (row['magasin'] || row['"magasin"']) : row['Magasin']
      const fidelite = isWebFormat ? (row['carte_fidelite'] && row['carte_fidelite'] !== '' ? 'Oui' : 'Non') : row['Client Fidélité']
      const carte = isWebFormat ? (row['carte_fidelite'] || row['"carte_fidelite"']) : row['N° Carte de fidélité']
      const cp = isWebFormat ? (row['cp'] || row['"cp"']) : row['C.P Fidélité']
      const ville = isWebFormat ? (row['ville'] || row['"ville"']) : row['Ville Fidélité']
      const caStr = isWebFormat ? (row['ca_ttc'] || row['"ca_ttc"']) : row['CA Ventes TTC Période 1']
      const ticket = isWebFormat ? (row['numero_ticket'] || row['"numero_ticket"']) : row['N° Ticket']
      const produit = isWebFormat ? (row['code_article'] || row['"code_article"']) : row['N° Produit']
      const date = isWebFormat ? (row['date'] || row['"date"']) : row['Date']
      
      if (index < 3 && isWebFormat) {
        console.log('🌐 Ligne Web détectée:', {
          magasin,
          isWeb: magasin === 'WEB',
          carte,
          ticket,
          date
        })
      }

      if (!famille || !caStr || String(caStr).trim() === '') return

      let caClean = String(caStr)
        .replace(/\s+/g, '')
        .replace(/\u00A0/g, '')
        .replace(/\u202F/g, '')
        .replace(',', '.')
      const ca = parseFloat(caClean)

      // Autoriser les CA négatifs (avoirs, remboursements) mais ignorer les valeurs invalides et 0
      if (isNaN(ca) || ca === 0) return

      // Web vs Physique - DOIT ÊTRE DÉFINI EN PREMIER
      const isWeb = magasin === 'WEB'

      // Tickets
      processed.allTickets.push({
        ticket: ticket || 'N/A',
        date: date || 'N/A',
        carte: carte || 'Sans carte',
        famille,
        sousFamille: sousFamille || '-',
        produit: produit || '-',
        magasin,
        ca,
        ville: ville || '-',
        cp: cp || '-',
      })

      // Clients - Grouper par ticket pour éviter de compter chaque ligne comme un achat
      if (carte && carte !== '-' && ticket) {
        if (!processed.allClients.has(carte)) {
          processed.allClients.set(carte, {
            carte,
            ville: ville || '-',
            cp: cp || '-',
            achats: [],
            ticketMap: new Map(), // Pour grouper par ticket
            ca_total: 0,
            firstPurchaseDate: date,
          })
        }
        const client = processed.allClients.get(carte)
        
        // Grouper par ticket : un même ticket = un seul achat
        if (!client.ticketMap.has(ticket)) {
          client.ticketMap.set(ticket, {
            date,
            ticket,
            famille,
            sousFamille,
            produits: [],
            magasin,
            ca: 0,
            isWeb
          })
          client.achats.push(client.ticketMap.get(ticket))
        }
        
        // Ajouter le produit et le CA au ticket existant
        const ticketData = client.ticketMap.get(ticket)
        ticketData.produits.push({ produit, famille, sousFamille, ca })
        ticketData.ca += ca
        client.ca_total += ca
        
        // Track first purchase date
        if (!client.firstPurchaseDate || date < client.firstPurchaseDate) {
          client.firstPurchaseDate = date
        }
      }

      // Familles (Global + Mag/Web séparés)
      if (!processed.familles[famille]) {
        processed.familles[famille] = { ca: 0, volume: 0 }
      }
      processed.familles[famille].ca += ca
      processed.familles[famille].volume++

      if (isWeb) {
        if (!processed.famillesWeb[famille]) {
          processed.famillesWeb[famille] = { ca: 0, volume: 0 }
        }
        processed.famillesWeb[famille].ca += ca
        processed.famillesWeb[famille].volume++
      } else {
        if (!processed.famillesMag[famille]) {
          processed.famillesMag[famille] = { ca: 0, volume: 0 }
        }
        processed.famillesMag[famille].ca += ca
        processed.famillesMag[famille].volume++
      }

      // Sous-familles (Global + Mag/Web séparés)
      if (sousFamille) {
        const key = famille + '|||' + sousFamille
        if (!processed.sousFamilles[key]) {
          processed.sousFamilles[key] = { famille, sousFamille, ca: 0, volume: 0 }
        }
        processed.sousFamilles[key].ca += ca
        processed.sousFamilles[key].volume++

        if (isWeb) {
          if (!processed.sousFamillesWeb[key]) {
            processed.sousFamillesWeb[key] = { famille, sousFamille, ca: 0, volume: 0 }
          }
          processed.sousFamillesWeb[key].ca += ca
          processed.sousFamillesWeb[key].volume++
        } else {
          if (!processed.sousFamillesMag[key]) {
            processed.sousFamillesMag[key] = { famille, sousFamille, ca: 0, volume: 0 }
          }
          processed.sousFamillesMag[key].ca += ca
          processed.sousFamillesMag[key].volume++
        }
      }

      // Fidélité (Global + Mag/Web séparés)
      const fideliteObj = isWeb ? processed.fideliteWeb : processed.fideliteMag
      if (fidelite === 'Oui') {
        processed.fidelite.oui++
        processed.fidelite.oui_ca += ca
        fideliteObj.oui++
        fideliteObj.oui_ca += ca
      } else {
        processed.fidelite.non++
        processed.fidelite.non_ca += ca
        fideliteObj.non++
        fideliteObj.non_ca += ca
      }

      // Magasins (traquer TOUS les magasins incluant web pour le classement)
      
      // Ajouter à geo.magasins pour tous les magasins (incluant web)
      if (magasin && magasin !== '-') {
        if (!processed.geo.magasins[magasin]) {
          processed.geo.magasins[magasin] = { ca: 0, volume: 0 }
        }
        processed.geo.magasins[magasin].ca += ca
        processed.geo.magasins[magasin].volume++
      }

      // En plus, si c'est web, l'ajouter aussi aux webStats
      if (isWeb) {
        processed.webStats.ca += ca
        processed.webStats.volume++
        if (ticket) {
          processed.webStats.tickets.add(ticket)
        }
      }

      // Géo CP
      if (cp && cp !== '-') {
        if (!processed.geo.cp[cp]) {
          processed.geo.cp[cp] = { ca: 0, volume: 0, ville: ville || '' }
        }
        processed.geo.cp[cp].ca += ca
        processed.geo.cp[cp].volume++
      }

      // Villes
      if (ville && ville !== '-') {
        if (!processed.villes[ville]) {
          processed.villes[ville] = { ca: 0, volume: 0 }
        }
        processed.villes[ville].ca += ca
        processed.villes[ville].volume++
      }

      // Produits (Global + Mag/Web + Par mois)
      if (produit && produit !== '-') {
        if (!processed.produits[produit]) {
          processed.produits[produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
        }
        processed.produits[produit].ca += ca
        processed.produits[produit].volume++

        if (isWeb) {
          if (!processed.produitsWeb[produit]) {
            processed.produitsWeb[produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
          }
          processed.produitsWeb[produit].ca += ca
          processed.produitsWeb[produit].volume++
        } else {
          if (!processed.produitsMag[produit]) {
            processed.produitsMag[produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
          }
          processed.produitsMag[produit].ca += ca
          processed.produitsMag[produit].volume++
        }

        // Par mois pour recommandations réseaux sociaux
        if (date) {
          const month = date.substring(3, 5) + '/' + date.substring(6, 10)
          
          if (!processed.produitsByMonth[month]) processed.produitsByMonth[month] = {}
          if (!processed.produitsByMonth[month][produit]) {
            processed.produitsByMonth[month][produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
          }
          processed.produitsByMonth[month][produit].ca += ca
          processed.produitsByMonth[month][produit].volume++

          if (isWeb) {
            if (!processed.produitsByMonthWeb[month]) processed.produitsByMonthWeb[month] = {}
            if (!processed.produitsByMonthWeb[month][produit]) {
              processed.produitsByMonthWeb[month][produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
            }
            processed.produitsByMonthWeb[month][produit].ca += ca
            processed.produitsByMonthWeb[month][produit].volume++
          } else {
            if (!processed.produitsByMonthMag[month]) processed.produitsByMonthMag[month] = {}
            if (!processed.produitsByMonthMag[month][produit]) {
              processed.produitsByMonthMag[month][produit] = { ca: 0, volume: 0, famille, sousFamille: sousFamille || '-' }
            }
            processed.produitsByMonthMag[month][produit].ca += ca
            processed.produitsByMonthMag[month][produit].volume++
          }
        }
      }

      // Saisonnalité (Global + Mag/Web séparés)
      if (date) {
        const month = date.substring(3, 5) + '/' + date.substring(6, 10)
        
        if (!processed.saison[month]) processed.saison[month] = {}
        if (!processed.saison[month][famille]) processed.saison[month][famille] = 0
        processed.saison[month][famille] += ca

        if (isWeb) {
          if (!processed.saisonWeb[month]) processed.saisonWeb[month] = {}
          if (!processed.saisonWeb[month][famille]) processed.saisonWeb[month][famille] = 0
          processed.saisonWeb[month][famille] += ca
        } else {
          if (!processed.saisonMag[month]) processed.saisonMag[month] = {}
          if (!processed.saisonMag[month][famille]) processed.saisonMag[month][famille] = 0
          processed.saisonMag[month][famille] += ca
        }
      }

      // Cross-selling (Global + Mag/Web séparés)
      if (ticket) {
        if (!processed.crossSell[ticket]) processed.crossSell[ticket] = new Set()
        processed.crossSell[ticket].add(famille)

        if (isWeb) {
          if (!processed.crossSellWeb[ticket]) processed.crossSellWeb[ticket] = new Set()
          processed.crossSellWeb[ticket].add(famille)
        } else {
          if (!processed.crossSellMag[ticket]) processed.crossSellMag[ticket] = new Set()
          processed.crossSellMag[ticket].add(famille)
        }
      }

      // Cohortes clients (par mois de première visite)
      if (carte && carte !== '-' && date) {
        const cohortMonth = date.substring(3, 5) + '/' + date.substring(6, 10)
        if (!processed.clientsFirstPurchase.has(carte)) {
          processed.clientsFirstPurchase.set(carte, cohortMonth)
        }
      }
    })

    // Calculer les cohortes
    processed.clientsFirstPurchase.forEach((cohortMonth, carte) => {
      if (!processed.cohortes[cohortMonth]) {
        processed.cohortes[cohortMonth] = { clients: new Set(), ca: 0, volume: 0 }
      }
      processed.cohortes[cohortMonth].clients.add(carte)
      const client = processed.allClients.get(carte)
      if (client) {
        processed.cohortes[cohortMonth].ca += client.ca_total
        processed.cohortes[cohortMonth].volume += client.achats.length
      }
    })

    // Nettoyer les ticketMap temporaires des clients
    processed.allClients.forEach(client => {
      delete client.ticketMap
    })

    // Calculer la plage de dates
    const allDates = processed.allTickets
      .map(t => t.date)
      .filter(d => d && d !== 'N/A')
      .map(d => {
        const [day, month, year] = d.split('/')
        return { original: d, date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)) }
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    
    processed.dateRange = {
      min: allDates[0]?.original || 'N/A',
      max: allDates[allDates.length - 1]?.original || 'N/A'
    }

    // Date d'import
    processed.lastImportDate = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Convertir le Set de tickets Web en nombre
    const webTicketsCount = processed.webStats.tickets.size
    
    // Debug Web stats
    console.log('🌐 Stats Web:', {
      ca: processed.webStats.ca,
      volume: processed.webStats.volume,
      ticketsUniques: webTicketsCount,
      ticketUnique: Array.from(processed.webStats.tickets)[0],
      info: webTicketsCount === 1 ? '⚠️ Tous les produits Web ont le même N° Ticket !' : '✅ OK'
    })
    
    delete (processed.webStats as any).tickets // Supprimer le Set

    console.log('✅ Traitement terminé:', {
      tickets: processed.allTickets.length,
      clients: processed.allClients.size,
      familles: Object.keys(processed.familles).length,
      dateRange: processed.dateRange,
      lastImportDate: processed.lastImportDate,
      webStats: { ca: processed.webStats.ca, ticketsUniques: webTicketsCount }
    })
    
    console.log('🏪 MAGASINS DANS processed.geo.magasins:', {
      count: Object.keys(processed.geo.magasins).length,
      magasins: Object.entries(processed.geo.magasins).map(([mag, stats]: [string, any]) => ({
        nom: mag,
        ca: stats.ca,
        volume: stats.volume
      })).slice(0, 5)
    })

    setProgress('✅ Terminé!')
    
    // Si on a un catalogue web, on le parse maintenant
    if ((window as any).catalogueWebData) {
      processed.catalogueWeb = (window as any).catalogueWebData
      console.log('📦 Catalogue web chargé:', Object.keys(processed.catalogueWeb).length, 'produits')
    }
    
    setTimeout(() => onDataLoaded(processed), 300)
  }

  const loadFiles = async () => {
    if (files.fileMagasins.length === 0) {
      alert('Veuillez sélectionner au moins un fichier magasin')
      return
    }

    setLoading(true)
    
    // Charger d'abord le catalogue web si présent
    if (files.fileCatalogueWeb) {
      setProgress('📦 Lecture du catalogue web...')
      Papa.parse(files.fileCatalogueWeb, {
        header: true,
        delimiter: ',',
        skipEmptyLines: true,
        complete: (resultsCatalogue) => {
          const catalogueWeb: any = {}
          resultsCatalogue.data.forEach((row: any) => {
            const code = row['code_article'] || row['"code_article"']
            if (code) {
              catalogueWeb[code] = {
                nom: row['nom_article'] || row['"nom_article"'] || code,
                categorie: row['categorie'] || row['"categorie"'] || '-',
                prix: parseFloat(row['prix_ht'] || row['"prix_ht"'] || '0'),
                stock: parseInt(row['stock'] || row['"stock"'] || '0')
              }
            }
          })
          ;(window as any).catalogueWebData = catalogueWeb
          console.log('📦 Catalogue web parsé:', Object.keys(catalogueWeb).length, 'produits')
          setProgress(`✅ Catalogue: ${Object.keys(catalogueWeb).length} produits`)
          continueLoading()
        }
      })
    } else {
      continueLoading()
    }
  }
  
  const continueLoading = async () => {
    let allData: any[] = []

    // Charger tous les fichiers magasins
    for (let i = 0; i < files.fileMagasins.length; i++) {
      const file = files.fileMagasins[i]
      setProgress(`📂 Lecture fichier magasin ${i + 1}/${files.fileMagasins.length}...`)
      
      await new Promise<void>((resolve) => {
        Papa.parse(file, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
          complete: (results) => {
            allData = allData.concat(results.data)
            setProgress(`✅ Fichier ${i + 1}: ${results.data.length.toLocaleString()} lignes`)
            resolve()
          },
        })
      })
    }

    setProgress(`✅ Magasins: ${allData.length.toLocaleString()} lignes au total`)

    // Charger le fichier Web si présent
    if (files.fileWeb) {
      setProgress('🌐 Lecture du fichier Web...')
      await new Promise<void>((resolve) => {
        Papa.parse(files.fileWeb!, {
          header: true,
          delimiter: ',',
          skipEmptyLines: true,
          complete: (results) => {
            console.log('🌐 CSV Web parsé - Première ligne:', results.data[0])
            console.log('🌐 Colonnes détectées:', Object.keys(results.data[0] || {}))
            allData = allData.concat(results.data)
            setProgress(`✅ Total: ${allData.length.toLocaleString()} lignes`)
            resolve()
          },
        })
      })
    }

    processData(allData)
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass rounded-3xl p-10 border border-zinc-800 shadow-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-6 shadow-lg">
            <Upload className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-semibold text-white mb-3">
            Importez vos données
          </h2>
          <p className="text-zinc-400 text-base max-w-2xl mx-auto">
            Chargez un ou deux fichiers CSV pour générer votre tableau de bord analytique.
            <br />
            <span className="text-sm text-zinc-500 mt-2 inline-block">
              Format accepté : CSV avec séparateur point-virgule (;)
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Fichiers Magasins (sélection multiple) */}
          <div className="group">
            <label className="block text-sm font-semibold text-zinc-300 mb-3">
              Fichiers Magasins (1 ou 2)
            </label>
            <div
              onClick={() => document.getElementById('fileMagasins')?.click()}
              className="relative border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-zinc-800/50 transition-all duration-300 cursor-pointer"
            >
              {files.fileMagasins.length > 0 ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <span className="font-medium text-white break-all px-2">
                    {files.fileMagasins.length} fichier{files.fileMagasins.length > 1 ? 's' : ''}
                  </span>
                  <div className="text-xs text-zinc-500 max-w-full overflow-hidden">
                    {files.fileMagasins.map((f, i) => (
                      <div key={i} className="truncate">{f.name}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 group-hover:text-blue-400 transition-colors">
                  <FileText className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-sm font-medium">Sélectionnez 1 ou 2 fichiers</p>
                  <p className="text-xs text-zinc-600 mt-2">En même temps</p>
                </div>
              )}
            </div>
            <input
              id="fileMagasins"
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(e) => handleFileChange('fileMagasins', Array.from(e.target.files || []))}
            />
          </div>

          {/* Fichier WEB (optionnel) */}
          <div className="glass rounded-3xl p-6 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-300 group">
            <label
              htmlFor="fileWeb"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl group-hover:from-cyan-500/20 group-hover:to-blue-500/20 transition-all duration-300">
                  {files.fileWeb ? (
                    <CheckCircle className="w-12 h-12 text-cyan-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-cyan-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileWeb ? files.fileWeb.name : 'CSV Web (optionnel)'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileWeb ? 'Fichier chargé' : 'Données e-commerce'}
                </p>
              </div>
            </label>
            <input
              id="fileWeb"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange('fileWeb', e.target.files?.[0] || null)}
            />
          </div>
          
          {/* Fichier Catalogue Web (optionnel) */}
          <div className="glass rounded-3xl p-6 border border-zinc-800 hover:border-yellow-500/50 transition-all duration-300 group">
            <label
              htmlFor="fileCatalogueWeb"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              <div className="relative">
                <div className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl group-hover:from-yellow-500/20 group-hover:to-orange-500/20 transition-all duration-300">
                  {files.fileCatalogueWeb ? (
                    <CheckCircle className="w-12 h-12 text-yellow-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-yellow-500" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {files.fileCatalogueWeb ? files.fileCatalogueWeb.name : 'Catalogue Web (optionnel)'}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  {files.fileCatalogueWeb ? 'Fichier chargé' : 'Pour King Quentin 👑'}
                </p>
              </div>
            </label>
            <input
              id="fileCatalogueWeb"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileChange('fileCatalogueWeb', e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {files.fileMagasins.length > 0 && (
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
                  <>
                    Analyser les données
                  </>
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
                    <p className="text-xs text-zinc-500 mt-1">Analyse et génération des statistiques</p>
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
