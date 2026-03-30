import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart3, Search, Home, Users, Settings, Menu, X, Package, ShoppingBag, Store, Activity, Download, Target, Layers, Globe, Crown, Megaphone, Calendar, ChevronDown, Map, MoreHorizontal, Shield, LogOut, ClipboardList, Tag, SlidersHorizontal, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { trackPageView, trackPeriodChange } from './services/tracker'
import './mobile.css'

// Import direct de tous les composants (pas de lazy loading → pas de double skeleton)
import Dashboard from './components/Dashboard/Dashboard'
import SearchPanel from './components/Search/SearchPanel'
import RFMAnalysis from './components/RFM/RFMAnalysis'
import Surveys from './components/Marketing/Surveys'
import ZoneChalandise from './components/Geo/ZoneChalandise'
import StorePerformance from './components/Geo/StorePerformance'
import SettingsView from './components/Admin/Settings'
import AdminUsers from './components/Admin/AdminUsers'
import ProductsPanel from './components/Products/ProductsPanel'

type TabType = 'dashboard' | 'search' | 'produits' | 'rfm' | 'zones' | 'stores' | 'surveys' | 'settings' | 'admin'

// Définition de tous les onglets pour le carousel mobile
const ALL_TABS = [
  { id: 'dashboard' as TabType, icon: Home, color: 'text-blue-400' },
  { id: 'search' as TabType, icon: Search, color: 'text-blue-400' },
  { id: 'produits' as TabType, icon: Tag, color: 'text-orange-400' },
  { id: 'rfm' as TabType, icon: Users, color: 'text-purple-400' },
  { id: 'zones' as TabType, icon: Map, color: 'text-green-400' },
  { id: 'stores' as TabType, icon: Store, color: 'text-teal-400' },
  { id: 'surveys' as TabType, icon: ClipboardList, color: 'text-violet-400' },
  { id: 'settings' as TabType, icon: Settings, color: 'text-zinc-400' },
]

// ─── URL Routing ──────────────────────────────────────────────────
const TAB_TO_PATH: Record<string, string> = {
  dashboard: 'dashboard', search: 'search', produits: 'produits', rfm: 'rfm',
  zones: 'zones', stores: 'stores',
  surveys: 'surveys', settings: 'settings', admin: 'admin',
}
const PATH_TO_TAB: Record<string, TabType> = { '': 'dashboard' }
for (const [tab, path] of Object.entries(TAB_TO_PATH)) {
  PATH_TO_TAB[path] = tab as TabType
}

function parsePath(pathname: string): { page: TabType; subPath: string } {
  const parts = pathname.split('/').filter(Boolean)
  const page = PATH_TO_TAB[parts[0] || ''] || 'dashboard'
  return { page, subPath: parts.slice(1).map(decodeURIComponent).join('/') }
}

