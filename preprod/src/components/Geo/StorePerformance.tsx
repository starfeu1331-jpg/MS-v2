import { useState, useEffect, Suspense, useCallback, Fragment } from 'react'
import { ArrowLeft, ChevronUp, ChevronDown, ChevronRight, Store, Users, ShoppingCart, CreditCard, Heart, TrendingDown, MapPin, BarChart3, Download, Maximize2 } from 'lucide-react'
import {
  LazyBarChart as BarChart, LazyBar as Bar,
  LazyLineChart as LineChart, LazyLine as Line,
  LazyPieChart as PieChart, LazyPie as Pie,
  LazyXAxis as XAxis, LazyYAxis as YAxis,
  LazyCartesianGrid as CartesianGrid, LazyTooltip as RTooltip,
  LazyResponsiveContainer as ResponsiveContainer, LazyCell as Cell,
  LazyLegend as Legend,
  ChartFallback
} from '../../utils/lazyRecharts'
import { trackPageView } from '../../services/tracker'

/* ── Config ── */
const API = import.meta.env.VITE_API_URL || ''
const CACHE_TTL = 5 * 60 * 1000
const oCache: Record<string, { d: any; t: number }> = {}
const dCache: Record<string, { d: any; t: number }> = {}

const pq = (p?: { type: string; value: number | string }) =>
  !p || p.type === 'all' ? '' : `&periodType=${encodeURIComponent(p.type)}&periodValue=${encodeURIComponent(p.value)}`
const ck = (pfx: string, p?: { type: string; value: number | string }, x = '') =>
  `${pfx}_${p?.type || 'a'}_${p?.value || 'a'}${x}`

