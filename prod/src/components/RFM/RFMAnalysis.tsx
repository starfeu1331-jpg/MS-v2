import {
  Users, Crown, Award, Heart, AlertTriangle, UserX, Sparkles, Target,
  TrendingUp, Euro, ShoppingCart, ChevronRight, Info, X, RefreshCw, Package, ImageOff
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import SegmentDetail from './SegmentDetail'
import UltraUltraChampions from './UltraUltraChampions'
import { trackInteraction, trackFilter } from '../../services/tracker'

// ─── Image produit PIM ───────────────────────────────────────────
const PIM_CDN = 'https://cdnapi.interactiv-database.fr/api/public/b67c96d1-87a7-4dbe-8c14-bee41dd35116/file/display/'
function ProductThumb({ code }: { code: string }) {
  const [src, setSrc] = useState(`${PIM_CDN}${code}_det_1_web.jpg`)
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0" style={{ width: 36, height: 36, minWidth: 36, minHeight: 36 }}><Package className="w-4 h-4 text-zinc-600" /></div>
  return <img src={src} alt="" width={36} height={36} style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, maxWidth: 36, maxHeight: 36 }} className="rounded-lg object-cover bg-zinc-800 shrink-0" onError={() => {
    if (src.includes('_det_1')) setSrc(`${PIM_CDN}${code}_amb_1_web.jpg`)
    else setFailed(true)
  }} />
}

// ─── Types ────────────────────────────────────────────────────────
interface SegmentStat {
  count: number
  ca: number
  ageMoyen?: number | null
  avecAge?: number
  pctAge?: number
}

interface RFMData {
  stats: {
    totalClients: number
    totalCA: number
    segments: Record<string, SegmentStat>
  }
  top20: any[]
}

interface RFMAnalysisProps {
  data?: any
  subPath?: string
  navigate?: (path: string) => void
  onSearchClient?: (carte: string) => void
  onSearchProduct?: (code: string) => void
  period?: { type: string; value: number | string; label?: string }
}

// Helpers pour slug segment <-> nom
function segmentToSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
function slugToSegment(slug: string): string | null {
  const SEGMENTS_NAMES = ['Ultra Champions','Champions','Loyaux','\u00c0 Risque','Perdus','Nouveaux','Occasionnels']
  return SEGMENTS_NAMES.find(n => segmentToSlug(n) === slug) || null
}

