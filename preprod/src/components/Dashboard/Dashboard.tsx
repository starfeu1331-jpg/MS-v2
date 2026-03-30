import { memo, useEffect, useState, Suspense } from 'react'
import { Users, ShoppingCart, Euro, AlertCircle, Package, Store, Calendar, BarChart3, RefreshCw, ImageOff, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { trackInteraction } from '../../services/tracker'
import {
  LazyResponsiveContainer as ResponsiveContainer,
  LazyLineChart as LineChart,
  LazyBarChart as BarChart,
  LazyLine as Line,
  LazyBar as Bar,
  LazyXAxis as XAxis,
  LazyYAxis as YAxis,
  LazyCartesianGrid as CartesianGrid,
  LazyTooltip as Tooltip,
  LazyCell as Cell,
  ChartFallback
} from '../../utils/lazyRecharts'

const PIM_CDN = 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/'

// Mini thumbnail pour les produits
function ProductThumb({ code }: { code: string }) {
  const [src, setSrc] = useState(`${PIM_CDN}${code}_det_1_web.jpg`)
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}><Package className="w-4 h-4 text-zinc-600" /></div>
  return <img src={src} alt="" width={36} height={36} style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, maxWidth: 36, maxHeight: 36 }} className="rounded-lg object-cover bg-zinc-800 shrink-0" onError={() => {
    if (src.includes('_det_1')) setSrc(`${PIM_CDN}${code}_amb_1_web.jpg`)
    else setFailed(true)
  }} />
}

interface DashboardProps {
  period?: { type: string; value: any }
  onNavigate?: (tab: any, context?: { clientCarte?: string; productCode?: string; storeCode?: string }) => void
}

interface DashboardData {
  kpis: {
    totalCA: number
    totalTickets: number
    totalClients: number
    panierMoyen: number
    nouveauxClients?: number
    evolution?: {
      ca: number | null
      tickets: number | null
      clients: number | null
      panierMoyen: number | null
      nouveauxClients: number | null
    }
  }
  statsClients: {
    total: number
    hommes: number
    femmes: number
    avecNom: number
    avecPrenom: number
    avecEmail: number
    avecTelephone: number
    avecAge: number
    ageMoyen: number
    pctHommes: number
    pctFemmes: number
    pctEmail: number
    pctTelephone: number
    pctAge: number
  }
  topProduits: any[]
  topMagasins: any[]
  topClients: any[]
  evolutionMensuelle: any[]
  topFamilles: any[]
  repartitionJours: any[]
}

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316']
const JOUR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']

