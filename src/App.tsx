import { useState, lazy, Suspense, useEffect, useRef } from 'react'
import { BarChart3, Search, Home, Users, Settings, Menu, X, Package, ShoppingBag, Store, Activity, Download, Target, Layers, Globe, Crown, Megaphone, Calendar, ChevronDown, Map, MoreHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LoadingFallback } from './components/LoadingFallback'
import './mobile.css'

// Lazy loading des composants - 100% PostgreSQL
// Composants principaux
const DashboardV2 = lazy(() => import('./components/DashboardV2'))

// Composants secondaires - chargement différé
const SearchPanel = lazy(() => import('./components/SearchPanel'))
const RFMAnalysis = lazy(() => import('./components/RFMAnalysis'))
const SubFamilyAnalysis = lazy(() => import('./components/SubFamilyAnalysis'))
const CrossSellingAnalysis = lazy(() => import('./components/CrossSellingAnalysis'))
const CohortAnalysis = lazy(() => import('./components/CohortAnalysis'))
const ABCAnalysis = lazy(() => import('./components/ABCAnalysis'))
const KingQuentin = lazy(() => import('./components/KingQuentin'))
const ZoneChalandise = lazy(() => import('./components/ZoneChalandiseSimple'));
const ZoneChalandiseV3 = lazy(() => import('./components/ZoneChalandiseV3'));
const StorePerformance = lazy(() => import('./components/StorePerformanceV2'))
const ForecastAnomalies = lazy(() => import('./components/ForecastAnomalies'))
const SocialMediaInsights = lazy(() => import('./components/SocialMediaInsights'))
const ExportData = lazy(() => import('./components/ExportData'))
const SettingsView = lazy(() => import('./components/Settings'))

type TabType = 'dashboard' | 'search' | 'rfm' | 'subFamilies' | 'crossSelling' | 'cohortes' | 'abc' | 'kingquentin' | 'zones' | 'zonesv3' | 'stores' | 'forecast' | 'social' | 'exports' | 'settings'

