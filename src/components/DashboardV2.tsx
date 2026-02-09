import { memo, useEffect, useState, Suspense } from 'react'
import { TrendingUp, Users, ShoppingCart, Euro, AlertCircle, Package, Store, Globe, Calendar } from 'lucide-react'
import { LazyResponsiveContainer as ResponsiveContainer, LazyLineChart as LineChart, LazyLine as Line, LazyXAxis as XAxis, LazyYAxis as YAxis, LazyCartesianGrid as CartesianGrid, LazyTooltip as Tooltip, ChartFallback } from '../utils/lazyRecharts'

interface DashboardV2Props {
  period?: { type: string; value: any }
  onNavigate?: (tab: any) => void
}

interface DashboardData {
  // KPIs
  totalCA: number
  totalCAMagasin: number
  totalCAWeb: number
  totalTickets: number
  totalTicketsMag: number
  totalTicketsWeb: number
  totalClients: number
  panierMoyen: number
  panierMoyenMag: number
  panierMoyenWeb: number
  
  // Stats clients (nouvelles colonnes)
  statsClients?: {
    total: number
    hommes: number
    femmes: number
    avecNom: number
    avecPrenom: number
    avecEmail: number
    avecTelephone: number
    pctHommes: number
    pctFemmes: number
    pctEmail: number
    pctTelephone: number
  }
  
  // Top données
  topProduits: any[]
  topMagasins: any[]
  topClients: any[]
  
  // Évolution temporelle
  evolutionMensuelle: any[]
  
  // Segments
  segmentsMagasin: any[]
  segmentsWeb: any[]
}

