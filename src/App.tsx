import { useState, lazy, Suspense } from 'react'
import { BarChart3, Search, Home, Users, Settings, Menu, X, Package, ShoppingBag, Store, Activity, Download, Target, Layers, Globe, Crown, Megaphone } from 'lucide-react'
import FileUploader from './components/FileUploader'

// Lazy loading des composants pour accélérer le chargement initial
const Dashboard = lazy(() => import('./components/Dashboard'))
const WebDashboard = lazy(() => import('./components/WebDashboard'))
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

type TabType = 'dashboard' | 'web' | 'search' | 'rfm' | 'subFamilies' | 'crossSelling' | 'cohortes' | 'abc' | 'kingquentin' | 'stores' | 'forecast' | 'social' | 'exports'

function App() {
  const [data, setData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-zinc-800 flex items-center justify-center">
            {sidebarOpen ? (
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-500" />
                <span className="text-xl font-bold text-white">Décor Analytics</span>
              </div>
            ) : (
              <BarChart3 className="w-6 h-6 text-blue-500" />
            )}
          </div>

          {/* Navigation */}
          {data && (
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
                onClick={() => setActiveTab('web')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === 'web'
                    ? 'bg-cyan-500 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Globe className="w-5 h-5" />
                {sidebarOpen && <span>E-Commerce</span>}
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
          )}
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
              {!data && 'Bienvenue'}
              {data && activeTab === 'dashboard' && 'Vue d\'ensemble'}
              {data && activeTab === 'web' && 'Web Dashboard'}
              {data && activeTab === 'search' && 'Recherche'}
              {data && activeTab === 'rfm' && 'Segmentation RFM'}
              {data && activeTab === 'subFamilies' && 'Sous-familles'}
              {data && activeTab === 'crossSelling' && 'Analyse Cross-Selling'}
              {data && activeTab === 'cohortes' && 'Analyse de Cohortes'}
              {data && activeTab === 'abc' && 'ABC Analysis'}
              {data && activeTab === 'kingquentin' && 'King Quentin 👑'}
              {data && activeTab === 'stores' && 'Performance Magasins'}
              {data && activeTab === 'forecast' && 'Prévisions & Anomalies'}
              {data && activeTab === 'social' && 'Réseaux Sociaux'}
              {data && activeTab === 'exports' && 'Exports de données'}
            </h1>
          </div>
          {data && (
            <div className="flex items-center gap-4">
              <div className="glass px-4 py-2 rounded-lg">
                <p className="text-sm text-zinc-400">Période analysée</p>
                <p className="text-lg font-bold text-white">
                  {data.dateRange.min} - {data.dateRange.max}
                </p>
              </div>
            </div>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          {!data ? (
            <FileUploader onDataLoaded={setData} />
          ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            }>
              {activeTab === 'dashboard' && <Dashboard data={data} onNavigate={setActiveTab} />}
              {activeTab === 'web' && <WebDashboard data={data} />}
              {activeTab === 'search' && <SearchPanel data={data} />}
              {activeTab === 'rfm' && <RFMAnalysis data={data} />}
              {activeTab === 'subFamilies' && <SubFamilyAnalysis data={data} />}
              {activeTab === 'crossSelling' && <CrossSellingAnalysis data={data} />}
              {activeTab === 'cohortes' && <CohortAnalysis data={data} />}
              {activeTab === 'abc' && <ABCAnalysis data={data} />}
              {activeTab === 'kingquentin' && <KingQuentin data={data} />}
              {activeTab === 'stores' && <StorePerformance data={data} />}
              {activeTab === 'forecast' && <ForecastAnomalies data={data} />}
              {activeTab === 'social' && <SocialMediaInsights data={data} />}
              {activeTab === 'exports' && <ExportData data={data} />}
            </Suspense>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