const f = {
  eur: (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M€` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k€` : `${Math.round(v)}€`,
  eurF: (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`,
  num: (v: number) => v.toLocaleString('fr-FR'),
  pct: (v: number) => `${v.toFixed(1)}%`,
}

const ZONE_LABELS: Record<string, string> = { S: 'SUD', N: 'NORD', Autre: 'AUTRE' }
const UNIVERS_COLORS: Record<string, string> = { Mur: '#3b82f6', Sol: '#10b981', Ameublement: '#f59e0b' }
const RFM_COLORS: Record<string, string> = {
  'Ultra Champions': '#fbbf24', Champions: '#f59e0b', Loyaux: '#10b981',
  Potentiels: '#3b82f6', Nouveaux: '#8b5cf6', 'À Risque': '#f97316',
  Occasionnels: '#6b7280', 'En Danger': '#ef4444', Perdus: '#991b1b', 'Non classé': '#52525b',
}
const JOUR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']

const SF_SHORT: Record<string, string> = {
  'Accessoires Mur': 'Acc. Mur', 'Décors muraux': 'Déc. Muraux', Peinture: 'Peinture',
  'Accessoires Sol': 'Acc. Sol', Dalles: 'Dalles', Gazon: 'Gazon',
  Moquette: 'Moquette', PVC: 'PVC', 'Stratifié': 'Stratifié', Tapis: 'Tapis',
  'Accessoires AM': 'Acc. AM', 'Métrage': 'Métrage', Nappage: 'Nappage', 'Rideau voilage': 'PAP',
}
const SF_ORDER: Record<string, string[]> = {
  Mur: ['Peinture', 'Décors muraux', 'Accessoires Mur'],
  Sol: ['Tapis', 'PVC', 'Moquette', 'Accessoires Sol', 'Stratifié', 'Dalles', 'Gazon'],
  Ameublement: ['Accessoires AM', 'Rideau voilage', 'Métrage', 'Nappage'],
}

const TT_STYLE = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', color: '#fff', fontSize: 12, padding: '8px 12px' }

/* ── Evo badge (exactly like Dashboard) ── */
function Evo({ v, sm }: { v: number | null | undefined; sm?: boolean }) {
  if (v == null || isNaN(v as number)) return <span className="text-zinc-600">—</span>
  const pos = v > 0
  const neg = v < 0
  return (
    <span className={`inline-flex items-center gap-0.5 ${sm ? 'text-[10px]' : 'text-xs'} font-semibold ${pos ? 'text-emerald-400' : neg ? 'text-red-400' : 'text-zinc-400'}`}>
      {pos ? '↑' : neg ? '↓' : ''} {pos ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

/* ── Loading ── */
function Spinner() {
  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center gap-4 skel-breath">
        <div className="w-12 h-12 bg-zinc-800 rounded-2xl" />
        <div><div className="h-6 w-40 bg-zinc-800 rounded-lg mb-2" /><div className="h-3 w-28 bg-zinc-800/60 rounded" /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <div key={i} className={`rounded-2xl p-5 border border-zinc-800 bg-zinc-900/50 skel-breath skel-d${i+1}`}><div className="h-3 w-16 bg-zinc-800 rounded mb-2" /><div className="h-6 w-20 bg-zinc-800 rounded-lg" /></div>)}
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden skel-breath skel-d2">
        <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50"><div className="h-5 w-28 bg-zinc-700 rounded-lg" /></div>
        <div className="p-6 space-y-3">{[0,1,2,3,4,5,6,7].map(i => <div key={i} className="h-12 bg-zinc-800/40 rounded-lg" />)}</div>
      </div>
    </div>
  )
}

/* ── View configuration ── */
export type StoreView = 'essentiel' | 'complet' | 'pdf'
export interface StoreViewColumns {
  ca: boolean; clients: boolean; pm: boolean; tickets: boolean; fidelite: boolean
  rang: boolean; univers: boolean; universPM: boolean; universTck: boolean; sousFamilles: boolean
}
export interface StoreViewConfig { view: StoreView; columns: StoreViewColumns }
export const VIEW_PRESETS: Record<StoreView, StoreViewColumns> = {
  essentiel: { ca: true, clients: true, pm: true, tickets: false, fidelite: false, rang: false, univers: false, universPM: false, universTck: false, sousFamilles: false },
  complet: { ca: true, clients: true, pm: true, tickets: true, fidelite: true, rang: true, univers: true, universPM: false, universTck: false, sousFamilles: false },
  pdf: { ca: true, clients: true, pm: true, tickets: true, fidelite: true, rang: true, univers: true, universPM: true, universTck: true, sousFamilles: true },
}
export const DEFAULT_VIEW_CONFIG: StoreViewConfig = { view: 'essentiel', columns: { ...VIEW_PRESETS.essentiel } }

/* ══════════════════════════════ MAIN ══════════════════════════════ */
interface StorePerformanceProps {
  period?: { type: string; value: number | string; label?: string }
  navigate?: (path: string) => void
  viewConfig?: StoreViewConfig
  subPath?: string
}

export default function StorePerformance({ period, navigate, viewConfig = DEFAULT_VIEW_CONFIG, subPath }: StorePerformanceProps) {
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStore, setExpandedStore] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<string | null>(subPath || null)
  const [detail, setDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'general' | 'Mur' | 'Sol' | 'Ameublement'>('general')
  const [sortKey, setSortKey] = useState<string>('rang_societe')
  const [sortAsc, setSortAsc] = useState(true)

  /* ── Fetch overview ── */
  useEffect(() => {
    const k = ck('o', period)
    const c = oCache[k]
    if (c && Date.now() - c.t < CACHE_TTL) { setOverview(c.d); setLoading(false); return }
    setLoading(true); setError(null)
    fetch(`${API}/api/stores?action=overview${pq(period)}`)
      .then(r => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.json() })
      .then(d => { oCache[k] = { d, t: Date.now() }; setOverview(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    trackPageView('stores')
  }, [period?.type, period?.value])

  /* ── Fetch detail ── */
  const loadDetail = useCallback((code: string) => {
    setSelectedStore(code); setErrorDetail(null); setDetailTab('general')
    navigate?.(`/stores/${code}`)
    const k = ck('d', period, `_${code}`)
    const c = dCache[k]
    if (c && Date.now() - c.t < CACHE_TTL) { setDetail(c.d); setLoadingDetail(false); return }
    setLoadingDetail(true)
    fetch(`${API}/api/stores?action=detail&storeCode=${encodeURIComponent(code)}${pq(period)}`)
      .then(r => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.json() })
      .then(d => { dCache[k] = { d, t: Date.now() }; setDetail(d) })
      .catch(e => setErrorDetail(e.message))
      .finally(() => setLoadingDetail(false))
  }, [period?.type, period?.value])

  useEffect(() => { if (selectedStore) loadDetail(selectedStore) }, [loadDetail])

  const handleSort = (k: string) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k === 'rang_societe') }
  }

  /* ═══════════════════════ DETAIL VIEW ═══════════════════════ */
  if (selectedStore) {
    if (loadingDetail) return <Spinner />
    if (errorDetail) return (
      <div className="space-y-6 p-4 md:p-6">
        <button onClick={() => { setSelectedStore(null); setDetail(null); navigate?.('/stores') }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour aux magasins
        </button>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 text-red-500 mx-auto mb-4"><Store className="w-14 h-14" /></div>
          <p className="text-xl font-bold text-white mb-2">Erreur</p>
          <p className="text-zinc-400 text-sm mb-4">{errorDetail}</p>
          <button onClick={() => loadDetail(selectedStore!)} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-sm font-medium transition-colors">Réessayer</button>
        </div>
      </div>
    )
    if (!detail) return null

    const { magasin: mag, stats: s, sous_familles: sf, stats_reseau: sr, has_n1: hn1, evolution, rfm_distribution, top_clients, top_zones, jours_semaine } = detail

    return (
      <div className="space-y-6 p-4 md:p-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedStore(null); setDetail(null); navigate?.('/stores') }}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{mag.nom}</h2>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <MapPin className="w-3.5 h-3.5" />{mag.ville}{mag.cp ? ` (${mag.cp})` : ''}
              <span className="text-zinc-700">•</span>
              Zone {ZONE_LABELS[mag.zone] || mag.zone || '?'}
            </div>
          </div>
        </div>

        {/* KPI Cards (gradient, like Dashboard) */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Chiffre d\'affaires', value: f.eurF(s.ca_total), evo: s.evo_ca, gradient: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', Icon: CreditCard },
            { label: 'Clients', value: f.num(s.nb_clients), evo: s.evo_clients, gradient: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', Icon: Users },
            { label: 'Panier moyen', value: f.eurF(s.panier_moyen), evo: s.evo_pm, gradient: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', Icon: ShoppingCart },
            { label: 'Tickets', value: f.num(s.nb_transactions || 0), evo: null, gradient: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400', Icon: Store },
            { label: 'Fidélité', value: f.pct(s.taux_fidelite), evo: null, gradient: 'from-pink-500/20 to-pink-600/5', border: 'border-pink-500/30', iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400', Icon: Heart },
          ].map((kpi, i) => (
            <div key={i} className={`bg-gradient-to-br ${kpi.gradient} rounded-2xl p-4 border ${kpi.border} backdrop-blur-sm`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`p-1.5 ${kpi.iconBg} rounded-lg`}><kpi.Icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} /></span>
                <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide leading-tight">{kpi.label}</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-white">{kpi.value}</div>
              {kpi.evo != null && <div className="mt-1"><Evo v={kpi.evo} /></div>}
            </div>
          ))}
        </div>

        {/* Universe cards (3 columns, like Dashboard familles) */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { key: 'mur', label: 'Mur', gradient: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500' },
            { key: 'sol', label: 'Sol', gradient: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' },
            { key: 'ameub', label: 'Ameublement', gradient: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' },
          ] as const).map(u => {
            const ca = s[`ca_${u.key}`] || 0
            const pctCA = s.ca_total > 0 ? (ca / s.ca_total) * 100 : 0
            return (
              <button key={u.key}
                onClick={() => setDetailTab(u.label === 'Ameublement' ? 'Ameublement' : u.label as any)}
                className={`bg-gradient-to-br ${u.gradient} rounded-xl p-5 border ${u.border} text-left hover:scale-[1.02] transition-transform ${detailTab === (u.label === 'Mur' ? 'Mur' : u.label === 'Sol' ? 'Sol' : 'Ameublement') ? 'ring-2 ring-white/20' : ''}`}>
                <div className={`text-sm font-bold ${u.text} mb-3`}>{u.label}</div>
                <div className="text-2xl font-bold text-white mb-1">{f.pct(pctCA)}</div>
                <div className="text-xs text-zinc-400 mb-0.5">CA : {f.eurF(ca)}</div>
                {hn1 && <Evo v={s[`evo_${u.key}`]} sm />}
                <div className="mt-3 h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                  <div className={`h-full ${u.bar} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pctCA, 100)}%` }} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Tab pills (like Dashboard toggle) */}
        <div className="flex gap-1 bg-zinc-800 rounded-lg p-1 w-fit">
          {[
            { id: 'general' as const, label: 'Général' },
            { id: 'Mur' as const, label: 'Mur' },
            { id: 'Sol' as const, label: 'Sol' },
            { id: 'Ameublement' as const, label: 'Ameub.' },
          ].map(t => (
            <button key={t.id} onClick={() => setDetailTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${detailTab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >{t.label}</button>
          ))}
        </div>

        {/* Tab: Général */}
        {detailTab === 'general' && (
          <div className="space-y-6">
            {/* Evolution chart */}
            {evolution?.length > 0 && (
              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                <h3 className="text-lg font-bold text-white mb-6">Évolution mensuelle</h3>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={evolution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="mois" stroke="#52525b" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v: number) => f.eur(v)} stroke="#52525b" tick={{ fontSize: 12 }} />
                      <RTooltip formatter={(v: any, n: string) => [n === 'ca' ? f.eurF(v) : f.num(v), n === 'ca' ? 'CA' : n === 'clients' ? 'Clients' : 'Tickets']} contentStyle={TT_STYLE} />
                      <Line type="monotone" dataKey="ca" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="CA" />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </div>
            )}

            {/* RFM + Jours (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {rfm_distribution?.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4">Profil RFM</h3>
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={rfm_distribution} dataKey="nb_clients" nameKey="segment" cx="50%" cy="50%" outerRadius={85} innerRadius={40} paddingAngle={2}
                          label={({ segment, percent }: any) => percent > 0.06 ? `${segment}` : ''} labelLine={false}>
                          {rfm_distribution.map((e: any, i: number) => <Cell key={i} fill={RFM_COLORS[e.segment] || '#52525b'} />)}
                        </Pie>
                        <RTooltip formatter={(v: any, n: string) => [f.num(v), 'Clients']} contentStyle={TT_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Suspense>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {rfm_distribution.map((r: any) => (
                      <span key={r.segment} className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: RFM_COLORS[r.segment] || '#52525b' }} />{r.segment}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {jours_semaine?.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-4">Activité par jour</h3>
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={jours_semaine}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="jour" stroke="#52525b" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v: number) => f.eur(v)} stroke="#52525b" tick={{ fontSize: 12 }} />
                        <RTooltip formatter={(v: any, n: string) => [n === 'ca' ? f.eurF(v) : f.num(v), n === 'ca' ? 'CA' : 'Tickets']} contentStyle={TT_STYLE} />
                        <Bar dataKey="ca" barSize={32} radius={[6, 6, 0, 0]} name="CA">
                          {jours_semaine.map((_: any, i: number) => <Cell key={i} fill={JOUR_COLORS[i % JOUR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Suspense>
                </div>
              )}
            </div>

            {/* Top clients + Top zones (2 columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {top_clients?.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-purple-400" /> Top clients</h3>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">{top_clients.length}</span>
                  </div>
                  <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
                    {top_clients.map((c: any, i: number) => (
                      <button key={c.carte} onClick={() => navigate?.(`/search/client/${encodeURIComponent(c.carte)}`)}
                        className="w-full bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 hover:border-purple-500/50 transition-all group text-left flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                            {(c.prenom?.[0] || c.nom?.[0] || '?').toUpperCase()}
                          </div>
                          <span className="absolute -top-1 -left-1 bg-zinc-800 text-zinc-400 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-zinc-700">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate group-hover:text-purple-400 transition-colors">{c.prenom || ''} {c.nom || 'Anonyme'}</div>
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 truncate">
                            {c.ville || '—'}
                            {c.rfm_segment && <span className="inline-flex px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px] ml-1">{c.rfm_segment}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-bold text-white">{f.eurF(c.ca)}</div>
                          <div className="text-[10px] text-zinc-600">{c.nb_achats} achats</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-purple-400 transition-colors shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {top_zones?.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><MapPin className="w-5 h-5 text-green-400" /> Zones de chalandise</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">{top_zones.length}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate?.(`/zones/store/${mag.code}`) }}
                        className="p-1.5 bg-zinc-800 hover:bg-green-500/20 border border-zinc-700 hover:border-green-500/40 rounded-lg transition-all group/zc"
                        title="Voir toute la zone de chalandise"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-zinc-500 group-hover/zc:text-green-400 transition-colors" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-1.5">
                    {top_zones.map((z: any, i: number) => {
                      const max = top_zones[0]?.ca || 1
                      return (
                        <div key={z.cp} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">#{i + 1}</span>
                              <span className="text-sm font-medium text-white truncate group-hover:text-green-400 transition-colors">{z.ville}</span>
                              <span className="text-xs text-zinc-600 shrink-0">{z.cp}</span>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <span className="text-sm font-bold text-white">{f.eurF(z.ca)}</span>
                              <span className="text-xs text-zinc-500 ml-2">{f.num(z.nb_clients)} cl.</span>
                            </div>
                          </div>
                          <div className="ml-[28px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500" style={{ width: `${(z.ca / max) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Universe detail (Mur / Sol / Ameublement) */}
        {detailTab !== 'general' && sf && (() => {
          const uKey = detailTab === 'Ameublement' ? 'ameub' : detailTab.toLowerCase()
          const ca = s[`ca_${uKey}`] || 0
          const famData = sf[detailTab] || {}
          const ordered = (SF_ORDER[detailTab] || Object.keys(famData)).filter(k => famData[k])
          const maxSfCa = Math.max(...ordered.map(k => famData[k]?.ca || 0), 1)

          return (
            <div className="space-y-6">
              {/* Sub-family list (like Dashboard top produits) */}
              <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" style={{ color: UNIVERS_COLORS[detailTab] }} />
                    Sous-familles {detailTab}
                  </h3>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">{ordered.length} sous-familles</span>
                </div>
                <div className="p-6 space-y-3">
                  {ordered.map((sfKey, i) => {
                    const d = famData[sfKey]
                    const sfPM = d.nb_tickets > 0 ? d.ca / d.nb_tickets : 0
                    const pct = ca > 0 ? (d.ca / ca) * 100 : 0
                    return (
                      <div key={sfKey} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">#{i + 1}</span>
                            <span className="text-sm text-white font-medium truncate">{SF_SHORT[sfKey] || sfKey}</span>
                            <span className="text-[10px] text-zinc-600 shrink-0">{f.pct(pct)} du CA</span>
                          </div>
                          <div className="text-right shrink-0 ml-3 flex items-center gap-3">
                            <span className="text-sm font-bold text-white">{f.eurF(d.ca)}</span>
                            {hn1 && <Evo v={d.evo} sm />}
                            <span className="text-xs text-zinc-500">{f.num(d.nb_tickets)} tck</span>
                            <span className="text-xs text-zinc-600">PM {f.eurF(sfPM)}</span>
                          </div>
                        </div>
                        <div className="ml-[28px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(d.ca / maxSfCa) * 100}%`, background: `linear-gradient(to right, ${UNIVERS_COLORS[detailTab]}, ${UNIVERS_COLORS[detailTab]}99)` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Chart comparison */}
              {ordered.length > 0 && (
                <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
                  <h3 className="text-lg font-bold text-white mb-6">Comparaison {hn1 ? 'N / N-1' : ''}</h3>
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={Math.max(180, ordered.length * 38)}>
                      <BarChart data={ordered.map(k => ({ name: SF_SHORT[k] || k, ca: famData[k].ca, ca_n1: famData[k].ca_n1 || 0 }))} layout="vertical" margin={{ left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis type="number" tickFormatter={(v: number) => f.eur(v)} stroke="#52525b" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" width={90} stroke="#52525b" tick={{ fontSize: 11 }} />
                        <RTooltip formatter={(v: any) => [f.eurF(v), '']} contentStyle={TT_STYLE} />
                        <Bar dataKey="ca" fill={UNIVERS_COLORS[detailTab] || '#3b82f6'} radius={[0, 4, 4, 0]} name="Période" barSize={hn1 ? 12 : 18} />
                        {hn1 && <Bar dataKey="ca_n1" fill="#3f3f46" radius={[0, 4, 4, 0]} name="N-1" barSize={12} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </Suspense>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  /* ═══════════════════════ OVERVIEW ═══════════════════════ */
  if (loading) return <Spinner />
  if (error) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 text-red-500 mx-auto mb-4"><Store className="w-14 h-14" /></div>
      <p className="text-xl font-bold text-white mb-2">Erreur de chargement</p>
      <p className="text-zinc-400 text-sm mb-4">{error}</p>
      <button onClick={() => window.location.reload()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-sm font-medium transition-colors">Réessayer</button>
    </div>
  )
  if (!overview?.magasins?.length) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Store className="w-14 h-14 text-zinc-600 mb-4" />
      <p className="text-xl font-bold text-white mb-2">Aucune donnée</p>
      <p className="text-zinc-400 text-sm">Aucun magasin trouvé pour cette période.</p>
    </div>
  )

  const { magasins, stats_reseau: sr, zone_totals: zt, has_n1: hasN1 } = overview

  /* Sort */
  const getVal = (m: any, k: string) => {
    const v = m.stats[k]
    if (v == null) return k.startsWith('evo_') ? -9999 : 0
    return v
  }
  const sorted = [...magasins].sort((a: any, b: any) => {
    const va = getVal(a, sortKey), vb = getVal(b, sortKey)
    return sortAsc ? va - vb : vb - va
  })
  const zoneOrder = ['S', 'N', 'Autre']
  const grouped: Record<string, any[]> = {}
  sorted.forEach((m: any) => { const z = m.zone || 'Autre'; if (!grouped[z]) grouped[z] = []; grouped[z].push(m) })

  const maxCA = Math.max(...magasins.map((m: any) => m.stats.ca_total || 0), 1)

  /* ── PDF Export ── */
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()

    const periodLabel = period?.label || (period?.type === 'week' ? `S${period.value}` : period?.type === 'month' ? `Mois ${period.value}` : period?.type === 'cumul_month' ? `Cumul ${period.value}` : 'Toutes périodes')
    const title = `DÉCOR DISCOUNT — ${periodLabel}`
    const fE = (v: number) => v != null ? v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '—'
    const fN = (v: number) => v != null ? v.toLocaleString('fr-FR') : '—'
    const fP = (v: number) => v != null && !isNaN(v) ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : '—'

    // Helper: build rows for one "page" (univers section)
    const buildRows = (univers?: 'mur' | 'sol' | 'ameub') => {
      const rows: any[][] = []
      const rowStyles: Record<number, any> = {}

      const makeRow = (label: string, s: any, n1: any, isTotal?: boolean) => {
        if (!univers) {
          return [
            label,
            fE(s.ca_total), n1 ? fE(n1.ca_total ?? s.ca_n1) : '—', fP(s.evo_ca),
            fN(s.nb_clients), n1 ? fN(n1.nb_clients ?? s.nb_clients_n1) : '—', fP(s.evo_clients),
            fE(s.panier_moyen), n1 ? fE(n1.panier_moyen ?? s.panier_moyen_n1) : '—', fP(s.evo_pm),
            fE(s.ca_mur), fP(s.evo_mur), fN(s.nb_tickets_mur), fP(s.evo_tickets_mur),
            fE(s.ca_sol), fP(s.evo_sol), fN(s.nb_tickets_sol), fP(s.evo_tickets_sol),
            fE(s.ca_ameub), fP(s.evo_ameub), fN(s.nb_tickets_ameub), fP(s.evo_tickets_ameub),
          ]
        }
        const u = univers
        const sfData = s.sous_familles?.[{ mur: 'Mur', sol: 'Sol', ameub: 'Ameublement' }[u]] || {}
        const sfOrder = SF_ORDER[{ mur: 'Mur', sol: 'Sol', ameub: 'Ameublement' }[u]] || []
        const row = [
          label,
          fE(s[`ca_${u}`]), fP(s[`evo_${u}`]),
          fN(s[`nb_tickets_${u}`]), fP(s[`evo_tickets_${u}`]),
          fE(s[`pm_${u}`]), fP(s[`evo_pm_${u}`]),
        ]
        sfOrder.forEach(sfKey => {
          const d = sfData[sfKey]
          row.push(d ? fE(d.ca) : '—', d?.evo != null ? fP(d.evo) : '—')
        })
        return row
      }

      // Société line
      const societeStats = {
        ca_total: sr.ca_total, nb_clients: sr.nb_clients_total, panier_moyen: sr.panier_moyen,
        nb_factures: sr.nb_factures_total, taux_fidelite: sr.taux_fidelite,
        ca_mur: sr.ca_mur || 0, ca_sol: sr.ca_sol || 0, ca_ameub: sr.ca_ameub || 0,
        evo_ca: sr.evo_ca, evo_clients: sr.evo_clients, evo_pm: sr.evo_pm,
        evo_mur: sr.evo_mur, evo_sol: sr.evo_sol, evo_ameub: sr.evo_ameub,
        nb_tickets_mur: sr.nb_tickets_mur || 0, nb_tickets_sol: sr.nb_tickets_sol || 0, nb_tickets_ameub: sr.nb_tickets_ameub || 0,
        evo_tickets_mur: sr.evo_tickets_mur, evo_tickets_sol: sr.evo_tickets_sol, evo_tickets_ameub: sr.evo_tickets_ameub,
        pm_mur: sr.pm_mur || 0, pm_sol: sr.pm_sol || 0, pm_ameub: sr.pm_ameub || 0,
        evo_pm_mur: sr.evo_pm_mur, evo_pm_sol: sr.evo_pm_sol, evo_pm_ameub: sr.evo_pm_ameub,
        sous_familles: {},
      }
      rows.push(makeRow('SOCIÉTÉ', societeStats, null))
      rowStyles[rows.length - 1] = { fillColor: [30, 64, 80], textColor: [255, 255, 255], fontStyle: 'bold' }

      // Moyenne line
      const n = magasins.length || 1
      const moyStats = { ...societeStats }
      const numericKeys = ['ca_total', 'nb_clients', 'nb_factures', 'ca_mur', 'ca_sol', 'ca_ameub', 'nb_tickets_mur', 'nb_tickets_sol', 'nb_tickets_ameub'] as const
      numericKeys.forEach(k => { (moyStats as any)[k] = (societeStats as any)[k] / n })
      rows.push(makeRow('MOYENNE', moyStats, null))
      rowStyles[rows.length - 1] = { fillColor: [50, 50, 55], textColor: [200, 200, 200], fontStyle: 'italic' }

      // Per zone
      zoneOrder.filter(z => grouped[z]?.length).forEach(zone => {
        const zLabel = ZONE_LABELS[zone] || zone
        if (zt?.[zone]) {
          const zs = {
            ...zt[zone],
            nb_clients: zt[zone].nb_clients || 0,
            evo_ca: zt[zone].evo_ca, evo_clients: zt[zone].evo_clients, evo_pm: zt[zone].evo_pm,
            evo_mur: zt[zone].evo_mur, evo_sol: zt[zone].evo_sol, evo_ameub: zt[zone].evo_ameub,
            nb_tickets_mur: zt[zone].nb_tickets_mur || 0, nb_tickets_sol: zt[zone].nb_tickets_sol || 0, nb_tickets_ameub: zt[zone].nb_tickets_ameub || 0,
            evo_tickets_mur: zt[zone].evo_tickets_mur, evo_tickets_sol: zt[zone].evo_tickets_sol, evo_tickets_ameub: zt[zone].evo_tickets_ameub,
            pm_mur: zt[zone].pm_mur || 0, pm_sol: zt[zone].pm_sol || 0, pm_ameub: zt[zone].pm_ameub || 0,
            evo_pm_mur: zt[zone].evo_pm_mur, evo_pm_sol: zt[zone].evo_pm_sol, evo_pm_ameub: zt[zone].evo_pm_ameub,
            sous_familles: {},
          }
          rows.push(makeRow(zLabel, zs, null))
          rowStyles[rows.length - 1] = { fillColor: [40, 40, 45], textColor: [100, 210, 200], fontStyle: 'bold' }
        }
        grouped[zone].forEach((m: any) => {
          rows.push(makeRow(m.nom.replace('Décor Discount ', ''), m.stats, null))
        })
      })

      return { rows, rowStyles }
    }

    // ── Page 1: Global + overview ──
    const globalHeaders = [
      [
        { content: '', colSpan: 1 },
        { content: 'CHIFFRE D\'AFFAIRES', colSpan: 3, styles: { halign: 'center', fillColor: [16, 185, 129] } },
        { content: 'CLIENTS', colSpan: 3, styles: { halign: 'center', fillColor: [59, 130, 246] } },
        { content: 'PANIER MOYEN', colSpan: 3, styles: { halign: 'center', fillColor: [245, 158, 11] } },
        { content: 'MUR', colSpan: 4, styles: { halign: 'center', fillColor: [59, 130, 246] } },
        { content: 'SOL', colSpan: 4, styles: { halign: 'center', fillColor: [16, 185, 129] } },
        { content: 'AMEUBLEMENT', colSpan: 4, styles: { halign: 'center', fillColor: [245, 158, 11] } },
      ],
      ['', 'Réel', 'N-1', 'Évo', 'Réel', 'N-1', 'Évo', 'Réel', 'N-1', 'Évo',
       'CA', 'Évo', 'Tck', 'Évo', 'CA', 'Évo', 'Tck', 'Évo', 'CA', 'Évo', 'Tck', 'Évo']
    ]
    const { rows: globalRows, rowStyles: globalStyles } = buildRows()

    doc.setFontSize(14)
    doc.setTextColor(255, 255, 255)
    doc.setFillColor(24, 24, 27)
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F')
    doc.text(title, 14, 14)
    doc.setFontSize(9)
    doc.setTextColor(160, 160, 160)
    doc.text('Vue globale & Univers', 14, 20)

    ;(doc as any).autoTable({
      startY: 25,
      head: globalHeaders,
      body: globalRows,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [220, 220, 220], fillColor: [35, 35, 40], lineColor: [60, 60, 65], lineWidth: 0.2, halign: 'right', overflow: 'ellipsize' },
      headStyles: { fillColor: [45, 45, 50], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 6 },
      columnStyles: { 0: { halign: 'left', cellWidth: 28, fontStyle: 'bold' } },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const custom = globalStyles[data.row.index]
          if (custom) {
            data.cell.styles.fillColor = custom.fillColor
            data.cell.styles.textColor = custom.textColor
            data.cell.styles.fontStyle = custom.fontStyle
          }
          // Color evo columns
          const evoColsGlobal = [3, 6, 9, 11, 13, 15, 17, 19, 21]
          if (evoColsGlobal.includes(data.column.index)) {
            const val = String(data.cell.raw || '')
            if (val.startsWith('+')) data.cell.styles.textColor = [52, 211, 153]
            else if (val.startsWith('-')) data.cell.styles.textColor = [248, 113, 113]
          }
        }
      },
      margin: { left: 6, right: 6 },
    })

    // ── Pages 2-4: Per-universe detail with sous-familles ──
    const universList: { key: 'mur' | 'sol' | 'ameub'; label: string; color: number[] }[] = [
      { key: 'mur', label: 'Revêtement Mural', color: [59, 130, 246] },
      { key: 'sol', label: 'Revêtement de Sol', color: [16, 185, 129] },
      { key: 'ameub', label: 'Ameublement', color: [245, 158, 11] },
    ]
    for (const uni of universList) {
      doc.addPage('a4', 'landscape')
      doc.setFillColor(24, 24, 27)
      doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F')
      doc.setFontSize(14)
      doc.setTextColor(...(uni.color as [number, number, number]))
      doc.text(`${title} — ${uni.label}`, 14, 14)
      doc.setFontSize(9)
      doc.setTextColor(160, 160, 160)
      doc.text('Détail univers et sous-familles', 14, 20)

      const famKey = { mur: 'Mur', sol: 'Sol', ameub: 'Ameublement' }[uni.key]
      const sfOrder = SF_ORDER[famKey] || []
      const uniHeaders: any[][] = [
        [
          { content: '', colSpan: 1 },
          { content: 'CA', colSpan: 2, styles: { halign: 'center', fillColor: uni.color } },
          { content: 'TICKETS', colSpan: 2, styles: { halign: 'center', fillColor: uni.color.map(c => Math.max(c - 30, 0)) } },
          { content: 'PM', colSpan: 2, styles: { halign: 'center', fillColor: uni.color.map(c => Math.max(c - 60, 0)) } },
          ...sfOrder.map(sf => ({ content: SF_SHORT[sf] || sf, colSpan: 2, styles: { halign: 'center', fillColor: uni.color.map(c => Math.min(c + 40, 255)) } })),
        ],
        ['', 'Réel', 'Évo', 'Réel', 'Évo', 'Réel', 'Évo', ...sfOrder.flatMap(() => ['CA', 'Évo'])],
      ]

      const { rows: uniRows, rowStyles: uniStyles } = buildRows(uni.key)

      ;(doc as any).autoTable({
        startY: 25,
        head: uniHeaders,
        body: uniRows,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [220, 220, 220], fillColor: [35, 35, 40], lineColor: [60, 60, 65], lineWidth: 0.2, halign: 'right', overflow: 'ellipsize' },
        headStyles: { fillColor: [45, 45, 50], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 6 },
        columnStyles: { 0: { halign: 'left', cellWidth: 28, fontStyle: 'bold' } },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const custom = uniStyles[data.row.index]
            if (custom) {
              data.cell.styles.fillColor = custom.fillColor
              data.cell.styles.textColor = custom.textColor
              data.cell.styles.fontStyle = custom.fontStyle
            }
            // Color evo columns (all odd columns after first)
            if (data.column.index > 0 && data.column.index % 2 === 0) {
              const val = String(data.cell.raw || '')
              if (val.startsWith('+')) data.cell.styles.textColor = [52, 211, 153]
              else if (val.startsWith('-')) data.cell.styles.textColor = [248, 113, 113]
            }
          }
        },
        margin: { left: 6, right: 6 },
      })
    }

    doc.save(`decor-discount-magasins-${periodLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  return (
    <div className="space-y-6 p-4 md:p-6 fade-in">
      {/* ── KPI Cards (5 gradient cards, like Dashboard) ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Chiffre d\'affaires', value: f.eur(sr.ca_total), evo: hasN1 ? sr.evo_ca : null, sub: `${sr.nb_magasins} magasins`, gradient: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', Icon: CreditCard },
          { label: 'Tickets', value: f.num(sr.nb_factures_total), evo: null, sub: null, gradient: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-500/30', iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', Icon: ShoppingCart },
          { label: 'Clients', value: f.num(sr.nb_clients_total), evo: hasN1 ? sr.evo_clients : null, sub: null, gradient: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30', iconBg: 'bg-purple-500/20', iconColor: 'text-purple-400', Icon: Users },
          { label: 'Panier moyen', value: f.eurF(sr.panier_moyen), evo: null, sub: null, gradient: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', Icon: Store },
          { label: 'Fidélité', value: f.pct(sr.taux_fidelite), evo: null, sub: null, gradient: 'from-pink-500/20 to-pink-600/5', border: 'border-pink-500/30', iconBg: 'bg-pink-500/20', iconColor: 'text-pink-400', Icon: Heart },
        ].map((kpi, i) => (
          <div key={i} className={`bg-gradient-to-br ${kpi.gradient} rounded-2xl p-4 border ${kpi.border} backdrop-blur-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`p-1.5 ${kpi.iconBg} rounded-lg`}><kpi.Icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} /></span>
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide leading-tight">{kpi.label}</span>
            </div>
            <div className="text-xl md:text-2xl font-bold text-white">{kpi.value}</div>
            <div className="mt-1 flex items-center gap-2">
              {kpi.evo != null && <Evo v={kpi.evo} />}
              {kpi.sub && <span className="text-[10px] text-zinc-500">{kpi.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Hint + Export ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => exportPDF()}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <Download className="w-4 h-4" /> Exporter PDF
        </button>
        <span className="text-[11px] text-zinc-600 hidden sm:inline">Cliquer sur un magasin pour sa fiche détaillée</span>
      </div>

      {/* ── Store list (by zone) ── */}
      {zoneOrder.filter(z => grouped[z]?.length).map(zone => (
        <div key={zone} className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
          {/* Zone header */}
          {(() => {
            const z = zt?.[zone]
            return (
              <div className="bg-zinc-800/40 px-6 py-3 border-b border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-teal-400" />
                    Zone {ZONE_LABELS[zone] || zone}
                  </h3>
                  <div className="flex items-center gap-3">
                    {z && (
                      <span className="text-xs text-zinc-400">
                        <span className="font-bold text-white">{f.eur(z.ca_total)}</span>
                        {hasN1 && <> <Evo v={z.evo_ca} sm /></>}
                        <span className="mx-1.5 text-zinc-600">·</span>
                        {f.num(z.nb_clients)} cl.
                        <span className="mx-1.5 text-zinc-600">·</span>
                        PM {f.eurF(z.panier_moyen)}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">{grouped[zone].length} mag.</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Table */}
          <div className="overflow-x-auto">
          <table className="w-full min-w-fit text-sm">
            <thead>
              <tr className="border-b border-zinc-800/50 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                <th className="px-3 py-2 text-center w-10">#</th>
                <th className="px-3 py-2 text-left min-w-[140px]">Magasin</th>
                {viewConfig.columns.ca && <th className="px-2 py-2 text-right w-[72px]">CA</th>}
                {viewConfig.columns.clients && <th className="px-2 py-2 text-right w-[58px]">Clients</th>}
                {viewConfig.columns.pm && <th className="px-2 py-2 text-right w-[58px]">PM</th>}
                {viewConfig.columns.tickets && <th className="px-2 py-2 text-right w-[54px]">Tickets</th>}
                {viewConfig.columns.fidelite && <th className="px-2 py-2 text-right w-[48px]">Fidél.</th>}
                {viewConfig.columns.rang && <th className="px-2 py-2 text-right w-[42px]">Rg Sté</th>}
                {viewConfig.columns.rang && <th className="px-2 py-2 text-right w-[42px]">Rg Zone</th>}
                {viewConfig.columns.univers && <th className="px-2 py-2 text-right w-[64px] text-blue-500">Mur</th>}
                {viewConfig.columns.univers && <th className="px-2 py-2 text-right w-[64px] text-emerald-500">Sol</th>}
                {viewConfig.columns.univers && <th className="px-2 py-2 text-right w-[64px] text-amber-500">Ameub.</th>}
                {viewConfig.columns.universPM && <th className="px-2 py-2 text-right w-[54px] text-blue-400/60">PM M</th>}
                {viewConfig.columns.universPM && <th className="px-2 py-2 text-right w-[54px] text-emerald-400/60">PM S</th>}
                {viewConfig.columns.universPM && <th className="px-2 py-2 text-right w-[54px] text-amber-400/60">PM A</th>}
                {viewConfig.columns.universTck && <th className="px-2 py-2 text-right w-[48px] text-blue-400/40">Tk M</th>}
                {viewConfig.columns.universTck && <th className="px-2 py-2 text-right w-[48px] text-emerald-400/40">Tk S</th>}
                {viewConfig.columns.universTck && <th className="px-2 py-2 text-right w-[48px] text-amber-400/40">Tk A</th>}
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
            {grouped[zone].map((m: any) => {
              const s = m.stats
              const isExpanded = expandedStore === m.code
              return (
                <Fragment key={m.code}>
                <tr className="hover:bg-zinc-800/30 transition-colors group cursor-pointer" onClick={() => loadDetail(m.code)}>
                  <td className="px-3 py-3 text-center">
                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold ${s.rang_societe <= 3 ? 'bg-gradient-to-br from-yellow-500/30 to-amber-600/10 text-yellow-400 border border-yellow-500/30' : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'}`}>
                      {s.rang_societe}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{m.nom.replace('Décor Discount ', '')}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{m.ville} ({m.cp})</div>
                  </td>
                  {viewConfig.columns.ca && (
                    <td className="px-2 py-3 text-right">
                      <div className="font-bold text-white tabular-nums">{f.eur(s.ca_total)}</div>
                      {hasN1 && <div className="flex items-center justify-end gap-1"><span className="text-[9px] text-zinc-600 tabular-nums">{f.eur(s.ca_n1)}</span><Evo v={s.evo_ca} sm /></div>}
                    </td>
                  )}
                  {viewConfig.columns.clients && (
                    <td className="px-2 py-3 text-right">
                      <div className="text-zinc-300 tabular-nums">{f.num(s.nb_clients)}</div>
                      {hasN1 && <Evo v={s.evo_clients} sm />}
                    </td>
                  )}
                  {viewConfig.columns.pm && (
                    <td className="px-2 py-3 text-right">
                      <div className="text-zinc-300 tabular-nums">{f.eurF(s.panier_moyen)}</div>
                      {hasN1 && <Evo v={s.evo_pm} sm />}
                    </td>
                  )}
                  {viewConfig.columns.tickets && (
                    <td className="px-2 py-3 text-right">
                      <div className="text-zinc-300 tabular-nums">{f.num(s.nb_factures)}</div>
                      {hasN1 && <Evo v={s.evo_factures} sm />}
                    </td>
                  )}
                  {viewConfig.columns.fidelite && (
                    <td className="px-2 py-3 text-right">
                      <div className="text-zinc-300 tabular-nums">{f.pct(s.taux_fidelite)}</div>
                    </td>
                  )}
                  {viewConfig.columns.rang && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{s.rang_societe}</td>}
                  {viewConfig.columns.rang && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{s.rang_regional}</td>}
                  {viewConfig.columns.univers && <td className="px-2 py-3 text-right text-blue-400 tabular-nums font-medium">{f.eur(s.ca_mur)}{hasN1 && <><br/><Evo v={s.evo_mur} sm /></>}</td>}
                  {viewConfig.columns.univers && <td className="px-2 py-3 text-right text-emerald-400 tabular-nums font-medium">{f.eur(s.ca_sol)}{hasN1 && <><br/><Evo v={s.evo_sol} sm /></>}</td>}
                  {viewConfig.columns.univers && <td className="px-2 py-3 text-right text-amber-400 tabular-nums font-medium">{f.eur(s.ca_ameub)}{hasN1 && <><br/><Evo v={s.evo_ameub} sm /></>}</td>}
                  {viewConfig.columns.universPM && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.eurF(s.pm_mur)}</td>}
                  {viewConfig.columns.universPM && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.eurF(s.pm_sol)}</td>}
                  {viewConfig.columns.universPM && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.eurF(s.pm_ameub)}</td>}
                  {viewConfig.columns.universTck && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.num(s.nb_tickets_mur)}</td>}
                  {viewConfig.columns.universTck && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.num(s.nb_tickets_sol)}</td>}
                  {viewConfig.columns.universTck && <td className="px-2 py-3 text-right text-xs text-zinc-400 tabular-nums">{f.num(s.nb_tickets_ameub)}</td>}
                  <td className="w-6 text-center"><ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-blue-400 transition-colors inline" /></td>
                </tr>
                {viewConfig.columns.sousFamilles && s.sous_familles && (
                  <tr>
                    <td colSpan={99} className="px-6 pb-2 pt-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedStore(isExpanded ? null : m.code) }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 mb-1"
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        Sous-familles
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-zinc-800/50">
                          {(['Mur', 'Sol', 'Ameublement'] as const).map(fam => {
                            const data = s.sous_familles[fam] || {}
                            const ordered = (SF_ORDER[fam] || Object.keys(data)).filter((k: string) => data[k])
                            if (ordered.length === 0) return <div key={fam} />
                            const famColor = fam === 'Mur' ? 'text-blue-400' : fam === 'Sol' ? 'text-emerald-400' : 'text-amber-400'
                            return (
                              <div key={fam}>
                                <div className={`text-[10px] font-bold ${famColor} uppercase mb-2`}>{fam}</div>
                                {ordered.map((sfKey: string) => {
                                  const d = data[sfKey]
                                  return (
                                    <div key={sfKey} className="flex items-center justify-between text-[11px] py-0.5">
                                      <span className="text-zinc-500 truncate">{SF_SHORT[sfKey] || sfKey}</span>
                                      <span className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-zinc-300 font-medium tabular-nums">{f.eur(d.ca)}</span>
                                        {d.evo != null && <Evo v={d.evo} sm />}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
            </tbody>
            {/* Zone total footer */}
            {zt?.[zone] && (
              <tfoot>
                <tr className="bg-zinc-800/50 border-t border-zinc-700/50">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2"><span className="text-[11px] font-bold text-teal-400 uppercase">Total zone</span></td>
                  {viewConfig.columns.ca && <td className="px-2 py-2 text-right font-bold text-teal-400 tabular-nums">{f.eur(zt[zone].ca_total)}</td>}
                  {viewConfig.columns.clients && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.num(zt[zone].nb_clients)}</td>}
                  {viewConfig.columns.pm && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.eurF(zt[zone].panier_moyen)}</td>}
                  {viewConfig.columns.tickets && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.num(zt[zone].nb_factures)}</td>}
                  {viewConfig.columns.fidelite && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.pct(zt[zone].taux_fidelite)}</td>}
                  {viewConfig.columns.rang && <td className="px-2 py-2" />}
                  {viewConfig.columns.rang && <td className="px-2 py-2" />}
                  {viewConfig.columns.univers && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.eur(zt[zone].ca_mur)}</td>}
                  {viewConfig.columns.univers && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.eur(zt[zone].ca_sol)}</td>}
                  {viewConfig.columns.univers && <td className="px-2 py-2 text-right text-teal-400/70 tabular-nums">{f.eur(zt[zone].ca_ameub)}</td>}
                  {viewConfig.columns.universPM && <td className="px-2 py-2" />}
                  {viewConfig.columns.universPM && <td className="px-2 py-2" />}
                  {viewConfig.columns.universPM && <td className="px-2 py-2" />}
                  {viewConfig.columns.universTck && <td className="px-2 py-2" />}
                  {viewConfig.columns.universTck && <td className="px-2 py-2" />}
                  {viewConfig.columns.universTck && <td className="px-2 py-2" />}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      ))}


    </div>
  )
}