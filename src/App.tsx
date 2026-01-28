import { useState, lazy, Suspense, useEffect, useRef } from 'react'
import { BarChart3, Search, Home, Users, Settings, Menu, X, Package, ShoppingBag, Store, Activity, Download, Target, Layers, Globe, Crown, Megaphone, Calendar, ChevronDown } from 'lucide-react'
import { LoadingFallback } from './components/LoadingFallback'

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
const StorePerformance = lazy(() => import('./components/StorePerformance'))
const ForecastAnomalies = lazy(() => import('./components/ForecastAnomalies'))
const SocialMediaInsights = lazy(() => import('./components/SocialMediaInsights'))
const ExportData = lazy(() => import('./components/ExportData'))

type TabType = 'dashboard' | 'search' | 'rfm' | 'subFamilies' | 'crossSelling' | 'cohortes' | 'abc' | 'kingquentin' | 'stores' | 'forecast' | 'social' | 'exports'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<{ type: string; value: number | string; label?: string }>({ type: 'year', value: 2025 })
  const [showWebData, setShowWebData] = useState(false)
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const periodMenuRef = useRef<HTMLDivElement>(null)

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
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-zinc-800 flex items-center justify-center">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <img src="/logo-magicsysteme.svg" alt="Magic Système" className="w-8 h-8" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
                <BarChart3 className="w-8 h-8 text-blue-500 hidden" />
                <span className="text-xl font-bold text-white">Magic Système</span>
              </div>
            ) : (
              <>
                <img src="/logo-magicsysteme.svg" alt="Logo" className="w-6 h-6" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }} />
                <BarChart3 className="w-6 h-6 text-blue-500 hidden" />
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Home className="w-5 h-5" />
                {sidebarOpen && <span>Vue d'ensemble</span>}
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'search'
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" />
                {sidebarOpen && <span>Recherche</span>}
              </button>
              
              {sidebarOpen && <div className="px-4 py-2"><p className="text-xs text-zinc-600 font-semibold uppercase">Analyses Avancées</p></div>}
              
              <button
                onClick={() => setActiveTab('rfm')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'rfm'
                    ? 'bg-purple-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                {sidebarOpen && <span>Segmentation RFM</span>}
              </button>
              <button
                onClick={() => setActiveTab('subFamilies')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'subFamilies'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Layers className="w-5 h-5" />
                {sidebarOpen && <span>Sous-familles</span>}
              </button>
              <button
                onClick={() => setActiveTab('crossSelling')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'crossSelling'
                    ? 'bg-pink-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                {sidebarOpen && <span>Cross-Selling</span>}
              </button>
              <button
                onClick={() => setActiveTab('cohortes')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'cohortes'
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Target className="w-5 h-5" />
                {sidebarOpen && <span>Cohortes</span>}
              </button>
              <button
                onClick={() => setActiveTab('abc')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'abc'
                    ? 'bg-cyan-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Package className="w-5 h-5" />
                {sidebarOpen && <span>ABC Analysis</span>}
              </button>
              <button
                onClick={() => setActiveTab('kingquentin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'kingquentin'
                    ? 'bg-yellow-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Crown className="w-5 h-5" />
                {sidebarOpen && <span>King Quentin</span>}
              </button>
              <button
                onClick={() => setActiveTab('stores')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'stores'
                    ? 'bg-teal-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Store className="w-5 h-5" />
                {sidebarOpen && <span>Magasins</span>}
              </button>
              <button
                onClick={() => setActiveTab('forecast')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'forecast'
                    ? 'bg-orange-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Activity className="w-5 h-5" />
                {sidebarOpen && <span>Prévisions</span>}
              </button>
              <button
                onClick={() => setActiveTab('social')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'social'
                    ? 'bg-pink-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Megaphone className="w-5 h-5" />
                {sidebarOpen && <span>Réseaux Sociaux</span>}
              </button>
              <button
                onClick={() => setActiveTab('exports')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'exports'
                    ? 'bg-green-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Download className="w-5 h-5" />
                {sidebarOpen && <span>Exports</span>}
              </button>

              {sidebarOpen && <div className="px-4 py-2 mt-4"><p className="text-xs text-zinc-600 font-semibold uppercase">Paramètres</p></div>}
              
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
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
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-zinc-400" /> : <Menu className="w-5 h-5 text-zinc-400" />}
            </button>
            <h1 className="text-2xl font-bold text-white">
              {activeTab === 'dashboard' && 'Vue d\'ensemble'}
              {activeTab === 'search' && 'Recherche'}
              {activeTab === 'rfm' && 'Segmentation RFM'}
              {activeTab === 'subFamilies' && 'Sous-familles'}
              {activeTab === 'crossSelling' && 'Analyse Cross-Selling'}
              {activeTab === 'cohortes' && 'Analyse de Cohortes'}
              {activeTab === 'abc' && 'ABC Analysis'}
              {activeTab === 'kingquentin' && 'King Quentin 👑'}
              {activeTab === 'stores' && 'Performance Magasins'}
              {activeTab === 'forecast' && 'Prévisions & Anomalies'}
              {activeTab === 'social' && 'Réseaux Sociaux'}
              {activeTab === 'exports' && 'Exports de données'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Sélecteur de période - Dropdown */}
          {activeTab === 'dashboard' && (
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
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'dashboard' && <DashboardV2 period={currentPeriod} onNavigate={setActiveTab} />}
            {activeTab === 'search' && <SearchPanel data={null} />}
            {activeTab === 'rfm' && <RFMAnalysis data={null} showWebData={showWebData} />}
            {activeTab === 'subFamilies' && <SubFamilyAnalysis data={null} showWebData={showWebData} />}
            {activeTab === 'crossSelling' && <CrossSellingAnalysis data={null} />}
            {activeTab === 'cohortes' && <CohortAnalysis />}
            {activeTab === 'abc' && <ABCAnalysis />}
            {activeTab === 'kingquentin' && <KingQuentin />}
            {activeTab === 'stores' && <StorePerformance />}
            {activeTab === 'forecast' && <ForecastAnomalies />}
            {activeTab === 'social' && <SocialMediaInsights data={null} />}
            {activeTab === 'exports' && <ExportData data={null} />}
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default App