// Définition de tous les onglets pour le carousel mobile
const ALL_TABS = [
  { id: 'dashboard' as TabType, icon: Home, color: 'text-blue-400' },
  { id: 'search' as TabType, icon: Search, color: 'text-blue-400' },
  { id: 'rfm' as TabType, icon: Users, color: 'text-purple-400' },
  { id: 'subFamilies' as TabType, icon: Layers, color: 'text-indigo-400' },
  { id: 'crossSelling' as TabType, icon: ShoppingBag, color: 'text-pink-400' },
  { id: 'cohortes' as TabType, icon: Target, color: 'text-indigo-400' },
  { id: 'abc' as TabType, icon: Package, color: 'text-cyan-400' },
  { id: 'kingquentin' as TabType, icon: Crown, color: 'text-yellow-400' },
  { id: 'zones' as TabType, icon: Map, color: 'text-green-400' },
  { id: 'zonesv3' as TabType, icon: Globe, color: 'text-emerald-400' },
  { id: 'stores' as TabType, icon: Store, color: 'text-teal-400' },
  { id: 'forecast' as TabType, icon: Activity, color: 'text-orange-400' },
  { id: 'social' as TabType, icon: Megaphone, color: 'text-pink-400' },
  { id: 'exports' as TabType, icon: Download, color: 'text-green-400' },
  { id: 'settings' as TabType, icon: Settings, color: 'text-zinc-400' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<{ type: string; value: number | string; label?: string }>({ type: 'all', value: 'all', label: 'Toutes périodes' })
  const [showWebData, setShowWebData] = useState(false)
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)
  const [[page, direction], setPage] = useState<[TabType, 'left' | 'right']>(['dashboard', 'right'])
  const periodMenuRef = useRef<HTMLDivElement>(null)

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

  // Gérer le changement d'onglet avec direction
  const handleTabChange = (newTab: TabType, visiblePosition?: number) => {
    // Si le clic vient des 5 icônes visibles, utiliser leur position réelle à l'écran
    if (visiblePosition !== undefined && visiblePosition !== 0) {
      const newDirection = visiblePosition > 0 ? 'right' : 'left'
      setPage([newTab, newDirection])
      return
    }

    const currentIndex = ALL_TABS.findIndex(tab => tab.id === page)
    const newIndex = ALL_TABS.findIndex(tab => tab.id === newTab)
    
    // Calculer la direction la plus courte en mode circulaire
    const diff = newIndex - currentIndex
    const circularDiff = diff > 0 
      ? Math.min(diff, diff - ALL_TABS.length)
      : Math.max(diff, diff + ALL_TABS.length)
    
    // Inverser la logique : si on va vers l'index supérieur, glisser vers la gauche
    const newDirection = circularDiff > 0 ? 'left' : 'right'
    setPage([newTab, newDirection])
  }

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
    }

    if (showPeriodMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPeriodMenu])

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
                  src="/Logo%20Magic%20Système%20texte.png"
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
                  src="/Logo%20Magic%20Système.png"
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
                onClick={() => handleTabChange('subFamilies')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'subFamilies'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Layers className="w-5 h-5" />
                {sidebarOpen && <span>Sous-familles</span>}
              </button>
              <button
                onClick={() => handleTabChange('crossSelling')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'crossSelling'
                    ? 'bg-pink-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                {sidebarOpen && <span>Cross-Selling</span>}
              </button>
              <button
                onClick={() => handleTabChange('cohortes')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'cohortes'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Target className="w-5 h-5" />
                {sidebarOpen && <span>Cohortes</span>}
              </button>
              <button
                onClick={() => handleTabChange('abc')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'abc'
                    ? 'bg-cyan-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                {sidebarOpen && <span>ABC Analysis</span>}
              </button>
              <button
                onClick={() => handleTabChange('kingquentin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'kingquentin'
                    ? 'bg-yellow-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Crown className="w-5 h-5" />
                {sidebarOpen && <span>King Quentin</span>}
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
                {sidebarOpen && <span>Zone de Chalandise</span>}
              </button>
              <button
                onClick={() => handleTabChange('zonesv3')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'zonesv3'
                    ? 'bg-emerald-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Globe className="w-5 h-5" />
                {sidebarOpen && <span>Zone de Chalandise V2</span>}
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
                onClick={() => handleTabChange('forecast')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'forecast'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Activity className="w-5 h-5" />
                {sidebarOpen && <span>Prévisions</span>}
              </button>
              <button
                onClick={() => handleTabChange('social')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'social'
                    ? 'bg-pink-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Megaphone className="w-5 h-5" />
                {sidebarOpen && <span>Réseaux Sociaux</span>}
              </button>
              <button
                onClick={() => handleTabChange('exports')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'exports'
                    ? 'bg-green-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Download className="w-5 h-5" />
                {sidebarOpen && <span>Exports</span>}
              </button>

              {sidebarOpen && <div className="px-4 py-2 mt-4"><p className="text-xs text-zinc-600 font-semibold uppercase">Paramètres</p></div>}
              
              <button
                onClick={() => handleTabChange('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  page === 'settings'
                    ? 'bg-zinc-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5" />
                {sidebarOpen && <span>Paramètres</span>}
              </button>
            </nav>

        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
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
              {page === 'rfm' && 'Segmentation RFM'}
              {page === 'subFamilies' && 'Sous-familles'}
              {page === 'crossSelling' && 'Analyse Cross-Selling'}
              {page === 'cohortes' && 'Analyse de Cohortes'}
              {page === 'abc' && 'ABC Analysis'}
              {page === 'kingquentin' && 'King Quentin 👑'}
              {page === 'zones' && 'Zone de Chalandise 🗺️'}
              {page === 'zonesv3' && 'Zone de Chalandise V2 🗺️'}
              {page === 'stores' && 'Performance Magasins'}
              {page === 'forecast' && 'Prévisions & Anomalies'}
              {page === 'social' && 'Réseaux Sociaux'}
              {page === 'exports' && 'Exports de données'}
              {page === 'settings' && 'Paramètres'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sélecteur de période - Dropdown */}
          {page === 'dashboard' && (
            <div className="relative" ref={periodMenuRef}>
              <button 
                onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-white font-medium transition-all"
              >
                <Calendar className="w-4 h-4" />
                <span>
                  {currentPeriod.type === 'year' && `${currentPeriod.value}`}
                  {currentPeriod.type === 'months' && `${currentPeriod.value} mois`}
                  {currentPeriod.type === 'all' && 'Tout'}
                  {currentPeriod.type === 'custom' && currentPeriod.label}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Dropdown menu */}
              {showPeriodMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50">
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setCurrentPeriod({ type: 'months', value: 3 })
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        currentPeriod.type === 'months' && currentPeriod.value === 3
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      3 derniers mois
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPeriod({ type: 'months', value: 6 })
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        currentPeriod.type === 'months' && currentPeriod.value === 6
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      6 derniers mois
                    </button>
                    <div className="border-t border-zinc-700 my-1"></div>
                    <button
                      onClick={() => {
                        setCurrentPeriod({ type: 'year', value: 2024 })
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        currentPeriod.type === 'year' && currentPeriod.value === 2024
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Année 2024
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPeriod({ type: 'year', value: 2025 })
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        currentPeriod.type === 'year' && currentPeriod.value === 2025
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Année 2025
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPeriod({ type: 'all', value: 'all' as any })
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        currentPeriod.type === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Toutes les périodes
                    </button>
                    <div className="border-t border-zinc-700 my-1"></div>
                    <button
                      onClick={() => {
                        setShowCustomDatePicker(!showCustomDatePicker)
                        setShowPeriodMenu(false)
                      }}
                      className={`w-full text-left px-4 py-2 transition-all ${
                        showCustomDatePicker
                          ? 'bg-purple-600 text-white'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Période personnalisée...
                    </button>
                  </div>
                </div>
              )}

              {/* Custom date picker popup */}
              {showCustomDatePicker && (
                <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl z-50 w-80">
                  <h3 className="text-white font-bold mb-3">Sélectionner une période</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-zinc-400 text-xs mb-1 block font-medium">Date de début</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-xs mb-1 block font-medium">Date de fin</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCustomDatePicker(false)}
                        className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          if (customStartDate && customEndDate) {
                            const startObj = new Date(customStartDate);
                            const endObj = new Date(customEndDate);
                            if (startObj <= endObj) {
                              setCurrentPeriod({ 
                                type: 'custom', 
                                value: `${customStartDate}_${customEndDate}` as any,
                                label: `${new Date(customStartDate).toLocaleDateString('fr-FR')} - ${new Date(customEndDate).toLocaleDateString('fr-FR')}`
                              })
                              setShowCustomDatePicker(false)
                            } else {
                              alert('La date de début doit être avant la date de fin')
                            }
                          } else {
                            alert('Veuillez sélectionner les deux dates')
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium text-sm transition-all"
                      >
                        Appliquer
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomDatePicker(false)}
                    className="absolute top-2 right-2 text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
            
            {/* Toggle Web/Magasin */}
            <button
              onClick={() => setShowWebData(!showWebData)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border text-sm ${
                showWebData
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30'
                  : 'bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30'
              }`}
            >
              {showWebData ? (
                <>
                  <Globe className="w-4 h-4" />
                  <span>Web</span>
                </>
              ) : (
                <>
                  <Store className="w-4 h-4" />
                  <span>Magasin</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="mobile-content flex-1 overflow-y-auto bg-zinc-950">
          <Suspense fallback={<LoadingFallback />}>
            {page === 'dashboard' && <div className="p-6"><DashboardV2 period={currentPeriod} onNavigate={handleTabChange} /></div>}
            {page === 'search' && <div className="p-6"><SearchPanel data={null} /></div>}
            {page === 'rfm' && <div className="p-6"><RFMAnalysis data={null} showWebData={showWebData} /></div>}
            {page === 'subFamilies' && <div className="p-6"><SubFamilyAnalysis data={null} showWebData={showWebData} /></div>}
            {page === 'crossSelling' && <div className="p-6"><CrossSellingAnalysis data={null} /></div>}
            {page === 'cohortes' && <div className="p-6"><CohortAnalysis /></div>}
            {page === 'abc' && <div className="p-6"><ABCAnalysis /></div>}
            {page === 'kingquentin' && <div className="p-6"><KingQuentin data={null} /></div>}
            {page === 'zones' && <ZoneChalandise />}
            {page === 'zonesv3' && <ZoneChalandiseV3 />}
            {page === 'stores' && <div className="p-6"><StorePerformance /></div>}
            {page === 'forecast' && <div className="p-6"><ForecastAnomalies /></div>}
            {page === 'social' && <div className="p-6"><SocialMediaInsights data={null} /></div>}
            {page === 'exports' && <div className="p-6"><ExportData data={null} /></div>}
            {page === 'settings' && <div className="p-6"><SettingsView /></div>}
          </Suspense>
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
                onClick={() => { handleTabChange('subFamilies'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Layers className="w-6 h-6 text-indigo-400" />
                <span className="font-medium">Sous-familles</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('crossSelling'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <ShoppingBag className="w-6 h-6 text-pink-400" />
                <span className="font-medium">Cross-Selling</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('cohortes'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Target className="w-6 h-6 text-indigo-400" />
                <span className="font-medium">Cohortes</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('abc'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Package className="w-6 h-6 text-cyan-400" />
                <span className="font-medium">ABC Analysis</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('kingquentin'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Crown className="w-6 h-6 text-yellow-400" />
                <span className="font-medium">King Quentin</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('zones'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Map className="w-6 h-6 text-green-400" />
                <span className="font-medium">Zone de Chalandise</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('zonesv3'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Globe className="w-6 h-6 text-emerald-400" />
                <span className="font-medium">Zone de Chalandise V2</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('forecast'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Activity className="w-6 h-6 text-orange-400" />
                <span className="font-medium">Prévisions</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('social'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Megaphone className="w-6 h-6 text-pink-400" />
                <span className="font-medium">Réseaux Sociaux</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('exports'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Download className="w-6 h-6 text-green-400" />
                <span className="font-medium">Exports</span>
              </button>
              
              <button
                onClick={() => { handleTabChange('settings'); setShowMobileMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Settings className="w-6 h-6 text-zinc-400" />
                <span className="font-medium">Paramètres</span>
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
