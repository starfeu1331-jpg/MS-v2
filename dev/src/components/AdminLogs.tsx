import { useState, useEffect } from 'react'
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAuthHeaders } from '../context/AuthContext'

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
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-500/20 text-green-400 border-green-500/30',
  LOGIN_FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  LOGOUT: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50',
  USER_CREATE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  USER_UPDATE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  USER_DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  USER_TOGGLE: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

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
    <div className="space-y-4">
      {/* Filtres */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          value={filterUser}
          onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
          ))}
        </select>

        <select
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
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
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <input
          type="date"
          value={filterDateEnd}
          onChange={e => { setFilterDateEnd(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg focus-within:border-blue-500 transition-colors flex-1 max-w-xs">
          <Search className="w-4 h-4 text-zinc-500 ml-3 shrink-0" />
          <input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchLogs() } }}
            placeholder="Rechercher email, nom..."
            className="flex-1 px-3 py-2 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={() => { setPage(1); fetchLogs() }}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
        <span className="text-zinc-500 text-sm">{total.toLocaleString('fr-FR')} entrée{total > 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="text-left px-4 py-3 text-zinc-400 font-medium whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Utilisateur</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Action</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Ressource</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">Détails</th>
                <th className="text-left px-4 py-3 text-zinc-400 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                      Chargement...
                    </div>
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500">Aucune entrée trouvée</td>
                </tr>
              )}
              {!loading && logs.map((log, i) => (
                <tr key={log.id} className={`border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/50'}`}>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap font-mono text-xs">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user_name ? (
                      <div>
                        <div className="text-white text-xs font-medium">{log.user_name}</div>
                        <div className="text-zinc-500 text-xs">{log.user_email}</div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">{log.user_email || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ACTION_COLORS[log.action] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[140px] truncate">{log.resource || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate font-mono">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-mono whitespace-nowrap">{log.ip || '—'}</td>
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
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>
          <span className="text-zinc-500 text-sm">Page {page} / {totalPages} · {total.toLocaleString('fr-FR')} entrées</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