// Cache global pour le Dashboard
const dashboardCache: Record<string, { data: DashboardData; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

function DashboardV2({ period = { type: 'year', value: 2025 }, onNavigate }: DashboardV2Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showWeb, setShowWeb] = useState(false)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Clé de cache basée sur la période
        const cacheKey = `dashboard_${period.type}_${period.value}`
        
        console.log('🔍 Dashboard: Vérification cache', cacheKey, 'Contenu:', Object.keys(dashboardCache))
        
        // Vérifier le cache
        const cached = dashboardCache[cacheKey]
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
          console.log('✅ Dashboard: Utilisation du cache', cacheKey)
          setData(cached.data)
          setLoading(false)
          return
        }
        
        setLoading(true)
        setError(null)

        console.log(`🔄 Dashboard: Chargement depuis API`, period)

        // Construction de l'URL selon le type de période
        let url = '/api/dashboard?year='
        
        if (period.type === 'year') {
          // Année spécifique (ex: 2025)
          url = `/api/dashboard?year=${period.value}`
        } else if (period.type === 'all') {
          // Toutes les périodes
          url = '/api/dashboard?year=all'
        } else if (period.type === 'custom') {
          // Période personnalisée avec dates de début et fin
          const [startDate, endDate] = (period.value as string).split('_')
          url = `/api/dashboard?startDate=${startDate}&endDate=${endDate}`
        } else if (period.type === 'months') {
          // X derniers mois
          url = `/api/dashboard?months=${period.value}`
        } else {
          // Fallback sur toutes les périodes
          url = '/api/dashboard?year=all'
        }

        // Appel API avec données pré-agrégées
        const response = await fetch(url)
        if (!response.ok) throw new Error('Erreur API')

        const apiData = await response.json()
        console.log(`✅ API: Dashboard période reçu`, apiData)

        // Les données sont déjà agrégées côté serveur
        const processed: DashboardData = {
          ...apiData.kpis,
          statsClients: apiData.statsClients,
          topProduits: apiData.topProduits,
          topMagasins: apiData.topMagasins,
          topClients: apiData.topClients,
          evolutionMensuelle: apiData.evolutionMensuelle,
          segmentsMagasin: [],
          segmentsWeb: []
        }
        
        // Mettre en cache
        dashboardCache[cacheKey] = {
          data: processed,
          timestamp: Date.now()
        }

        setData(processed)
        setLoading(false)

        console.log('✅ Dashboard chargé:', processed)
      } catch (err: any) {
        console.error('❌ Erreur Dashboard:', err)
        setError(err.message)
        setLoading(false)
      }
    }
    
    loadDashboardData()
  }, [period.type, period.value])

  const formatEuro = (val: number) => {
    if (!val || isNaN(val)) return '0€'
    return `${Math.round(val).toLocaleString('fr-FR')}€`
  }

  const formatNumber = (val: number) => {
    if (!val || isNaN(val)) return '0'
    return Math.round(val).toLocaleString('fr-FR')
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-flex p-6 bg-zinc-800 rounded-full mb-4">
            <div className="w-12 h-12 border-4 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-zinc-400">Chargement des données...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-zinc-400">{error || 'Données non disponibles'}</p>
          <button
            onClick={() => {
              const cacheKey = `dashboard_${period.type}_${period.value}`
              delete dashboardCache[cacheKey]
              window.location.reload()
            }}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const currentCA = showWeb ? data.totalCAWeb : data.totalCAMagasin
  const currentTickets = showWeb ? data.totalTicketsWeb : data.totalTicketsMag
  const currentPanierMoyen = showWeb ? data.panierMoyenWeb : data.panierMoyenMag

  return (
    <div className="space-y-6 p-6">
      {/* Header avec toggle */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl">
              <Calendar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Dashboard {period.type === 'year' ? period.value : period.type === 'months' ? `${period.value} derniers mois` : 'Toutes périodes'}</h2>
              <p className="text-zinc-400">Vue d'ensemble des performances</p>
            </div>
          </div>
          <button
            onClick={() => {
              const cacheKey = `dashboard_${period.type}_${period.value}`
              delete dashboardCache[cacheKey]
              window.location.reload()
            }}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-xl text-blue-400 text-sm font-medium transition-all"
          >
            🔄 Rafraîchir
          </button>
        </div>

        {/* Toggle Magasin/Web */}
        <div className="flex gap-2 bg-zinc-900 rounded-xl p-1">
          <button
            onClick={() => setShowWeb(false)}
            className={`px-6 py-2 rounded-lg transition-all ${
              !showWeb
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Store className="w-4 h-4 inline mr-2" />
            Magasins
          </button>
          <button
            onClick={() => setShowWeb(true)}
            className={`px-6 py-2 rounded-lg transition-all ${
              showWeb
                ? 'bg-cyan-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Web
          </button>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Euro className="w-5 h-5 text-green-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Chiffre d'affaires</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(currentCA)}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-green-500">+12.5%</p>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Tickets</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(currentTickets)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Clients</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(data.totalClients)}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-orange-500" />
              <p className="text-xs text-zinc-500 font-semibold uppercase">Panier moyen</p>
            </div>
            <p className="text-3xl font-bold text-white">{formatEuro(currentPanierMoyen)}</p>
          </div>
        </div>
        
        {/* Stats Qualité Données Clients */}
        {data.statsClients && (
          <div className="mt-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-6 border border-blue-500/20">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              📊 Qualité des données clients
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/50 rounded-xl p-4">
                <p className="text-xs text-zinc-400 mb-1">Hommes / Femmes</p>
                <p className="text-2xl font-bold text-white">
                  {data.statsClients.pctHommes.toFixed(0)}% / {data.statsClients.pctFemmes.toFixed(0)}%
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatNumber(data.statsClients.hommes)} H • {formatNumber(data.statsClients.femmes)} F
                </p>
              </div>
              
              <div className="bg-zinc-900/50 rounded-xl p-4">
                <p className="text-xs text-zinc-400 mb-1">📧 Emails renseignés</p>
                <p className="text-2xl font-bold text-green-400">
                  {data.statsClients.pctEmail.toFixed(1)}%
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatNumber(data.statsClients.avecEmail)} / {formatNumber(data.statsClients.total)}
                </p>
              </div>
              
              <div className="bg-zinc-900/50 rounded-xl p-4">
                <p className="text-xs text-zinc-400 mb-1">📱 Téléphones renseignés</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {data.statsClients.pctTelephone.toFixed(1)}%
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatNumber(data.statsClients.avecTelephone)} / {formatNumber(data.statsClients.total)}
                </p>
              </div>
              
              <div className="bg-zinc-900/50 rounded-xl p-4">
                <p className="text-xs text-zinc-400 mb-1">👤 Identité complète</p>
                <p className="text-2xl font-bold text-purple-400">
                  {((data.statsClients.avecNom / data.statsClients.total) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Nom: {formatNumber(data.statsClients.avecNom)} • Prénom: {formatNumber(data.statsClients.avecPrenom)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Graphique évolution */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">Évolution mensuelle</h3>
        <Suspense fallback={<ChartFallback />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.evolutionMensuelle}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mois" stroke="#71717a" />
              <YAxis stroke="#71717a" />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="ca" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>

      {/* Grid 2 colonnes */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top produits */}
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Top Produits</h3>
            <Package className="w-6 h-6 text-blue-500" />
          </div>
          <div className="space-y-3">
            {data.topProduits.slice(0, 5).map((p, i) => (
              <div key={p.code} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-blue-500 font-bold">#{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{p.code}</p>
                    <p className="text-xs text-zinc-500">{p.sous_famille} • {p.famille}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatEuro(p.ca)}</p>
                  <p className="text-xs text-zinc-500">{formatNumber(p.volume)} unités</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top magasins */}
        {!showWeb && (
          <div className="glass rounded-3xl p-8 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Top Magasins</h3>
              <Store className="w-6 h-6 text-green-500" />
            </div>
            <div className="space-y-3">
              {data.topMagasins.map((m, i) => (
                <div key={m.code} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-green-500 font-bold">#{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{m.nom}</p>
                      <p className="text-xs text-zinc-500">{m.zone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{formatEuro(m.ca)}</p>
                    <p className="text-xs text-zinc-500">{m.nbTickets} tickets</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top clients Web */}
        {showWeb && (
          <div className="glass rounded-3xl p-8 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Top Clients Web</h3>
              <Users className="w-6 h-6 text-cyan-500" />
            </div>
            <div className="space-y-3">
              {data.topClients.filter((c: any) => c.carte !== '0').slice(0, 5).map((c, i) => (
                <div key={c.carte} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-cyan-500 font-bold">#{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{c.carte}</p>
                      <p className="text-xs text-zinc-500">{c.ville}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{formatEuro(c.ca)}</p>
                    <p className="text-xs text-zinc-500">{c.nbCommandes} commandes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(DashboardV2)