// ─── Cache mémoire ───────────────────────────────────────────────
const rfmCache: Record<string, { data: RFMData; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000
const rfmUIState: Record<string, { selectedSegment: string | null; showSegmentDetail: boolean }> = {}

// ─── Prefetch "toutes périodes" (avant même le mount) ────────────
let prefetchPromise: Promise<RFMData | null> | null = fetch('/api/rfm')
  .then(r => r.ok ? r.json() : null)
  .then((data: RFMData | null) => {
    if (data) rfmCache['all:all'] = { data, timestamp: Date.now() }
    return data
  })
  .catch(() => null)

// ─── Définition des 7 segments ───────────────────────────────────
const SEGMENTS = [
  { name: 'Ultra Champions', color: 'purple',  icon: Crown,          description: 'Excellence absolue', criteria: 'R=5 ET F=5 ET M=5', action: 'VIP absolu — privilèges exclusifs, accès prioritaire' },
  { name: 'Champions',       color: 'emerald', icon: Award,          description: 'Meilleurs clients',  criteria: 'R≥4 ET F≥4 ET M≥4', action: 'Récompensez-les — offres VIP, programme ambassadeur' },
  { name: 'Loyaux',          color: 'blue',    icon: Heart,          description: 'Clients fidèles',    criteria: 'F≥4 (sauf Champions)', action: 'Montée en gamme — cross-sell, upsell, offres premium' },
  { name: 'À Risque',        color: 'orange',  icon: AlertTriangle,  description: 'Anciens bons clients', criteria: 'R≤2 ET F≥4', action: 'Réactivation urgente — offres de reconquête' },
  { name: 'Perdus',          color: 'red',     icon: UserX,          description: 'Inactifs longue date', criteria: 'R≤2 ET F<4', action: 'Dernière chance — offre exceptionnelle ou laisser partir' },
  { name: 'Nouveaux',        color: 'cyan',    icon: Sparkles,       description: 'Récents, peu d\'achats', criteria: 'F≤2 ET R≥4', action: 'Fidélisation — offre de bienvenue, suivi régulier' },
  { name: 'Occasionnels',    color: 'zinc',    icon: Target,         description: 'Sans profil marqué', criteria: 'Tous les autres', action: 'Engagement — augmenter la fréquence via campagnes' },
]

// ─── Couleurs statiques ──────────────────────────────────────────
const colorMap: Record<string, { iconBg: string; border: string; text: string; barBg: string; barFill: string }> = {
  purple:  { iconBg: 'bg-purple-500/20',  border: 'border-purple-500/20',  text: 'text-purple-400',  barBg: 'bg-purple-500/10',  barFill: 'bg-gradient-to-r from-purple-500 to-purple-400' },
  emerald: { iconBg: 'bg-emerald-500/20', border: 'border-emerald-500/20', text: 'text-emerald-400', barBg: 'bg-emerald-500/10', barFill: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
  blue:    { iconBg: 'bg-blue-500/20',    border: 'border-blue-500/20',    text: 'text-blue-400',    barBg: 'bg-blue-500/10',    barFill: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  orange:  { iconBg: 'bg-orange-500/20',  border: 'border-orange-500/20',  text: 'text-orange-400',  barBg: 'bg-orange-500/10',  barFill: 'bg-gradient-to-r from-orange-500 to-orange-400' },
  red:     { iconBg: 'bg-red-500/20',     border: 'border-red-500/20',     text: 'text-red-400',     barBg: 'bg-red-500/10',     barFill: 'bg-gradient-to-r from-red-500 to-red-400' },
  cyan:    { iconBg: 'bg-cyan-500/20',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    barBg: 'bg-cyan-500/10',    barFill: 'bg-gradient-to-r from-cyan-500 to-cyan-400' },
  zinc:    { iconBg: 'bg-zinc-500/20',    border: 'border-zinc-500/20',    text: 'text-zinc-400',    barBg: 'bg-zinc-500/10',    barFill: 'bg-gradient-to-r from-zinc-500 to-zinc-400' },
}

// ═══════════════════════════════════════════════════════════════════
export default function RFMAnalysis({ onSearchClient, onSearchProduct, subPath, navigate: nav, period }: RFMAnalysisProps) {
  const savedUIState = rfmUIState['rfm_ui']
  const [selectedSegment, setSelectedSegment] = useState<string | null>(savedUIState?.selectedSegment || null)
  const [showSegmentDetail, setShowSegmentDetail] = useState(savedUIState?.showSegmentDetail || false)
  const [showUltraUltra, setShowUltraUltra] = useState(false)

  // ── Period-aware cache ──
  const periodKey = period ? `${period.type}:${period.value}` : 'all:all'
  const cached = rfmCache[periodKey]
  const hasValidCache = cached && (Date.now() - cached.timestamp) < CACHE_DURATION
  const [rfmData, setRfmData] = useState<RFMData | null>(hasValidCache ? cached.data : null)
  const [showMethodModal, setShowMethodModal] = useState(false)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topProductsLoading, setTopProductsLoading] = useState(true)
  const [topProductsSegment, setTopProductsSegment] = useState('Ultra Champions')
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false)
  const [topProductsSort, setTopProductsSort] = useState<'ca' | 'volume'>('ca')

  const [loading, setLoading] = useState(!hasValidCache)
  const [error, setError] = useState<string | null>(null)

  // Sync from URL subPath (handles popstate + deep links)
  const prevSubPathRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (subPath === undefined) return
    if (subPath === prevSubPathRef.current) return
    prevSubPathRef.current = subPath
    if (subPath) {
      if (subPath === 'ultra-ultra-champions') {
        setShowUltraUltra(true)
        setShowSegmentDetail(false)
        setSelectedSegment(null)
        return
      }
      const seg = slugToSegment(subPath)
      if (seg && (selectedSegment !== seg || !showSegmentDetail)) {
        setSelectedSegment(seg)
        setShowSegmentDetail(true)
        setShowUltraUltra(false)
      }
    } else {
      if (showSegmentDetail) {
        setShowSegmentDetail(false)
        setSelectedSegment(null)
      }
      if (showUltraUltra) setShowUltraUltra(false)
    }
  }, [subPath])

  useEffect(() => {
    rfmUIState['rfm_ui'] = { selectedSegment, showSegmentDetail }
  }, [selectedSegment, showSegmentDetail])

  useEffect(() => {
    const fetchRFMData = async () => {
      // 1) Cache mémoire déjà rempli → instantané
      const c = rfmCache[periodKey]
      if (c && (Date.now() - c.timestamp) < CACHE_DURATION) {
        setRfmData(c.data)
        setLoading(false)
        return
      }

      // 2) Attendre le prefetch module-level s'il est encore en vol (uniquement pour "all")
      const isAllPeriod = !period || period.type === 'all'
      if (isAllPeriod && prefetchPromise) {
        try {
          const prefetched = await prefetchPromise
          prefetchPromise = null // consommé
          if (prefetched) {
            setRfmData(prefetched)
            setLoading(false)
            return
          }
        } catch { /* fallback ci-dessous */ }
      }

      // 3) Fetch avec paramètres de période
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (period && period.type !== 'all') {
          params.set('periodType', period.type)
          params.set('periodValue', String(period.value))
        }
        const url = `/api/rfm${params.toString() ? '?' + params.toString() : ''}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        const data = await response.json()
        rfmCache[periodKey] = { data, timestamp: Date.now() }
        setRfmData(data)
      } catch (err: any) {
        console.error('Erreur chargement RFM:', err)
        setError(err.message || 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    fetchRFMData()
  }, [periodKey])

  // Fetch top products by segment
  useEffect(() => {
    const fetchTopProducts = async () => {
      setTopProductsLoading(true)
      try {
        const params = new URLSearchParams({ topProducts: topProductsSegment })
        if (period && period.type !== 'all') {
          params.set('periodType', period.type)
          params.set('periodValue', String(period.value))
        }
        const res = await fetch(`/api/rfm?${params.toString()}`)
        if (!res.ok) throw new Error('Erreur API')
        const data = await res.json()
        setTopProducts(data.products || [])
      } catch (err) {
        console.error('Erreur top products:', err)
      } finally {
        setTopProductsLoading(false)
      }
    }
    fetchTopProducts()
  }, [topProductsSegment, periodKey])

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  const formatCompact = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M€`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}k€`
    return `${Math.round(value)}€`
  }

  // ─── Ultra Ultra Champions (segment caché) ─────────────────────
  if (showUltraUltra) {
    return (
      <UltraUltraChampions
        onBack={() => {
          setShowUltraUltra(false)
          if (nav) nav('/rfm')
        }}
        onSearchClient={onSearchClient}
      />
    )
  }

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 skel-breath skel-d1">
            <div className="w-11 h-11 bg-zinc-800 rounded-xl" />
            <div>
              <div className="h-6 w-52 bg-zinc-800 rounded-lg mb-1.5" />
              <div className="h-3.5 w-36 bg-zinc-800/60 rounded-md" />
            </div>
          </div>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className={`rounded-2xl p-5 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${(i % 4) + 1}`}>
                <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
                <div className="h-7 w-32 bg-zinc-800 rounded-lg mb-2" />
                <div className="h-2.5 w-20 bg-zinc-800/50 rounded" />
              </div>
            ))}
          </div>
          {/* Segments grid */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden skel-breath skel-d2">
            <div className="px-6 py-4 border-b border-zinc-700/50 bg-zinc-800/40">
              <div className="h-5 w-28 bg-zinc-700 rounded-lg" />
            </div>
            <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-xl p-3 border border-zinc-800 bg-zinc-800/30" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="h-3 w-16 bg-zinc-700 rounded mb-2 mx-auto" />
                  <div className="h-5 w-12 bg-zinc-700/60 rounded mx-auto mb-1" />
                  <div className="h-2 w-full bg-zinc-800 rounded-full mt-2" />
                </div>
              ))}
            </div>
          </div>
          {/* Bottom section */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 skel-breath skel-d3">
            <div className="h-5 w-40 bg-zinc-800 rounded-lg mb-4" />
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className={`h-10 bg-zinc-800/40 rounded-lg skel-breath skel-d${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!rfmData || !rfmData.stats || rfmData.stats.totalClients === 0) {
    return (
      <div className="glass rounded-3xl p-8 border border-zinc-800 text-center">
        <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Aucun client trouvé</h2>
        <p className="text-zinc-400">Pas de données RFM disponibles</p>
      </div>
    )
  }

  const { totalClients, totalCA, segments: segmentStats } = rfmData.stats
  const top20 = rfmData.top20 || []
  const maxSegCA = Math.max(...SEGMENTS.map(s => segmentStats[s.name]?.ca || 0))

  // ── Paramètres période pour les sous-composants ──
  const periodParams = period && period.type !== 'all'
    ? `periodType=${encodeURIComponent(period.type)}&periodValue=${encodeURIComponent(String(period.value))}`
    : ''

  // ─── Vue détail d'un segment ────────────────────────────────────
  if (showSegmentDetail && selectedSegment && segmentStats[selectedSegment]) {
    return (
      <SegmentDetail
        segmentName={selectedSegment}
        segmentData={segmentStats[selectedSegment]}
        totalClients={totalClients}
        totalCA={totalCA}
        periodParams={periodParams}
        onBack={() => {
          setShowSegmentDetail(false)
          setSelectedSegment(null)
          if (nav) nav('/rfm')
          else window.history.back()
        }}
        onSearchClient={onSearchClient}
      />
    )
  }

  // ─── Vue principale ─────────────────────────────────────────────
  return (
    <div className="space-y-6 fade-in">

      {/* ── Modale Méthode RFM ──────────────────────── */}
      {showMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} onClick={() => setShowMethodModal(false)}>
          <div className="glass rounded-3xl p-8 border border-zinc-700 max-w-2xl w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Méthode de Calcul RFM</h3>
              <button onClick={() => setShowMethodModal(false)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <p className="text-sm text-zinc-300 mb-4">
              L'analyse <strong className="text-purple-400">RFM</strong> attribue 3 scores de 1 à 5 selon la méthode des <strong className="text-cyan-400">quintiles</strong> (20% de clients par tranche) :
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                <h4 className="font-bold text-blue-400 mb-1 text-sm">R — Récence</h4>
                <p className="text-xs text-zinc-400">Jours depuis le dernier achat</p>
                <p className="text-xs text-emerald-400 mt-2">5 = plus récent</p>
              </div>
              <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                <h4 className="font-bold text-cyan-400 mb-1 text-sm">F — Fréquence</h4>
                <p className="text-xs text-zinc-400">Nombre d'achats total</p>
                <p className="text-xs text-emerald-400 mt-2">5 = plus fréquent</p>
              </div>
              <div className="bg-teal-500/10 rounded-xl p-4 border border-teal-500/20">
                <h4 className="font-bold text-teal-400 mb-1 text-sm">M — Montant</h4>
                <p className="text-xs text-zinc-400">CA total généré</p>
                <p className="text-xs text-emerald-400 mt-2">5 = plus gros CA</p>
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-400 mb-2">
                <strong className="text-purple-400">Score final :</strong> R×100 + F×10 + M
                <span className="text-zinc-500 ml-2">(ex : R=5, F=4, M=3 → 543)</span>
              </p>
              <div className="grid grid-cols-5 gap-2 text-center font-bold mt-3" style={{ fontSize: '10px' }}>
                <div className="bg-red-500/10 text-red-400 py-1.5 rounded-lg">1 — 20% bas</div>
                <div className="bg-orange-500/10 text-orange-400 py-1.5 rounded-lg">2</div>
                <div className="bg-amber-500/10 text-amber-400 py-1.5 rounded-lg">3</div>
                <div className="bg-lime-500/20 text-lime-400 py-1.5 rounded-lg">4</div>
                <div className="bg-emerald-500/10 text-emerald-400 py-1.5 rounded-lg">5 — 20% haut</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header + KPIs ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 rounded-xl">
            <Users className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Segmentation RFM</h2>
            <p className="text-sm text-zinc-500">Récence · Fréquence · Montant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMethodModal(true)}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors group"
            title="Comment fonctionne l'analyse RFM"
          >
            <Info className="w-5 h-5 text-zinc-500 group-hover:text-purple-400 transition-colors" />
          </button>
          <button
            onClick={() => { delete rfmCache[periodKey]; window.location.reload() }}
            className="p-2 hover:bg-zinc-800 rounded-xl transition-colors group"
            title="Rafraîchir les données"
          >
            <RefreshCw className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/15 to-blue-600/5 rounded-2xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Clients analysés</p>
          </div>
          <p className="text-2xl font-bold text-white">{totalClients.toLocaleString('fr-FR')}</p>
          <p className="text-[11px] text-zinc-500 mt-1 group relative cursor-default">
            Porteurs carte fidélité
            <span className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-2 border border-zinc-700 shadow-xl w-64 z-10">
              Seuls les clients avec carte de fidélité et CA positif sont inclus. Les achats anonymes ne sont pas segmentés.
            </span>
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 rounded-2xl p-5 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Euro className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">CA Total</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatEuro(totalCA)}</p>
          <p className="text-[11px] text-zinc-500 mt-1">{period && period.type !== 'all' ? (period.label || 'Période filtrée') : 'Cumul toutes transactions'}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 rounded-2xl p-5 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">CA Moyen / Client</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatEuro(totalCA / totalClients)}</p>
        </div>
      </div>

      {/* ── Segments en ligne ─────────────────────── */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Segments</h3>
            <span className="text-xs text-zinc-500">7 segments</span>
          </div>
        </div>
        <div className="p-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {SEGMENTS.map((seg) => {
            const stats = segmentStats[seg.name] || { count: 0, ca: 0 }
            const pctClients = ((stats.count / totalClients) * 100)
            const pctCA = ((stats.ca / totalCA) * 100)
            const barWidth = maxSegCA > 0 ? (stats.ca / maxSegCA) * 100 : 0
            const c = colorMap[seg.color]
            const Icon = seg.icon

            return (
              <button
                key={seg.name}
                onClick={() => {
                  setSelectedSegment(seg.name); setShowSegmentDetail(true)
                  trackInteraction('SEGMENT_VIEW', 'rfm', { segment: seg.name })
                  if (nav) nav('/rfm/' + segmentToSlug(seg.name))
                }}
                className="bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-purple-500/50 transition-all group text-left"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`p-1.5 ${c.iconBg} rounded-lg`}>
                      <Icon className={`w-4 h-4 ${c.text}`} />
                    </div>
                    <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">{seg.name}</span>
                  </div>
                  <p className="text-[9px] text-zinc-500 mb-2 leading-tight">{seg.criteria}</p>
                  <div className="mb-2">
                    <p className="text-lg font-bold text-white">{stats.count.toLocaleString('fr-FR')}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{pctClients.toFixed(1)}% clients</p>
                  </div>
                  <div>
                    <div className={`h-1 ${c.barBg} rounded-full overflow-hidden`}>
                      <div className={`h-full rounded-full ${c.barFill} transition-all`} style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] font-bold text-emerald-400">{pctCA.toFixed(1)}% CA</span>
                      <span className="text-[8px] text-zinc-600">{formatCompact(stats.ca)}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Top 20 + Top Produits Ultra Champions ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top 20 Clients */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Top 20 Clients</h3>
              <span className="text-xs text-zinc-500">par CA</span>
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-[700px] overflow-y-auto">
            {top20.map((client: any, idx: number) => {
              const initial = (client.prenom?.[0] || client.nom?.[0] || '?').toUpperCase()
              const name = (client.prenom || client.nom)
                ? `${client.prenom || ''} ${client.nom || ''}`.trim()
                : `Carte ${client.carte}`
              const location = [client.ville, client.cp].filter(Boolean).join(' ')

              return (
                <button
                  key={client.carte}
                  onClick={() => onSearchClient?.(client.carte)}
                  className="w-full bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-blue-500/50 transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm">
                        {initial}
                      </div>
                      <span className="absolute -top-1 -left-1 bg-zinc-800 text-zinc-400 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-zinc-700">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{name}</p>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[11px] text-zinc-500 truncate block">{location || '—'}</span>
                        {client.segment && <span className="text-[11px] text-zinc-600 shrink-0 ml-1">· {client.segment}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">{formatEuro(client.monetary)}</p>
                      <div className="flex items-center gap-3 justify-end mt-0.5">
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">{client.RFM}</span>
                        <span className="text-[10px] text-zinc-600">{client.frequency} achats</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-blue-400 transition-colors shrink-0" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Top Produits par segment */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Top Produits
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setSegmentDropdownOpen(!segmentDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-purple-500/50 transition-all text-xs font-medium text-purple-400"
                >
                  <span>{topProductsSegment}</span>
                  <ChevronRight className={`w-3 h-3 text-zinc-500 transition-transform ${segmentDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {segmentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSegmentDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 min-w-[180px]">
                      {SEGMENTS.map(seg => (
                        <button
                          key={seg.name}
                          onClick={() => { setTopProductsSegment(seg.name); setSegmentDropdownOpen(false); trackFilter('rfm', { topProductsSegment: seg.name }) }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-800 transition-colors ${
                            seg.name === topProductsSegment ? 'text-purple-400 font-bold' : 'text-zinc-400'
                          }`}
                        >
                          <span>{seg.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
                <button
                  onClick={() => setTopProductsSort('ca')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${topProductsSort === 'ca' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <span>CA</span>
                </button>
                <div className="w-px h-3.5 bg-zinc-700" />
                <button
                  onClick={() => setTopProductsSort('volume')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${topProductsSort === 'volume' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <span>Unités</span>
                </button>
              </div>
              <span className="text-xs text-zinc-500">{topProducts.length} produits</span>
            </div>
          </div>
          <div className="p-6 space-y-3 max-h-[700px] overflow-y-auto">
            {topProductsLoading ? (
              <div className="space-y-3 py-4">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className={`flex items-center gap-3 skel-breath skel-d${(i%4)+1}`}>
                    <div className="w-5 h-4 bg-zinc-800/60 rounded" />
                    <div className="flex-1"><div className="h-3 w-3/4 bg-zinc-800 rounded mb-1.5" /><div className="h-1.5 w-full bg-zinc-800/40 rounded-full" /></div>
                    <div className="h-4 w-14 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">Aucun produit trouvé</p>
            ) : (
              [...topProducts].sort((a, b) => topProductsSort === 'ca' ? (b.ca - a.ca) : ((b.volume || 0) - (a.volume || 0))).map((p: any, i: number) => {
                const maxVal = topProductsSort === 'ca'
                  ? Math.max(...topProducts.map((x: any) => x.ca || 0))
                  : Math.max(...topProducts.map((x: any) => x.volume || 0))
                const barVal = topProductsSort === 'ca' ? p.ca : (p.volume || 0)
                return (
                  <div key={p.code || i} className="group cursor-pointer" onClick={() => onSearchProduct?.(p.code)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">#{i + 1}</span>
                        <ProductThumb code={p.code} />
                        <span className="text-sm text-white font-medium truncate group-hover:text-purple-400 transition-colors">{p.nom || p.code}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-sm font-bold text-white">{formatEuro(p.ca)}</span>
                        <span className="text-xs text-zinc-500 ml-2">{(p.volume || 0).toLocaleString('fr-FR')} u.</span>
                      </div>
                    </div>
                    {p.famille && (
                      <p className="text-[10px] text-zinc-600 ml-[60px] mb-1">
                        {p.famille}{p.sous_famille ? <> › {p.sous_famille}</> : ''}
                      </p>
                    )}
                    <div className="ml-[60px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-500" style={{ width: `${(barVal / (maxVal || 1)) * 100}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
