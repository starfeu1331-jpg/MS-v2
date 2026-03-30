import { useState, useEffect } from 'react'
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAuthHeaders } from '../../context/AuthContext'

interface Log {
  id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  action: string
  resource: string | null
  details: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

interface UserOption {
  id: string
  email: string
  prenom: string
  nom: string
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Connexion',
  LOGIN_FAILED: 'Échec connexion',
  LOGOUT: 'Déconnexion',
  USER_CREATE: 'Création utilisateur',
  USER_UPDATE: 'Modification utilisateur',
  USER_DELETE: 'Suppression utilisateur',
  USER_TOGGLE: 'Activation / désactivation',
  PAGE_VIEW: 'Consultation page',
  SEARCH: 'Recherche',
  FILTER: 'Filtre appliqué',
  EXPORT: 'Export données',
  CLIENT_VIEW: 'Fiche client',
  TICKET_VIEW: 'Détail ticket',
  PRODUCT_VIEW: 'Fiche produit',
  CATEGORY_BROWSE: 'Navigation catalogue',
  DRILL_DOWN: 'Drill-down',
  SEGMENT_VIEW: 'Détail segment RFM',
  CHART_MODE: 'Changement graphique',
  PERIOD_CHANGE: 'Changement période',
  SETTING_CHANGE: 'Modification paramètre',
  CACHE_CLEAR: 'Vidage cache',
  DB_UPDATE: 'Mise à jour BDD',
  SESSION_DURATION: 'Durée session',
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500/20 text-green-400 border-green-500/30',
  LOGIN_FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  LOGOUT: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50',
  USER_CREATE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  USER_UPDATE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  USER_DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  USER_TOGGLE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  PAGE_VIEW: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  SEARCH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  FILTER: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  EXPORT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CLIENT_VIEW: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  TICKET_VIEW: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  PRODUCT_VIEW: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  CATEGORY_BROWSE: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  DRILL_DOWN: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  SEGMENT_VIEW: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  CHART_MODE: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  PERIOD_CHANGE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  SETTING_CHANGE: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  CACHE_CLEAR: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  DB_UPDATE: 'bg-red-500/20 text-red-400 border-red-500/30',
  SESSION_DURATION: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  search: 'Recherche',
  rfm: 'Analyse RFM',
  subFamilies: 'Sous-familles',
  crossSelling: 'Cross-selling',
  cohortes: 'Cohortes',
  abc: 'Analyse ABC',
  kingquentin: 'King Quentin',
  zones: 'Zone de chalandise',
  stores: 'Performance magasins',
  forecast: 'Prévisions',
  social: 'Réseaux sociaux',
  exports: 'Exports',
  settings: 'Paramètres',
  admin: 'Administration',
  global: 'Global',
}

function formatResource(resource: string | null): string {
  if (!resource) return '—'
  return MODULE_LABELS[resource] || resource
}

function formatDetails(action: string, details: Record<string, unknown> | null, resource: string | null): string {
  if (!details) return '—'
  const d = details as Record<string, any>
  switch (action) {
    case 'PAGE_VIEW':
      return d.subPath ? `Page: ${resource} / ${d.subPath}` : `Page: ${resource}`
    case 'SEARCH':
      return `"${d.query || ''}"${d.resultCount !== undefined ? ` → ${d.resultCount} résultats` : ''}`
    case 'FILTER':
      return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ')
    case 'EXPORT':
      return `${(d.type || '').replace(/_/g, ' ')} (${d.format || ''})`
    case 'CLIENT_VIEW':
      return `Carte: ${d.clientId || '?'}`
    case 'TICKET_VIEW':
      return `Facture: ${d.facture || '?'}`
    case 'PRODUCT_VIEW':
      return `Produit: ${d.productId || '?'}`
    case 'CATEGORY_BROWSE':
      return [d.famille, d.sous_famille, d.sous_sous_famille].filter(Boolean).join(' › ')
    case 'DRILL_DOWN':
      return `${d.target || ''} ${d.code || ''}`
    case 'SEGMENT_VIEW':
      return `Segment: ${d.segment || '?'}`
    case 'CHART_MODE':
      return `Mode: ${d.mode || '?'}`
    case 'PERIOD_CHANGE':
      return d.label || `${d.type}: ${d.value}`
    case 'DB_UPDATE':
      return `Mode: ${d.mode || '?'}`
    case 'SESSION_DURATION':
      return d.durationSeconds ? `${Math.floor(d.durationSeconds / 60)}min ${d.durationSeconds % 60}s` : '—'
    case 'LOGIN_FAILED':
      return d.reason === 'wrong_password' ? 'Mot de passe incorrect' : d.reason === 'user_not_found' ? 'Utilisateur inconnu' : d.reason === 'account_inactive' ? 'Compte désactivé' : JSON.stringify(d)
    default:
      return JSON.stringify(d)
  }
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<Log[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])

  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  useEffect(() => {
    fetch('/api/auth/users', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => { fetchLogs() }, [filterUser, filterAction, filterDateStart, filterDateEnd, page])

  async function fetchLogs() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filterUser) params.set('userId', filterUser)
    if (filterAction !== 'all') params.set('action', filterAction)
    if (filterDateStart) params.set('dateStart', filterDateStart)
    if (filterDateEnd) params.set('dateEnd', filterDateEnd)
    if (filterSearch.trim()) params.set('search', filterSearch.trim())

    const res = await fetch(`/api/auth/logs?${params}`, { headers: getAuthHeaders() })
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }

