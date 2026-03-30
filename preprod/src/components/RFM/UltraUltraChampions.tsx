import {
  ArrowLeft, Download, Crown, Euro, Users, Calendar,
  ShoppingCart, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, Shield, Star, Mail, Phone, MapPin, TrendingUp
} from 'lucide-react'
import { useState, useEffect } from 'react'

interface UltraUltraProps {
  onBack: () => void
  onSearchClient?: (carte: string) => void
}

const PAGE_SIZE = 50

export default function UltraUltraChampions({ onBack, onSearchClient }: UltraUltraProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [semesters, setSemesters] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('monetary')
  const [sortOrder, setSortOrder] = useState('desc')

  const fetchPage = async (pageNum: number) => {
    setLoading(true)
    try {
      const url = `/api/rfm?ultraUltra=true&page=${pageNum}&sort=${sortBy}&order=${sortOrder}&pageSize=${PAGE_SIZE}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erreur API: ${res.status}`)
      const data = await res.json()
      setClients(data.clients || [])
      if (data.stats) setStats(data.stats)
      if (data.semesters) setSemesters(data.semesters)
      setPage(pageNum)
    } catch (err) {
      console.error('Erreur Ultra Ultra:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPage(0) }, [sortBy, sortOrder])

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortOrder('desc') }
  }

  const totalPages = stats ? Math.ceil(stats.count / PAGE_SIZE) : 1

  const formatEuro = (v: number) => {
    if (!v || isNaN(v)) return '0€'
    return `${Math.round(v).toLocaleString('fr-FR')}€`
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
  }

  const exportToCSV = () => {
    const headers = ['Rang CA', 'Carte', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Sexe', 'Ville', 'CP', 'Score RFM', 'R', 'F', 'M', 'CA Total', 'Récence (jours)', 'Fréquence']
    const rows = clients.map((c: any, idx: number) => [
      c.monetary_rank ?? (page * PAGE_SIZE + idx + 1), c.carte, c.nom || '', c.prenom || '',
      c.email || '', c.telephone || '', c.sexe || '', c.ville || '',
      c.cp || '', c.RFM, c.R, c.F, c.M,
      Math.round(c.monetary), c.recency, c.frequency
    ])
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Ultra_Ultra_Champions_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700/50">
            <ArrowLeft className="w-5 h-5 text-zinc-300" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Ultra Ultra Champions</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Segment confidentiel — Ultra Champions sur 4 semestres consécutifs</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Confidentiel
          </span>
        </div>
      </div>

      {/* Semester badges */}
      {semesters.length > 0 && (
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500 mb-3 font-medium">Ultra Champions (R=5, F=5, M=5) sur chaque semestre :</p>
          <div className="grid grid-cols-4 gap-3">
            {semesters.map((sem: any, i: number) => (
              <div key={i} className="bg-zinc-800/50 rounded-xl p-3 border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">Semestre {i + 1}</span>
                </div>
                <p className="text-xs text-zinc-300 font-medium">{formatDate(sem.start)} → {formatDate(sem.end)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[9px] text-emerald-400 font-mono">R=5</span>
                  <span className="text-[9px] text-emerald-400 font-mono">F=5</span>
                  <span className="text-[9px] text-emerald-400 font-mono">M=5</span>
                  <Star className="w-2.5 h-2.5 text-amber-400 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Ultra Ultra Champions', value: stats.count?.toLocaleString('fr-FR'), icon: Crown, color: 'amber' },
            { label: 'CA Total', value: formatEuro(stats.ca), icon: Euro, color: 'emerald' },
            { label: 'CA / Client', value: formatEuro(stats.caParClient), icon: TrendingUp, color: 'blue' },
            { label: 'Panier Moyen', value: formatEuro(stats.panierMoyen), icon: ShoppingCart, color: 'purple' },
            { label: 'Fréquence Moy.', value: `${stats.frequenceMoyenne}`, icon: ShoppingCart, color: 'cyan' },
            { label: 'Taux Rétention', value: `${stats.tauxRetention}%`, icon: Users, color: 'rose' },
          ].map((kpi, i) => (
            <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 bg-${kpi.color}-500/20 rounded-lg`}>
                  <kpi.icon className={`w-3.5 h-3.5 text-${kpi.color}-400`} />
                </div>
                <span className="text-[10px] text-zinc-500">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Client List */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-800/40 px-6 py-4 border-b border-zinc-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Clients</h3>
            {stats && <span className="text-xs text-zinc-500">{stats.count} clients</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportToCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors border border-zinc-700/50">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* Pagination top */}
        {totalPages > 1 && (
          <div className="px-6 py-2 border-b border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Page {page + 1} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchPage(0)} disabled={page === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronsLeft className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(page - 1)} disabled={page === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages - 1} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronsRight className="w-4 h-4 text-zinc-400" /></button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-3">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} className={`flex items-center gap-4 skel-breath skel-d${(i%4)+1}`}>
                <div className="w-5 h-4 bg-zinc-800/60 rounded" />
                <div className="flex-1"><div className="h-3.5 w-36 bg-zinc-800 rounded mb-1" /><div className="h-2.5 w-48 bg-zinc-800/50 rounded" /></div>
                <div className="h-4 w-12 bg-zinc-800 rounded" />
                <div className="h-4 w-12 bg-zinc-800 rounded" />
                <div className="h-4 w-16 bg-zinc-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto fade-in">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Contact</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">RFM</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">R</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">F</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">M</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort('monetary')}>
                    <span className="inline-flex items-center gap-1">CA <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort('frequency')}>
                    <span className="inline-flex items-center gap-1">Achats <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort('recency')}>
                    <span className="inline-flex items-center gap-1">Récence <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any, idx: number) => (
                  <tr
                    key={client.carte}
                    onClick={() => onSearchClient?.(client.carte)}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-600 font-mono">{client.monetary_rank ?? (page * PAGE_SIZE + idx + 1)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{[client.prenom, client.nom].filter(Boolean).join(' ') || '—'}</p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        {client.ville && <><MapPin className="w-2.5 h-2.5" /> {client.ville} {client.cp && `(${client.cp.toString().slice(0, 2)})`}</>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {client.email && <p className="text-[10px] text-zinc-400 flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{client.email}</p>}
                        {client.telephone && <p className="text-[10px] text-zinc-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{client.telephone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">{client.RFM}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-emerald-400 font-mono">{client.R}</td>
                    <td className="px-4 py-3 text-center text-xs text-emerald-400 font-mono">{client.F}</td>
                    <td className="px-4 py-3 text-center text-xs text-emerald-400 font-mono">{client.M}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-emerald-400">{formatEuro(client.monetary)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-300">{client.frequency}</td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-400">{client.recency}j</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bottom */}
        {totalPages > 1 && !loading && (
          <div className="px-6 py-3 border-t border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Page {page + 1} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchPage(0)} disabled={page === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronsLeft className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(page - 1)} disabled={page === 0} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronLeft className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(page + 1)} disabled={page >= totalPages - 1} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronRight className="w-4 h-4 text-zinc-400" /></button>
              <button onClick={() => fetchPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30"><ChevronsRight className="w-4 h-4 text-zinc-400" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
