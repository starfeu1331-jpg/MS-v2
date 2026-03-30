import { ShoppingBag, TrendingUp, Search, ArrowLeftRight, ChevronDown, ChevronUp, X, Zap, Clock, HelpCircle } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { trackFilter } from '../../services/tracker'

interface CrossSellingAnalysisProps {
  data?: any
  period?: { type: string; value: number | string; label?: string }
}

type Mode = 'top' | 'search' | 'compare'
type SortKey = 'lift' | 'count' | 'support' | 'confidenceAB' | 'totalCA' | 'avgCA'

const crossSellingCache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000

// Store last query durations for estimation
function getEstimatedTime(key: string): number | null {
  try {
    const stored = localStorage.getItem(`cs_timing_${key}`)
    return stored ? parseInt(stored, 10) : null
  } catch { return null }
}
function saveQueryTime(key: string, ms: number) {
  try { localStorage.setItem(`cs_timing_${key}`, String(ms)) } catch {}
}

function LoadingTimer({ estimatedMs }: { estimatedMs: number | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Date.now() - t0), 250)
    return () => clearInterval(iv)
  }, [])

  const hasEstimate = estimatedMs !== null && estimatedMs > 1000
  const remainingMs = hasEstimate ? Math.max(0, estimatedMs - elapsed) : 0
  const remainingSec = Math.ceil(remainingMs / 1000)
  const progress = hasEstimate ? Math.min(elapsed / estimatedMs, 0.97) : null

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-5">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-3 skel-breath">
          <div className="w-12 h-12 bg-zinc-800 rounded-2xl" />
          <div className="flex-1"><div className="h-4 w-48 bg-zinc-800 rounded mb-2" /><div className="h-3 w-32 bg-zinc-800/60 rounded" /></div>
        </div>
        <div className="space-y-3 skel-breath skel-d1">
          {[0,1,2,3,4].map(i => <div key={i} className="h-12 bg-zinc-800/40 rounded-xl" />)}
        </div>
      </div>
      {hasEstimate ? (
        <div className="text-center">
          {remainingSec > 0 ? (
            <>
              <div className="text-zinc-400 text-sm">Temps restant estimé</div>
              <div className="text-white font-bold text-2xl mt-1">~{remainingSec}s</div>
            </>
          ) : (
            <div className="text-zinc-400 text-sm">Presque terminé...</div>
          )}
        </div>
      ) : (
        <div className="text-zinc-400 text-sm">Première analyse, calcul en cours...</div>
      )}
      {progress !== null && (
        <div className="w-56 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-700 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function CrossSellingAnalysis({ data, period }: CrossSellingAnalysisProps) {
  const [granularity, setGranularity] = useState<'famille' | 'sous_famille' | 'sous_sous_famille' | 'sous_sous_sous_famille' | 'produit'>('famille')
  const [mode, setMode] = useState<Mode>('top')
  const [sortKey, setSortKey] = useState<SortKey>('lift')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [crossSF, setCrossSF] = useState(true)
  const [excludeCheap, setExcludeCheap] = useState(true)

  // Top associations
  const [topData, setTopData] = useState<any>(null)
  const [topLoading, setTopLoading] = useState(true)

  // Search mode
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimeout = useRef<any>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Compare mode
  const [compareA1, setCompareA1] = useState('')
  const [compareA2, setCompareA2] = useState('')
  const [compareB1, setCompareB1] = useState('')
  const [compareB2, setCompareB2] = useState('')
  const [compareResults, setCompareResults] = useState<any>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const periodKey = period ? `${period.type}:${period.value}` : 'all:all'

  const buildParams = useCallback(() => {
    const p = new URLSearchParams()
    if (period && period.type !== 'all') {
      p.set('periodType', period.type)
      p.set('periodValue', String(period.value))
    }
    return p
  }, [period, periodKey])

  // Fetch top associations
  useEffect(() => {
    if (mode !== 'top') return
    const fetchTop = async () => {
      const cacheKey = `cs_top_${granularity}_${periodKey}_${crossSF}_${excludeCheap}`
      const cached = crossSellingCache[cacheKey]
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        setTopData(cached.data)
        setTopLoading(false)
        return
      }
      setTopLoading(true)
      setError(null)
      try {
        const p = buildParams()
        p.set('granularity', granularity)
        if (crossSF) p.set('crossSF', 'true')
        if (excludeCheap) p.set('excludeCheap', 'true')
        const fetchStart = Date.now()
        const res = await fetch(`/api/cross-selling?${p.toString()}`)
        if (!res.ok) throw new Error(`Erreur ${res.status}`)
        const d = await res.json()
        saveQueryTime(`top_${granularity}`, Date.now() - fetchStart)
        crossSellingCache[cacheKey] = { data: d, timestamp: Date.now() }
        setTopData(d)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setTopLoading(false)
      }
    }
    fetchTop()
  }, [granularity, periodKey, mode, buildParams, crossSF, excludeCheap])

  // Autocomplete
  const doAutocomplete = useCallback((term: string) => {
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current)
    if (term.length < 2) { setSuggestions([]); return }
    suggestTimeout.current = setTimeout(async () => {
      try {
        const p = buildParams()
        p.set('mode', 'autocomplete')
        p.set('q', term)
        const res = await fetch(`/api/cross-selling?${p.toString()}`)
        const d = await res.json()
        setSuggestions(d.suggestions || [])
        setShowSuggestions(true)
      } catch { setSuggestions([]) }
    }, 300)
  }, [buildParams])

  // Search
  const doSearch = useCallback(async (term?: string) => {
    const q = term || searchTerm
    if (!q.trim()) return
    setSearchLoading(true)
    setError(null)
    setShowSuggestions(false)
    try {
      const p = buildParams()
      p.set('mode', 'search')
      p.set('search', q)
      p.set('searchLevel', granularity)
      const fetchStart = Date.now()
      const res = await fetch(`/api/cross-selling?${p.toString()}`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const d = await res.json()
      saveQueryTime(`search_${granularity}`, Date.now() - fetchStart)
      setSearchResults(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearchLoading(false)
    }
  }, [searchTerm, granularity, buildParams])

  // Compare
  const doCompare = useCallback(async () => {
    if (!compareA1.trim() || !compareA2.trim() || !compareB1.trim() || !compareB2.trim()) return
    setCompareLoading(true)
    setError(null)
    try {
      const p = buildParams()
      p.set('mode', 'compare')
      p.set('pairA1', compareA1)
      p.set('pairA2', compareA2)
      p.set('pairB1', compareB1)
      p.set('pairB2', compareB2)
      p.set('compareLevel', granularity)
      const fetchStart = Date.now()
      const res = await fetch(`/api/cross-selling?${p.toString()}`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const d = await res.json()
      saveQueryTime(`compare_${granularity}`, Date.now() - fetchStart)
      setCompareResults(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCompareLoading(false)
    }
  }, [compareA1, compareA2, compareB1, compareB2, granularity, buildParams])

  // Click outside suggestions
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatEuro = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  const formatPct = (v: number) => v < 0.01 ? '<0.01%' : `${v.toFixed(2)}%`

  const sortedAssociations = topData?.associations
    ? [...topData.associations].sort((a: any, b: any) => {
        const mul = sortDir === 'desc' ? -1 : 1
        return mul * ((a[sortKey] || 0) - (b[sortKey] || 0))
      })
    : []

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
  }

  const getLiftColor = (lift: number) => {
    if (lift >= 5) return 'text-emerald-400'
    if (lift >= 2) return 'text-green-400'
    if (lift >= 1.2) return 'text-yellow-400'
    return 'text-zinc-500'
  }

  const getLiftBg = (lift: number) => {
    if (lift >= 5) return 'bg-emerald-500/20 border-emerald-500/30'
    if (lift >= 2) return 'bg-green-500/20 border-green-500/30'
    if (lift >= 1.2) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-zinc-800/50 border-zinc-700'
  }

  // ─── Loading / Error ───
  if (mode === 'top' && topLoading) {
    return <LoadingTimer estimatedMs={getEstimatedTime(`top_${granularity}`)} />
  }
  if (error && mode === 'top' && !topData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header + Filters */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Cross-Selling & Associations</h2>
            <p className="text-zinc-400">Quels produits sont achetés ensemble par vos clients ?</p>
          </div>
          <button
            onClick={() => setShowGuide(g => !g)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
            {showGuide ? 'Masquer le guide' : 'Comment ça marche ?'}
          </button>
        </div>

        {showGuide && (
          <div className="mb-6 p-6 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 space-y-5">
            <div>
              <h3 className="text-white font-bold text-base mb-2">À quoi sert ce module ?</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Ce module analyse tous les tickets de caisse pour trouver quels produits (ou familles de produits) sont <strong className="text-zinc-200">régulièrement achetés ensemble</strong> dans un même panier.
                L'objectif : identifier les associations fortes pour optimiser le merchandising, le placement en magasin, ou les recommandations commerciales.
                Par exemple, si SOL et PEINTURE se retrouvent souvent dans le même ticket, ça peut justifier de les rapprocher en rayon ou de proposer l'un quand un client achète l'autre.
              </p>
            </div>

            <div className="border-t border-zinc-700/50 pt-4">
              <h3 className="text-white font-bold text-base mb-3">Les 3 indicateurs expliqués</h3>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-900/50">
                  <div className="text-pink-400 font-bold text-sm mb-1">Force du lien (Lift)</div>
                  <p className="text-sm text-zinc-400 mb-2">
                    Cet indicateur mesure si deux produits sont achetés ensemble <strong className="text-zinc-200">plus souvent que le hasard ne le prédirait</strong>.
                  </p>
                  <div className="text-sm text-zinc-400 mb-2">
                    <strong className="text-zinc-300">Calcul :</strong> on compare la fréquence réelle de la paire dans les tickets, avec la fréquence qu'on obtiendrait si les achats étaient totalement indépendants.
                  </div>
                  <div className="text-sm text-zinc-400 bg-zinc-800/80 rounded-lg p-3">
                    <strong className="text-zinc-200">Exemple concret :</strong> SOL apparaît dans 20% des tickets, PEINTURE dans 10%. Si les achats étaient au hasard, on trouverait les deux ensemble dans 2% des tickets (20% × 10%). Mais en réalité ils apparaissent ensemble dans 6% des tickets → le Lift est de <strong className="text-emerald-400">3x</strong> (6% ÷ 2%). Ça veut dire qu'ils sont achetés ensemble <strong className="text-zinc-200">3 fois plus souvent que la normale</strong>.
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    <span className="text-emerald-400">≥ 5x</span> = très forte association · <span className="text-green-400">≥ 2x</span> = bonne association · <span className="text-yellow-400">≥ 1.2x</span> = légère · <span className="text-zinc-500">{'< 1.2x'}</span> = pas significatif
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/50">
                  <div className="text-pink-400 font-bold text-sm mb-1">Confiance (%)</div>
                  <p className="text-sm text-zinc-400 mb-2">
                    Parmi tous les tickets qui contiennent le produit A, quel <strong className="text-zinc-200">pourcentage contient aussi le produit B</strong> ?
                  </p>
                  <p className="text-sm text-zinc-400 mb-2">
                    Ce calcul dépend du sens : la confiance en partant de A n'est pas la même qu'en partant de B, parce que A et B ne sont pas vendus autant l'un que l'autre.
                  </p>
                  <div className="text-sm text-zinc-400 bg-zinc-800/80 rounded-lg p-3 space-y-2">
                    <div><strong className="text-zinc-200">Exemple avec des familles :</strong> PEINTURE apparaît dans 1 000 tickets, SOL dans 500. Ils sont ensemble dans 200 tickets.</div>
                    <div>· En partant de PEINTURE : 200 / 1 000 = <strong className="text-zinc-200">20%</strong> des acheteurs de PEINTURE prennent aussi du SOL</div>
                    <div>· En partant de SOL : 200 / 500 = <strong className="text-zinc-200">40%</strong> des acheteurs de SOL prennent aussi de la PEINTURE</div>
                    <div className="pt-1"><strong className="text-zinc-200">C'est pareil pour un produit spécifique :</strong> un pot de peinture Dulux 10L est dans 80 tickets, un rouleau Nespoli dans 300 tickets, et on les trouve ensemble dans 30 tickets.</div>
                    <div>· En partant du pot : 30 / 80 = <strong className="text-zinc-200">37%</strong> de ceux qui achètent le pot prennent aussi le rouleau</div>
                    <div>· En partant du rouleau : 30 / 300 = <strong className="text-zinc-200">10%</strong> de ceux qui achètent le rouleau prennent aussi le pot</div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">On affiche la valeur la plus haute des deux, car c'est elle qui montre le lien le plus fort.</div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/50">
                  <div className="text-pink-400 font-bold text-sm mb-1">Tickets ensemble & CA</div>
                  <p className="text-sm text-zinc-400 mb-2">
                    <strong className="text-zinc-200">Tickets ensemble</strong> : le nombre de tickets de caisse où les deux produits apparaissent dans le même panier.
                  </p>
                  <p className="text-sm text-zinc-400">
                    <strong className="text-zinc-200">CA généré</strong> : le chiffre d'affaires total de ces deux produits sur l'ensemble de ces tickets. C'est le CA cumulé des deux produits à chaque fois qu'ils sont vendus ensemble.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-700/50 pt-4">
              <h3 className="text-white font-bold text-base mb-2">Les 3 modes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-zinc-400">
                <div className="p-3 rounded-xl bg-zinc-900/50">
                  <div className="text-zinc-200 font-semibold mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Top Associations</div>
                  Affiche automatiquement les paires de produits avec les liens les plus forts. Utile pour découvrir des associations auxquelles on n'aurait pas pensé.
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/50">
                  <div className="text-zinc-200 font-semibold mb-1 flex items-center gap-1"><Search className="w-3 h-3" /> Recherche</div>
                  Tapez un produit ou une famille et voyez avec quoi il se vend le plus. Par exemple : "avec quoi se vend la PEINTURE ?".
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/50">
                  <div className="text-zinc-200 font-semibold mb-1 flex items-center gap-1"><ArrowLeftRight className="w-3 h-3" /> Comparer</div>
                  Comparez deux paires de produits : est-ce que SOL + PEINTURE s'associent mieux que SOL + TEXTILE ? Utile pour arbitrer entre deux stratégies de cross-selling.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Row 1: Mode tabs */}
        <div className="flex gap-2 mb-4">
          {([
            { id: 'top' as Mode, label: 'Top Associations', icon: TrendingUp },
            { id: 'search' as Mode, label: 'Recherche', icon: Search },
            { id: 'compare' as Mode, label: 'Comparer A+B vs C+D', icon: ArrowLeftRight },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); trackFilter('crossSelling', { mode: m.id }) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                mode === m.id
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Row 2: Granularité */}
        <div>
          <label className="block text-xs text-zinc-400 font-semibold uppercase mb-2">Niveau d'analyse</label>
          <div className="flex gap-2 flex-wrap">
              {[
                { key: 'famille' as const, label: 'Familles' },
                { key: 'sous_famille' as const, label: 'Sous-Familles' },
                { key: 'sous_sous_famille' as const, label: 'Sous²-Familles' },
                { key: 'sous_sous_sous_famille' as const, label: 'Sous³-Familles' },
                { key: 'produit' as const, label: 'Produits' },
              ].map(g => (
                <button
                  key={g.key}
                  onClick={() => setGranularity(g.key)}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all ${
                    granularity === g.key
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

        {/* Row 3: Filtres intelligents */}
        <div>
          <label className="block text-xs text-zinc-400 font-semibold uppercase mb-2">Filtres</label>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setCrossSF(!crossSF)}
              className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                crossSF
                  ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/50'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              <span className={`w-3 h-3 rounded-full transition-all ${crossSF ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              Associations surprenantes
            </button>
            <button
              onClick={() => setExcludeCheap(!excludeCheap)}
              className={`px-3 py-1.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                excludeCheap
                  ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/50'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              <span className={`w-3 h-3 rounded-full transition-all ${excludeCheap ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
              Exclure petits articles
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            {crossSF ? '✓ Masque les paires évidentes (même sous-famille)' : '○ Toutes les paires, y compris triviales'}
            {' · '}
            {excludeCheap ? '✓ Exclut les articles sous le prix moyen de leur sous-famille' : '○ Tous les articles, même petits'}
          </p>
        </div>

        </div>

      {/* ═══ MODE: TOP ASSOCIATIONS ═══ */}
      {mode === 'top' && topData && (
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-pink-400" />
              <h3 className="text-xl font-bold text-white">Top Associations par {{ famille: 'Famille', sous_famille: 'Sous-Famille', sous_sous_famille: 'Sous²-Famille', sous_sous_sous_famille: 'Sous³-Famille', produit: 'Produit' }[granularity]}</h3>
              <span className="text-sm text-zinc-500">{topData.totalTickets?.toLocaleString('fr-FR')} tickets</span>
            </div>
          </div>

          {/* Sort headers */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-800 mb-2">
            <div className="col-span-4">Paire de produits</div>
            <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('lift')}>
              Force du lien <SortIcon k="lift" />
            </div>
            <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('confidenceAB')}>
              Confiance <SortIcon k="confidenceAB" />
            </div>
            <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('count')}>
              Tickets ensemble <SortIcon k="count" />
            </div>
            <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('totalCA')}>
              CA généré <SortIcon k="totalCA" />
            </div>
          </div>

          <div className="space-y-2">
            {sortedAssociations.map((a: any, idx: number) => (
              <div key={idx} className={`grid grid-cols-1 lg:grid-cols-12 gap-2 items-center p-4 rounded-2xl border transition-all hover:scale-[1.005] ${getLiftBg(a.lift)}`}>
                <div className="lg:col-span-4 flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pink-500/20 text-pink-400 font-bold text-xs shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white block truncate">{a.itemA}</span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <span className="text-pink-400">+</span> <span className="truncate">{a.itemB}</span>
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <span className={`text-lg font-black ${getLiftColor(a.lift)}`}>{a.lift}x</span>
                  <span className="text-[10px] text-zinc-500 ml-1">plus que la normale</span>
                </div>
                <div className="lg:col-span-2">
                  <span className="text-sm text-white font-semibold">{Math.max(a.confidenceAB, a.confidenceBA)}%</span>
                  <span className="text-[10px] text-zinc-500 ml-1">des acheteurs de l'un prennent l'autre</span>
                </div>
                <div className="lg:col-span-2">
                  <span className="text-sm text-zinc-300">{a.count.toLocaleString('fr-FR')}</span>
                  <span className="text-[10px] text-zinc-500 ml-1">tickets</span>
                </div>
                <div className="lg:col-span-2">
                  <div className="text-sm text-emerald-400 font-semibold">{formatEuro(a.totalCA)}</div>
                  <div className="text-[10px] text-zinc-500">{formatEuro(a.avgCA)} moy/ticket</div>
                </div>
              </div>
            ))}
          </div>

          {sortedAssociations.length === 0 && (
            <div className="text-center py-12 text-zinc-500">Aucune association trouvée avec ces critères</div>
          )}
        </div>
      )}

      {/* ═══ MODE: SEARCH ═══ */}
      {mode === 'search' && (
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-6 h-6 text-pink-400" />
            <h3 className="text-xl font-bold text-white">Avec quoi se vend... ?</h3>
          </div>

          <div className="flex gap-3 mb-6" ref={searchRef}>
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); doAutocomplete(e.target.value) }}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder={{ famille: 'Tapez un nom de famille (ex: SOL, PEINTURE...)', sous_famille: 'Tapez un nom de sous-famille...', sous_sous_famille: 'Tapez un nom de sous-sous-famille...', sous_sous_sous_famille: 'Tapez un nom de sous-sous-sous-famille...', produit: 'Tapez un code produit ou designation...' }[granularity]}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setSearchResults(null); setSuggestions([]) }} className="absolute right-3 top-3 text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                  {suggestions.map((s: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => { setSearchTerm(s.name); setShowSuggestions(false); doSearch(s.name) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 flex items-center justify-between"
                    >
                      <span className="text-sm text-white truncate">{s.name}</span>
                      <span className="text-xs text-zinc-500 ml-2 shrink-0">{{ famille: 'Famille', sous_famille: 'Sous-Famille', sous_sous_famille: 'Sous²-Famille', sous_sous_sous_famille: 'Sous³-Famille', produit: 'Produit' }[s.level as string] || s.level}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => doSearch()}
              disabled={searchLoading || !searchTerm.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {searchLoading ? '...' : 'Rechercher'}
            </button>
          </div>

          {searchLoading && (
            <LoadingTimer estimatedMs={getEstimatedTime(`search_${granularity}`)} />
          )}

          {searchResults && !searchLoading && (
            <>
              <div className="mb-4 text-sm text-zinc-400">
                Résultats pour <span className="text-white font-semibold">"{searchResults.searchTerm}"</span>
                <span className="ml-2">· {searchResults.companions?.length || 0} associations trouvées</span>
                <span className="ml-2">· {searchResults.totalTickets?.toLocaleString('fr-FR')} tickets analysés</span>
              </div>
              <div className="space-y-2">
                {(searchResults.companions || []).map((c: any, idx: number) => (
                  <div key={idx} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${getLiftBg(c.lift)}`}>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pink-500/20 text-pink-400 font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white truncate block">{c.item}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm shrink-0">
                      <div className="text-center">
                        <div className={`text-lg font-black ${getLiftColor(c.lift)}`}>{c.lift}x</div>
                        <div className="text-[10px] text-zinc-500">plus que la normale</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white font-semibold">{c.confidence}%</div>
                        <div className="text-[10px] text-zinc-500">des acheteurs prennent les 2</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white">{c.count.toLocaleString('fr-FR')}</div>
                        <div className="text-[10px] text-zinc-500">tickets ensemble</div>
                      </div>
                      <div className="text-center">
                        <div className="text-emerald-400 font-semibold">{formatEuro(c.totalCA)}</div>
                        <div className="text-[10px] text-zinc-500">CA généré</div>
                      </div>
                    </div>
                  </div>
                ))}
                {(searchResults.companions || []).length === 0 && (
                  <div className="text-center py-12 text-zinc-500">Aucune association trouvée pour ce terme</div>
                )}
              </div>
            </>
          )}

          {!searchResults && !searchLoading && (
            <div className="text-center py-16 text-zinc-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Recherchez une famille, sous-famille ou un produit pour voir avec quoi il se vend le plus</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ MODE: COMPARE ═══ */}
      {mode === 'compare' && (
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-6">
            <ArrowLeftRight className="w-6 h-6 text-pink-400" />
            <h3 className="text-xl font-bold text-white">Comparer deux paires</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Pair A */}
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
              <div className="text-sm font-bold text-blue-400 mb-3">Paire A</div>
              <input
                value={compareA1}
                onChange={e => setCompareA1(e.target.value)}
                placeholder={{ famille: 'Famille A1 (ex: SOL)', sous_famille: 'Sous-famille A1', sous_sous_famille: 'Sous²-famille A1', sous_sous_sous_famille: 'Sous³-famille A1', produit: 'Produit A1' }[granularity]}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm mb-2 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="text-center text-blue-400 text-xs font-bold my-1">+</div>
              <input
                value={compareA2}
                onChange={e => setCompareA2(e.target.value)}
                placeholder={{ famille: 'Famille A2 (ex: PEINTURE)', sous_famille: 'Sous-famille A2', sous_sous_famille: 'Sous²-famille A2', sous_sous_sous_famille: 'Sous³-famille A2', produit: 'Produit A2' }[granularity]}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            {/* Pair B */}
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
              <div className="text-sm font-bold text-purple-400 mb-3">Paire B</div>
              <input
                value={compareB1}
                onChange={e => setCompareB1(e.target.value)}
                placeholder={{ famille: 'Famille B1 (ex: TEXTILE)', sous_famille: 'Sous-famille B1', sous_sous_famille: 'Sous²-famille B1', sous_sous_sous_famille: 'Sous³-famille B1', produit: 'Produit B1' }[granularity]}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm mb-2 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <div className="text-center text-purple-400 text-xs font-bold my-1">+</div>
              <input
                value={compareB2}
                onChange={e => setCompareB2(e.target.value)}
                placeholder={{ famille: 'Famille B2 (ex: ECLAIRAGE)', sous_famille: 'Sous-famille B2', sous_sous_famille: 'Sous²-famille B2', sous_sous_sous_famille: 'Sous³-famille B2', produit: 'Produit B2' }[granularity]}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={doCompare}
            disabled={compareLoading || !compareA1.trim() || !compareA2.trim() || !compareB1.trim() || !compareB2.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all mb-6"
          >
            {compareLoading ? 'Analyse en cours...' : 'Comparer les deux paires'}
          </button>

          {compareLoading && (
            <LoadingTimer estimatedMs={getEstimatedTime(`compare_${granularity}`)} />
          )}

          {compareResults && !compareLoading && (
            <div className="space-y-4">
              {/* Winner banner */}
              {compareResults.winner !== 'equal' && (
                <div className={`p-4 rounded-2xl border text-center ${
                  compareResults.winner === 'A' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-purple-500/10 border-purple-500/30'
                }`}>
                  <Zap className={`w-6 h-6 mx-auto mb-1 ${compareResults.winner === 'A' ? 'text-blue-400' : 'text-purple-400'}`} />
                  <div className="text-white font-bold">
                    La Paire {compareResults.winner} a un Lift plus fort !
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Lien {compareResults.winner === 'A' ? compareResults.pairA.lift : compareResults.pairB.lift}x 
                    vs {compareResults.winner === 'A' ? compareResults.pairB.lift : compareResults.pairA.lift}x — ces produits sont plus souvent achetés ensemble
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { label: 'Paire A', data: compareResults.pairA, color: 'blue' },
                  { label: 'Paire B', data: compareResults.pairB, color: 'purple' }
                ].map(({ label, data: pd, color }) => (
                  <div key={label} className={`p-5 rounded-2xl border ${
                    color === 'blue' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'
                  }`}>
                    <div className={`text-sm font-bold mb-3 ${color === 'blue' ? 'text-blue-400' : 'text-purple-400'}`}>
                      {label}: {pd.items[0]} + {pd.items[1]}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-zinc-500 text-xs">Force du lien</div>
                        <div className={`text-xl font-black ${getLiftColor(pd.lift)}`}>{pd.lift}x</div>
                        <div className="text-[10px] text-zinc-500">plus que la normale</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs">Confiance</div>
                        <div className="text-white font-semibold">{Math.max(pd.confidenceXY, pd.confidenceYX)}%</div>
                        <div className="text-[10px] text-zinc-500">des acheteurs prennent les 2</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs">Tickets ensemble</div>
                        <div className="text-white">{pd.count.toLocaleString('fr-FR')}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs">CA généré</div>
                        <div className="text-emerald-400 font-semibold">{formatEuro(pd.totalCA)}</div>
                        <div className="text-[10px] text-zinc-500">{formatEuro(pd.avgCA)} moy/ticket</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!compareResults && !compareLoading && (
            <div className="text-center py-12 text-zinc-500">
              <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Remplissez les 4 champs et lancez la comparaison</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