  function formatDate(d: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date(d))
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* ── Filtres ─────────────────────────────── */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Filtres</p>
          <span className="text-xs text-zinc-500 font-medium">{total.toLocaleString('fr-FR')} entrée{total > 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={filterUser}
            onChange={e => { setFilterUser(e.target.value); setPage(1) }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-600 transition"
            style={{ padding: '12px 16px' }}
          >
            <option value="">Tous les utilisateurs</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1) }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-600 transition"
            style={{ padding: '12px 16px' }}
          >
            <option value="all">Toutes les actions</option>
            {ALL_ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>

          <input
            type="date"
            value={filterDateStart}
            onChange={e => { setFilterDateStart(e.target.value); setPage(1) }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-600 transition"
            style={{ padding: '12px 16px' }}
          />
          <input
            type="date"
            value={filterDateEnd}
            onChange={e => { setFilterDateEnd(e.target.value); setPage(1) }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-600 transition"
            style={{ padding: '12px 16px' }}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl focus-within:border-zinc-600 transition-colors flex-1 max-w-sm" style={{ padding: '0 16px' }}>
            <Search className="w-4 h-4 text-zinc-500 shrink-0" />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchLogs() } }}
              placeholder="Rechercher email, nom..."
              className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
              style={{ padding: '12px 12px' }}
            />
          </div>
          <button
            onClick={() => { setPage(1); fetchLogs() }}
            className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-colors"
          >
            <div className="flex items-center gap-2.5" style={{ padding: '12px 20px' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'skel-breath' : ''}`} />
              Actualiser
            </div>
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────── */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide whitespace-nowrap" style={{ padding: '16px 20px' }}>Date</th>
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide" style={{ padding: '16px 20px' }}>Utilisateur</th>
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide" style={{ padding: '16px 20px' }}>Action</th>
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide" style={{ padding: '16px 20px' }}>Ressource</th>
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide" style={{ padding: '16px 20px' }}>Détails</th>
                <th className="text-left text-xs text-zinc-400 font-semibold uppercase tracking-wide" style={{ padding: '16px 20px' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center" style={{ padding: '48px 0' }}>
                    <div className="space-y-3 max-w-2xl mx-auto">
                      {[0,1,2,3,4].map(i => (
                        <div key={i} className={`flex items-center gap-4 skel-breath skel-d${(i%4)+1}`}>
                          <div className="h-3 w-28 bg-zinc-800 rounded" />
                          <div className="h-3 w-20 bg-zinc-800/60 rounded" />
                          <div className="h-3 w-16 bg-zinc-800/40 rounded" />
                          <div className="flex-1" />
                          <div className="h-3 w-24 bg-zinc-800/50 rounded" />
                          <div className="h-3 w-16 bg-zinc-800/40 rounded" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-zinc-500" style={{ padding: '48px 0' }}>Aucune entrée trouvée</td>
                </tr>
              )}
              {!loading && logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-zinc-800 hover:bg-zinc-800/20 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/30'}`}>
                  <td className="text-zinc-400 whitespace-nowrap font-mono text-sm" style={{ padding: '16px 24px' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {log.user_name ? (
                      <div>
                        <div className="text-white text-sm font-medium">{log.user_name}</div>
                        <div className="text-zinc-500 text-xs mt-1">{log.user_email}</div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-sm">{log.user_email || '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span className={`inline-flex items-center rounded-xl text-sm font-semibold border ${ACTION_COLORS[log.action] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600'}`} style={{ padding: '6px 14px' }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="text-zinc-400 text-sm max-w-[140px] truncate" style={{ padding: '16px 24px' }}>{formatResource(log.resource)}</td>
                  <td className="text-zinc-500 text-sm max-w-[200px] truncate" style={{ padding: '16px 24px' }}>
                    {formatDetails(log.action, log.details, log.resource)}
                  </td>
                  <td className="text-zinc-500 text-sm font-mono whitespace-nowrap" style={{ padding: '16px 24px' }}>{log.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2" style={{ padding: '12px 20px' }}>
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </div>
          </button>
          <span className="text-zinc-500 text-sm">Page {page} / {totalPages} · {total.toLocaleString('fr-FR')} entrées</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2" style={{ padding: '12px 20px' }}>
              Suivant
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
