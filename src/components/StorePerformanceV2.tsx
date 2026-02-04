import { Store, Target, TrendingUp, Users, ShoppingBag, MapPin, Mail, Phone, Download, X, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Award, Crown } from 'lucide-react'
import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'
const CACHE_DURATION = 5 * 60 * 1000

interface MagasinStats {
  ca_total: number
  nb_clients: number
  nb_clients_actifs: number
  nb_clients_fideles: number
  nb_transactions: number
  panier_moyen: number
  taux_fidelite: number
}

interface Magasin {
  code: string
  nom: string
  ville: string
  cp: string | null
  lat: number | null
  lon: number | null
  stats: MagasinStats
  top_produits: Array<{famille: string, ca: number, volume: number, rang: number}>
  top_clients: Array<{carte: string, nom?: string, prenom?: string, email?: string, telephone?: string, sexe?: string, ville?: string, cp?: string, ca_client: number, nb_achats: number, dernier_achat: string}>
  zones_chalandise: Array<{cp: string, ville: string, nb_clients: number, ca_zone: number, nb_transactions: number}>
  top_famille: string
}

interface StatsReseau {
  ca_total: number
  nb_magasins: number
  nb_clients_total: number
  nb_transactions_total: number
  panier_moyen_reseau: number
}

type SortField = 'nom' | 'ca_total' | 'nb_clients' | 'nb_transactions' | 'panier_moyen' | 'taux_fidelite'
type SortDirection = 'asc' | 'desc'
type FilterMode = 'all' | 'top5' | 'bottom5' | 'high-basket' | 'alerts'

let storeCache: { data: any; timestamp: number } | null = null

