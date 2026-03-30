import {
  ArrowLeft, Download, TrendingUp, ShoppingCart, Euro, Users, Calendar,
  BarChart3, ChevronLeft, ChevronRight, Crown, Award, Heart,
  AlertTriangle, UserX, Sparkles, Target, Mail, Phone, MapPin,
  Lightbulb, ArrowUpDown, ChevronsLeft, ChevronsRight
} from 'lucide-react'
import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────
interface SegmentDetailProps {
  segmentName: string
  segmentData: {
    ca: number
    count: number
    avecAge?: number
    ageMoyen?: number | null
    pctAge?: number
  }
  totalClients: number
  totalCA: number
  onBack: () => void
  onSearchClient?: (carte: string) => void
  periodParams?: string
}

interface DetailedStats {
  count: number
  ca: number
  frequenceMoyenne: number
  recenceMoyenne: number
  panierMoyen: number
  caParClient: number
  recenceMin: number
  recenceMax: number
  caMin: number
  caMax: number
  tauxRetention: number
  multiAchat: number
}

// ─── Segment metadata ─────────────────────────────────────────────
const SEGMENT_META: Record<string, { color: string; icon: any; description: string; criteria: string; action: string }> = {
  'Ultra Champions': { color: 'purple',  icon: Crown,         description: 'Excellence absolue',          criteria: 'R=5 ET F=5 ET M=5',  action: 'VIP absolu — privilèges exclusifs, accès prioritaire' },
  'Champions':       { color: 'emerald', icon: Award,         description: 'Meilleurs clients',           criteria: 'R≥4 ET F≥4 ET M≥4',  action: 'Récompensez-les — offres VIP, programme ambassadeur' },
  'Loyaux':          { color: 'blue',    icon: Heart,         description: 'Clients fidèles',             criteria: 'F≥4 (sauf Champions)', action: 'Montée en gamme — cross-sell, upsell, offres premium' },
  'À Risque':        { color: 'orange',  icon: AlertTriangle, description: 'Anciens bons clients',        criteria: 'R≤2 ET F≥4',          action: 'Réactivation urgente — offres de reconquête' },
  'Perdus':          { color: 'red',     icon: UserX,         description: 'Inactifs longue date',        criteria: 'R≤2 ET F<4',           action: 'Dernière chance — offre exceptionnelle ou laisser partir' },
  'Nouveaux':        { color: 'cyan',    icon: Sparkles,      description: 'Récents, peu d\'achats',      criteria: 'F≤2 ET R≥4',           action: 'Fidélisation — offre de bienvenue, suivi régulier' },
  'Occasionnels':    { color: 'zinc',    icon: Target,        description: 'Sans profil marqué',          criteria: 'Tous les autres',       action: 'Engagement — augmenter la fréquence via campagnes' },
}

// ─── Couleurs statiques ───────────────────────────────────────────
const colorMap: Record<string, { iconBg: string; border: string; text: string; gradBg: string }> = {
  purple:  { iconBg: 'bg-purple-500/20',  border: 'border-purple-500/20',  text: 'text-purple-400',  gradBg: 'from-purple-500/15 to-purple-600/5' },
  emerald: { iconBg: 'bg-emerald-500/20', border: 'border-emerald-500/20', text: 'text-emerald-400', gradBg: 'from-emerald-500/15 to-emerald-600/5' },
  blue:    { iconBg: 'bg-blue-500/20',    border: 'border-blue-500/20',    text: 'text-blue-400',    gradBg: 'from-blue-500/15 to-blue-600/5' },
  orange:  { iconBg: 'bg-orange-500/20',  border: 'border-orange-500/20',  text: 'text-orange-400',  gradBg: 'from-orange-500/15 to-orange-600/5' },
  red:     { iconBg: 'bg-red-500/20',     border: 'border-red-500/20',     text: 'text-red-400',     gradBg: 'from-red-500/15 to-red-600/5' },
  cyan:    { iconBg: 'bg-cyan-500/20',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    gradBg: 'from-cyan-500/15 to-cyan-600/5' },
  zinc:    { iconBg: 'bg-zinc-500/20',    border: 'border-zinc-500/20',    text: 'text-zinc-400',    gradBg: 'from-zinc-500/15 to-zinc-600/5' },
}

const PAGE_SIZE = 50

