import { ShoppingBag, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'

interface CrossSellingAnalysisProps {
  data?: any
}

// Cache global
const crossSellingCache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function CrossSellingAnalysis({ data }: CrossSellingAnalysisProps) {
  const [channel, setChannel] = useState<'all' | 'MAGASIN' | 'WEB'>('all')
  const [crossData, setCrossData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const cacheKey = `cross_${channel}`
      
      // Vérifier le cache
      const cached = crossSellingCache[cacheKey]
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        console.log('✅ Cross-Selling: Utilisation du cache', cacheKey)
        setCrossData(cached.data)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log('🔄 Cross-Selling: Chargement depuis API', channel)
        const magasinParam = channel === 'all' ? '' : `?magasin=${channel}`
        const response = await fetch(`/api/cross-selling${magasinParam}`)
        
        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`)
        }
        
        const apiData = await response.json()
        
        // Mettre en cache
        crossSellingCache[cacheKey] = {
          data: apiData,
          timestamp: Date.now()
        }
        
        setCrossData(apiData)
      } catch (err: any) {
        console.error('❌ Erreur chargement Cross-Selling:', err)
        setError(err.message || 'Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [channel])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    )
  }

  if (error || !crossData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400">{error || 'Données non disponibles'}</p>
        </div>
      </div>
    )
  }
  
  const formatEuro = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
  const associations = crossData.associations || []

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Cross-Selling & Associations Produits</h2>
            <p className="text-zinc-400">Analyse des achats groupés par ticket</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
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
                onClick={() => setChannel('MAGASIN')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  channel === 'MAGASIN'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Magasins
              </button>
              <button
                onClick={() => setChannel('WEB')}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  channel === 'WEB'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Web
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cross-Selling Matrix */}
      <div className="glass rounded-3xl p-8 border border-zinc-800">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-pink-400" />
          <h3 className="text-xl font-bold text-white">Top Associations de Familles</h3>
          <span className="text-sm text-zinc-500">{crossData.totalTickets} tickets analysés</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {associations.slice(0, 20).map((assoc: any, idx: number) => (
            <div key={idx} className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800 hover:border-pink-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 font-bold text-xs">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-white">{assoc.families[0]}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <span className="text-pink-400">→</span>
                    <span className="text-sm font-semibold text-zinc-300">{assoc.families[1]}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-pink-400">{assoc.count}</div>
                  <div className="text-xs text-zinc-500">achats ensemble</div>
                  <div className="text-xs text-emerald-400">{formatEuro(assoc.totalCA)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
