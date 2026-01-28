import { Store, Target } from 'lucide-react'
import { useState, useEffect, Suspense } from 'react'
import { LazyBarChart as BarChart, LazyBar as Bar, LazyXAxis as XAxis, LazyYAxis as YAxis, LazyCartesianGrid as CartesianGrid, LazyTooltip as Tooltip, LazyResponsiveContainer as ResponsiveContainer, ChartFallback } from '../utils/lazyRecharts'

const API_URL = import.meta.env.VITE_API_URL || 'https://ms-v2.vercel.app'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Cache global
let storeCache: { data: any; timestamp: number } | null = null

export default function StorePerformance() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Vérifier le cache
        const now = Date.now()
        if (storeCache && (now - storeCache.timestamp < CACHE_DURATION)) {
          console.log('🔍 Stores: Utilisation cache')
          setData(storeCache.data)
          setLoading(false)
          return
        }

        console.log('🔄 Stores: Chargement depuis API')
        setLoading(true)
        
        const response = await fetch(`${API_URL}/api/stores`)
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`)
        
        const result = await response.json()
        
        // Mettre en cache
        storeCache = { data: result, timestamp: Date.now() }
        
        setData(result)
        console.log('✅ Stores: Données chargées')
      } catch (err: any) {
        console.error('❌ Erreur chargement Stores:', err)
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
  
  if (!data || !data.geo || !data.geo.magasins) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-zinc-400">Aucune donnée</div></div>
  }
  
  console.log('🏪 DEBUG StorePerformance - data.geo.magasins:', data.geo.magasins)
  console.log('🏪 Nombre de magasins:', Object.keys(data.geo.magasins).length)
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  
  // Préparer les données des magasins
  const magasins: any[] = Object.entries(data.geo.magasins)
    .filter(([mag, stats]: [string, any]) => stats && stats.ca && stats.volume)
    .map(([mag, stats]: [string, any]) => ({
      mag,
      ca: stats.ca || 0,
      volume: stats.volume || 0,
      panierMoyen: (stats.ca || 0) / (stats.volume || 1),
      perfCA: 0,
      perfVolume: 0,
      indexPanier: 0,
      scoreGlobal: 0,
      category: '',
      color: '',
    }))
  
  const totalCAMag = magasins.reduce((sum, m) => sum + m.ca, 0)
  const totalVolumeMag = magasins.reduce((sum, m) => sum + m.volume, 0)
  const avgPanierMag = totalCAMag / totalVolumeMag
  
  // Calculer les performances relatives
  magasins.forEach(mag => {
    mag.perfCA = (mag.ca / totalCAMag) * 100
    mag.perfVolume = (mag.volume / totalVolumeMag) * 100
    mag.indexPanier = (mag.panierMoyen / avgPanierMag) * 100
    
    // Score global (moyenne des 3 indices)
    mag.scoreGlobal = (mag.perfCA + mag.perfVolume + mag.indexPanier) / 3
    
    // Classification
    if (mag.scoreGlobal >= 120) {
      mag.category = '🏆 Excellence'
      mag.color = 'emerald'
    } else if (mag.scoreGlobal >= 100) {
      mag.category = '✅ Performant'
      mag.color = 'blue'
    } else if (mag.scoreGlobal >= 80) {
      mag.category = '⚠️ À Surveiller'
      mag.color = 'orange'
    } else {
      mag.category = '❌ En Difficulté'
      mag.color = 'red'
    }
  })
  
  magasins.sort((a, b) => b.scoreGlobal - a.scoreGlobal)
  
  // Stats Web
  const webCA = data.webStats.ca
  const webVolume = data.webStats.volume
  const webPanierMoyen = webVolume > 0 ? webCA / webVolume : 0
  
  const totalCA = totalCAMag + webCA
  const totalVolume = totalVolumeMag + webVolume
  
  // Comparaison Web vs Magasins
  const webVsMagData = [
    { name: 'Magasins', ca: totalCAMag, volume: totalVolumeMag },
    { name: 'Web', ca: webCA, volume: webVolume },
  ]
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl">
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Performance Magasins</h2>
            <p className="text-zinc-400">Benchmarking et comparaison Web vs Magasins</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Magasins</p>
            <p className="text-2xl font-bold text-white mt-1">{magasins.length}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Magasins</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCAMag)}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">CA Web</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(webCA)}</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Part Web</p>
            <p className="text-2xl font-bold text-white mt-1">{((webCA / totalCA) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
            <p className="text-xs text-zinc-500 font-semibold uppercase">Panier Moyen</p>
            <p className="text-2xl font-bold text-white mt-1">{formatEuro(totalCA / totalVolume)}</p>
          </div>
        </div>
      </div>
      
      {/* Comparaison Web vs Magasins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-8 border border-zinc-800">
          <h3 className="text-xl font-bold text-white mb-6">Comparaison CA</h3>
          <Suspense fallback={<ChartFallback />}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={webVsMagData}>
                <defs>
                  <linearGradient id="colorMag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.9}/>
                  </linearGradient>
                  <linearGradient id="colorWeb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" />
                <YAxis tickFormatter={formatEuro} stroke="#71717a" />
                <Tooltip 
                  formatter={(value: any) => formatEuro(value)}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '12px',
                    color: '#ffffff'
                  }}
                />
                <Bar dataKey="ca" radius={[8, 8, 0, 0]}>
                  {webVsMagData.map((_, index) => (
                    <Bar key={index} fill={index === 0 ? 'url(#colorMag)' : 'url(#colorWeb)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Suspense>
        </div>
        
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6 border border-emerald-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <Store className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Magasins Physiques</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase">CA</p>
                <p className="text-xl font-bold text-white">{formatEuro(totalCAMag)}</p>
                <p className="text-xs text-emerald-400">{((totalCAMag / totalCA) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase">Panier Moyen</p>
                <p className="text-xl font-bold text-white">{formatEuro(avgPanierMag)}</p>
              </div>
            </div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white">E-commerce (Dépôts Logistiques)</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase">CA</p>
                <p className="text-xl font-bold text-white">{formatEuro(webCA)}</p>
                <p className="text-xs text-purple-400">{((webCA / totalCA) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20">
                <p className="text-xs text-zinc-400 font-semibold uppercase">Panier Moyen</p>
                <p className="text-xl font-bold text-white">{formatEuro(webPanierMoyen)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Podium Top 3 */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">🏆 Podium des Meilleurs Magasins</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {magasins.slice(0, 3).map((mag, idx) => {
            const medals = ['🥇', '🥈', '🥉']
            const colors = ['from-yellow-500 to-orange-500', 'from-gray-400 to-gray-600', 'from-orange-600 to-amber-700']
            
            return (
              <div key={mag.mag} className={`bg-gradient-to-br ${colors[idx]} rounded-2xl p-6 text-white shadow-2xl transform hover:scale-105 transition-all`}>
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">{medals[idx]}</div>
                  <div className="text-2xl font-black">{mag.mag}</div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
                    <p className="text-xs font-semibold uppercase opacity-80">Score Global</p>
                    <p className="text-2xl font-black">{mag.scoreGlobal.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
                    <p className="text-xs font-semibold uppercase opacity-80">CA</p>
                    <p className="text-xl font-bold">{formatEuro(mag.ca)}</p>
                  </div>
                  <div className="bg-white/20 rounded-xl p-3 backdrop-blur">
                    <p className="text-xs font-semibold uppercase opacity-80">Panier Moyen</p>
                    <p className="text-xl font-bold">{formatEuro(mag.panierMoyen)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Tableau complet */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <h3 className="text-xl font-bold text-white mb-6">Classement Complet</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Rang</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase">Magasin</th>
                <th className="px-4 py-3 text-center text-xs font-black uppercase">Catégorie</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Score</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">CA</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">% CA</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Volume</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Panier Moyen</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase">Index Panier</th>
              </tr>
            </thead>
            <tbody>
              {magasins.map((mag, idx) => (
                <tr key={mag.mag} className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-${mag.color}-500/20 text-${mag.color}-400 font-bold text-sm`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-white">{mag.mag}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full bg-${mag.color}-500/20 border border-${mag.color}-500/30 text-${mag.color}-400 font-semibold text-xs`}>
                      {mag.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm">
                      {mag.scoreGlobal.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">{formatEuro(mag.ca)}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{mag.perfCA.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-zinc-300">{mag.volume.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-cyan-400">{formatEuro(mag.panierMoyen)}</td>
                  <td className="px-4 py-3 text-right text-sm text-zinc-400">{mag.indexPanier.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