// Cache global
const dashboardCache: Record<string, { data: DashboardData; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000

function Dashboard({ period = { type: 'all', value: 'all' }, onNavigate }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<'ca' | 'tickets' | 'panierMoyen'>('ca')
  const [productSort, setProductSort] = useState<'ca' | 'volume'>('ca')
  const [refreshKey, setRefreshKey] = useState(0)
  const { user } = useAuth()

  const forceRefresh = () => {
    delete dashboardCache[`dashboard_${period.type}_${period.value}`]
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const cacheKey = `dashboard_${period.type}_${period.value}`
        const cached = dashboardCache[cacheKey]
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
          setData(cached.data)
          setLoading(false)
          return
        }

        setLoading(true)
        setError(null)

        let url = '/api/dashboard?year=all'
        if (period.type === 'year') url = `/api/dashboard?year=${period.value}`
        else if (period.type === 'all') url = '/api/dashboard?year=all'
        else if (period.type === 'custom') {
          const [startDate, endDate] = (period.value as string).split('_')
          url = `/api/dashboard?startDate=${startDate}&endDate=${endDate}`
        } else if (period.type === 'months') url = `/api/dashboard?months=${period.value}`

        const response = await fetch(url)
        if (!response.ok) throw new Error('Erreur API')

        const apiData = await response.json()
        dashboardCache[cacheKey] = { data: apiData, timestamp: Date.now() }
        setData(apiData)
        setLoading(false)
      } catch (err: any) {
        console.error('Dashboard error:', err)
        setError(err.message)
        setLoading(false)
      }
    }
    loadData()
  }, [period.type, period.value, refreshKey])

  const fmt = (val: number) => {
    if (!val || isNaN(val)) return '0€'
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M€`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K€`
    return `${Math.round(val).toLocaleString('fr-FR')}€`
  }

  const fmtFull = (val: number) => {
    if (!val || isNaN(val)) return '0€'
    return `${Math.round(val).toLocaleString('fr-FR')}€`
  }

  const fmtNum = (val: number) => {
    if (!val || isNaN(val)) return '0'
    return Math.round(val).toLocaleString('fr-FR')
  }

  if (loading) {
    return (
        <div className="space-y-6 p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between skel-breath">
            <div className="h-8 w-64 bg-zinc-800 rounded-xl" />
            <div className="h-9 w-9 bg-zinc-800 rounded-lg" />
          </div>
          {/* 5 KPI cards */}
          <div className="grid grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`rounded-2xl p-4 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${(i % 4) + 1}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-zinc-800 rounded-lg" />
                  <div className="h-2.5 w-16 bg-zinc-800/60 rounded" />
                </div>
                <div className="h-6 w-24 bg-zinc-800 rounded-lg mb-1" />
                <div className="h-2 w-14 bg-zinc-800/40 rounded" />
              </div>
            ))}
          </div>
          {/* Evolution chart */}
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 skel-breath skel-d1">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 w-40 bg-zinc-800 rounded-lg" />
              <div className="flex gap-2">
                <div className="h-7 w-16 bg-zinc-800 rounded-lg" />
                <div className="h-7 w-16 bg-zinc-800 rounded-lg" />
                <div className="h-7 w-16 bg-zinc-800 rounded-lg" />
              </div>
            </div>
            <div className="h-[300px] bg-zinc-800/30 rounded-xl" />
          </div>
          {/* Top Produits + Magasins */}
          <div className="grid lg:grid-cols-2 gap-6">
            {[0, 1].map(j => (
              <div key={j} className={`bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden skel-breath skel-d${j + 2}`}>
                <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                  <div className="h-5 w-32 bg-zinc-700 rounded-lg" />
                </div>
                <div className="p-6 space-y-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-4 bg-zinc-800/60 rounded" />
                      <div className="w-9 h-9 bg-zinc-800 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 bg-zinc-800 rounded mb-1.5" />
                        <div className="h-1.5 w-full bg-zinc-800/40 rounded-full" />
                      </div>
                      <div className="h-4 w-16 bg-zinc-800 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Top Clients table */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden skel-breath skel-d3">
            <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
              <div className="h-5 w-28 bg-zinc-700 rounded-lg" />
            </div>
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-5 h-4 bg-zinc-800/60 rounded" />
                  <div className="h-3 w-28 bg-zinc-800 rounded" />
                  <div className="h-3 w-20 bg-zinc-800/60 rounded" />
                  <div className="h-3 w-24 bg-zinc-800/50 rounded" />
                  <div className="flex-1" />
                  <div className="h-3 w-16 bg-zinc-800 rounded" />
                  <div className="h-3 w-12 bg-zinc-800/60 rounded" />
                </div>
              ))}
            </div>
          </div>
          {/* Familles + Jours */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden skel-breath skel-d4">
              <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                <div className="h-5 w-44 bg-zinc-700 rounded-lg" />
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="rounded-xl p-3 border border-zinc-800 bg-zinc-800/30">
                    <div className="h-2.5 w-20 bg-zinc-700 rounded mb-2" />
                    <div className="h-5 w-12 bg-zinc-700/60 rounded mb-1" />
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-2" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden skel-breath skel-d1">
              <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                <div className="h-5 w-48 bg-zinc-700 rounded-lg" />
              </div>
              <div className="p-6">
                <div className="h-[280px] bg-zinc-800/30 rounded-xl" />
              </div>
            </div>
          </div>
          {/* Stats qualité bottom */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden skel-breath skel-d2">
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                  <div className="h-2.5 w-20 bg-zinc-700 rounded mb-2" />
                  <div className="h-5 w-14 bg-zinc-700/60 rounded mb-1" />
                  <div className="h-2 w-24 bg-zinc-800/40 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Erreur de chargement</h2>
          <p className="text-zinc-400 text-sm mb-4">{error || 'Données non disponibles'}</p>
          <button
          onClick={forceRefresh}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-sm font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const { kpis, statsClients, topProduits, topMagasins, topClients, evolutionMensuelle, topFamilles, repartitionJours } = data
  const sortedProduits = [...(topProduits || [])].sort((a: any, b: any) => productSort === 'ca' ? b.ca - a.ca : b.volume - a.volume)
  const maxProdCA = sortedProduits?.[0]?.[productSort === 'ca' ? 'ca' : 'volume'] || 1
  const maxMagCA = topMagasins?.[0]?.ca || 1
  const totalFamillesCA = (topFamilles || []).reduce((sum: number, f: any) => sum + (f.ca || 0), 0)

  const chartLabel = chartMode === 'ca' ? "Chiffre d'affaires" : chartMode === 'tickets' ? 'Tickets' : 'Panier moyen'
  const chartDataKey = chartMode

  return (
    <div className="space-y-6 p-4 md:p-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Bienvenue{user?.prenom ? ` ${user.prenom}` : ''} 👋
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Voici votre tableau de bord
            {period.type === 'year' && <span className="text-blue-400 font-medium"> — {period.value}</span>}
            {period.type === 'months' && <span className="text-blue-400 font-medium"> — {period.value} derniers mois</span>}
          </p>
        </div>
        <button
          onClick={forceRefresh}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-400 text-xs transition-colors shrink-0 ml-4"
        >
          <span style={{ display: 'inline-flex', width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={10} strokeWidth={2} />
          </span>
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Chiffre d'affaires", value: fmtFull(kpis.totalCA), icon: Euro, evo: kpis.evolution?.ca, gradient: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
          { label: 'Tickets de caisse', value: fmtNum(kpis.totalTickets), icon: ShoppingCart, evo: kpis.evolution?.tickets, gradient: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400' },
          { label: 'Clients uniques', value: fmtNum(kpis.totalClients), icon: Users, evo: kpis.evolution?.clients, gradient: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400' },
          { label: 'Panier moyen', value: fmtFull(kpis.panierMoyen), icon: Package, evo: kpis.evolution?.panierMoyen, gradient: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400' },
          { label: 'Nouveaux clients', value: fmtNum(kpis.nouveauxClients || 0), icon: UserPlus, evo: kpis.evolution?.nouveauxClients, gradient: 'from-pink-500/20 to-pink-600/5', border: 'border-pink-500/30', iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400' },
        ].map(({ label, value, icon: Icon, evo, gradient, border, iconBg, iconColor }) => (
          <div key={label} className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 border ${border} backdrop-blur-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 ${iconBg} rounded-lg`}>
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
              </div>
              <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide leading-tight">{label}</p>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-xl md:text-2xl font-bold text-white">{value}</p>
              {evo !== null && evo !== undefined && (
                <span className={`text-[10px] font-semibold mb-0.5 ${evo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {evo >= 0 ? '↑' : '↓'} {Math.abs(evo).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Evolution Chart */}
      <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h3 className="text-lg font-bold text-white">Évolution mensuelle</h3>
          <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
            {([
              { key: 'ca', label: 'CA' },
              { key: 'tickets', label: 'Tickets' },
              { key: 'panierMoyen', label: 'Panier' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setChartMode(key); trackInteraction('CHART_MODE', 'dashboard', { mode: key }) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartMode === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Suspense fallback={<ChartFallback />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolutionMensuelle}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mois" stroke="#52525b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#52525b" tick={{ fontSize: 12 }} tickFormatter={(v: number) => chartMode === 'ca' ? fmt(v) : chartMode === 'panierMoyen' ? `${Math.round(v)}€` : fmtNum(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }}
                formatter={(value: number) => [chartMode === 'tickets' ? fmtNum(value) : fmtFull(value), chartLabel]}
              />
              <Line type="monotone" dataKey={chartDataKey} stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
      </div>

      {/* Top Produits + Top Magasins */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Produits */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Top Produits
            </h3>
            <div className="flex items-center gap-0.5 bg-zinc-900/60 rounded-full p-0.5 border border-zinc-700/50">
              {([
                { key: 'ca' as const, label: 'CA' },
                { key: 'volume' as const, label: 'Unités' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setProductSort(key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                    productSort === key
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6 space-y-3">
            {sortedProduits.slice(0, 8).map((p: any, i: number) => (
              <div key={p.code || i} className="group cursor-pointer" onClick={() => { onNavigate?.('search', { productCode: p.code }); trackInteraction('DRILL_DOWN', 'dashboard', { target: 'product', code: p.code }) }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">#{i + 1}</span>
                    <ProductThumb code={p.code} />
                    <span className="text-sm text-white font-medium truncate group-hover:text-blue-400 transition-colors">{p.nom || p.code}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-sm font-bold text-white">{productSort === 'ca' ? fmt(p.ca) : fmtNum(p.volume)}</span>
                    <span className="text-xs text-zinc-500 ml-2">{productSort === 'ca' ? `${fmtNum(p.volume)} u.` : fmt(p.ca)}</span>
                  </div>
                </div>
                {p.famille && (
                  <p className="text-[10px] text-zinc-600 ml-[60px] mb-1">
                    <span className="hover:text-indigo-400 transition-colors" onClick={(e) => { e.stopPropagation(); onNavigate?.('subFamilies') }}>{p.famille}</span>
                    {p.sous_famille ? <> › <span className="hover:text-indigo-400 transition-colors" onClick={(e) => { e.stopPropagation(); onNavigate?.('subFamilies') }}>{p.sous_famille}</span></> : ''}
                  </p>
                )}
                <div className="ml-[60px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500" style={{ width: `${((productSort === 'ca' ? p.ca : p.volume) / maxProdCA) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Magasins */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-green-400" />
              Top Magasins
            </h3>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">{topMagasins?.length || 0} magasins</span>
          </div>
          <div className="p-6 space-y-3">
            {(topMagasins || []).slice(0, 10).map((m: any, i: number) => (
              <div key={m.code || i} className="cursor-pointer group" onClick={() => { onNavigate?.('stores', { storeCode: m.code }); trackInteraction('DRILL_DOWN', 'dashboard', { target: 'store', code: m.code }) }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">#{i + 1}</span>
                    <span className="text-sm text-white font-medium truncate group-hover:text-green-400 transition-colors">M{m.code}{m.ville ? ` ${m.ville}` : ''}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-sm font-bold text-white">{fmt(m.ca)}</span>
                    <span className="text-xs text-zinc-500 ml-2">{fmtNum(m.nbTickets)} tck</span>
                  </div>
                </div>
                <div className="ml-7 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500" style={{ width: `${(m.ca / maxMagCA) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Clients */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Top Clients
          </h3>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">Par CA</span>
        </div>

        <div className="p-6">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">#</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Nom</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Carte</th>
                <th className="text-left py-3 px-3 text-zinc-400 font-medium">Ville</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">CA</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Commandes</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Dernière visite</th>
              </tr>
            </thead>
            <tbody>
              {(topClients || []).slice(0, 10).map((c: any, i: number) => (
                <tr key={c.carte || i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer group" onClick={() => onNavigate?.('search', { clientCarte: c.carte })}>
                  <td className="py-3 px-3 text-zinc-500 font-bold">{i + 1}</td>
                  <td className="py-3 px-3 text-white font-medium group-hover:text-purple-400 transition-colors">{c.nom || '-'}</td>
                  <td className="py-3 px-3 text-zinc-400 font-mono text-xs">{c.carte}</td>
                  <td className="py-3 px-3 text-zinc-400">{c.ville || '-'}</td>
                  <td className="py-3 px-3 text-right text-white font-bold">{fmtFull(c.ca)}</td>
                  <td className="py-3 px-3 text-right text-zinc-300">{fmtNum(c.nbCommandes)}</td>
                  <td className="py-3 px-3 text-right text-zinc-400 text-xs">{c.derniereVisite ? new Date(c.derniereVisite).toLocaleDateString('fr-FR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {(topClients || []).slice(0, 8).map((c: any, i: number) => (
            <div key={c.carte || i} className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-800/50 cursor-pointer hover:border-purple-500/30 transition-colors" onClick={() => onNavigate?.('search', { clientCarte: c.carte })}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-bold">#{i + 1}</span>
                  <span className="text-white font-medium text-sm hover:text-purple-400 transition-colors">{c.nom || c.carte}</span>
                </div>
                <span className="text-white font-bold text-sm">{fmtFull(c.ca)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{c.ville || '-'}</span>
                <span>{fmtNum(c.nbCommandes)} commandes</span>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Répartition Familles + Jours semaine */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Familles — 3 blocs visuels */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white">Répartition par famille</h3>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4">
            {(topFamilles || []).slice(0, 3).map((f: any, i: number) => {
              const pct = totalFamillesCA > 0 ? ((f.ca / totalFamillesCA) * 100) : 0
              const colors = [
                { bg: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500' },
                { bg: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', text: 'text-purple-400', bar: 'bg-purple-500' },
                { bg: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' },
              ]
              const c = colors[i % colors.length]
              return (
                <div key={f.famille || i} className={`bg-gradient-to-br ${c.bg} rounded-xl p-5 border ${c.border} cursor-pointer hover:scale-[1.02] transition-transform`} onClick={() => onNavigate?.('subFamilies')}>
                  <p className={`text-sm font-bold ${c.text} mb-3`}>{f.famille || 'Sans famille'}</p>
                  <p className="text-2xl font-bold text-white mb-1">{pct.toFixed(0)}%</p>
                  <p className="text-xs text-zinc-400 mb-0.5">CA : {fmt(f.ca)}</p>
                  <p className="text-xs text-zinc-500">{fmtNum(f.volume)} unités vendues</p>
                  <div className="mt-3 h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CA par jour de la semaine */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white">CA par jour de la semaine</h3>
          </div>
          <div className="p-6">
          {repartitionJours && repartitionJours.length > 0 ? (
            <Suspense fallback={<ChartFallback />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={repartitionJours} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="jour" stroke="#52525b" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fontSize: 12 }} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: '12px 16px' }}>
                          <p style={{ color: '#e4e4e7', fontWeight: 'bold', marginBottom: 6, fontSize: 13 }}>{label}</p>
                          <p style={{ color: '#d4d4d8', fontSize: 12, marginBottom: 2 }}>CA : <span style={{ fontWeight: 600, color: '#fff' }}>{fmtFull(d?.ca || 0)}</span></p>
                          <p style={{ color: '#d4d4d8', fontSize: 12 }}>Tickets : <span style={{ fontWeight: 600, color: '#fff' }}>{fmtNum(d?.tickets || 0)}</span></p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="ca" radius={[6, 6, 0, 0]}>
                    {repartitionJours.map((_: any, i: number) => (
                      <Cell key={i} fill={JOUR_COLORS[i % JOUR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Suspense>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Pas de données</div>
          )}
          </div>
        </div>
      </div>

      {/* Stats Qualité Données Clients */}
      {statsClients && (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Qualité des données clients
            </h3>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 mb-2">Hommes / Femmes</p>
              <p className="text-xl font-bold text-white">
                {statsClients.pctHommes?.toFixed(0) || 0}% / {statsClients.pctFemmes?.toFixed(0) || 0}%
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {fmtNum(statsClients.hommes)} H · {fmtNum(statsClients.femmes)} F
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 mb-2">Emails renseignés</p>
              <p className="text-xl font-bold text-green-400">
                {statsClients.pctEmail?.toFixed(1) || 0}%
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {fmtNum(statsClients.avecEmail)} / {fmtNum(statsClients.total)}
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 mb-2">Téléphones renseignés</p>
              <p className="text-xl font-bold text-cyan-400">
                {statsClients.pctTelephone?.toFixed(1) || 0}%
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {fmtNum(statsClients.avecTelephone)} / {fmtNum(statsClients.total)}
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 mb-2">Identité complète</p>
              <p className="text-xl font-bold text-purple-400">
                {statsClients.total > 0 ? ((statsClients.avecNom / statsClients.total) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Nom: {fmtNum(statsClients.avecNom)} · Prénom: {fmtNum(statsClients.avecPrenom)}
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 mb-2">Âge renseigné</p>
              <p className="text-xl font-bold text-orange-400">
                {statsClients.pctAge?.toFixed(1) || '0.0'}%
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {fmtNum(statsClients.avecAge || 0)} clients · Moy: {statsClients.ageMoyen || 0} ans
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(Dashboard)
