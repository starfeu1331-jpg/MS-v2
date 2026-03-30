import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, X, Check, UserCheck, UserX, Users, ScrollText,
  LayoutDashboard, BarChart3, TrendingUp, Store, ShoppingCart, Package,
  Repeat, Megaphone, LineChart, Download, ShieldCheck, Mail
} from 'lucide-react'
import { getAuthHeaders, UserRole } from '../context/AuthContext'
import AdminLogs from './AdminLogs'

interface User {
  id: string
  email: string
  nom: string
  prenom: string
  role: UserRole
  isActive: boolean
  createdAt: string
  modules: string[] | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  ANALYST: 'Analyste',
  VIEWER: 'Lecteur',
}

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
  ADMIN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ANALYST: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  VIEWER: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30',
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Tous les droits, gestion des comptes',
  ADMIN: 'Gestion utilisateurs et accès complet',
  ANALYST: 'Accès lecture + exports',
  VIEWER: 'Lecture seule',
}

export const ALL_MODULES = [
  { id: 'dashboard',     label: 'Dashboard',              desc: 'KPIs globaux, CA, évolution',         icon: LayoutDashboard, color: 'blue'    },
  { id: 'rfm',           label: 'Analyse RFM',             desc: 'Segmentation et scoring clients',     icon: BarChart3,       color: 'purple'  },
  { id: 'cohortes',      label: 'Cohortes',                desc: 'Fidélisation et rétention',           icon: TrendingUp,      color: 'emerald' },
  { id: 'stores',        label: 'Performance magasins',    desc: 'Analyse par dépôt / point de vente',  icon: Store,           color: 'orange'  },
  { id: 'abc-analysis',  label: 'Analyse ABC',             desc: 'Classification produits par CA',      icon: ShoppingCart,    color: 'yellow'  },
  { id: 'sub-families',  label: 'Sous-familles produits',  desc: 'Analyse détaillée par famille',       icon: Package,         color: 'cyan'    },
  { id: 'cross-selling', label: 'Cross-selling',           desc: 'Affinités et ventes croisées',        icon: Repeat,          color: 'pink'    },
  { id: 'marketing',     label: 'Marketing',               desc: 'Campagnes, segmentation emails',      icon: Megaphone,       color: 'red'     },
  { id: 'forecast',      label: 'Prévisions',              desc: 'Forecasting et projections CA',       icon: LineChart,       color: 'indigo'  },
  { id: 'export',        label: 'Export données',          desc: 'Téléchargement CSV / Excel',          icon: Download,        color: 'zinc'    },
]

const COLOR_MAP: Record<string, string> = {
  blue:    'bg-blue-500/20 border-blue-500/30 text-blue-400',
  purple:  'bg-purple-500/20 border-purple-500/30 text-purple-400',
  emerald: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  orange:  'bg-orange-500/20 border-orange-500/30 text-orange-400',
  yellow:  'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  cyan:    'bg-cyan-500/20 border-cyan-500/30 text-cyan-400',
  pink:    'bg-pink-500/20 border-pink-500/30 text-pink-400',
  red:     'bg-red-500/20 border-red-500/30 text-red-400',
  indigo:  'bg-indigo-500/20 border-indigo-500/30 text-indigo-400',
  zinc:    'bg-zinc-700/50 border-zinc-600/30 text-zinc-400',
}

const TOGGLE_BG: Record<string, string> = {
  blue: 'bg-blue-500', purple: 'bg-purple-500', emerald: 'bg-emerald-500',
  orange: 'bg-orange-500', yellow: 'bg-yellow-400', cyan: 'bg-cyan-500',
  pink: 'bg-pink-500', red: 'bg-red-500', indigo: 'bg-indigo-500', zinc: 'bg-zinc-500',
}