// ═══════════════════════════════════════════════════════════════════
export default function SegmentDetail({
  segmentName,
  segmentData,
  totalClients,
  totalCA,
  onBack,
  onSearchClient,
  periodParams
}: SegmentDetailProps) {
  const [clients, setClients] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState<'monetary' | 'frequency' | 'recency'>('monetary')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(true)
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null)

  const totalPages = Math.ceil(segmentData.count / PAGE_SIZE)
  const meta = SEGMENT_META[segmentName] || SEGMENT_META['Occasionnels']
  const c = colorMap[meta.color] || colorMap.zinc
  const SegIcon = meta.icon

  const formatEuro = (value: number) => {
    if (!value || isNaN(value)) return '0€'
    return `${Math.round(value).toLocaleString('fr-FR')}€`
  }

  // ─── Fetch clients paginés ──────────────────────────────────────
  const fetchPage = async (pageNum: number) => {
    setLoading(true)
    try {
      const url = `/api/rfm?segment=${encodeURIComponent(segmentName)}&page=${pageNum}&sort=${sortBy}&order=${sortOrder}&pageSize=${PAGE_SIZE}${periodParams ? '&' + periodParams : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erreur API: ${res.status}`)
      const data = await res.json()
      setClients(data.clients || [])
      if (data.segmentStats) setDetailedStats(data.segmentStats)
      setPage(pageNum)
    } catch (err) {
      console.error('Erreur chargement segment:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentName, sortBy, sortOrder])

  const handleSortChange = (col: 'monetary' | 'frequency' | 'recency') => {
    if (col === sortBy) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(col)
      setSortOrder('desc')
    }
  }

  // ─── Export CSV ─────────────────────────────────────────────────
  const exportToCSV = () => {
    const headers = ['Rang CA', 'Carte', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Sexe', 'Ville', 'CP', 'Score RFM', 'R', 'F', 'M', 'CA Total', 'Récence (jours)', 'Fréquence']
    const rows = clients.map((client: any, idx: number) => [
      client.monetary_rank ?? (page * PAGE_SIZE + idx + 1), client.carte, client.nom || '', client.prenom || '',
      client.email || '', client.telephone || '', client.sexe || '', client.ville || '',
      client.cp || '', client.RFM, client.R, client.F, client.M,
      Math.round(client.monetary), client.recency, client.frequency
    ])
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `RFM_${segmentName}_page${page + 1}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const stats = detailedStats
  const percentOfClients = (segmentData.count / totalClients) * 100
  const percentOfCA = (segmentData.ca / totalCA) * 100

  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Header compact ──────────────────────────── */}
      <div className="glass rounded-3xl p-6 shadow-2xl border border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className={`p-3 ${c.iconBg} rounded-xl`}>
              <SegIcon className={`w-6 h-6 ${c.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">{segmentName}</h1>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${c.iconBg} ${c.text}`}>{meta.criteria}</span>
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <button
            onClick={exportToCSV}
            disabled={clients.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>

        {/* Action recommandée */}
        <div className={`mt-4 p-3.5 rounded-xl bg-gradient-to-r ${c.gradBg} border ${c.border}`}>
          <div className="flex items-center gap-2.5">
            <Lightbulb className={`w-4 h-4 ${c.text} shrink-0`} />
            <p className="text-sm text-zinc-300">
              <strong className={c.text}>Action recommandée :</strong> {meta.action}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPIs — 2 rangées ────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-500/15 to-blue-600/5 rounded-2xl p-4 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Clients</p>
          </div>
          <p className="text-xl font-bold text-white">{segmentData.count.toLocaleString('fr-FR')}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{percentOfClients.toFixed(1)}% du total</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Euro className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">CA Total</p>
          </div>
          <p className="text-xl font-bold text-white">{formatEuro(segmentData.ca)}</p>
          <p className="text-[11px] text-emerald-400 font-bold mt-0.5">{percentOfCA.toFixed(1)}% du CA</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 rounded-2xl p-4 border border-purple-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Panier Moy.</p>
          </div>
          <p className="text-xl font-bold text-white">{stats ? formatEuro(stats.panierMoyen) : '...'}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{stats ? `${stats.frequenceMoyenne.toFixed(1)} achats/client` : '...'}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500/15 to-orange-600/5 rounded-2xl p-4 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">CA / Client</p>
          </div>
          <p className="text-xl font-bold text-white">{stats ? formatEuro(stats.caParClient) : '...'}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{stats ? `${Math.round(stats.recenceMoyenne)}j récence moy.` : '...'}</p>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Age</p>
          </div>
          {segmentData.avecAge && segmentData.avecAge > 0 ? (
            <>
              <p className="text-xl font-bold text-white">{segmentData.ageMoyen} ans</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{segmentData.pctAge}% renseigné</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-zinc-600">N/A</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Non disponible</p>
            </>
          )}
        </div>
        {stats && (
          <div className="bg-gradient-to-br from-teal-500/15 to-teal-600/5 rounded-2xl p-4 border border-teal-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-4 h-4 text-teal-400" />
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Rétention</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.tauxRetention.toFixed(1)}%</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{stats.multiAchat.toLocaleString('fr-FR')} multi-achats</p>
          </div>
        )}
      </div>

      {/* ── Stats avancées (latérales) ──────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 border border-zinc-800">
            <div className="flex items-center gap-2.5 mb-4">
              <Calendar className="w-5 h-5 text-orange-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Récence</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Moyenne</p>
                <p className="text-2xl font-bold text-white mt-1">{Math.round(stats.recenceMoyenne)}j</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Min</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.recenceMin}j</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Max</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{stats.recenceMax}j</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-zinc-800">
            <div className="flex items-center gap-2.5 mb-4">
              <Euro className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">CA par client</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Moyen</p>
                <p className="text-2xl font-bold text-white mt-1">{formatEuro(stats.caParClient)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Min</p>
                <p className="text-2xl font-bold text-zinc-400 mt-1">{formatEuro(stats.caMin)}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Max</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{formatEuro(stats.caMax)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Liste clients paginée ───────────────────── */}
      <div className="glass rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
        {/* En-tête */}
        <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white">Clients du segment</h3>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-md">
                {segmentData.count.toLocaleString('fr-FR')} clients
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(['monetary', 'frequency', 'recency'] as const).map(col => {
                const labels = { monetary: 'CA', frequency: 'Fréquence', recency: 'Récence' }
                const isActive = sortBy === col
                return (
                  <button
                    key={col}
                    onClick={() => handleSortChange(col)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                        : 'bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/80'
                    }`}
                  >
                    {labels[col]}
                    {isActive && <ArrowUpDown className="w-3 h-3" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Pagination haut */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
          <p className="text-xs text-zinc-500">Page {page + 1} sur {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => fetchPage(0)} disabled={page === 0 || loading}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronsLeft className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={() => fetchPage(page - 1)} disabled={page === 0 || loading}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </button>
            {(() => {
              const pages: number[] = []
              const start = Math.max(0, page - 2)
              const end = Math.min(totalPages - 1, page + 2)
              for (let i = start; i <= end; i++) pages.push(i)
              return pages.map(p => (
                <button key={p} onClick={() => fetchPage(p)} disabled={loading}
                  style={{ minWidth: '2rem' }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    p === page ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-700'
                  }`}>
                  {p + 1}
                </button>
              ))
            })()}
            <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages - 1 || loading}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={() => fetchPage(totalPages - 1)} disabled={page >= totalPages - 1 || loading}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronsRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3 py-4">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} className={`flex items-center gap-4 skel-breath skel-d${(i%4)+1}`}>
                <div className="w-5 h-4 bg-zinc-800/60 rounded" />
                <div className="flex-1"><div className="h-3.5 w-40 bg-zinc-800 rounded mb-1" /><div className="h-2.5 w-24 bg-zinc-800/50 rounded" /></div>
                <div className="h-4 w-16 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto fade-in">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider"># CA</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">RFM</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">R</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">F</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">M</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">CA</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Achats</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Récence</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any, idx: number) => {
                  const name = (client.prenom || client.nom)
                    ? `${client.prenom || ''} ${client.nom || ''}`.trim()
                    : `Carte ${client.carte}`
                  const location = [client.ville, client.cp].filter(Boolean).join(' ')

                  return (
                    <tr
                      key={client.carte}
                      onClick={() => onSearchClient?.(client.carte)}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600">{client.monetary_rank ?? (page * PAGE_SIZE + idx + 1)}</td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{name}</p>
                          {location && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <MapPin size={14} strokeWidth={1.5} className="text-zinc-600 shrink-0" />
                              <span className="text-[11px] text-zinc-600 truncate">{location}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 max-w-[200px]">
                              <Mail size={14} strokeWidth={1.5} className="text-emerald-500 shrink-0" />
                              <span className="text-[11px] text-zinc-400 truncate">{client.email}</span>
                            </div>
                          )}
                          {client.telephone && (
                            <div className="flex items-center gap-2">
                              <Phone size={14} strokeWidth={1.5} className="text-cyan-500 shrink-0" />
                              <span className="text-[11px] text-zinc-400">{client.telephone}</span>
                            </div>
                          )}
                          {!client.email && !client.telephone && <p className="text-[11px] text-zinc-700">—</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-xs">
                          {client.RFM}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-blue-400 font-bold text-xs">{client.R}</td>
                      <td className="px-4 py-3 text-center text-cyan-400 font-bold text-xs">{client.F}</td>
                      <td className="px-4 py-3 text-center text-teal-400 font-bold text-xs">{client.M}</td>
                      <td className="px-4 py-3 text-right text-white font-bold text-sm">{formatEuro(client.monetary)}</td>
                      <td className="px-4 py-3 text-right text-zinc-400 text-sm">{client.frequency}</td>
                      <td className="px-4 py-3 text-right text-orange-400 text-sm">{client.recency}j</td>
                    </tr>
                  )
                })}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-zinc-600 text-sm">Aucun client trouvé</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bas */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 py-4 border-t border-zinc-800/50">
            <button onClick={() => fetchPage(0)} disabled={page === 0}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronsLeft className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={() => fetchPage(page - 1)} disabled={page === 0}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-white" />
            </button>
            <span className="text-xs text-zinc-500 px-3">Page {page + 1} / {totalPages}</span>
            <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages - 1}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
            <button onClick={() => fetchPage(totalPages - 1)} disabled={page >= totalPages - 1}
              className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-30 rounded-lg transition-colors">
              <ChevronsRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
