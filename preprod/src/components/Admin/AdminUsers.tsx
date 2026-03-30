import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, X, Check, UserCheck, UserX, Users, ScrollText,
  LayoutDashboard, BarChart3, TrendingUp, Store, ShoppingCart, Package,
  Repeat, Megaphone, LineChart, Download, ShieldCheck, Mail, ChevronRight, ArrowLeft
} from 'lucide-react'
import { getAuthHeaders, UserRole } from '../../context/AuthContext'
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

const CHECK_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  blue:    { bg: 'bg-blue-500/20',    border: 'border-blue-500/40',    icon: 'text-blue-400'    },
  purple:  { bg: 'bg-purple-500/20',  border: 'border-purple-500/40',  icon: 'text-purple-400'  },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', icon: 'text-emerald-400' },
  orange:  { bg: 'bg-orange-500/20',  border: 'border-orange-500/40',  icon: 'text-orange-400'  },
  yellow:  { bg: 'bg-yellow-500/20',  border: 'border-yellow-500/40',  icon: 'text-yellow-400'  },
  cyan:    { bg: 'bg-cyan-500/20',    border: 'border-cyan-500/40',    icon: 'text-cyan-400'    },
  pink:    { bg: 'bg-pink-500/20',    border: 'border-pink-500/40',    icon: 'text-pink-400'    },
  red:     { bg: 'bg-red-500/20',     border: 'border-red-500/40',     icon: 'text-red-400'     },
  indigo:  { bg: 'bg-indigo-500/20',  border: 'border-indigo-500/40',  icon: 'text-indigo-400'  },
  zinc:    { bg: 'bg-zinc-700/30',    border: 'border-zinc-600/40',    icon: 'text-zinc-400'    },
}

/* ═══════════════════════════════════════════════════
   UserPage — page complète de création / modification
   ═══════════════════════════════════════════════════ */