const _initRoute = parsePath(window.location.pathname)

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<{ type: string; value: number | string; label?: string }>({ type: 'all', value: 'all', label: 'Toutes périodes' })
  const [showWebData, setShowWebData] = useState(false)
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [showYearSubmenu, setShowYearSubmenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)
  const [[page, direction], setPage] = useState<[TabType, 'left' | 'right']>([_initRoute.page, 'right'])
  const [subPath, setSubPath] = useState(_initRoute.subPath)
  const periodMenuRef = useRef<HTMLDivElement>(null)
  const viewMenuRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(page)

  // ── Store view configuration (A+D combo) ──
  type StoreView = 'essentiel' | 'complet' | 'pdf'
  interface StoreViewColumns {
    ca: boolean; clients: boolean; pm: boolean; tickets: boolean; fidelite: boolean
    rang: boolean; univers: boolean; universPM: boolean; universTck: boolean; sousFamilles: boolean
  }
  interface StoreViewConfig { view: StoreView; columns: StoreViewColumns }
  const VIEW_PRESETS: Record<StoreView, StoreViewColumns> = {
    essentiel: { ca: true, clients: true, pm: true, tickets: false, fidelite: false, rang: false, univers: false, universPM: false, universTck: false, sousFamilles: false },
    complet: { ca: true, clients: true, pm: true, tickets: true, fidelite: true, rang: true, univers: true, universPM: false, universTck: false, sousFamilles: false },
    pdf: { ca: true, clients: true, pm: true, tickets: true, fidelite: true, rang: true, univers: true, universPM: true, universTck: true, sousFamilles: true },
  }
  const [storeViewConfig, setStoreViewConfig] = useState<StoreViewConfig>({ view: 'essentiel', columns: { ...VIEW_PRESETS.essentiel } })
  const [showViewMenu, setShowViewMenu] = useState(false)

  const setStoreView = (view: StoreView) => {
    setStoreViewConfig({ view, columns: { ...VIEW_PRESETS[view] } })
  }
  const toggleStoreColumn = (col: keyof StoreViewColumns) => {
    setStoreViewConfig(prev => ({
      view: prev.view,
      columns: { ...prev.columns, [col]: !prev.columns[col] }
    }))
  }
  pageRef.current = page
  const { user, logout, canAccess } = useAuth()
  const scrollToTopRef = useRef(true)

  // ─── Convert Settings period types to ones components understand ──
  const resolvePeriod = (p: { type: string; value: string | number; label?: string }) => {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    if (p.type === 'week') {
      const day = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - ((day + 6) % 7))
      return { type: 'custom', value: `${fmt(monday)}_${fmt(today)}`, label: p.label }
    }
    if (p.type === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { type: 'custom', value: `${fmt(first)}_${fmt(today)}`, label: p.label }
    }
    if (p.type === 'ytd') {
      const jan1 = new Date(today.getFullYear(), 0, 1)
      return { type: 'custom', value: `${fmt(jan1)}_${fmt(today)}`, label: p.label }
    }
    return p
  }

  // ─── Load user preferences on mount ─────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('magic_token')
    if (!token) return
    const API = import.meta.env.VITE_API_URL || ''
    fetch(`${API}/api/auth/preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then((prefs: { defaultPage?: string; defaultPeriod?: { type: string; value: string | number; label?: string }; sidebarOpen?: boolean; storeView?: StoreView; scrollToTop?: boolean } | null) => {
        if (!prefs) return
        if (typeof prefs.sidebarOpen === 'boolean') setSidebarOpen(prefs.sidebarOpen)
        if (typeof prefs.scrollToTop === 'boolean') scrollToTopRef.current = prefs.scrollToTop
        if (prefs.storeView && VIEW_PRESETS[prefs.storeView]) setStoreView(prefs.storeView)
        if (prefs.defaultPeriod?.type) setCurrentPeriod(resolvePeriod(prefs.defaultPeriod))
        // Only apply defaultPage if user landed on root (no explicit URL)
        if (prefs.defaultPage && _initRoute.page === 'dashboard' && !_initRoute.subPath) {
          const path = '/' + (TAB_TO_PATH[prefs.defaultPage] || 'dashboard')
          window.history.replaceState({ scrollTop: 0 }, '', path)
          setPage([prefs.defaultPage as TabType, 'right'])
        }
      })
      .catch(() => {})
  }, [])

  // ─── Listen for real-time preference changes from Settings ──────
  useEffect(() => {
    const onPrefsChanged = (e: Event) => {
      const prefs = (e as CustomEvent).detail
      if (!prefs) return
      if (typeof prefs.sidebarOpen === 'boolean') setSidebarOpen(prefs.sidebarOpen)
      if (typeof prefs.scrollToTop === 'boolean') scrollToTopRef.current = prefs.scrollToTop
      if (prefs.storeView && VIEW_PRESETS[prefs.storeView]) setStoreView(prefs.storeView)
      if (prefs.defaultPeriod?.type) setCurrentPeriod(resolvePeriod(prefs.defaultPeriod))
    }
    window.addEventListener('prefs-changed', onPrefsChanged)
    return () => window.removeEventListener('prefs-changed', onPrefsChanged)
  }, [])

  // Obtenir les 5 icônes visibles : 2 avant, 1 actif, 2 après (circulaire)
  const getVisibleTabs = () => {
    const activeIndex = ALL_TABS.findIndex(tab => tab.id === page)
    const visible = []
    
    // 2 à gauche, 1 au centre, 2 à droite = 5 total
    for (let i = -2; i <= 2; i++) {
      const index = (activeIndex + i + ALL_TABS.length) % ALL_TABS.length
      visible.push({
        ...ALL_TABS[index],
        position: i // -2, -1, 0, 1, 2
      })
    }
    
    return visible
  }

  // ─── Navigation: full URL-based routing ─────────────────────────
  const navigate = useCallback((path: string) => {
    const mainEl = document.querySelector('main')
    // Save scroll of current view
    if (mainEl) {
      window.history.replaceState({ ...window.history.state, scrollTop: mainEl.scrollTop }, '')
    }
    window.history.pushState({ scrollTop: 0 }, '', path)
    const { page: newPage, subPath: newSub } = parsePath(path)
    setSubPath(newSub)
    trackPageView(newPage, newSub ? { subPath: newSub } : undefined)
    if (newPage !== pageRef.current) {
      if (scrollToTopRef.current) {
        mainEl?.scrollTo(0, 0)
        window.scrollTo(0, 0)
      }
      const ci = ALL_TABS.findIndex(t => t.id === pageRef.current)
      const ni = ALL_TABS.findIndex(t => t.id === newPage)
      if (ci >= 0 && ni >= 0) {
        const d = ni - ci
        const cd = d > 0 ? Math.min(d, d - ALL_TABS.length) : Math.max(d, d + ALL_TABS.length)
        setPage([newPage, cd > 0 ? 'left' : 'right'])
      } else {
        setPage([newPage, 'right'])
      }
    }
  }, [])

  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  // Tab-level navigation (sidebar / mobile carousel with direction)
  const handleTabChange = (newTab: TabType, visiblePosition?: number) => {
    const path = '/' + (TAB_TO_PATH[newTab] || 'dashboard')
    const mainEl = document.querySelector('main')
    if (mainEl) {
      window.history.replaceState({ ...window.history.state, scrollTop: mainEl.scrollTop }, '')
    }
    if (scrollToTopRef.current) {
      mainEl?.scrollTo(0, 0)
      window.scrollTo(0, 0)
    }
    window.history.pushState({ scrollTop: 0 }, '', path)
    setSubPath('')
    if (visiblePosition !== undefined && visiblePosition !== 0) {
      setPage([newTab, visiblePosition > 0 ? 'right' : 'left'])
    } else {
      const ci = ALL_TABS.findIndex(t => t.id === pageRef.current)
      const ni = ALL_TABS.findIndex(t => t.id === newTab)
      const d = ni - ci
      const cd = d > 0 ? Math.min(d, d - ALL_TABS.length) : Math.max(d, d + ALL_TABS.length)
      setPage([newTab, cd > 0 ? 'left' : 'right'])
    }
  }

  // Browser back/forward
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const { page: newPage, subPath: newSub } = parsePath(window.location.pathname)
      setSubPath(newSub)
      if (newPage !== pageRef.current) {
        setPage([newPage, 'right'])
      }
      // Restore scroll
      const saved = e.state?.scrollTop || 0
      if (saved > 0) {
        const tryRestore = (n: number) => {
          const el = document.querySelector('main')
          if (el && el.scrollHeight >= saved) el.scrollTo(0, saved)
          else if (n > 0) requestAnimationFrame(() => tryRestore(n - 1))
        }
        requestAnimationFrame(() => tryRestore(20))
      }
    }
    window.addEventListener('popstate', onPopState)
    // Set initial history state with current URL
    window.history.replaceState({ scrollTop: 0 }, '', window.location.pathname || '/dashboard')
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const slideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? -100 : 100,
      opacity: 0,
    }),
  }

  // Fermer le menu au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(event.target as Node)) {
        setShowPeriodMenu(false)
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setShowViewMenu(false)
      }
    }

    if (showPeriodMenu || showViewMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPeriodMenu, showViewMenu])

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar Desktop */}
      <aside className={`desktop-sidebar fixed lg:sticky top-0 left-0 h-screen bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-3 border-b border-zinc-800 flex items-center justify-center h-24">
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.img
                  key="logo-open"
                  src="/Logo%20Magic%20Systeme%20texte.png"
                  alt="Magic Système"
                  className="object-contain"
                  style={{ height: '64px', width: 'auto' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              ) : (
                <motion.img
                  key="logo-closed"
                  src="/Logo%20Magic%20Systeme.png"
                  alt="Logo"
                  className="object-contain"
                  style={{ height: '48px', width: 'auto' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
                onClick={() => handleTabChange('dashboard')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'dashboard'
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Home className="w-5 h-5" />
                {sidebarOpen && <span>Vue d'ensemble</span>}
              </button>
              <button
                onClick={() => handleTabChange('search')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'search'
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" />
                {sidebarOpen && <span>Recherche</span>}
              </button>
              
              {sidebarOpen && <div className="px-4 py-2"><p className="text-xs text-zinc-600 font-semibold uppercase">Analyses Avancées</p></div>}
              
              <button
                onClick={() => handleTabChange('rfm')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'rfm'
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                {sidebarOpen && <span>Segmentation RFM</span>}
              </button>
              <button
                onClick={() => handleTabChange('produits')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'produits'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Tag className="w-5 h-5" />
                {sidebarOpen && <span>Produits</span>}
              </button>

              <button
                onClick={() => handleTabChange('zones')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'zones'
                    ? 'bg-green-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Map className="w-5 h-5" />
                {sidebarOpen && <span>Zones Chalandise</span>}
              </button>
              <button
                onClick={() => handleTabChange('stores')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'stores'
                    ? 'bg-teal-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Store className="w-5 h-5" />
                {sidebarOpen && <span>Magasins</span>}
              </button>

              <button
                onClick={() => handleTabChange('surveys')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'surveys'
                    ? 'bg-violet-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                {sidebarOpen && <span>Nos Enquêtes</span>}
              </button>


              {sidebarOpen && <div className="px-4 py-2 mt-4"><p className="text-xs text-zinc-600 font-semibold uppercase">Préférences</p></div>}
              
              <button
                onClick={() => handleTabChange('settings')}
                
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'settings'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5" />
                {sidebarOpen && <span>Préférences</span>}
              </button>

              {canAccess('admin') && (
                <>
                  {sidebarOpen && <div className="px-4 py-2 mt-2"><p className="text-xs text-zinc-600 font-semibold uppercase">Administration</p></div>}
                  <button
                    onClick={() => handleTabChange('admin')}
                    
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      page === 'admin'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    {sidebarOpen && <span>Utilisateurs</span>}
                  </button>
                </>
              )}
            </nav>

        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between" style={{ position: 'relative', zIndex: 10001 }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="desktop-toggle-btn p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-zinc-400" /> : <Menu className="w-5 h-5 text-zinc-400" />}
            </button>
            <h1 className="text-2xl font-bold text-white">
              {page === 'dashboard' && 'Vue d\'ensemble'}
              {page === 'search' && 'Recherche'}
              {page === 'produits' && 'Produits'}
              {page === 'rfm' && 'Segmentation RFM'}

              {page === 'zones' && 'Zones Chalandise'}
              {page === 'stores' && 'Performance Magasins'}

              {page === 'surveys' && 'Enquêtes & Études'}

              {page === 'settings' && 'Préférences'}
              {page === 'admin' && 'Administration'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sélecteur de période */}
          {(page === 'dashboard' || page === 'search' || page === 'produits' || page === 'rfm' || page === 'zones' || page === 'stores') && (
            <div className="relative" ref={periodMenuRef}>
              {/* Bouton carré calendrier */}
              <button 
                onClick={() => { setShowPeriodMenu(!showPeriodMenu); setShowCustomDatePicker(false); setShowYearSubmenu(false) }}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  showPeriodMenu 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
                title="Choisir la période"
              >
                <Calendar className="w-4 h-4" />
              </button>

              {/* Period dropdown */}
              {showPeriodMenu && (
                <div style={{ position: 'absolute', right: -16, marginTop: 8, zIndex: 10002 }}>
                  {/* Menu principal — sert de containing block pour les sous-menus */}
                  <div className="relative rounded-xl" style={{ background: 'rgba(9, 9, 11, 0.80)', border: '1px solid rgba(63, 63, 70, 0.3)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', minWidth: 220 }}>
                    
                    {/* Périodes glissantes */}
                    <div className="p-2 flex flex-col gap-0.5">
                      {[
                        { type: 'months', value: 3, label: 'Les 3 derniers mois' },
                        { type: 'months', value: 6, label: 'Les 6 derniers mois' },
                        { type: 'months', value: 12, label: 'Les 12 derniers mois' },
                      ].map((p) => {
                        const isActive = currentPeriod.type === p.type && String(currentPeriod.value) === String(p.value)
                        return (
                          <button
                            key={`${p.type}-${p.value}`}
                            onClick={() => { setCurrentPeriod({ type: p.type, value: p.value as any }); trackPeriodChange({ type: p.type, value: p.value, label: p.label }); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                              isActive
                                ? 'bg-blue-500/15 text-blue-400 font-medium'
                                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ height: 1, background: 'rgba(63, 63, 70, 0.3)', margin: '0 8px' }} />

                    {/* Par année */}
                    <div className="p-2">
                      <button
                        onClick={() => { setShowYearSubmenu(!showYearSubmenu); setShowCustomDatePicker(false); }}
                        onMouseEnter={() => { setShowYearSubmenu(true); setShowCustomDatePicker(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between transition-all duration-150 ${
                          currentPeriod.type === 'year' || showYearSubmenu
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>Par année</span>
                        <ChevronDown className="w-3 h-3 -rotate-90 opacity-50" />
                      </button>
                    </div>

                    <div style={{ height: 1, background: 'rgba(63, 63, 70, 0.3)', margin: '0 8px' }} />

                    {/* Depuis 2022 (Tout) */}
                    <div className="p-2">
                      <button
                        onClick={() => { setCurrentPeriod({ type: 'all', value: 'all' as any }); trackPeriodChange({ type: 'all', value: 'all', label: 'Toutes périodes' }); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                          currentPeriod.type === 'all'
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        Depuis 2022 (Tout)
                      </button>
                    </div>

                    <div style={{ height: 1, background: 'rgba(63, 63, 70, 0.3)', margin: '0 8px' }} />

                    {/* Période personnalisée */}
                    <div className="p-2">
                      <button
                        onClick={() => { setShowCustomDatePicker(!showCustomDatePicker); setShowYearSubmenu(false); }}
                        onMouseEnter={() => { setShowCustomDatePicker(true); setShowYearSubmenu(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between transition-all duration-150 ${
                          currentPeriod.type === 'custom' || showCustomDatePicker
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>Période personnalisée</span>
                        <ChevronDown className="w-3 h-3 -rotate-90 opacity-50" />
                      </button>
                    </div>

                    <div style={{ height: 1, background: 'rgba(63, 63, 70, 0.3)', margin: '0 8px' }} />

                    {/* Bouton Analyser */}
                    <div className="p-2">
                      <button
                        onClick={() => setShowPeriodMenu(false)}
                        className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-semibold transition-colors"
                      >
                        Analyser
                      </button>
                    </div>

                    {/* ========= SOUS-MENUS (absolute par rapport au menu principal) ========= */}

                    {/* Sous-menu années */}
                    {showYearSubmenu && (
                      <div 
                        className="absolute rounded-xl p-2"
                        style={{ 
                          top: 0,
                          right: 'calc(100% + 6px)',
                          background: 'rgba(9, 9, 11, 0.80)', 
                          border: '1px solid rgba(63, 63, 70, 0.3)', 
                          backdropFilter: 'blur(24px)', 
                          WebkitBackdropFilter: 'blur(24px)',
                          minWidth: 140,
                        }}
                        onMouseLeave={() => setShowYearSubmenu(false)}
                      >
                        {[2025, 2024, 2023, 2022].map(y => {
                          const isActive = currentPeriod.type === 'year' && currentPeriod.value === y
                          return (
                            <button
                              key={y}
                              onClick={() => { setCurrentPeriod({ type: 'year', value: y }); setShowYearSubmenu(false); trackPeriodChange({ type: 'year', value: y }); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                                isActive
                                  ? 'bg-blue-500/15 text-blue-400 font-medium'
                                  : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              {y}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Sous-menu dates personnalisées */}
                    {showCustomDatePicker && (
                      <div 
                        className="absolute rounded-xl p-3"
                        style={{ 
                          top: 0,
                          right: 'calc(100% + 6px)',
                          background: 'rgba(9, 9, 11, 0.80)', 
                          border: '1px solid rgba(63, 63, 70, 0.3)', 
                          backdropFilter: 'blur(24px)', 
                          WebkitBackdropFilter: 'blur(24px)',
                          width: 250,
                        }}
                        onMouseLeave={() => setShowCustomDatePicker(false)}
                      >
                        <p className="text-[11px] font-medium text-zinc-500 mb-3 px-0.5">Sélectionner les dates</p>
                        <div className="flex flex-col gap-3">
                          <div>
                            <label className="text-zinc-400 text-[11px] mb-1.5 block px-0.5">Début</label>
                            <input 
                              type="date" 
                              value={customStartDate} 
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg text-[13px] text-white outline-none transition-colors"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(63, 63, 70, 0.3)' }}
                              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'}
                              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.3)'}
                            />
                          </div>
                          <div>
                            <label className="text-zinc-400 text-[11px] mb-1.5 block px-0.5">Fin</label>
                            <input 
                              type="date" 
                              value={customEndDate} 
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-2.5 py-2 rounded-lg text-[13px] text-white outline-none transition-colors"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(63, 63, 70, 0.3)' }}
                              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'}
                              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.3)'}
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (customStartDate && customEndDate) {
                                const s = new Date(customStartDate), e = new Date(customEndDate)
                                if (s <= e) {
                                  setCurrentPeriod({ type: 'custom', value: `${customStartDate}_${customEndDate}` as any, label: `${s.toLocaleDateString('fr-FR')} → ${e.toLocaleDateString('fr-FR')}` })
                                  trackPeriodChange({ type: 'custom', value: `${customStartDate}_${customEndDate}`, label: `${s.toLocaleDateString('fr-FR')} → ${e.toLocaleDateString('fr-FR')}` })
                                  setShowCustomDatePicker(false)
                                  setShowPeriodMenu(false)
                                }
                              }
                            }}
                            disabled={!customStartDate || !customEndDate}
                            className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-25 disabled:cursor-not-allowed text-white text-[13px] font-medium transition-colors mt-1"
                          >
                            Appliquer
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bouton configuration colonnes (stores uniquement) */}
          {page === 'stores' && (
            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setShowViewMenu(!showViewMenu)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${
                  showViewMenu
                    ? 'bg-teal-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
                title="Configurer les colonnes"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {showViewMenu && (
                <div style={{ position: 'absolute', right: 0, marginTop: 8, zIndex: 10002 }}>
                  <div className="rounded-xl" style={{ background: 'rgba(9, 9, 11, 0.92)', border: '1px solid rgba(63, 63, 70, 0.3)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', width: 260 }}>
                    {/* Pre-made views */}
                    <div className="p-3 pb-2">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">Vues</p>
                      <div className="flex gap-2">
                        {([
                          { id: 'essentiel' as StoreView, label: 'Essentiel', desc: 'CA, Clients, PM' },
                          { id: 'complet' as StoreView, label: 'Complet', desc: '+ Tickets, Rangs, Univers' },
                          { id: 'pdf' as StoreView, label: 'Mode PDF', desc: 'Toutes les données' },
                        ]).map(v => (
                          <button
                            key={v.id}
                            onClick={() => setStoreView(v.id)}
                            className={`px-3 py-1.5 rounded-md text-center transition-all duration-150 ${
                              storeViewConfig.view === v.id
                                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 font-semibold'
                                : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-800 hover:text-white'
                            }`}
                            title={v.desc}
                          >
                            <div className="text-[10px] leading-tight font-medium whitespace-nowrap">{v.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ height: 1, background: 'rgba(63, 63, 70, 0.3)', margin: '0 12px' }} />

                    {/* Column toggles */}
                    <div className="p-3 pt-2 space-y-0.5">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Colonnes</p>
                      {([
                        { key: 'ca' as const, label: 'Chiffre d\'affaires', color: 'text-emerald-400' },
                        { key: 'clients' as const, label: 'Clients', color: 'text-blue-400' },
                        { key: 'pm' as const, label: 'Panier moyen', color: 'text-amber-400' },
                        { key: 'tickets' as const, label: 'Tickets', color: 'text-purple-400' },
                        { key: 'fidelite' as const, label: 'Fidélité', color: 'text-pink-400' },
                        { key: 'rang' as const, label: 'Classements (Sté/Zone)', color: 'text-zinc-400' },
                        { key: 'univers' as const, label: 'CA Mur / Sol / Ameub.', color: 'text-teal-400' },
                        { key: 'universPM' as const, label: 'PM par univers', color: 'text-teal-400/70' },
                        { key: 'universTck' as const, label: 'Tickets par univers', color: 'text-teal-400/50' },
                        { key: 'sousFamilles' as const, label: 'Sous-familles', color: 'text-indigo-400' },
                      ]).map(col => (
                        <button
                          key={col.key}
                          onClick={() => toggleStoreColumn(col.key)}
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all duration-100 ${
                            storeViewConfig.columns[col.key]
                              ? 'bg-white/5 text-white'
                              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            storeViewConfig.columns[col.key]
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-zinc-600'
                          }`}>
                            {storeViewConfig.columns[col.key] && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-[12px]">{col.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
            
            {user && (
              <div className="flex items-center gap-2 ml-2">
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.prenom?.[0]}{user.nom?.[0]}
                  </div>
                  <span className="text-sm text-zinc-300 font-medium">{user.prenom}</span>
                  <span className="text-xs text-zinc-600 capitalize">{user.role.toLowerCase().replace('_', ' ')}</span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="mobile-content flex-1 overflow-y-auto bg-zinc-950">
            {page === 'dashboard' && <div className="p-6"><Dashboard period={currentPeriod} onNavigate={(tab: any, context?: any) => {
              if (context?.clientCarte) navigate('/search/client/' + encodeURIComponent(context.clientCarte))
              else if (context?.productCode) navigate('/search/produit/' + encodeURIComponent(context.productCode))
              else navigate('/' + (TAB_TO_PATH[tab] || 'dashboard'))
            }} /></div>}
            {page === 'search' && <div className="p-6"><SearchPanel
              subPath={subPath}
              navigate={navigate}
              period={currentPeriod}
            /></div>}
            {page === 'produits' && <div className="p-6"><ProductsPanel
              subPath={subPath}
              navigate={navigate}
              period={currentPeriod}
            /></div>}
            {page === 'rfm' && <div className="p-6"><RFMAnalysis data={null}
              subPath={subPath}
              navigate={navigate}
              period={currentPeriod}
              onSearchClient={(carte: string) => navigate('/search/client/' + encodeURIComponent(carte))}
              onSearchProduct={(code: string) => navigate('/search/produit/' + encodeURIComponent(code))}
            /></div>}

            {page === 'zones' && <ZoneChalandise period={currentPeriod} initialStore={subPath?.startsWith('store/') ? subPath.split('/')[1] : undefined} />}
            {page === 'stores' && <div className="p-6"><StorePerformance period={currentPeriod} navigate={navigate} viewConfig={storeViewConfig} subPath={subPath} /></div>}

            {page === 'surveys' && <div className="p-6"><Surveys /></div>}

            {page === 'settings' && <div className="p-6"><SettingsView /></div>}
            {page === 'admin' && <div className="p-6"><AdminUsers subPath={subPath} navigate={navigate} /></div>}
        </main>
      </div>

      {/* Mobile Bottom Navigation - 5 icônes visibles max */}
      <nav className="mobile-bottom-nav">
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={page}
            className="w-full h-full flex items-center justify-between px-6"
            variants={slideVariants}
            custom={direction}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {getVisibleTabs().map((tab) => {
              const Icon = tab.icon
              const isActive = tab.position === 0
              const distance = Math.abs(tab.position)
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id, tab.position)}
                  className={`flex-shrink-0 flex items-center justify-center ${
                    isActive ? tab.color : 'text-zinc-600'
                  }`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: isActive ? 1.5 : distance === 1 ? 0.9 : 0.7,
                    opacity: isActive ? 1 : distance === 1 ? 0.6 : 0.3,
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                >
                  <Icon className="w-8 h-8" strokeWidth={isActive ? 3 : 2} />
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </nav>

      {/* Mobile Drawer Menu */}
      {showMobileMenu && (
        <div 
          className="mobile-menu-drawer fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setShowMobileMenu(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-xl font-bold text-white">Toutes les analyses</h3>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="p-4 space-y-2">
              <button
                onClick={() => { handleTabChange('zones'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Map className="w-6 h-6 text-green-400" />
                <span className="font-medium">Zones Chalandise</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('surveys'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <ClipboardList className="w-6 h-6 text-violet-400" />
                <span className="font-medium">Enquêtes</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('settings'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Settings className="w-6 h-6 text-blue-400" />
                <span className="font-medium">Préférences</span>
              </button>

              <div className="h-4"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
