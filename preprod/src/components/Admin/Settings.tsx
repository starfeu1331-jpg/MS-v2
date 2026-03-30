import { useState, useEffect } from 'react'
import { SlidersHorizontal, Calendar, LayoutDashboard, Store, Check, HardDrive, Monitor, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const API = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'magic_token'

interface Prefs {
  defaultPage?: string
  defaultPeriod?: { type: string; value: string | number; label?: string }
  sidebarOpen?: boolean
  storeView?: 'essentiel' | 'complet' | 'pdf'
  scrollToTop?: boolean
}

const MODULES = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '📊' },
  { id: 'search', label: 'Recherche', icon: '🔍' },
  { id: 'produits', label: 'Produits', icon: '🏷️' },
  { id: 'rfm', label: 'Segmentation RFM', icon: '👥' },
  { id: 'subFamilies', label: 'Sous-familles', icon: '📦' },
  { id: 'crossSelling', label: 'Cross-Selling', icon: '🛒' },
  { id: 'cohortes', label: 'Cohortes', icon: '🎯' },
  { id: 'abc', label: 'ABC Analysis', icon: '📋' },
  { id: 'kingquentin', label: 'King Quentin', icon: '👑' },
  { id: 'zones', label: 'Zones Chalandise', icon: '🗺️' },
  { id: 'stores', label: 'Magasins', icon: '🏪' },
  { id: 'forecast', label: 'Prévisions', icon: '📈' },
]

const PERIODS = [
  { type: 'week', value: 'current', label: 'Semaine en cours' },
  { type: 'month', value: 'current', label: 'Mois en cours' },
  { type: 'ytd', value: 'current', label: "Depuis le début de l'année" },
  { type: 'months', value: 3, label: 'Les 3 derniers mois' },
  { type: 'months', value: 6, label: 'Les 6 derniers mois' },
  { type: 'months', value: 12, label: 'Les 12 derniers mois' },
  { type: 'year', value: 2025, label: 'Année 2025' },
  { type: 'year', value: 2024, label: 'Année 2024' },
  { type: 'year', value: 2023, label: 'Année 2023' },
  { type: 'all', value: 'all', label: 'Depuis 2022 (Tout)' },
]

const STORE_VIEWS = [
  { id: 'essentiel', label: 'Essentiel', desc: 'CA, Clients, Panier moyen' },
  { id: 'complet', label: 'Complet', desc: 'Tickets, Rangs, Univers' },
  { id: 'pdf', label: 'Mode PDF', desc: 'Toutes les données' },
]