export default function StorePerformanceV2() {
  const [data, setData] = useState<{ magasins: Magasin[], stats_reseau: StatsReseau } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMagasin, setSelectedMagasin] = useState<Magasin | null>(null)
  const [sortField, setSortField] = useState<SortField>('ca_total')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  useEffect(() => {
    const loadData = async () => {
      try {
        const now = Date.now()
        if (storeCache && (now - storeCache.timestamp < CACHE_DURATION)) {
          console.log('🔍 Stores V2: Utilisation cache')
          setData(storeCache.data)
          setLoading(false)
          return
        }

        console.log('🔄 Stores V2: Chargement depuis API')
        setLoading(true)
        
        const response = await fetch(`${API_URL}/api/stores`)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        
        const result = await response.json()
        storeCache = { data: result, timestamp: Date.now() }
        
        setData(result)
        console.log('✅ Stores V2: Données chargées')
      } catch (err: any) {
        console.error('❌ Erreur chargement Stores:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-red-400">Erreur: {error}</div></div>
  }
  
  if (!data || !data.magasins) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée</div></div>
  }

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  // Tri et filtre
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  let filteredMagasins = [...data.magasins]

  // Appliquer filtres rapides
  if (filterMode === 'top5') {
    filteredMagasins = [...data.magasins].sort((a, b) => b.stats.ca_total - a.stats.ca_total).slice(0, 5)
  } else if (filterMode === 'bottom5') {
    filteredMagasins = [...data.magasins].sort((a, b) => a.stats.ca_total - b.stats.ca_total).slice(0, 5)
  } else if (filterMode === 'high-basket') {
    filteredMagasins = data.magasins.filter(m => m.stats.panier_moyen > data.stats_reseau.panier_moyen_reseau)
  } else if (filterMode === 'alerts') {
    filteredMagasins = data.magasins.filter(m => 
      m.stats.panier_moyen < data.stats_reseau.panier_moyen_reseau * 0.8 || 
      m.stats.nb_clients < 100 ||
      m.stats.taux_fidelite < 15
    )
  }

  // Appliquer tri
  filteredMagasins.sort((a, b) => {
    let valA: any, valB: any
    
    if (sortField === 'nom') {
      valA = a.nom
      valB = b.nom
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    } else if (sortField === 'ca_total') {
      valA = a.stats.ca_total
      valB = b.stats.ca_total
    } else if (sortField === 'nb_clients') {
      valA = a.stats.nb_clients
      valB = b.stats.nb_clients
    } else if (sortField === 'nb_transactions') {
      valA = a.stats.nb_transactions
      valB = b.stats.nb_transactions
    } else if (sortField === 'panier_moyen') {
      valA = a.stats.panier_moyen
      valB = b.stats.panier_moyen
    } else if (sortField === 'taux_fidelite') {
      valA = a.stats.taux_fidelite
      valB = b.stats.taux_fidelite
    }
    
    return sortDirection === 'asc' ? valA - valB : valB - valA
  })

  // Export Excel
  const exportToExcel = () => {
    const headers = ['Rang', 'Code', 'Magasin', 'Ville', 'CA Total', 'Part CA %', 'Nb Clients', 'Clients Actifs', 'Clients Fidèles', 'Nb Transactions', 'Panier Moyen', 'Taux Fidélité %', 'Top Famille']
    const rows = filteredMagasins.map((mag, idx) => [
      idx + 1,
      mag.code,
      mag.nom,
      mag.ville,
      Math.round(mag.stats.ca_total),
      ((mag.stats.ca_total / data.stats_reseau.ca_total) * 100).toFixed(2),
      mag.stats.nb_clients,
      mag.stats.nb_clients_actifs,
      mag.stats.nb_clients_fideles,
      mag.stats.nb_transactions,
      Math.round(mag.stats.panier_moyen),
      mag.stats.taux_fidelite.toFixed(1),
      mag.top_famille
    ])
    
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `performance_magasins_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-zinc-500" />
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-400" /> : <ArrowDown className="w-4 h-4 text-blue-400" />
  }

  return (
    <div className="space-y-6">
      {/* Header KPIs Réseau */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl">
              <Store className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Performance Magasins</h2>
              <p className="text-zinc-400">Tableau de bord réseau • {data.stats_reseau.nb_magasins} points de vente</p>
            </div>
          </div>
          <button
            onClick={exportToExcel}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export Excel
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-4 h-4 text-orange-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Magasins</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats_reseau.nb_magasins}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">CA Réseau</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatEuro(data.stats_reseau.ca_total)}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Clients Total</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats_reseau.nb_clients_total.toLocaleString('fr-FR')}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Transactions</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats_reseau.nb_transactions_total.toLocaleString('fr-FR')}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyan-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Panier Moyen</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatEuro(data.stats_reseau.panier_moyen_reseau)}</p>
          </div>
        </div>
      </div>

      {/* Filtres rapides */}
      <div className="glass rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-zinc-400">Filtres rapides:</span>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterMode === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            📊 Tous ({data.magasins.length})
          </button>
          <button
            onClick={() => setFilterMode('top5')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterMode === 'top5' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            🏆 Top 5 CA
          </button>
          <button
            onClick={() => setFilterMode('bottom5')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterMode === 'bottom5' 
                ? 'bg-red-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            📉 Bottom 5
          </button>
          <button
            onClick={() => setFilterMode('high-basket')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterMode === 'high-basket' 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            🎯 Panier > Moyenne
          </button>
          <button
            onClick={() => setFilterMode('alerts')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filterMode === 'alerts' 
                ? 'bg-orange-600 text-white' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            ⚠️ Alertes
          </button>
        </div>
      </div>

      {/* Tableau magasins */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">Classement • {filteredMagasins.length} magasin(s)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">#</th>
                <th 
                  className="px-4 py-3 text-left text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('nom')}
                >
                  <div className="flex items-center gap-2">
                    Magasin {getSortIcon('nom')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Ville</th>
                <th 
                  className="px-4 py-3 text-right text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('ca_total')}
                >
                  <div className="flex items-center justify-end gap-2">
                    CA Total {getSortIcon('ca_total')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Part CA</th>
                <th 
                  className="px-4 py-3 text-right text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('nb_clients')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Clients {getSortIcon('nb_clients')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('nb_transactions')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Tx {getSortIcon('nb_transactions')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('panier_moyen')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Panier {getSortIcon('panier_moyen')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
                  onClick={() => handleSort('taux_fidelite')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Fidélité {getSortIcon('taux_fidelite')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Top Famille</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredMagasins.map((mag, idx) => {
                const partCA = (mag.stats.ca_total / data.stats_reseau.ca_total) * 100
                const panierVsMoyenne = ((mag.stats.panier_moyen / data.stats_reseau.panier_moyen_reseau) - 1) * 100
                const hasAlert = mag.stats.panier_moyen < data.stats_reseau.panier_moyen_reseau * 0.8 || 
                                 mag.stats.nb_clients < 100 || 
                                 mag.stats.taux_fidelite < 15

                return (
                  <tr 
                    key={mag.code} 
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedMagasin(mag)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-bold text-sm">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasAlert && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                        {idx < 3 && <Award className="w-4 h-4 text-yellow-500" />}
                        <span className="text-sm font-bold text-white">{mag.nom}</span>
                        <span className="text-xs text-zinc-500">({mag.code})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">{mag.ville}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatEuro(mag.stats.ca_total)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">
                        {partCA.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-white">
                      {mag.stats.nb_clients.toLocaleString('fr-FR')}
                      <span className="text-xs text-zinc-500 ml-1">({mag.stats.nb_clients_actifs})</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-400">{mag.stats.nb_transactions.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="text-sm font-bold text-cyan-400">{formatEuro(mag.stats.panier_moyen)}</p>
                        <p className={`text-xs ${panierVsMoyenne >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {panierVsMoyenne >= 0 ? '+' : ''}{panierVsMoyenne.toFixed(0)}%
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                        mag.stats.taux_fidelite >= 25 ? 'bg-emerald-500/20 text-emerald-400' :
                        mag.stats.taux_fidelite >= 15 ? 'bg-blue-500/20 text-blue-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {mag.stats.taux_fidelite.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-zinc-400">{mag.top_famille}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMagasin(mag)
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal détails magasin */}
      {selectedMagasin && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMagasin(null)}
        >
          <div 
            className="glass rounded-3xl p-8 border border-zinc-800 max-w-6xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl">
                  <Store className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">{selectedMagasin.nom}</h2>
                  <p className="text-zinc-400">{selectedMagasin.code} • {selectedMagasin.ville}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMagasin(null)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Stats générales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">CA Total</p>
                <p className="text-2xl font-bold text-white">{formatEuro(selectedMagasin.stats.ca_total)}</p>
                <p className="text-xs text-emerald-400 mt-1">
                  {((selectedMagasin.stats.ca_total / data.stats_reseau.ca_total) * 100).toFixed(1)}% du réseau
                </p>
              </div>
              <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">Clients</p>
                <p className="text-2xl font-bold text-white">{selectedMagasin.stats.nb_clients.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-blue-400 mt-1">
                  {selectedMagasin.stats.nb_clients_actifs} actifs • {selectedMagasin.stats.nb_clients_fideles} fidèles
                </p>
              </div>
              <div className="bg-purple-500/10 rounded-2xl p-4 border border-purple-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">Transactions</p>
                <p className="text-2xl font-bold text-white">{selectedMagasin.stats.nb_transactions.toLocaleString('fr-FR')}</p>
                <p className="text-xs text-purple-400 mt-1">
                  {(selectedMagasin.stats.nb_transactions / selectedMagasin.stats.nb_clients).toFixed(1)} tx/client
                </p>
              </div>
              <div className="bg-cyan-500/10 rounded-2xl p-4 border border-cyan-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase mb-1">Panier Moyen</p>
                <p className="text-2xl font-bold text-white">{formatEuro(selectedMagasin.stats.panier_moyen)}</p>
                <p className={`text-xs mt-1 ${
                  selectedMagasin.stats.panier_moyen >= data.stats_reseau.panier_moyen_reseau 
                    ? 'text-emerald-400' 
                    : 'text-orange-400'
                }`}>
                  {((selectedMagasin.stats.panier_moyen / data.stats_reseau.panier_moyen_reseau - 1) * 100).toFixed(0)}% vs réseau
                </p>
              </div>
            </div>

            {/* Tabs contenu */}
            <div className="space-y-6">
              {/* Top Produits */}
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  Top 10 Familles de Produits
                </h3>
                <div className="space-y-2">
                  {selectedMagasin.top_produits.slice(0, 10).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-white">{p.famille}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-zinc-500">{p.volume} ventes</span>
                        <span className="text-sm font-bold text-emerald-400">{formatEuro(p.ca)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Clients VIP */}
              {selectedMagasin.top_clients.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    Top 10 Clients VIP
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-800 text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Client</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Contact</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase">CA</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Achats</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMagasin.top_clients.map((client, idx) => (
                          <tr key={client.carte} className="border-b border-zinc-800">
                            <td className="px-3 py-2 text-xs text-zinc-500">{idx + 1}</td>
                            <td className="px-3 py-2">
                              {client.nom && client.prenom ? (
                                <div>
                                  <p className="text-sm font-medium text-white">{client.prenom} {client.nom}</p>
                                  <p className="text-xs text-zinc-500">Carte {client.carte}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-400">Carte {client.carte}</p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs space-y-1">
                                {client.email && (
                                  <p className="text-green-400 flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {client.email}
                                  </p>
                                )}
                                {client.telephone && (
                                  <p className="text-cyan-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {client.telephone}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-emerald-400">
                              {formatEuro(client.ca_client)}
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-white">{client.nb_achats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Zones chalandise */}
              {selectedMagasin.zones_chalandise.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-500" />
                    Top 10 Zones de Chalandise
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {selectedMagasin.zones_chalandise.map((zone, idx) => (
                      <div key={zone.cp} className="bg-zinc-800/50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-bold text-white">{zone.cp}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mb-2">{zone.ville}</p>
                        <p className="text-xs text-zinc-500">{zone.nb_clients} clients</p>
                        <p className="text-xs font-bold text-emerald-400">{formatEuro(zone.ca_zone)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
