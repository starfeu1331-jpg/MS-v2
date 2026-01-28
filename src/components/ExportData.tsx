import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react'
import { useState } from 'react'

interface ExportDataProps {
  data: any
}

export default function ExportData({ data }: ExportDataProps) {
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  
  if (!data || !data.familles) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
  
  // Export CSV
  const exportToCSV = (dataArray: any[], filename: string, headers?: string[]) => {
    const csvContent = [
      headers.join(';'),
      ...dataArray.map(row => headers.map(h => row[h] || '').join(';'))
    ].join('\\n')
    
    const blob = new Blob([`\\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }
  
  // Export KPIs
  const exportKPIs = () => {
    const totalCA = Object.values(data.familles).reduce((sum: number, f: any) => sum + (Number(f.ca) || 0), 0)
    const totalTransactions = Object.values(data.familles).reduce((sum: number, f: any) => sum + (Number(f.volume) || 0), 0)
    const panierMoyen = totalCA / (totalTransactions || 1)
    const nbClients = Number(data.allClients?.size) || 0
    const tauxFidelite = ((Number(data.fidelite?.oui) || 0) / ((Number(data.fidelite?.oui) || 0) + (Number(data.fidelite?.non) || 0) || 1)) * 100
    
    const kpis = [{
      Indicateur: 'CA Total',
      Valeur: formatEuro(totalCA),
      Type: 'Financier'
    }, {
      Indicateur: 'Transactions',
      Valeur: totalTransactions.toLocaleString('fr-FR'),
      Type: 'Volume'
    }, {
      Indicateur: 'Panier Moyen',
      Valeur: formatEuro(panierMoyen),
      Type: 'Financier'
    }, {
      Indicateur: 'Nombre de Clients',
      Valeur: (Number(nbClients) || 0).toLocaleString('fr-FR'),
      Type: 'Client'
    }, {
      Indicateur: 'Taux de Fidélité',
      Valeur: `${(Number(tauxFidelite) || 0).toFixed(2)}%`,
      Type: 'Client'
    }, {
      Indicateur: 'CA Web',
      Valeur: formatEuro(Number(data.webStats?.ca) || 0),
      Type: 'Financier'
    }, {
      Indicateur: 'Part Web',
      Valeur: `${(((Number(data.webStats?.ca) || 0) / (totalCA || 1)) * 100).toFixed(2)}%`,
      Type: 'Distribution'
    }]
    
    exportToCSV(kpis, 'KPIs', ['Indicateur', 'Valeur', 'Type'])
  }
  
  // Export Top Familles
  const exportTopFamilles = () => {
    const familles = Object.entries(data.familles)
      .map(([nom, stats]: [string, any]) => ({
        Famille: nom,
        CA: formatEuro(stats.ca),
        Volume: stats.volume,
        'Panier Moyen': formatEuro(stats.ca / stats.volume)
      }))
      .sort((a, b) => parseFloat(b.CA.replace(/[^0-9,-]/g, '').replace(',', '.')) - parseFloat(a.CA.replace(/[^0-9,-]/g, '').replace(',', '.')))
    
    exportToCSV(familles, 'Top_Familles', ['Famille', 'CA', 'Volume', 'Panier Moyen'])
  }
  
  // Export Top Produits
  const exportTopProduits = () => {
    const produits = Object.entries(data.produits)
      .map(([numero, stats]: [string, any]) => ({
        'Numéro Produit': numero,
        Famille: stats.famille,
        'Sous-Famille': stats.sousFamille || '-',
        CA: formatEuro(stats.ca),
        Volume: stats.volume,
      }))
      .sort((a, b) => parseFloat(b.CA.replace(/[^0-9,-]/g, '').replace(',', '.')) - parseFloat(a.CA.replace(/[^0-9,-]/g, '').replace(',', '.')))
      .slice(0, 100)
    
    exportToCSV(produits, 'Top_100_Produits', ['Numéro Produit', 'Famille', 'Sous-Famille', 'CA', 'Volume'])
  }
  
  // Export Clients
  const exportTopClients = () => {
    const clients: any[] = []
    data.allClients.forEach((client: any, carte: string) => {
      clients.push({
        Carte: carte,
        Ville: client.ville,
        CP: client.cp,
        'CA Total': formatEuro(client.ca_total),
        'Nombre Achats': client.achats.length,
        'Panier Moyen': formatEuro(client.ca_total / client.achats.length),
      })
    })
    
    clients.sort((a, b) => parseFloat(b['CA Total'].replace(/[^0-9,-]/g, '').replace(',', '.')) - parseFloat(a['CA Total'].replace(/[^0-9,-]/g, '').replace(',', '.')))
    
    exportToCSV(clients.slice(0, 100), 'Top_100_Clients', ['Carte', 'Ville', 'CP', 'CA Total', 'Nombre Achats', 'Panier Moyen'])
  }
  
  // Export Magasins
  const exportMagasins = () => {
    const magasins = Object.entries(data.geo.magasins)
      .map(([mag, stats]: [string, any]) => ({
        Magasin: mag,
        CA: formatEuro(stats.ca),
        Volume: stats.volume,
        'Panier Moyen': formatEuro(stats.ca / stats.volume),
      }))
      .sort((a, b) => parseFloat(b.CA.replace(/[^0-9,-]/g, '').replace(',', '.')) - parseFloat(a.CA.replace(/[^0-9,-]/g, '').replace(',', '.')))
    
    exportToCSV(magasins, 'Performance_Magasins', ['Magasin', 'CA', 'Volume', 'Panier Moyen'])
  }
  
  // Export tout
  const exportAll = async () => {
    setExporting(true)
    setExportSuccess(false)
    
    await new Promise(resolve => setTimeout(resolve, 500))
    exportKPIs()
    await new Promise(resolve => setTimeout(resolve, 300))
    exportTopFamilles()
    await new Promise(resolve => setTimeout(resolve, 300))
    exportTopProduits()
    await new Promise(resolve => setTimeout(resolve, 300))
    exportTopClients()
    await new Promise(resolve => setTimeout(resolve, 300))
    exportMagasins()
    
    setExporting(false)
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl">
            <Download className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Exports de Données</h2>
            <p className="text-zinc-400">Téléchargez vos analyses au format CSV</p>
          </div>
        </div>
        
        {exportSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 mt-6">
            <Check className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-semibold">Exports réussis !</p>
              <p className="text-sm text-zinc-400">Les fichiers ont été téléchargés dans votre dossier Téléchargements</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Export KPIs */}
        <div className="glass rounded-2xl p-6 border border-zinc-800 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white">KPIs Principaux</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Indicateurs clés de performance (CA, transactions, panier moyen, clients, fidélité, web)
          </p>
          <button
            onClick={exportKPIs}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
        
        {/* Export Familles */}
        <div className="glass rounded-2xl p-6 border border-zinc-800 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Top Familles</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Toutes les familles de produits classées par CA avec volumes et paniers moyens
          </p>
          <button
            onClick={exportTopFamilles}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
        
        {/* Export Produits */}
        <div className="glass rounded-2xl p-6 border border-zinc-800 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-pink-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Top 100 Produits</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Les 100 meilleurs produits par CA avec numéros, familles et sous-familles
          </p>
          <button
            onClick={exportTopProduits}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
        
        {/* Export Clients */}
        <div className="glass rounded-2xl p-6 border border-zinc-800 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Top 100 Clients</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Les 100 meilleurs clients par CA avec localisation et fréquence d'achat
          </p>
          <button
            onClick={exportTopClients}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
        
        {/* Export Magasins */}
        <div className="glass rounded-2xl p-6 border border-zinc-800 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Performance Magasins</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Tous les magasins avec CA, volumes et paniers moyens classés par performance
          </p>
          <button
            onClick={exportMagasins}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
        
        {/* Export All */}
        <div className="glass rounded-2xl p-6 border border-green-500/30 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Export Complet</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Télécharger tous les fichiers CSV d'un coup (5 fichiers)
          </p>
          <button
            onClick={exportAll}
            disabled={exporting}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Export en cours...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Tout Télécharger
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