function Toggle({ enabled, onChange, color = 'blue', compact = false }: { enabled: boolean; onChange: (v: boolean) => void; color?: string; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onChange(!enabled) }}
        className={`relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 focus:outline-none ${
          enabled ? (TOGGLE_BG[color] || 'bg-blue-500') + ' border-transparent' : 'bg-zinc-900 border-zinc-600'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full transition-opacity ${enabled ? 'bg-white opacity-100' : 'bg-zinc-600 opacity-70'}`} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onChange(!enabled) }}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent cursor-pointer transition-colors duration-200 ease-in-out focus:outline-none ${
        enabled ? (TOGGLE_BG[color] || 'bg-blue-500') : 'bg-zinc-700'
      }`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
        enabled ? 'translate-x-4' : 'translate-x-0'
      }`} />
    </button>
  )
}

function UserModal({ user, onClose, onSave }: {
  user: Partial<User> | null
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!user?.id
  const initModules: string[] | null = user?.modules ?? null
  const [fullAccess, setFullAccess] = useState(initModules === null)
  const [enabledModules, setEnabledModules] = useState<Set<string>>(
    new Set(initModules === null ? ALL_MODULES.map(m => m.id) : initModules)
  )
  const [form, setForm] = useState({
    email: user?.email || '',
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    role: (user?.role || 'ANALYST') as UserRole,
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleModule = (id: string) => {
    setEnabledModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleFullAccess = (v: boolean) => {
    setFullAccess(v)
    if (v) setEnabledModules(new Set(ALL_MODULES.map(m => m.id)))
  }

  const handleSubmit = async () => {
    setError('')
    if (!isEdit && (!form.email || !form.password || !form.nom || !form.prenom)) {
      setError('Tous les champs sont requis')
      return
    }
    setLoading(true)
    const body: Record<string, unknown> = {
      email: form.email,
      nom: form.nom,
      prenom: form.prenom,
      role: form.role,
      modules: fullAccess ? null : Array.from(enabledModules),
    }
    if (form.password) body.password = form.password

    const url = isEdit ? `/api/auth/users/${user!.id}` : '/api/auth/users'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Erreur'); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-6 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-white leading-tight truncate">
              {isEdit ? `Modifier — ${user?.prenom} ${user?.nom}` : 'Nouvel utilisateur'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 truncate">
              {isEdit ? 'Mise à jour des informations et des accès modules' : 'Création du compte et configuration des accès'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

            {/* Left — Identity + Role */}
            <div className="xl:col-span-5 space-y-8">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:p-8 space-y-6">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Identité</p>

                {!isEdit && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-500">Adresse e-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                      <input
                        type="email"
                        placeholder="prenom.nom@decor-discount.com"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-500">Prénom</label>
                    <input
                      type="text"
                      placeholder="Jean"
                      value={form.prenom}
                      onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-500">Nom</label>
                    <input
                      type="text"
                      placeholder="Dupont"
                      value={form.nom}
                      onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-500">
                    {isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'}
                  </label>
                  <input
                    type="password"
                    placeholder={isEdit ? '••••••••' : 'Minimum 8 caractères'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:p-8 space-y-6">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Rôle</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: val }))}
                      className={`relative p-4 rounded-xl border text-left transition-all min-h-[96px] ${
                        form.role === val
                          ? `${ROLE_COLORS[val]} ring-1 ring-inset ring-current`
                          : 'bg-zinc-900 border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold">{label}</span>
                        {form.role === val && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-xs opacity-70 leading-snug">{ROLE_DESCRIPTIONS[val]}</p>
                    </button>
                  ))}
                </div>
              </section>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <X className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Right — Module access */}
            <div className="xl:col-span-7">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Accès modules</p>
                  <span className="text-xs text-zinc-600 font-medium">
                    {fullAccess ? 'Tous les modules' : `${enabledModules.size} / ${ALL_MODULES.length}`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-5 bg-zinc-900 border border-zinc-700/60 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Accès complet</p>
                      <p className="text-xs text-zinc-600 truncate">Tous les modules débloqués</p>
                    </div>
                  </div>
                  <Toggle enabled={fullAccess} onChange={handleFullAccess} color="blue" />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-700 font-medium">ou sélection individuelle</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                <div className={`rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-4 transition-opacity duration-200 ${fullAccess ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex flex-col gap-3">
                    {ALL_MODULES.map(mod => {
                      const Icon = mod.icon
                      const isOn = enabledModules.has(mod.id)
                      return (
                        <div
                          key={mod.id}
                          onClick={() => toggleModule(mod.id)}
                          className={`rounded-xl border cursor-pointer transition-all select-none py-4 px-4 ${
                            isOn
                              ? `${COLOR_MAP[mod.color]}`
                              : 'bg-zinc-900/80 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                          }`}
                        >
                          <div className="ml-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isOn ? COLOR_MAP[mod.color] : 'bg-zinc-800'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold leading-tight ${isOn ? '' : 'text-zinc-600'}`}>{mod.label}</p>
                              <p className={`text-xs mt-1 truncate ${isOn ? 'opacity-60' : 'text-zinc-700'}`}>{mod.desc}</p>
                            </div>
                            <Toggle enabled={isOn} onChange={() => toggleModule(mod.id)} color={mod.color} compact />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-6 border-t border-zinc-800 shrink-0 bg-zinc-950">
        <p className="text-xs">
          {!fullAccess && enabledModules.size === 0
            ? <span className="text-orange-400 font-medium">⚠ Aucun module activé — l'utilisateur ne verra rien</span>
            : <span className="text-zinc-600">{fullAccess ? 'Accès à tous les modules' : `${enabledModules.size} module${enabledModules.size > 1 ? 's' : ''} activé${enabledModules.size > 1 ? 's' : ''}`}</span>
          }
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check className="w-4 h-4" />
            }
            {isEdit ? 'Enregistrer' : "Créer l'utilisateur"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [tab, setTab] = useState<'users' | 'logs'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Partial<User> | null | false>(false)

  const fetchUsers = async () => {
    setLoading(true)
    const res = await fetch('/api/auth/users', { headers: getAuthHeaders() })
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const toggleActive = async (user: User) => {
    await fetch(`/api/auth/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ isActive: !user.isActive })
    })
    fetchUsers()
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Supprimer définitivement ${user.prenom} ${user.nom} ?`)) return
    await fetch(`/api/auth/users/${user.id}`, { method: 'DELETE', headers: getAuthHeaders() })
    fetchUsers()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-1 mb-6 bg-zinc-800/50 rounded-xl p-1 w-fit border border-zinc-700/50">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'users' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'logs' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          Journal d'activité
        </button>
      </div>

      {tab === 'logs' && <AdminLogs />}

      {tab === 'users' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-gradient">Gestion des accès</h2>
              <p className="text-zinc-500 text-sm mt-1">{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvel utilisateur
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="glass rounded-2xl border border-zinc-800 overflow-hidden">
              {users.map((user, i) => {
                const mCount = user.modules === null ? null : user.modules.length
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-4 px-6 py-4 ${i < users.length - 1 ? 'border-b border-zinc-800' : ''} ${!user.isActive ? 'opacity-40' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {user.prenom[0]}{user.nom[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">{user.prenom} {user.nom}</p>
                      <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium">
                      {mCount === null
                        ? <span className="text-blue-400/60">Accès complet</span>
                        : <span className={mCount === 0 ? 'text-orange-400' : 'text-zinc-600'}>
                            {mCount} module{mCount > 1 ? 's' : ''}
                          </span>
                      }
                    </span>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setModal(user)} className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors" title="Modifier">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActive(user)} className={`p-2 rounded-lg transition-colors ${user.isActive ? 'text-zinc-500 hover:text-orange-400 hover:bg-zinc-800' : 'text-zinc-500 hover:text-green-400 hover:bg-zinc-800'}`} title={user.isActive ? 'Désactiver' : 'Réactiver'}>
                        {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button onClick={() => deleteUser(user)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {modal !== false && (
            <UserModal user={modal} onClose={() => setModal(false)} onSave={fetchUsers} />
          )}
        </>
      )}
    </div>
  )
}