export default function Preferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<Prefs>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [storageSize, setStorageSize] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) { setLoading(false); return }
    fetch(`${API}/api/auth/preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : {})
      .then(d => setPrefs(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        total += key.length + (localStorage.getItem(key)?.length || 0)
      }
    }
    setStorageSize(total * 2)
  }, [])

  const save = async (patch: Partial<Prefs>) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    setPrefs(prev => ({ ...prev, ...patch }))
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`${API}/api/auth/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch)
      })
      if (res.ok) {
        const data = await res.json()
        setPrefs(data)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        window.dispatchEvent(new CustomEvent('prefs-changed', { detail: data }))
      }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const clearCaches = () => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key !== TOKEN_KEY) keys.push(key)
    }
    keys.forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
  }

  if (loading) return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 skel-breath">
        <div className="w-12 h-12 bg-zinc-800 rounded-2xl" />
        <div><div className="h-6 w-36 bg-zinc-800 rounded-lg mb-2" /><div className="h-3 w-52 bg-zinc-800/60 rounded" /></div>
      </div>
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 skel-breath skel-d1">
          <div className="h-5 w-32 bg-zinc-800 rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {[0,1,2,3,4,5].map(i => <div key={i} className="h-20 bg-zinc-800/40 rounded-xl" />)}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 skel-breath skel-d2">
          <div className="h-5 w-28 bg-zinc-800 rounded mb-4" />
          <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-12 bg-zinc-800/40 rounded-lg" />)}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8 fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl border border-blue-500/20">
            <SlidersHorizontal className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Préférences</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Personnalise ton expérience, {user?.prenom}</p>
          </div>
        </div>
        {(saving || saved) && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
            {saving && <div className="w-3.5 h-3.5 bg-blue-400/30 rounded-full skel-breath" />}
            {saved && <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">Enregistré</span></>}
          </div>
        )}
      </div>

      {/* ── Page d'accueil ── */}
      <Section
        title="Page d'accueil"
        desc="Module affiché au lancement de l'application"
        icon={<LayoutDashboard className="w-5 h-5 text-blue-400" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {MODULES.map(m => {
            const active = (prefs.defaultPage || 'dashboard') === m.id
            return (
              <button
                key={m.id}
                onClick={() => save({ defaultPage: m.id })}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  active
                    ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30'
                    : 'bg-zinc-800/30 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <span className="text-base shrink-0">{m.icon}</span>
                <span className="text-sm truncate">{m.label}</span>
                {active && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-blue-400" />}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Période par défaut ── */}
      <Section
        title="Période par défaut"
        desc="Période sélectionnée au lancement"
        icon={<Calendar className="w-5 h-5 text-purple-400" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PERIODS.map((p, i) => {
            const active = (prefs.defaultPeriod?.type === p.type && String(prefs.defaultPeriod?.value) === String(p.value))
              || (!prefs.defaultPeriod && p.type === 'all')
            return (
              <button
                key={i}
                onClick={() => save({ defaultPeriod: p })}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm text-left transition-all ${
                  active
                    ? 'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/30'
                    : 'bg-zinc-800/30 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <span>{p.label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Vue magasins ── */}
      <Section
        title="Vue magasins"
        desc="Colonnes affichées par défaut dans le module Magasins"
        icon={<Store className="w-5 h-5 text-teal-400" />}
      >
        <div className="grid grid-cols-3 gap-3">
          {STORE_VIEWS.map(v => {
            const active = (prefs.storeView || 'essentiel') === v.id
            return (
              <button
                key={v.id}
                onClick={() => save({ storeView: v.id as Prefs['storeView'] })}
                className={`px-4 py-4 rounded-xl text-center transition-all ${
                  active
                    ? 'bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/30'
                    : 'bg-zinc-800/30 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <div className="text-sm font-semibold">{v.label}</div>
                <div className="text-xs text-zinc-500 mt-1">{v.desc}</div>
                {active && <Check className="w-3.5 h-3.5 mx-auto mt-2" />}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Interface ── */}
      <Section
        title="Interface"
        desc="Comportement de l'application"
        icon={<Monitor className="w-5 h-5 text-amber-400" />}
      >
        <div className="divide-y divide-zinc-800/60">
          <Toggle
            label="Barre latérale ouverte au lancement"
            desc="La sidebar est dépliée par défaut"
            checked={prefs.sidebarOpen !== false}
            onChange={v => save({ sidebarOpen: v })}
          />
          <Toggle
            label="Remonter en haut au changement de module"
            desc="Scrolle automatiquement vers le haut de la page"
            checked={prefs.scrollToTop !== false}
            onChange={v => save({ scrollToTop: v })}
          />
        </div>
      </Section>

      {/* ── Stockage ── */}
      <Section
        title="Stockage local"
        desc="Données en cache dans ton navigateur"
        icon={<HardDrive className="w-5 h-5 text-zinc-400" />}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-white">{formatBytes(storageSize)}</div>
              <div className="text-xs text-zinc-500 mt-0.5">Préférences, token, caches API</div>
            </div>
            <button
              onClick={clearCaches}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vider le cache
            </button>
          </div>
          <div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                style={{ width: `${Math.max(Math.min((storageSize / (5 * 1024 * 1024)) * 100, 100), 1)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-zinc-600">0</span>
              <span className="text-xs text-zinc-600">5 Mo</span>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}

/* ── Reusable sub-components ── */

function Section({ title, desc, icon, children }: { title: string; desc: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-800/60">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between py-4 group cursor-pointer">
      <div className="text-left pr-6">
        <div className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
      </div>
      <div className={`w-11 h-6 rounded-full flex items-center shrink-0 transition-colors ${checked ? 'bg-blue-500' : 'bg-zinc-700'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[4px]'}`} />
      </div>
    </button>
  )
}
