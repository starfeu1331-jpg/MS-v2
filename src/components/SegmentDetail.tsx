import { ArrowLeft, Download, TrendingUp, ShoppingCart, Euro, Users, Package, MapPin, Calendar, BarChart3 } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'

interface SegmentDetailProps {
  segmentName: string
  segmentData: {
    clients: any[]
    ca: number
    count: number
  }
  allData: any
  totalClients: number
  totalCA: number
  onBack: () => void
  onSearchClient?: (carte: string) => void
}

export default function SegmentDetail({
  segmentName,
  segmentData,
  allData,
  totalClients,
  totalCA,
  onBack,
  onSearchClient
}: SegmentDetailProps) {
  const [sortBy, setSortBy] = useState<'monetary' | 'frequency' | 'recency'>('monetary')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loadingProducts, setLoadingProducts] = useState(false)

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  // Calculer les statistiques du segment
  const panierMoyen = segmentData.ca / segmentData.clients.reduce((sum, c) => sum + c.frequency, 0)
  const caParClient = segmentData.ca / segmentData.count
  const frequenceMoyenne = segmentData.clients.reduce((sum, c) => sum + c.frequency, 0) / segmentData.count
  const recenceMoyenne = segmentData.clients.reduce((sum, c) => sum + c.recency, 0) / segmentData.count

  // Top produits - désactivé temporairement (nécessite API dédiée)
  const topProduits = useMemo(() => {
    // TODO: créer une API pour les top produits par segment
    return []
  }, [segmentData.clients])

  // Récupérer les noms de produits via l'API
  useEffect(() => {
    const fetchProductNames = async () => {
      if (!topProduits || topProduits.length === 0) {
        console.log('⚠️ No products to fetch')
        return
      }
      
      console.log('🔄 Starting to fetch names for', topProduits.length, 'products')
      setLoadingProducts(true)
      const names: Record<string, string> = {}
      
      for (const produit of topProduits) {
        if (!produit || !produit.code) {
          console.warn('⚠️ Invalid product:', produit)
          continue
        }
        
        // Pas d'API pour le moment
        names[produit.code] = produit.code
      }
      
      console.log('✅ All product names fetched:', Object.keys(names).length, 'products')
      console.log('📦 Product names:', names)
      setProductNames(names)
      setLoadingProducts(false)
    }
    
    fetchProductNames()
  }, [topProduits])

  // Distribution géographique (codes postaux)
  const geoStats: Record<string, { clients: number, ca: number }> = {}
  segmentData.clients.forEach(client => {
    const cp = client.ville || 'Non défini' // Utiliser la ville directement du client RFM
    if (!geoStats[cp]) {
      geoStats[cp] = { clients: 0, ca: 0 }
    }
    geoStats[cp].clients++
    geoStats[cp].ca += client.monetary || 0
  })

  const topCP = Object.entries(geoStats)
    .map(([cp, stats]) => ({ cp, ...stats }))
    .filter(item => item.cp !== 'Non défini' && item.cp !== '-' && item.cp !== '')
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)

  console.log('📍 Top Villes:', topCP.length, topCP.slice(0, 3))

  // Évolution temporelle - désactivée (nécessite accès aux achats détaillés)
  const evolutionTemporelle: any[] = []
  
  // Stats avancées
  const clientsAvecPlusieursAchats = segmentData.clients.filter(c => c.frequency > 1).length
  const tauxRetention = (clientsAvecPlusieursAchats / segmentData.count) * 100
  
  const recenceMax = Math.max(...segmentData.clients.map(c => c.recency))
  const recenceMin = Math.min(...segmentData.clients.map(c => c.recency))
  
  const caMax = Math.max(...segmentData.clients.map(c => c.monetary))
  const caMin = Math.min(...segmentData.clients.map(c => c.monetary))

  // Familles de produits - désactivé (nécessite API dédiée)
  const familleStats: Record<string, { ca: number, volume: number, tickets: number }> = {}

  const topFamilles = Object.entries(familleStats)
    .map(([famille, stats]) => ({
      famille,
      ca: stats.ca,
      volume: stats.volume,
      tickets: stats.tickets,
      panierMoyen: stats.tickets > 0 ? stats.ca / stats.tickets : 0
    }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10)

  // Trier les clients
  const sortedClients = [...segmentData.clients].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
  })

  const exportToCSV = () => {
    const headers = ['Rang', 'Carte', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Sexe', 'Ville', 'CP', 'Score RFM', 'R', 'F', 'M', 'CA Total', 'Récence (jours)', 'Fréquence']
    const rows = sortedClients.map((client, idx) => [
      idx + 1,
      client.carte,
      client.nom || '',
      client.prenom || '',
      client.email || '',
      client.telephone || '',
      client.sexe || '',
      client.ville || '',
      client.cp || '',
      client.RFM,
      client.R,
      client.F,
      client.M,
      Math.round(client.monetary),
      client.recency,
      client.frequency
    ])
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `RFM_${segmentName}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const getSegmentInfo = (name: string) => {
    const segments: Record<string, any> = {
      'Ultra Champions': {
        color: 'purple',
        icon: '👑💎',
        description: 'Excellence absolue: les meilleurs clients',
        action: 'VIP absolu ! Chouchouter, privilèges exclusifs, accès prioritaire'
      },
      'Champions': {
        color: 'emerald',
        icon: '👑',
        description: 'Vos meilleurs clients : achètent récemment, fréquemment et dépensent beaucoup',
        action: 'Récompensez-les ! Offres VIP, programme ambassadeur'
      },
      'Loyaux': {
        color: 'blue',
        icon: '💎',
        description: 'Clients fidèles avec bon potentiel, achètent régulièrement',
        action: 'Montée en gamme : cross-sell, upsell, offres premium'
      },
      'À Risque': {
        color: 'orange',
        icon: '⚠️',
        description: 'Anciens bons clients qui n\'ont pas acheté récemment',
        action: 'Réactivation urgente ! Offres de reconquête personnalisées'
      },
      'Perdus': {
        color: 'red',
        icon: '💔',
        description: 'Clients inactifs depuis longtemps',
        action: 'Dernière chance : offre exceptionnelle ou laisser partir'
      },
      'Nouveaux': {
        color: 'cyan',
        icon: '✨',
        description: 'Nouveaux clients avec un seul achat',
        action: 'Fidélisation ! Offre de bienvenue, communication régulière'
      },
      'Occasionnels': {
        color: 'zinc',
        icon: '🎯',
        description: 'Clients occasionnels sans profil marqué',
        action: 'Engagement : augmenter la fréquence via campagnes ciblées'
      }
    }
    return segments[name] || segments['Occasionnels']
  }

  const segmentInfo = getSegmentInfo(segmentName)
  const percentOfClients = (segmentData.count / totalClients) * 100
  const percentOfCA = (segmentData.ca / totalCA) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{segmentInfo.icon}</span>
                <h1 className="text-4xl font-bold text-white">{segmentName}</h1>
              </div>
              <p className="text-lg text-zinc-400">{segmentInfo.description}</p>
            </div>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
          >
            <Download className="w-5 h-5" />
            Exporter CSV
          </button>
        </div>

        <div className={`p-4 rounded-2xl bg-${segmentInfo.color}-500/10 border border-${segmentInfo.color}-500/30`}>
          <p className={`text-${segmentInfo.color}-400 font-medium`}>
            💡 <strong>Action recommandée:</strong> {segmentInfo.action}
          </p>
        </div>
      </div>

      {/* KPIs du segment */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h2 className="text-2xl font-bold text-white mb-6">📊 Indicateurs Clés</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Clients</p>
            </div>
            <p className="text-3xl font-bold text-white">{segmentData.count.toLocaleString('fr-FR')}</p>
            <p className="text-sm text-zinc-400 mt-1">
              {percentOfClients.toFixed(1)}% du total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <Euro className="w-5 h-5 text-emerald-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Total</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(segmentData.ca)}</p>
            <p className="text-sm text-emerald-400 mt-1 font-bold">
              {percentOfCA.toFixed(1)}% du CA total
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Panier Moyen</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(panierMoyen)}</p>
            <p className="text-sm text-zinc-400 mt-1">
              {frequenceMoyenne.toFixed(1)} achats/client
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA/Client</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(caParClient)}</p>
            <p className="text-sm text-zinc-400 mt-1">
              {Math.round(recenceMoyenne)}j depuis dernier achat
            </p>
          </div>
        </div>
      </div>

      {/* Stats avancées */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Taux de Rétention</h3>
          </div>
          <p className="text-4xl font-bold text-cyan-400">{tauxRetention.toFixed(1)}%</p>
          <p className="text-sm text-zinc-400 mt-2">
            {clientsAvecPlusieursAchats} clients avec 2+ achats
          </p>
        </div>

        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-bold text-white">Récence</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500">Moyenne</p>
              <p className="text-2xl font-bold text-white">{Math.round(recenceMoyenne)}j</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Min</p>
                <p className="text-emerald-400 font-bold">{recenceMin}j</p>
              </div>
              <div>
                <p className="text-zinc-500">Max</p>
                <p className="text-red-400 font-bold">{recenceMax}j</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Euro className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">CA Client</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-zinc-500">Moyen</p>
              <p className="text-2xl font-bold text-white">{formatEuro(caParClient)}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Min</p>
                <p className="text-zinc-400 font-bold">{formatEuro(caMin)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Max</p>
                <p className="text-emerald-400 font-bold">{formatEuro(caMax)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Produits avec noms */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-8 h-8 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Top 15 Produits</h2>
        </div>
        {loadingProducts && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            <p className="text-zinc-400 mt-2">Chargement des noms de produits...</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Produit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Volume</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {topProduits.map((produit, idx) => (
                <tr key={produit.code} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-mono text-zinc-300">{produit.code}</td>
                  <td className="px-4 py-3 text-sm text-white max-w-xs truncate">
                    {productNames[produit.code] || produit.code}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                    {formatEuro(produit.ca)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-300">
                    {produit.volume.toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-cyan-400">
                    {produit.tickets.toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution géographique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Top 10 Codes Postaux</h2>
          </div>
          <div className="space-y-3">
            {topCP.map((cp, idx) => (
              <div key={cp.cp} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-500">#{idx + 1}</span>
                  <div>
                    <p className="text-white font-bold">{cp.cp}</p>
                    <p className="text-xs text-zinc-400">{cp.clients} clients</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold">{formatEuro(cp.ca)}</p>
                  <p className="text-xs text-zinc-400">{formatEuro(cp.ca / cp.clients)}/client</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-8 h-8 text-orange-500" />
            <h2 className="text-2xl font-bold text-white">Évolution (12 derniers mois)</h2>
          </div>
          <div className="space-y-3">
            {evolutionTemporelle.length > 0 ? (
              evolutionTemporelle.map(mois => (
                <div key={mois.mois} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div>
                    <p className="text-white font-bold">{mois.mois}</p>
                    <p className="text-xs text-zinc-400">{mois.tickets} tickets</p>
                  </div>
                  <p className="text-emerald-400 font-bold">{formatEuro(mois.ca)}</p>
                </div>
              ))
            ) : (
              <p className="text-zinc-400 text-center py-8">Données temporelles non disponibles</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Familles de produits */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">Top 10 Familles de Produits</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Famille</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">% Segment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Tickets</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Panier Moyen</th>
              </tr>
            </thead>
            <tbody>
              {topFamilles.map((famille, idx) => (
                <tr key={famille.famille} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-4 text-sm font-medium text-white">{famille.famille}</td>
                  <td className="px-4 py-4 text-right text-sm font-bold text-white">{formatEuro(famille.ca)}</td>
                  <td className="px-4 py-4 text-right text-sm text-blue-400">
                    {((famille.ca / segmentData.ca) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-zinc-400">{famille.tickets.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-4 text-right text-sm font-medium text-emerald-400">{formatEuro(famille.panierMoyen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liste des clients */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">👥 Liste des Clients</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Trier par:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="monetary">CA Total</option>
              <option value="frequency">Fréquence</option>
              <option value="recency">Récence</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-zinc-700 transition-all"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Identité</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Contact</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">R</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">F</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">M</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">CA Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Fréquence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Récence (j)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client, idx) => (
                <tr key={client.carte} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-bold text-zinc-400">#{idx + 1}</td>
                  <td className="px-4 py-4">
                    <div>
                      {client.nom && client.prenom ? (
                        <p className="text-sm font-bold text-white">{client.prenom} {client.nom}</p>
                      ) : (
                        <p className="text-sm font-medium text-white">Carte {client.carte}</p>
                      )}
                      <p className="text-xs text-zinc-500">
                        {client.sexe === 'H' && '👨'} {client.sexe === 'F' && '👩'} {client.ville} {client.cp && `(${client.cp})`}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs">
                      {client.email && <p className="text-green-400">📧 {client.email}</p>}
                      {client.telephone && <p className="text-cyan-400">📱 {client.telephone}</p>}
                      {!client.email && !client.telephone && <p className="text-zinc-600">-</p>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm">
                      {client.RFM}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-blue-400 font-bold">{client.R}</td>
                  <td className="px-4 py-4 text-center text-cyan-400 font-bold">{client.F}</td>
                  <td className="px-4 py-4 text-center text-teal-400 font-bold">{client.M}</td>
                  <td className="px-4 py-4 text-right text-white font-bold">{formatEuro(client.monetary)}</td>
                  <td className="px-4 py-4 text-right text-zinc-400">{client.frequency}</td>
                  <td className="px-4 py-4 text-right text-orange-400">{client.recency}</td>
                  <td className="px-4 py-4 text-center">
                    {onSearchClient && (
                      <button
                        onClick={() => onSearchClient(client.carte)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Voir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