function UserPage({ user, onClose, onSave }: {
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

  const handleFullAccess = (checked: boolean) => {
    setFullAccess(checked)
    if (checked) setEnabledModules(new Set(ALL_MODULES.map(m => m.id)))
    else setEnabledModules(new Set())
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
    <div className="space-y-8">

      {/* ── Breadcrumb ──────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
          style={{ padding: '10px' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors font-medium">
            Administration
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
          <span className="text-white font-semibold">
            {isEdit ? `${user?.prenom} ${user?.nom}` : 'Nouvel utilisateur'}
          </span>
        </div>
      </div>

      {/* ── Titre ──────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {isEdit ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
        </h2>
        <p className="text-sm text-zinc-500" style={{ marginTop: '6px' }}>
          {isEdit
            ? 'Mettez à jour les informations et les accès de cet utilisateur.'
            : 'Remplissez les informations pour créer un nouveau compte.'}
        </p>
      </div>

      {/* ── Contenu 2 colonnes ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12" style={{ gap: '32px' }}>

        {/* ─── Colonne gauche : Identité + Rôle ─── */}
        <div className="xl:col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Section Identité */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40" style={{ padding: '28px' }}>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest" style={{ marginBottom: '24px' }}>
              Identité
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {!isEdit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="text-xs font-semibold text-zinc-500">Adresse e-mail</label>
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl focus-within:border-zinc-600 transition" style={{ padding: '0 16px' }}>
                    <Mail className="w-4 h-4 text-zinc-600 shrink-0" />
                    <input
                      type="email"
                      placeholder="prenom.nom@decor-discount.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
                      style={{ padding: '14px 12px' }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2" style={{ gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="text-xs font-semibold text-zinc-500">Prénom</label>
                  <input
                    type="text"
                    placeholder="Jean"
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition"
                    style={{ padding: '14px 16px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="text-xs font-semibold text-zinc-500">Nom</label>
                  <input
                    type="text"
                    placeholder="Dupont"
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition"
                    style={{ padding: '14px 16px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="text-xs font-semibold text-zinc-500">
                  {isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'}
                </label>
                <input
                  type="password"
                  placeholder={isEdit ? '••••••••' : 'Minimum 8 caractères'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition"
                  style={{ padding: '14px 16px' }}
                />
              </div>
            </div>
          </section>

          {/* Section Rôle */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40" style={{ padding: '28px' }}>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest" style={{ marginBottom: '24px' }}>
              Rôle
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label className="text-xs font-semibold text-zinc-500">Niveau d'accès</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:border-zinc-600 focus:outline-none transition appearance-none cursor-pointer"
                style={{ padding: '14px 16px' }}
              >
                <option value="SUPER_ADMIN">Super Admin — Tous les droits, gestion des comptes</option>
                <option value="ADMIN">Admin — Gestion utilisateurs et accès complet</option>
                <option value="ANALYST">Analyste — Accès lecture + exports</option>
                <option value="VIEWER">Lecteur — Lecture seule</option>
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900" style={{ padding: '16px', marginTop: '16px' }}>
              <div className={`w-3 h-3 rounded-full ${
                form.role === 'SUPER_ADMIN' ? 'bg-red-400' :
                form.role === 'ADMIN' ? 'bg-blue-400' :
                form.role === 'ANALYST' ? 'bg-purple-400' : 'bg-zinc-500'
              }`} />
              <span className="text-sm text-zinc-300 font-medium">{ROLE_LABELS[form.role]}</span>
              <span className="text-xs text-zinc-600">sélectionné</span>
            </div>
          </section>

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10" style={{ padding: '16px' }}>
              <X className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ─── Colonne droite : Modules ─── */}
        <div className="xl:col-span-7">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40" style={{ padding: '28px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Accès modules</p>
              <span className="text-xs text-zinc-600 font-medium">
                {fullAccess ? 'Tous les modules' : `${enabledModules.size} / ${ALL_MODULES.length}`}
              </span>
            </div>

            {/* Toggle accès complet */}
            <label
              className={`flex items-center gap-3 rounded-xl border cursor-pointer select-none transition-all ${
                fullAccess ? 'border-blue-500/40 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900'
              }`}
              style={{ padding: '16px 20px', marginBottom: '20px' }}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                fullAccess ? 'bg-blue-500/20' : 'bg-zinc-800'
              }`}>
                <ShieldCheck className={`w-4 h-4 ${fullAccess ? 'text-blue-400' : 'text-zinc-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${fullAccess ? 'text-white' : 'text-zinc-400'}`}>Accès complet</p>
                <p className="text-xs text-zinc-600">Donne accès à tous les modules automatiquement</p>
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={fullAccess}
                onChange={e => handleFullAccess(e.target.checked)}
              />
            </label>

            {/* Séparateur */}
            <div className="flex items-center" style={{ gap: '16px', marginBottom: '20px' }}>
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-700 font-medium">Sélection individuelle</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Grille de checkboxes */}
            <div
              className={`transition-opacity duration-200 ${fullAccess ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px' }}>
                {ALL_MODULES.map(mod => {
                  const Icon = mod.icon
                  const isOn = enabledModules.has(mod.id)
                  const colors = CHECK_COLORS[mod.color] || CHECK_COLORS.zinc

                  return (
                    <div
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={`flex items-center rounded-xl border cursor-pointer select-none transition-all ${
                        isOn
                          ? `${colors.bg} ${colors.border}`
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                      style={{ padding: '16px' }}
                    >

                      {/* Icône */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isOn ? `${colors.bg}` : 'bg-zinc-800'
                        }`}
                        style={{ marginLeft: '0' }}
                      >
                        <Icon className={`w-4 h-4 ${isOn ? colors.icon : 'text-zinc-600'}`} />
                      </div>

                      {/* Texte */}
                      <div className="min-w-0" style={{ marginLeft: '12px' }}>
                        <p className={`text-sm font-semibold leading-tight ${isOn ? 'text-white' : 'text-zinc-500'}`}>{mod.label}</p>
                        <p className={`text-xs leading-snug ${isOn ? 'text-zinc-400' : 'text-zinc-700'}`} style={{ marginTop: '2px' }}>{mod.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Avertissement */}
            {!fullAccess && enabledModules.size === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10" style={{ padding: '14px 16px', marginTop: '16px' }}>
                <span className="text-orange-400 text-sm font-medium">⚠ Aucun module sélectionné — l'utilisateur ne verra rien</span>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Barre d'actions ── */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40" style={{ padding: '20px 28px' }}>
        <p className="text-sm text-zinc-500">
          {fullAccess
            ? 'Accès complet à tous les modules'
            : `${enabledModules.size} module${enabledModules.size > 1 ? 's' : ''} activé${enabledModules.size > 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center" style={{ gap: '12px' }}>
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
            style={{ padding: '12px 28px' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            style={{ padding: '12px 32px', gap: '10px' }}
          >
            {loading
              ? <div className="w-4 h-4 bg-white/30 rounded-full skel-breath" />
              : <Check className="w-4 h-4" />
            }
            {isEdit ? 'Enregistrer' : "Créer l'utilisateur"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   AdminUsers — page principale avec routing URL
   ═══════════════════════════════════════════════════ */
export default function AdminUsers({ subPath = '', navigate }: { subPath?: string; navigate?: (path: string) => void }) {
  const go = (path: string) => navigate ? navigate(path) : window.history.pushState({}, '', path)

  // Parse subPath: '', 'utilisateurs', 'journal', 'utilisateurs/creer', 'utilisateurs/modifier/:id'
  const parts = subPath.split('/').filter(Boolean)
  const section = parts[0] || 'utilisateurs' // default to utilisateurs
  const action = parts[1] || ''
  const actionId = parts[2] || ''

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

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

  /* ── Page création ── */
  if (section === 'utilisateurs' && action === 'creer') {
    return (
      <UserPage
        user={{}}
        onClose={() => go('/admin/utilisateurs')}
        onSave={fetchUsers}
      />
    )
  }

  /* ── Page modification ── */
  if (section === 'utilisateurs' && action === 'modifier' && actionId) {
    const foundUser = users.find(u => u.id === actionId)
    if (loading) {
      return (
        <div className="space-y-4 skel-breath">
          <div className="h-8 w-48 bg-zinc-800 rounded-lg" />
          <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-12 bg-zinc-800/40 rounded-lg" />)}</div>
        </div>
      )
    }
    return (
      <UserPage
        user={foundUser || {}}
        onClose={() => go('/admin/utilisateurs')}
        onSave={fetchUsers}
      />
    )
  }

  /* ── Onglet actif basé sur l'URL ── */
  const tab = section === 'journal' ? 'logs' : 'users'

  return (
    <div className="space-y-6 fade-in">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Administration</h2>
            <p className="text-sm text-zinc-500">Gestion des utilisateurs et accès</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/60 rounded-xl p-1.5">
            <button
              onClick={() => go('/admin/utilisateurs')}
              className={`flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === 'users' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={{ padding: '12px 24px' }}
            >
              <Users className="w-4 h-4" />
              Utilisateurs
            </button>
            <button
              onClick={() => go('/admin/journal')}
              className={`flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === 'logs' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={{ padding: '12px 24px' }}
            >
              <ScrollText className="w-4 h-4" />
              Journal
            </button>
          </div>
        </div>
      </div>

      {tab === 'logs' && <AdminLogs />}

      {tab === 'users' && (
        <>
          {/* ── KPIs ──────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500/15 to-blue-600/5 rounded-2xl p-5 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Total</p>
              </div>
              <p className="text-2xl font-bold text-white">{users.length}</p>
              <p className="text-xs text-zinc-500 mt-1">utilisateur{users.length > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 rounded-2xl p-5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Actifs</p>
              </div>
              <p className="text-2xl font-bold text-white">{users.filter(u => u.isActive).length}</p>
              <p className="text-xs text-zinc-500 mt-1">comptes activés</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 rounded-2xl p-5 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Admins</p>
              </div>
              <p className="text-2xl font-bold text-white">{users.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN').length}</p>
              <p className="text-xs text-zinc-500 mt-1">administrateurs</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/15 to-orange-600/5 rounded-2xl p-5 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-orange-500/20 rounded-lg">
                  <UserX className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Inactifs</p>
              </div>
              <p className="text-2xl font-bold text-white">{users.filter(u => !u.isActive).length}</p>
              <p className="text-xs text-zinc-500 mt-1">comptes désactivés</p>
            </div>
          </div>

          {/* ── Action bar ──────────────────────────── */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}</p>
            <button
              onClick={() => go('/admin/utilisateurs/creer')}
              className="bg-blue-500 hover:bg-blue-400 text-white rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 font-bold text-base" style={{ padding: '8px 12px' }}>
                <Plus className="w-5 h-5" />
                Nouvel utilisateur
              </div>
            </button>
          </div>

          {/* ── User cards ──────────────────────────── */}
          {loading ? (
            <div className="space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className={`bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5 skel-breath skel-d${i+1}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full" />
                    <div className="flex-1"><div className="h-4 w-32 bg-zinc-800 rounded mb-2" /><div className="h-3 w-48 bg-zinc-800/60 rounded" /></div>
                    <div className="h-8 w-20 bg-zinc-800 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const mCount = user.modules === null ? null : user.modules.length
                const roleGradients: Record<string, string> = {
                  SUPER_ADMIN: 'from-red-500 to-orange-500',
                  ADMIN: 'from-blue-500 to-cyan-500',
                  ANALYST: 'from-purple-500 to-pink-500',
                  VIEWER: 'from-zinc-500 to-zinc-600',
                }
                return (
                  <div
                    key={user.id}
                    className={`bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5 transition-all hover:border-zinc-700 ${!user.isActive ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleGradients[user.role] || 'from-blue-500 to-cyan-500'} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg`}>
                        {user.prenom[0]}{user.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-white text-base">{user.prenom} {user.nom}</p>
                          <span className={`rounded-lg text-xs font-bold border ${ROLE_COLORS[user.role]}`} style={{ padding: '4px 10px' }}>
                            {ROLE_LABELS[user.role]}
                          </span>
                          {!user.isActive && (
                            <span className="rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20" style={{ padding: '4px 10px' }}>
                              Inactif
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                          <span className="text-xs text-zinc-600">·</span>
                          <span className="shrink-0 text-xs font-medium">
                            {mCount === null
                              ? <span className="text-blue-400/70">Accès complet</span>
                              : <span className={mCount === 0 ? 'text-orange-400' : 'text-zinc-500'}>
                                  {mCount} module{mCount !== null && mCount > 1 ? 's' : ''}
                                </span>
                            }
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => go(`/admin/utilisateurs/modifier/${user.id}`)} className="text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/60 rounded-xl border border-zinc-800 transition-colors" title="Modifier" style={{ padding: '14px' }}>
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button onClick={() => toggleActive(user)} className={`rounded-xl border border-zinc-800 transition-colors ${user.isActive ? 'text-zinc-500 hover:text-orange-400 hover:bg-zinc-800/60' : 'text-zinc-500 hover:text-green-400 hover:bg-zinc-800/60'}`} title={user.isActive ? 'Désactiver' : 'Réactiver'} style={{ padding: '14px' }}>
                          {user.isActive ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                        </button>
                        <button onClick={() => deleteUser(user)} className="text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 rounded-xl border border-zinc-800 transition-colors" title="Supprimer" style={{ padding: '14px' }}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
