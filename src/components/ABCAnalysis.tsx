import { Package, TrendingDown, Star, AlertTriangle } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { LazyPieChart as PieChart, LazyPie as Pie, LazyCell as Cell, LazyResponsiveContainer as ResponsiveContainer, LazyTooltip as Tooltip, ChartFallback } from '../utils/lazyRecharts'

const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache global
let abcCache: { data: any; timestamp: number } | null = null

export default function ABCAnalysis() {
  const [channel, setChannel] = useState<'all' | 'mag' | 'web'>('all')
  const [level, setLevel] = useState<'familles' | 'sousFamilles' | 'produits'>('familles')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier le cache
        const now = Date.now()
        if (abcCache && (now - abcCache.timestamp < CACHE_DURATION)) {
          console.log('🔍 ABC: Utilisation cache')
          setData(abcCache.data)
          setLoading(false)
          return
        }

        console.log('🔄 ABC: Chargement depuis API')
        setLoading(true)
        
        const response = await fetch(`${API_URL}/api/abc-analysis`)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        
        const result = await response.json()
        
        // Mettre en cache
        abcCache = { data: result, timestamp: Date.now() }
        
        setData(result)
        console.log('✅ ABC: Données chargées')
      } catch (err: any) {
        console.error('❌ Erreur chargement ABC:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Chargement...</div></div>
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-red-400">Erreur: {error}</div></div>
  }
  
  if (!data || !data.familles) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée</div></div>
  }
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  
  // Sélectionner les données selon le canal et le niveau
  const getData = () => {
    if (level === 'familles') {
      return channel === 'all' ? data.familles : 
             channel === 'mag' ? data.famillesMag : data.famillesWeb
    } else if (level === 'sousFamilles') {
      return channel === 'all' ? data.sousFamilles :
             channel === 'mag' ? data.sousFamillesMag : data.sousFamillesWeb
    } else {
      return channel === 'all' ? data.produits :
             channel === 'mag' ? data.produitsMag : data.produitsWeb
    }
  }
  
  const sourceData = getData()
  
  // Analyse ABC
  const analyzeABC = () => {
    const items: any[] = Object.entries(sourceData).map(([key, stats]: [string, any]) => {
      let name = key
      if (level === 'sousFamilles') {
        const parts = key.split('|||')
        name = `${parts[0]} > ${parts[1]}`
      }
      return {
        name,
        ca: stats.ca,
        volume: stats.volume,
        famille: stats.famille || '-',
        category: '',
        color: '',
        priority: '',
        cumulativePercent: 0,
        rank: 0,
      }
    })
    
    items.sort((a, b) => b.ca - a.ca)
    
    const totalCA = items.reduce((sum, item) => sum + item.ca, 0)
    let cumulativeCA = 0
    
    items.forEach((item, idx) => {
      cumulativeCA += item.ca
      const cumulativePercent = (cumulativeCA / totalCA) * 100
      
      if (cumulativePercent <= 80) {
        item.category = 'A'
        item.color = 'emerald'
        item.priority = '🌟 Star'
      } else if (cumulativePercent <= 95) {
        item.category = 'B'
        item.color = 'blue'
        item.priority = '💰 Cash Cow'
      } else {
        item.category = 'C'
        item.color = 'zinc'
        item.priority = '⚠️ Question Mark'
      }
      
      item.cumulativePercent = cumulativePercent
      item.rank = idx + 1
    })
    
    return items
  }
  
  const items = analyzeABC()
  
  const categoryStats = items.reduce((acc: any, item: any) => {
    if (!acc[item.category]) {
      acc[item.category] = { count: 0, ca: 0, volume: 0 }
    }
    acc[item.category].count++
    acc[item.category].ca += item.ca
    acc[item.category].volume += item.volume
    return acc
  }, {})
  
  const pieData = Object.entries(categoryStats).map(([cat, stats]: [string, any]) => ({
    name: `Catégorie ${cat}`,
    value: stats.ca,
    count: stats.count,
  }))
  
  const COLORS_PIE: { [key: string]: string } = {
    'Catégorie A': '#10b981',
    'Catégorie B': '#3b82f6',
    'Catégorie C': '#71717a',
  }
  
  const totalCA = items.reduce((sum, item) => sum + item.ca, 0)
  
  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Analyse ABC</h2>
            <p className="text-zinc-400">Classification par contribution au CA (A: 80%, B: 15%, C: 5%)</p>
          </div>
        </div>
        
        {/* Filtres */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-zinc-400 font-semibold uppercase mb-2">Canal</label>
            <div className="flex gap-2">
              <button
                onClick={() => setChannel('all')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  channel === 'all'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setChannel('mag')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  channel === 'mag'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Magasins
              </button>
              <button
                onClick={() => setChannel('web')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  channel === 'web'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Web
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs text-zinc-400 font-semibold uppercase mb-2">Niveau</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLevel('familles')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  level === 'familles'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Familles
              </button>
              <button
                onClick={() => setLevel('sousFamilles')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  level === 'sousFamilles'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Sous-Familles
              </button>
              <button
                onClick={() => setLevel('produits')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  level === 'produits'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Produits
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats par catégorie */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['A', 'B', 'C'].map(cat => {
          const stats = categoryStats[cat] || { count: 0, ca: 0, volume: 0 }
          const color = cat === 'A' ? 'emerald' : cat === 'B' ? 'blue' : 'zinc'
          const icon = cat === 'A' ? Star : cat === 'B' ? TrendingDown : AlertTriangle
          const Icon = icon
          
          return (
            <div key={cat} className={`glass rounded-2xl p-6 border border-${color}-500/20`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 bg-${color}-500/20 rounded-xl`}>
                  <Icon className={`w-6 h-6 text-${color}-400`} />
                </div>
                <h3 className={`text-2xl font-bold text-${color}-400`}>Catégorie {cat}</h3>
              </div>
              
              <div className="space-y-3">
                <div className={`bg-${color}-500/10 rounded-xl p-3 border border-${color}-500/20`}>
                  <p className="text-xs text-zinc-400 font-semibold uppercase">Nombre</p>
                  <p className="text-2xl font-bold text-white">{stats.count}</p>
                  <p className="text-xs text-zinc-500">{((stats.count / items.length) * 100).toFixed(1)}% du total</p>
                </div>
                <div className={`bg-${color}-500/10 rounded-xl p-3 border border-${color}-500/20`}>
                  <p className="text-xs text-zinc-400 font-semibold uppercase">CA</p>
                  <p className="text-2xl font-bold text-white">{formatEuro(stats.ca)}</p>
                  <p className="text-xs text-zinc-500">{((stats.ca / totalCA) * 100).toFixed(1)}% du CA</p>
                </div>
                <div className={`bg-${color}-500/10 rounded-xl p-3 border border-${color}-500/20`}>
                  <p className="text-xs text-zinc-400 font-semibold uppercase">Volume</p>
                  <p className="text-2xl font-bold text-white">{stats.volume.toLocaleString('fr-FR')}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Graphique Pie */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">Répartition du CA par Catégorie</h3>
        {pieData && pieData.length > 0 ? (
          <Suspense fallback={<ChartFallback />}>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${((entry.value / totalCA) * 100).toFixed(1)}%`}
                  outerRadius={130}
                  dataKey="value"
                  stroke="#18181b"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_PIE[entry.name]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatEuro(value)}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    color: '#ffffff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Suspense>
        ) : (
          <div className="text-center text-zinc-400 py-20">Aucune donnée à afficher</div>
        )}
      </div>
      
      {/* Tableau détaillé */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">Classement Détaillé (Top 50)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Nom</th>
                <th className="px-4 py-3 text-center text-xs font-black uppercase">Catégorie</th>
                <th className="px-4 py-3 text-center text-xs font-black uppercase">Priorité</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">CA</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">% CA</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">% Cumulé</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Volume</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 50).map((item) => (
                <tr key={item.name} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-${item.color}-500/20 text-${item.color}-400 font-bold text-sm`}>
                      {item.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white max-w-xs truncate">{item.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full bg-${item.color}-500/20 border border-${item.color}-500/30 text-${item.color}-400 font-bold text-xs`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{item.priority}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatEuro(item.ca)}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{((item.ca / totalCA) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-cyan-400">{item.cumulativePercent.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-300">{item.volume.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
